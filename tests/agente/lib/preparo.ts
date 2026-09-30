/**
 * P28 · Preparo de cada caso: muda o que o caso pede e devolve como desfazer.
 *
 * Os dados que o roteiro escreve (horários da Edilaine, modo de teste, janela
 * de envio) são fictícios e de homologação; nada disto roda em produção. Cada
 * preparo guarda o valor que estava no parâmetro e o devolve no fim.
 */
import { gravarParametro, lerParametro, lit } from "./sql";
import type { Consulta } from "./sql";
import type { Preparo } from "./tipos";

/** Horários fictícios para o caso 14 (parametro.horarios_edilaine, texto livre). */
export const HORARIOS_FICTICIOS_DA_EDILAINE =
  "terça-feira às 10h ou quinta-feira às 15h";

export class ErroDePreCondicao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDePreCondicao";
  }
}

type Desfazer = () => Promise<void>;

async function trocarParametro(
  consulta: Consulta,
  chave: string,
  valor: unknown,
): Promise<Desfazer> {
  const antes = await lerParametro(consulta, chave);
  await gravarParametro(consulta, chave, valor);
  return async () => gravarParametro(consulta, chave, antes);
}

export interface OpcoesDePreparo {
  ambiente: "real" | "local";
}

export async function aplicarPreparo(
  consulta: Consulta,
  preparos: Preparo[],
  opcoes: OpcoesDePreparo,
): Promise<Desfazer> {
  const desfazer: Desfazer[] = [];
  for (const p of preparos) {
    switch (p.preparo) {
      case "horariosDaEdilaine":
        desfazer.push(
          await trocarParametro(
            consulta,
            "horarios_edilaine",
            HORARIOS_FICTICIOS_DA_EDILAINE,
          ),
        );
        break;
      case "agendaDeTeste": {
        // Faixas de segunda a sábado (domingo fica sem horário de propósito: é o dia que
        // os casos 17 e "nenhum horário serve" pedem). Bloco, antecedência e janela vêm do
        // padrão do seed; o que muda é só o que faz o caso não depender do dia em que roda.
        const dia = [
          ["09:00", "12:00"],
          ["14:00", "18:00"],
        ];
        desfazer.push(
          await trocarParametro(consulta, "agenda_faixas", {
            seg: dia,
            ter: dia,
            qua: dia,
            qui: dia,
            sex: dia,
            sab: [["09:00", "12:00"]],
          }),
        );
        // A falta é remarcada na hora (o padrão espera algumas horas).
        desfazer.push(
          await trocarParametro(
            consulta,
            "agenda_remarcar_apos_falta_horas",
            0,
          ),
        );
        desfazer.push(
          await trocarParametro(consulta, "agente_janela_envio", {
            inicio: "00:00",
            fim: "23:59",
          }),
        );
        break;
      }
      case "modoTesteForaDaLista":
        desfazer.push(await trocarParametro(consulta, "agente_modo", "teste"));
        break;
      case "ligarAlertaSaudeSensivel":
        desfazer.push(
          await trocarParametro(consulta, "alerta_saude_sensivel_ativo", true),
        );
        break;
      case "janelaDeEnvioAberta":
        desfazer.push(
          await trocarParametro(consulta, "agente_janela_envio", {
            inicio: "00:00",
            fim: "23:59",
          }),
        );
        break;
      case "textosAprovados": {
        const [linha] = await consulta.linhas(
          `select coalesce(jsonb_agg(chave order by chave), '[]'::jsonb) as pendentes
             from public.mensagem_modelo
            where chave in (${p.chaves.map(lit).join(", ")}) and status <> 'aprovado'`,
        );
        const pendentes = ((linha?.["pendentes"] ?? []) as string[]) ?? [];
        if (pendentes.length === 0) break;
        if (opcoes.ambiente === "real") {
          throw new ErroDePreCondicao(
            `Falta aprovar em mensagem_modelo: ${pendentes.join(", ")}. Sem aprovação, o sistema não envia o texto e a família fica sem resposta (PRD 23; aprovação do Leonardo e da Edilaine).`,
          );
        }
        // Banco local: o seed traz esses textos como rascunho. Aprova só durante o caso.
        await consulta.linhas(
          `update public.mensagem_modelo set status = 'aprovado' where chave in (${pendentes.map(lit).join(", ")}) returning chave`,
        );
        desfazer.push(async () => {
          await consulta.linhas(
            `update public.mensagem_modelo set status = 'rascunho' where chave in (${pendentes.map(lit).join(", ")}) returning chave`,
          );
        });
        break;
      }
      case "cidadeForaDaArea": {
        const [linha] = await consulta.linhas(
          `select agente.verificar_cobertura(${lit(p.cidade)}, '', ${lit(p.uf)}) as resultado`,
        );
        const status = (linha?.["resultado"] as { status?: string } | undefined)
          ?.status;
        if (status === "nao_atendida") break;
        if (opcoes.ambiente === "real") {
          throw new ErroDePreCondicao(
            `${p.cidade}/${p.uf} volta "${status ?? "sem resposta"}" em verificar_cobertura, e o caso espera "nao_atendida". ` +
              "Falta carregar a lista completa de municípios do IBGE no banco de homologação (PRD 16.3).",
          );
        }
        // Banco local: o seed traz só uma amostra dos municípios do IBGE. Acrescenta a cidade,
        // fora de qualquer região atendida, como a carga completa faria.
        await consulta.linhas(
          `insert into public.municipio (codigo_ibge, nome, uf, regiao_intermediaria)
           values (${lit(p.codigoIbge)}, ${lit(p.cidade)}, ${lit(p.uf)}, ${lit(p.cidade)})
           on conflict do nothing returning codigo_ibge`,
        );
        desfazer.push(async () => {
          await consulta.linhas(
            `delete from public.municipio where codigo_ibge = ${lit(p.codigoIbge)} returning codigo_ibge`,
          );
        });
        break;
      }
    }
  }
  return async () => {
    for (const f of desfazer.reverse()) await f();
  };
}
