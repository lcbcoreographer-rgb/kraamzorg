/**
 * P28 · O "modelo" do simulador: respostas escritas à mão, uma por turno.
 *
 * Isto NÃO prova o modelo. Prova que, quando o modelo faz o que o prompt
 * manda (escolhe a ferramenta certa e escreve dentro das regras), o resto do
 * sistema faz a sua parte: o validador deixa passar, a apresentação vai antes
 * do valor, a transferência abre com o destino e a prioridade da matriz, a
 * pausa e o modo `humano_comercial` entram, o marco fica no banco. E quando o
 * modelo erra (casos S* em `casos-so-simulador.ts`), o sistema segura.
 *
 * Cada resposta segue o prompt 4.2-rc4 por comportamento, sem copiar frase:
 * quem escreve aqui é o roteiro, nunca a Isadora de produção. Nenhum valor em
 * reais está escrito: `c.aVista(...)` e `c.parcela(...)` leem o plano do
 * banco, como o modelo lê o bloco de planos da ficha.
 *
 * A ferramenta roda de verdade: o executor local avalia os parâmetros do nó
 * gerado pelo build (`$fromAI` com a entrada abaixo) e executa a consulta no
 * banco local como o papel `n8n_agente`, ou o fluxo 2 gerado.
 */
import type { Objeto, Plano } from "../lib/tipos";

export interface ChamadaDeFerramenta {
  ferramenta: string;
  entrada: Objeto;
}

export interface ContextoDoModelo {
  planos: Plano[];
  /** O que a família escreveu neste turno. */
  mensagem: string;
  /** Retorno de cada ferramenta chamada antes do texto, na ordem. */
  observacoes: Objeto[];
  /** O último retorno de uma ferramenta, mesmo de um turno anterior (o id da opção que ela gravou, por exemplo). */
  ultimo(ferramenta: string): Objeto | undefined;
  /** As opções de horário da última lista que a agenda devolveu, com o `id_opcao` de cada uma. */
  opcoes(): { id_opcao: string; texto: string }[];
  /** As entradas de todas as chamadas anteriores de uma ferramenta, da mais antiga para a mais nova. */
  entradas(ferramenta: string): Objeto[];
  horariosDaEdilaine: string[];
  aVista(filtro: string | { dias: number; gemelar?: boolean }): string;
  parcela(filtro: string | { dias: number; gemelar?: boolean }): string;
}

/** O que uma chamada de ferramenta pode ler antes de ser montada. */
export type ContextoDeChamada = Pick<
  ContextoDoModelo,
  "mensagem" | "observacoes" | "ultimo" | "opcoes" | "entradas"
>;

/**
 * Uma chamada, ou uma função que a monta na hora com o que as anteriores
 * devolveram (é assim que o modelo escolhe o `id_opcao` que a ferramenta de
 * agenda acabou de gravar). `null` pula a chamada.
 */
export type ItemDeFerramenta =
  ChamadaDeFerramenta | ((c: ContextoDeChamada) => ChamadaDeFerramenta | null);

export interface RespostaDoAgente {
  /** Chamadas de ferramenta antes do texto. Pode depender do que a família escreveu. */
  ferramentas?:
    ItemDeFerramenta[] | ((c: ContextoDeChamada) => ItemDeFerramenta[]);
  texto: string | ((c: ContextoDoModelo) => string);
}

export interface RoteiroDoTurno {
  /** Saída do classificador de mensagem. Padrão: lead, sem saúde, sem perda. */
  classificador?: Objeto;
  /** O modelo de conversa. Ausente: se ele rodar, o teste falha (o caminho devia ser do sistema). */
  agente?: RespostaDoAgente;
  /**
   * Saída do classificador de pedido do fluxo 2. Padrão: concorda com o motivo
   * que o agente escolheu (é o que um classificador certo faz).
   */
  classificadorPedido?: Objeto;
  /** Saída da reescrita (quando o validador reprova). */
  reescrita?: Objeto;
  /**
   * Saída do gerador de follow-up. Pode variar com a conversa: o sistema recusa a mesma
   * mensagem proativa para duas famílias no mesmo dia, então repetir o teste no mesmo dia
   * pede um texto que não se repete.
   */
  followup?:
    | Objeto
    | ((c: {
        digitos: string;
        /** O texto aprovado que o sistema entregou ao gerador (`{{texto_base}}`), com os dados da agenda já no lugar. */
        textoBase: string;
      }) => Objeto);
}

