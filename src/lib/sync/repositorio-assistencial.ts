import { z } from "zod";
import {
  avaliarAlertasDoRegistro,
  catalogoDasLinhas,
} from "@/lib/checklist/registro";
import { valorObservadoEmTexto } from "@/lib/checklist/formato";
import { lerAdendoDoPayload } from "./protocolo";
import type { EstadoEntidade, RepositorioSincronizacao } from "./repositorio";
import type {
  Entidade,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";
import type {
  AlertaParaRegistro,
  AssistencialRepositorio,
  RegistroParaEnvio,
} from "@/lib/dados/tipos-assistencial";

/**
 * Gravação da sincronização no banco para o registro assistencial e o
 * alerta clínico (P39 e P40), por cima do repositório do schema api
 * (`AssistencialRepositorio`): o mesmo código serve ao Supabase e à
 * demonstração. As outras entidades da fila (visita, consulta pré-natal,
 * áudio) ainda não têm gravação no banco; ficam com o repositório de
 * `outros`, se houver (a demonstração usa o de memória do P12).
 *
 * - Registro assinado: a assinatura e os obrigatórios são conferidos no
 *   banco (`api.registrar_atendimento`). Antes, o servidor reavalia os
 *   alertas com o mesmo motor do aparelho (`src/lib/regras-alerta`) sobre
 *   as regras de `regra_alerta` e entrega o resultado junto, na mesma
 *   transação (PRD 9.3: "na sincronização, o servidor reavalia").
 * - Registro já gravado com conteúdo igual: reenvio, sem efeito. Com
 *   conteúdo diferente: adendo, nunca sobrescrita (D-05).
 * - Alerta criado no aparelho: `api.registrar_alerta_clinico`, idempotente
 *   por regra, visita e bebê.
 */

export const MOTIVO_DIVERGENCIA =
  "Registro reenviado com conteúdo diferente do assinado";

const registroSchema = z.object({
  visitaId: z.uuid(),
  profissionalId: z.uuid(),
  instrumentoVersao: z.string().min(1),
  dados: z.record(z.string(), z.unknown()),
  resumoDescritivo: z.string(),
  assinadoEmMs: z.number().int().positive(),
  assinatura: z.string().regex(/^[0-9a-f]{64}$/),
});

const novoAlertaSchema = z.object({
  visitaId: z.uuid(),
  regraId: z.string().min(1),
  instrumentoVersao: z.string().min(1),
  bebeId: z.uuid().nullable(),
  campo: z.string().nullable(),
  valorObservado: z.string().nullable(),
  manual: z.boolean(),
});

/** Campos de `alerta_clinico` que a fila atualiza (os quatro do DOC 3). */
const CAMPOS_DO_ACIONAMENTO = {
  sinal_identificado: "sinalIdentificado",
  acionado_em: "acionadoEm",
  orientacao_medica: "orientacaoMedica",
  conduta_adotada: "condutaAdotada",
} as const;

const ENTIDADES_DO_BANCO: readonly Entidade[] = [
  "registro_atendimento",
  "alerta_clinico",
];

/** Payload da fila reconstruído do registro gravado, para comparar com o reenvio. */
function payloadDoRegistro(
  visitaId: string,
  registro: NonNullable<
    Awaited<ReturnType<AssistencialRepositorio["obterChecklist"]>>
  >["registro"],
): RegistroParaEnvio | null {
  if (!registro) return null;
  return {
    visitaId,
    profissionalId: registro.profissionalId,
    instrumentoVersao: registro.instrumentoVersao,
    dados: registro.dados,
    resumoDescritivo: registro.resumoDescritivo,
    assinadoEmMs: Date.parse(registro.assinadoEm),
    assinatura: registro.assinatura,
  };
}

/**
 * Resultados já devolvidos, por id de item (idempotência do que o banco não
 * guarda). Do processo, não da requisição: cada requisição monta o seu
 * repositório, mas o reenvio do mesmo item chega em outra requisição. No
 * banco, cada gravação também é idempotente por si (registro igual, alerta
 * da mesma regra e adendo igual não duplicam).
 */
const PROCESSADOS_DO_PROCESSO = new Map<string, ResultadoItemSincronizacao>();

export class RepositorioSincronizacaoAssistencial implements RepositorioSincronizacao {
  constructor(
    private readonly assistencial: AssistencialRepositorio,
    private readonly outros: RepositorioSincronizacao | null = null,
    private readonly processados: Map<
      string,
      ResultadoItemSincronizacao
    > = PROCESSADOS_DO_PROCESSO,
  ) {}

  private doBanco(entidade: Entidade): boolean {
    return ENTIDADES_DO_BANCO.includes(entidade);
  }

  private exigirOutros(entidade: string): RepositorioSincronizacao {
    if (!this.outros) {
      throw new Error(
        `sincronização: ${entidade} ainda não tem gravação no banco`,
      );
    }
    return this.outros;
  }

  async buscarResultadoProcessado(
    id: string,
  ): Promise<ResultadoItemSincronizacao | null> {
    return (
      this.processados.get(id) ??
      (await this.outros?.buscarResultadoProcessado(id)) ??
      null
    );
  }

  async buscarEstado(
    entidade: Entidade,
    entidadeId: string,
  ): Promise<EstadoEntidade | null> {
    if (entidade === "registro_atendimento") {
      const checklist = await this.assistencial.obterChecklist(entidadeId);
      const payload = checklist
        ? payloadDoRegistro(entidadeId, checklist.registro)
        : null;
      return payload ? { entidadeId, versao: null, dados: payload } : null;
    }
    if (entidade === "alerta_clinico") {
      const alertas = await this.assistencial.listarAlertas("todos");
      const alerta = alertas.find((a) => a.id === entidadeId);
      return alerta
        ? { entidadeId, versao: alerta.versao, dados: alerta }
        : null;
    }
    return this.exigirOutros(entidade).buscarEstado(entidade, entidadeId);
  }

  async aplicar(
    item: ItemSincronizacaoEntrada,
  ): Promise<{ versaoResultante: number | null; entidadeId: string }> {
    if (item.entidade === "registro_atendimento") {
      const registro = registroSchema.parse(item.payload);
      const alertas = await this.reavaliarAlertas(registro);
      await this.assistencial.registrarAtendimento(registro, alertas);
      return { versaoResultante: null, entidadeId: registro.visitaId };
    }

    if (item.entidade === "alerta_clinico") {
      if (item.entidadeId === null) {
        const pedido = novoAlertaSchema.parse(item.payload);
        const { id } = await this.assistencial.registrarAlerta(pedido);
        return { versaoResultante: 1, entidadeId: id };
      }
      const campo = item.campo as keyof typeof CAMPOS_DO_ACIONAMENTO | null;
      const destino = campo ? CAMPOS_DO_ACIONAMENTO[campo] : undefined;
      if (!destino) {
        throw new Error(
          `sincronização: o campo ${item.campo ?? "(inteiro)"} do alerta clínico não se atualiza pela fila`,
        );
      }
      const valor = z.string().parse(item.payload);
      await this.assistencial.registrarAcionamento({
        alertaId: item.entidadeId,
        versaoBase: item.versaoBase,
        [destino]: valor,
      });
      return {
        versaoResultante: (item.versaoBase ?? 0) + 1,
        entidadeId: item.entidadeId,
      };
    }

    return this.exigirOutros(item.entidade).aplicar(item);
  }

  async registrarAdendo(item: ItemSincronizacaoEntrada): Promise<void> {
    if (item.entidade !== "registro_atendimento") {
      return this.exigirOutros(item.entidade).registrarAdendo(item);
    }
    if (item.entidadeId === null) {
      throw new Error("adendo: falta o visita_id");
    }
    const checklist = await this.assistencial.obterChecklist(item.entidadeId);
    const registro = checklist?.registro;
    if (!registro) {
      throw new Error("adendo: o registro desta visita ainda não existe");
    }
    const pedido = lerAdendoDoPayload(item.payload);
    if (pedido) {
      await this.assistencial.registrarAdendo(
        registro.id,
        pedido.motivo,
        pedido.conteudo,
      );
      return;
    }
    // Divergência entre dois envios do mesmo registro (D-05): o conteúdo
    // que chegou depois fica guardado inteiro no adendo, nada se perde.
    const divergente = registroSchema.safeParse(item.payload);
    const conteudo = divergente.success
      ? `Assinatura enviada depois: ${divergente.data.assinatura}\n${JSON.stringify(
          {
            resumo_descritivo: divergente.data.resumoDescritivo,
            dados: divergente.data.dados,
          },
        )}`
      : JSON.stringify(item.payload);
    await this.assistencial.registrarAdendo(
      registro.id,
      MOTIVO_DIVERGENCIA,
      conteudo,
    );
  }

  async marcarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void> {
    if (this.doBanco(item.entidade)) {
      this.processados.set(item.id, resultado);
      return;
    }
    return this.exigirOutros(item.entidade).marcarProcessado(item, resultado);
  }

  async registrarAuditoria(entrada: {
    usuarioId: string;
    acao: string;
    entidade: string;
    entidadeId: string | null;
    valorAntes: unknown;
    valorDepois: unknown;
  }): Promise<void> {
    // As gravações do banco já são auditadas por gatilho (PRD 5.2).
    if (ENTIDADES_DO_BANCO.includes(entrada.entidade as Entidade)) return;
    return this.outros?.registrarAuditoria(entrada);
  }

  /**
   * O servidor reavalia os alertas do registro com o mesmo motor do
   * aparelho e as regras de `regra_alerta` (PRD 9.3). O aparelho já mandou o
   * que viu na hora do campo; o que ele não viu (offline sem cache, regra
   * nova) entra aqui.
   */
  private async reavaliarAlertas(
    registro: RegistroParaEnvio,
  ): Promise<AlertaParaRegistro[]> {
    const checklist = await this.assistencial.obterChecklist(registro.visitaId);
    if (!checklist) {
      throw new Error("visita não encontrada para este usuário");
    }
    const { catalogo } = catalogoDasLinhas(checklist.regras);
    const avaliados = avaliarAlertasDoRegistro(registro.dados, {
      catalogo,
      bebes: checklist.bebes,
      anteriores: checklist.anteriores,
      dataVisita: checklist.visita.data,
    });
    return avaliados.map((a) => ({
      regraId: a.regraId,
      bebeId: a.bebeId,
      campo: a.campo,
      valorObservado: valorObservadoEmTexto(a.valorObservado),
    }));
  }
}
