import {
  camposOcultosComValor,
  chaveEndereco,
  comValor,
  type BebeFormulario,
  type EnderecoCampo,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import { valorObservadoEmTexto } from "./formato";
import type { AlertaAvaliado } from "./registro";
import { chaveAlerta, type AcionamentoAlerta } from "./registro";
import type { AlertaDisparado, RascunhoChecklist } from "./rascunho";
import type { SinalDoSeletor } from "./alertas";

/**
 * Transformações puras do rascunho do checklist: a tela chama estas
 * funções, grava o resultado no aparelho e reage ao que mudou. Sem I/O,
 * para o comportamento (nada de outro dia sem confirmação, alerta que
 * fica, hora do acionamento) ser testado sem tela.
 */

export interface ContextoDoRascunho {
  definicao: DefinicaoInstrumento;
  bebes: BebeFormulario[];
  ultimoDia: boolean;
}

function agora(): string {
  return new Date().toISOString();
}

/**
 * Grava (ou apaga, com `null`) a resposta de um campo. A resposta que
 * deixou de se aplicar (condição para aparecer) é apagada junto, como no
 * gerador de formulário (P34), e o texto trazido de outro dia para esse
 * campo deixa de esperar confirmação quando a enfermeira responde.
 */
export function aplicarResposta(
  rascunho: RascunhoChecklist,
  contexto: ContextoDoRascunho,
  endereco: EnderecoCampo,
  valor: ValorCampo | null,
): RascunhoChecklist {
  let respostas = comValor(rascunho.respostas, endereco, valor);
  const ocultos = camposOcultosComValor(contexto.definicao, respostas, {
    bebes: contexto.bebes,
    contexto: { ultimo_dia: contexto.ultimoDia },
  });
  for (const oculto of ocultos) respostas = comValor(respostas, oculto, null);

  let trazidos = rascunho.trazidos;
  const chave = chaveEndereco(endereco);
  if (valor !== null && chave in trazidos) {
    const { [chave]: _respondido, ...resto } = trazidos;
    void _respondido;
    trazidos = resto;
  }
  return { ...rascunho, respostas, trazidos, atualizadoEm: agora() };
}

/** Alertas que ainda não estavam no rascunho, prontos para entrar na fila. */
export function novosDisparos(
  rascunho: RascunhoChecklist,
  avaliados: AlertaAvaliado[],
): AlertaDisparado[] {
  const jaTem = new Set(
    rascunho.disparados.map((d) => chaveAlerta(d.regraId, d.bebeId)),
  );
  const vistos = new Set<string>();
  const novos: AlertaDisparado[] = [];
  for (const alerta of avaliados) {
    const chave = chaveAlerta(alerta.regraId, alerta.bebeId);
    if (jaTem.has(chave) || vistos.has(chave)) continue;
    vistos.add(chave);
    novos.push({
      regraId: alerta.regraId,
      bebeId: alerta.bebeId,
      campo: alerta.campo,
      valorObservado: valorObservadoEmTexto(alerta.valorObservado),
      manual: false,
      enfileirado: false,
    });
  }
  return novos;
}

export function comDisparos(
  rascunho: RascunhoChecklist,
  novos: AlertaDisparado[],
): RascunhoChecklist {
  if (novos.length === 0) return rascunho;
  return {
    ...rascunho,
    disparados: [...rascunho.disparados, ...novos],
    atualizadoEm: agora(),
  };
}

/** Marca como já enviados à fila os alertas dados. */
export function marcarEnfileirados(
  rascunho: RascunhoChecklist,
  chaves: string[],
): RascunhoChecklist {
  const alvo = new Set(chaves);
  return {
    ...rascunho,
    disparados: rascunho.disparados.map((d) =>
      alvo.has(chaveAlerta(d.regraId, d.bebeId))
        ? { ...d, enfileirado: true }
        : d,
    ),
  };
}

/** Sinal escolhido no seletor do DOC 3 (K-07): entra como alerta manual. */
export function comSinalManual(
  rascunho: RascunhoChecklist,
  sinal: SinalDoSeletor,
  bebeId: string | null,
  observacao: string | null,
): { rascunho: RascunhoChecklist; disparo: AlertaDisparado | null } {
  const chave = chaveAlerta(sinal.regraId, bebeId);
  if (
    rascunho.disparados.some((d) => chaveAlerta(d.regraId, d.bebeId) === chave)
  ) {
    return { rascunho, disparo: null };
  }
  const disparo: AlertaDisparado = {
    regraId: sinal.regraId,
    bebeId,
    campo: null,
    valorObservado: observacao?.trim() ? observacao.trim() : null,
    manual: true,
    enfileirado: false,
  };
  return { rascunho: comDisparos(rascunho, [disparo]), disparo };
}

/** Grava os quatro campos do DOC 3 de um alerta (substitui o anterior). */
export function comAcionamento(
  rascunho: RascunhoChecklist,
  acionamento: AcionamentoAlerta,
): RascunhoChecklist {
  const chave = chaveAlerta(acionamento.regraId, acionamento.bebeId);
  const outros = rascunho.acionamentos.filter(
    (a) => chaveAlerta(a.regraId, a.bebeId) !== chave,
  );
  return {
    ...rascunho,
    acionamentos: [...outros, acionamento],
    atualizadoEm: agora(),
  };
}

export function acionamentoDoAlerta(
  rascunho: RascunhoChecklist,
  regraId: string,
  bebeId: string | null,
): AcionamentoAlerta | undefined {
  const chave = chaveAlerta(regraId, bebeId);
  return rascunho.acionamentos.find(
    (a) => chaveAlerta(a.regraId, a.bebeId) === chave,
  );
}
