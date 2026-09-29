/**
 * P28 · Casos que só o simulador consegue montar: eles forçam o modelo a
 * errar ou uma peça da infraestrutura a falhar, coisa que o ambiente real não
 * faz sob encomenda. Cobrem os casos extras do PRD (Apêndice C) que dizem
 * "forçado a falhar", "resposta com valor fora da tabela", "[SILENCIO] no meio
 * do texto" e "valor de outro plano no mesmo bloco".
 *
 * No ambiente real o mesmo comportamento é vigiado pelas regras universais
 * (`U01` a `U12`) em todos os casos: se o validador deixasse passar um valor
 * fora da tabela ou uma promessa, o caso que provocou reprovaria.
 */
import {
  apenasOTextoFixoNoTurno,
  avisoAoGrupo,
  contem,
  enviouApresentacao,
  modeloNaoRodou,
  naoContem,
  respondeNoTurno,
  semNenhumValor,
  silencioNoTurno,
  prioridadeMaximaAberta,
  freioEm,
  textoFixoNoTurno,
  transferePara,
} from "../lib/regras";
import type { Caso } from "../lib/tipos";
import type { OpcoesDeCaso } from "./execucao-local";
import type { RoteiroDoTurno } from "./modelo-roteirizado";
import { CLASSIFICACAO_PADRAO } from "./modelo-roteirizado";

export interface CasoSoSimulador {
  caso: Caso;
  opcoes: OpcoesDeCaso;
}

function caso(
  base: Omit<Caso, "grupo" | "ambientes" | "rotulo"> & { rotulo?: string },
): Caso {
  return {
    grupo: "extra_v42",
    ambientes: ["local"],
    rotulo: base.rotulo ?? base.id,
    ...base,
  };
}

function agente(
  texto: string,
  extra: Partial<RoteiroDoTurno> = {},
): Record<number, RoteiroDoTurno> {
  return { 1: { agente: { texto }, ...extra } };
}