export const CLASSIFICACAO_PADRAO: Objeto = {
  tipo_contato: "lead",
  saude: "nenhum",
  perda: false,
  perda_temporalidade: "nenhuma",
  internacao: false,
  saude_mental: false,
  porque: "roteiro de homologação",
};

export const SAUDACAO =
  "Oi, boa tarde! Que bom receber a sua mensagem. Eu sou a Isadora, assistente virtual da Kraamzorg Brasil, e vou te acompanhar por aqui 🤍\n\nPra começar, como posso te chamar?";

export function transferir(
  motivo: string,
  resumo: string,
  solicitacao: string,
  dados: Objeto = {},
): ChamadaDeFerramenta {
  return {
    ferramenta: "transferir_para_equipe",
    entrada: { motivo, resumo, solicitacao, dados },
  };
}

export function ficha(dados: Objeto): ChamadaDeFerramenta {
  return { ferramenta: "atualizar_ficha", entrada: { dados } };
}

export const ROTEIROS_BASE: Record<string, Record<number, RoteiroDoTurno>> = {
  C01: { 1: { agente: { texto: SAUDACAO } } },

  C02: {
    1: {
      agente: {
        texto: (c) =>
          [
            "Claro, vou te mandar a apresentação com todos os formatos, e já te conto os valores por aqui.",
            "[ENVIAR_APRESENTACAO]",
            `O Essencial fica em ${c.aVista("Essencial")}, ou ${c.parcela("Essencial")}. O Imersão é ${c.aVista("Imersão")}, ou ${c.parcela("Imersão")}. O Continuado é ${c.aVista("Continuado")}, ou ${c.parcela("Continuado")}.`,
            "De quantas semanas você está?",
          ].join("\n\n"),
      },
    },
  },

  C03: {
    1: {
      agente: {
        ferramentas: [ficha({ plano_interesse: "Continuado" })],
        texto: (c) =>
          [
            "Que bom que você quer conhecer o Continuado, são 12 dias de acompanhamento. Vou te mandar a apresentação para você ver com calma.",
            "[ENVIAR_APRESENTACAO]",
            `O Continuado é ${c.aVista({ dias: 12 })}, ou ${c.parcela({ dias: 12 })}.`,
          ].join("\n\n"),
      },
    },
  },

  C07: {
    1: {
      agente: {
        ferramentas: [
          {
            ferramenta: "verificar_cobertura",
            entrada: { cidade: "Curitiba", bairro: "", uf: "PR" },
          },
        ],
        texto:
          "Por enquanto a Kraamzorg atende nas regiões de São Paulo e de Londrina. Se o pós-parto for em uma dessas regiões, me avisa que eu verifico com carinho para você.",
      },
    },
  },

  C08: {
    1: {
      agente: {
        ferramentas: [
          ficha({ semanas: "14" }),
          { ferramenta: "registrar_retorno", entrada: { quando: "28" } },
        ],
        texto: [
          "Parabéns pela gestação! Que bom começar a pensar nesses primeiros dias com tempo.",
          "O período mais indicado para reservar fica entre 28 e 36 semanas. Vou te mandar a apresentação para você já conhecer os formatos.",
          "[ENVIAR_APRESENTACAO]",
          "Combinado de eu te chamar de novo quando você estiver com 28 semanas?",
        ].join("\n\n"),
      },
    },
  },

  C09: {
    1: {
      agente: {
        ferramentas: [ficha({ gemelar: true })],
        texto: (c) =>
          [
            "Que alegria, gêmeos! Para essa gestação existem planos pensados para duas crianças. Vou te mandar a apresentação.",
            "[ENVIAR_APRESENTACAO]",
            `O Gemelar Essencial é ${c.aVista("Gemelar Essencial")}, ou ${c.parcela("Gemelar Essencial")}. O Gemelar Continuado é ${c.aVista("Gemelar Continuado")}, ou ${c.parcela("Gemelar Continuado")}.`,
            "De quantas semanas vocês estão?",
          ].join("\n\n"),
      },
    },
  },

  C10: {
    1: {
      agente: {
        ferramentas: [ficha({ rede_apoio: "mãe" })],
        texto: [
          "Que bom ter a sua mãe por perto, a ajuda dela faz muita diferença nesses dias. O nosso cuidado soma com o dela: a enfermeira orienta você e cuida do bebê com técnica, e a sua mãe fica mais tranquila para apoiar do jeito dela.",
          "Você já sabe de quantas semanas está?",
        ].join("\n\n"),
      },
    },
  },

  C11: {
    1: {
      agente: {
        texto:
          "Vou te explicar direitinho. O cuidado da Kraamzorg acontece durante o dia, com enfermeiras especializadas, e não inclui acompanhamento noturno. Nas visitas, a enfermeira orienta a família para se organizar nas noites.",
      },
    },
  },

  C20: {
    1: {
      agente: {
        texto:
          "Obrigada. Por segurança, não precisa mandar documentos por aqui, e você pode apagar essa mensagem se quiser. Quando chegar a hora do contrato, o Leonardo te envia um formulário seguro.",
      },
    },
  },

  C21: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "duvida_sem_resposta",
            "Perguntou se há vaga garantida para o Natal.",
            "Vocês garantem vaga para o Natal?",
          ),
        ],
        texto:
          "A reserva da Kraamzorg é feita pela data prevista do parto, a DPP, e a equipe confirma a disponibilidade para o período. Essa parte eu vou confirmar com a equipe para te responder certinho, tá?",
      },
    },
  },

  C22: {
    1: {
      agente: {
        texto:
          "Emitimos nota fiscal, sim. Ela descreve o serviço como cuidado domiciliar pós-parto. O reembolso depende das regras do seu plano de saúde, então vale consultar com eles.",
      },
    },
  },

  C23: {
    1: {
      agente: {
        texto:
          "Eu sou a Isadora, a assistente virtual da Kraamzorg Brasil. Se você preferir conversar com uma pessoa, posso pedir para a Edilaine ou o Leonardo falarem com você por aqui.",
      },
    },
  },

  C24: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "bebe_nasceu",
            "Contou que o bebê nasceu há 2 dias.",
            "Meu bebê nasceu há 2 dias.",
          ),
        ],
        texto:
          "Que alegria, parabéns pela chegada do bebê! 👶 Como o nosso cuidado acontece justamente nos primeiros dias depois da alta, já avisei a equipe para ver a possibilidade para vocês. Vocês já estão em casa?",
      },
    },
  },

  C28: {
    1: {
      agente: {
        ferramentas: [ficha({ sem_interesse: true })],
        texto:
          "Tudo bem, obrigada por ter conversado comigo. Se um dia fizer sentido, a Kraamzorg vai estar por aqui, com carinho.",
      },
    },
  },

  X02: {
    1: {
      classificador: {
        ...CLASSIFICACAO_PADRAO,
        perda: true,
        perda_temporalidade: "anterior",
        porque: "perda de gestação anterior",
      },
    },
  },

  X03: { 1: { agente: { texto: SAUDACAO } } },

  X04: {
    1: {
      classificador: {
        ...CLASSIFICACAO_PADRAO,
        saude: "urgencia",
        porque: "sinal de infecção no coto",
      },
    },
  },

  X06: {
    1: {
      classificador: {
        ...CLASSIFICACAO_PADRAO,
        tipo_contato: "candidata",
        porque: "profissional procurando trabalho",
      },
    },
  },

  X08: { 1: { agente: { texto: SAUDACAO } } },

  X07: {
    1: {
      agente: {
        texto:
          "Claro! No acompanhamento, uma enfermeira especializada visita vocês nos primeiros dias depois da alta e orienta a família em tudo o que for preciso. Você já sabe de quantas semanas está?",
      },
    },
  },

  V03: {
    1: {
      agente: {
        texto:
          "Obrigada por mandar. Sobre a sua pergunta, vou pedir para alguém da equipe olhar com calma e te responder por aqui.",
      },
    },
  },

  V09: { 1: { agente: { texto: SAUDACAO } } },

  X10: {
    1: {
      agente: {
        ferramentas: [
          ficha({ quer_contratar: true }),
          {
            ferramenta: "anotar_para_leonardo",
            entrada: {
              anotacao: "Disse que a conversa foi ótima e quer contratar",
            },
          },
        ],
        texto:
          "Que alegria! Fico muito feliz com a decisão de vocês 🤍 O próximo passo é uma reunião online de 30 minutos com a Edilaine, sem compromisso. O Leonardo cuida do contrato e do pagamento depois da reunião com a Edilaine, e já deixei anotado que vocês querem seguir. Posso ver os horários da Edilaine para vocês?",
      },
    },
  },
};