export const CASOS_SO_SIMULADOR: CasoSoSimulador[] = [
  {
    caso: caso({
      id: "S01",
      rotulo: "valor fora da tabela",
      titulo:
        "O modelo escreve um valor que não é da tabela: o validador segura e a reescrita sai no lugar",
      turnos: [{ tipo: "texto", texto: "Quanto custa o plano mais curto?" }],
      regras: [
        respondeNoTurno(1, "sistema"),
        enviouApresentacao(1, "sistema"),
        naoContem(
          "S01-valor-errado-nao-sai",
          "O valor errado escrito pelo modelo não chega à família.",
          1,
          [/3\.900/, /3900/],
          "bloqueante",
        ),
      ],
    }),
    opcoes: {
      roteiros: agente(
        "Claro! O plano mais curto fica em R$ 3.900, com 6 dias de acompanhamento.",
        {
          reescrita: {
            texto:
              "Vou te mandar a apresentação com os formatos e os valores certinhos.\n\n[ENVIAR_APRESENTACAO]",
            transferir: null,
          },
        },
      ),
    },
  },
  {
    caso: caso({
      id: "S02",
      rotulo: "valor de outro plano no bloco",
      titulo:
        "O Continuado com o valor do Essencial no mesmo bloco: reprovado, e sem reescrita boa a família recebe o texto de confirmar",
      turnos: [{ tipo: "texto", texto: "Me conta do plano de 12 dias." }],
      regras: [
        textoFixoNoTurno(1, "fallback_confirmar"),
        transferePara({
          turno: 1,
          motivos: ["validacao_resposta"],
          destino: "comercial",
          prioridade: "alta",
          origem: "sistema",
        }),
        semNenhumValor(1, "sistema"),
      ],
    }),
    opcoes: {
      roteiros: agente(
        "O Continuado cuida de vocês por 12 dias. O investimento é R$ 4.200.",
        {
          reescrita: {
            texto:
              "O Continuado cuida de vocês por 12 dias. O investimento é R$ 4.200.",
            transferir: null,
          },
        },
      ),
    },
  },
  {
    caso: caso({
      id: "S03",
      rotulo: "travessão e mamãe",
      titulo:
        "Travessão e a palavra mamãe na saída do modelo: nada disso chega à família",
      turnos: [{ tipo: "texto", texto: "Oi, tudo bem?" }],
      regras: [
        respondeNoTurno(1, "sistema"),
        contem(
          "S03-reescrita-saiu",
          "Sai a reescrita, sem a palavra proibida.",
          1,
          [[/kraamzorg/, /isadora/, /oi/]],
          "bloqueante",
        ),
      ],
    }),
    opcoes: {
      roteiros: agente(
        "Oi, mamãe \u2014 tudo bem? Que bom receber a sua mensagem.",
        {
          reescrita: {
            texto:
              "Oi! Que bom receber a sua mensagem. Eu sou a Isadora, da Kraamzorg Brasil. Como posso te chamar?",
            transferir: null,
          },
        },
      ),
    },
  },
  {
    caso: caso({
      id: "S04",
      rotulo: "[SILENCIO] no meio",
      titulo: "Texto junto com [SILENCIO] no meio da resposta: nada sai",
      turnos: [{ tipo: "texto", texto: "Oi, tudo bem?" }],
      regras: [silencioNoTurno(1, "sistema")],
    }),
    opcoes: {
      roteiros: agente(
        "Claro, fique tranquila. [SILENCIO] Qualquer coisa me chama.",
      ),
    },
  },
  {
    caso: caso({
      id: "S05",
      rotulo: "contrato e sangramento, filtro e classificador fora do ar",
      titulo:
        'Filtro de termos e classificador falhando, "Queria saber do contrato, e desde ontem estou com um sangramento": o sistema sobe para saúde pela transferência',
      turnos: [
        {
          tipo: "texto",
          texto:
            "Queria saber do contrato, e desde ontem estou com um sangramento.",
        },
      ],
      regras: [
        textoFixoNoTurno(1, "alerta_saude"),
        transferePara({
          turno: 1,
          motivos: ["saude"],
          destino: "coordenacao_clinica",
          prioridade: "maxima",
          origem: "sistema",
        }),
        avisoAoGrupo(1, { chave: "grupo_saude" }),
        naoContem(
          "S05-saida-do-modelo-descartada",
          "A fala do modelo sobre o contrato não chega à família.",
          1,
          [/leonardo segue/],
          "bloqueante",
        ),
      ],
    }),
    opcoes: {
      falhas: ["checar_termos_alerta", "openai_classificacao"],
      roteiros: {
        1: {
          agente: {
            ferramentas: [
              {
                ferramenta: "transferir_para_equipe",
                entrada: {
                  motivo: "contratar",
                  resumo: "Quer saber do contrato.",
                  solicitacao: "Queria saber do contrato.",
                  dados: {},
                },
              },
            ],
            texto: "O Leonardo segue com vocês daqui.",
          },
          classificadorPedido: {
            tipo: "saude",
            porque: "relato de sangramento na mesma mensagem do pedido",
          },
        },
      },
    },
  },
  {
    caso: caso({
      id: "S06",
      rotulo: "áudio de sangramento, gravar a transcrição falha",
      titulo:
        "Áudio de sangramento com `registrar_transcricao` falhando: o alerta sai do mesmo jeito",
      turnos: [
        {
          tipo: "audio",
          transcricao: "Estou com muito sangramento desde a madrugada.",
        },
      ],
      regras: [
        textoFixoNoTurno(1, "alerta_saude"),
        transferePara({
          turno: 1,
          motivos: ["saude"],
          destino: "coordenacao_clinica",
          prioridade: "maxima",
          origem: "sistema",
        }),
        avisoAoGrupo(1, { chave: "grupo_saude" }),
        modeloNaoRodou(1),
      ],
    }),
    opcoes: { falhas: ["registrar_transcricao"] },
  },
  {
    caso: caso({
      id: "S07",
      rotulo: "modelo de conversa fora do ar",
      titulo:
        "OpenAI fora do ar: nada vai para a família, a equipe recebe a transferência com prioridade alta",
      turnos: [
        { tipo: "texto", texto: "Oi, queria saber mais sobre o pós-parto." },
      ],
      regras: [
        silencioNoTurno(1, "sistema"),
        transferePara({
          turno: 1,
          motivos: ["outro"],
          destino: "comercial",
          prioridade: "alta",
          origem: "sistema",
        }),
      ],
    }),
    opcoes: { falhas: ["agente"], roteiros: { 1: {} } },
  },
  {
    caso: caso({
      id: "S08",
      rotulo: "Redis fora do ar",
      titulo: "Redis fora do ar: segue sem agrupar e responde",
      turnos: [{ tipo: "texto", texto: "Oi, boa tarde!" }],
      regras: [respondeNoTurno(1, "sistema")],
    }),
    opcoes: {
      falhas: ["redis"],
      roteiros: agente(
        "Oi, boa tarde! Que bom receber a sua mensagem. Eu sou a Isadora, da Kraamzorg Brasil. Como posso te chamar?",
      ),
    },
  },
  {
    caso: caso({
      id: "S09",
      rotulo: "classificador cala o alerta de termo",
      titulo:
        'Classificador devolvendo "nenhum" para "sangramento": o filtro de termos prevalece',
      turnos: [{ tipo: "texto", texto: "Estou com sangramento." }],
      regras: [
        apenasOTextoFixoNoTurno(1, "alerta_saude"),
        transferePara({
          turno: 1,
          motivos: ["saude"],
          destino: "coordenacao_clinica",
          prioridade: "maxima",
          origem: "sistema",
        }),
        modeloNaoRodou(1),
      ],
    }),
    opcoes: {
      roteiros: {
        1: { classificador: { ...CLASSIFICACAO_PADRAO, saude: "nenhum" } },
      },
    },
  },
  {
    caso: caso({
      id: "S10",
      rotulo: "texto sensível aprovado",
      titulo:
        'Com `alerta_saude_sensivel_ativo` ligado e o texto aprovado, a família em bloqueio total recebe o "alerta_saude_sensivel"',
      preparo: [
        { preparo: "ligarAlertaSaudeSensivel" },
        { preparo: "textosAprovados", chaves: ["alerta_saude_sensivel"] },
      ],
      turnos: [
        { tipo: "texto", texto: "Perdi o bebê ontem." },
        { tipo: "texto", texto: "Estou com febre alta e sangrando muito." },
      ],
      regras: [
        freioEm(1, "bloqueio_total"),
        textoFixoNoTurno(2, "alerta_saude_sensivel"),
        prioridadeMaximaAberta(2),
      ],
    }),
    opcoes: {},
  },
  {
    caso: caso({
      id: "S11",
      rotulo: "[SILENCIO] depois de acionar_equipe_saude",
      titulo:
        "O modelo aciona a equipe de saúde e ainda escreve um conselho antes do [SILENCIO]: só o texto aprovado sai",
      turnos: [
        { tipo: "texto", texto: "Estou com uma tontura estranha desde cedo." },
      ],
      regras: [
        apenasOTextoFixoNoTurno(1, "alerta_saude"),
        transferePara({
          turno: 1,
          motivos: ["saude"],
          destino: "coordenacao_clinica",
          prioridade: "maxima",
          origem: "sistema",
        }),
        avisoAoGrupo(1, { chave: "grupo_saude" }),
      ],
    }),
    opcoes: {
      roteiros: {
        1: {
          agente: {
            ferramentas: [
              {
                ferramenta: "acionar_equipe_saude",
                entrada: {
                  tipo: "saude",
                  resumo: "Contou uma tontura estranha desde cedo.",
                },
              },
            ],
            texto: "Tente se deitar e beber água. [SILENCIO]",
          },
        },
      },
    },
  },
];
