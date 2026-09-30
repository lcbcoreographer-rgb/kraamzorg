/**
 * P28 · O "modelo" do simulador para os casos da agenda (P25b, PRD 11.14,
 * Apêndice C casos 4 a 6, 12 a 19, 26, 27 e os extras [v4.3]).
 *
 * Como em `modelo-roteirizado.ts`, isto NÃO prova o modelo. Prova que, quando
 * o modelo faz o que o prompt manda (consulta a agenda antes de falar de
 * horário, confere a opção escolhida, pede o e-mail só depois, cria o evento e
 * só então confirma), o resto do sistema faz a sua parte: as ferramentas de
 * agenda rodam de verdade no fluxo 4 gerado, sobre o banco local e o
 * calendário de teste, e o validador deixa passar só o que elas devolveram.
 *
 * O roteiro "lê" o retorno das ferramentas como o modelo lê: se a agenda
 * disse `ocupado`, ele oferece as duas opções novas; se disse `indisponivel`,
 * diz que vai conferir com a equipe. Assim o mesmo turno serve ao caminho
 * feliz e ao caminho com falha.
 *
 * Nomes e e-mails são fictícios (Carla, Renata, Beatriz, example.com).
 */
import { EMAIL_DA_CARLA } from "../lib/agenda";
import { ficha } from "./modelo-roteirizado";
import type {
  ChamadaDeFerramenta,
  ContextoDeChamada,
  ContextoDoModelo,
  ItemDeFerramenta,
  RoteiroDoTurno,
} from "./modelo-roteirizado";

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------

export function sugerir(preferencia = ""): ChamadaDeFerramenta {
  return {
    ferramenta: "consultar_horarios_edilaine",
    entrada: { modo: "sugerir", preferencia, id_opcao: "" },
  };
}

/** Confere a opção que a família escolheu (1 ou 2) da última lista que a agenda devolveu. */
export function conferir(escolha: 1 | 2): ItemDeFerramenta {
  return (c) => {
    const opcao = c.opcoes()[escolha - 1];
    if (!opcao)
      throw new Error(`o roteiro escolhe a opção ${escolha}, mas não há lista`);
    return {
      ferramenta: "consultar_horarios_edilaine",
      entrada: { modo: "conferir", preferencia: "", id_opcao: opcao.id_opcao },
    };
  };
}

function ultimaConferida(c: ContextoDeChamada): string {
  const conferida = c
    .entradas("consultar_horarios_edilaine")
    .filter((e) => e["modo"] === "conferir")
    .at(-1);
  return String(conferida?.["id_opcao"] ?? "");
}

export function agendar(email: string, emailParceiro = ""): ItemDeFerramenta {
  return (c) => ({
    ferramenta: "agendar_reuniao",
    entrada: {
      id_opcao: ultimaConferida(c),
      email,
      email_parceiro: emailParceiro,
    },
  });
}

export function remarcar(): ItemDeFerramenta {
  return (c) => ({
    ferramenta: "remarcar_reuniao",
    entrada: { id_opcao: ultimaConferida(c) },
  });
}

export function cancelar(motivo: string): ChamadaDeFerramenta {
  return { ferramenta: "cancelar_reuniao", entrada: { motivo } };
}

export function anotar(anotacao: string): ChamadaDeFerramenta {
  return { ferramenta: "anotar_para_leonardo", entrada: { anotacao } };
}

export function consultarEquipe(
  tipo: "area" | "duvida",
  pergunta: string,
): ChamadaDeFerramenta {
  return {
    ferramenta: "consultar_equipe",
    entrada: { tipo, pergunta },
  };
}

// ---------------------------------------------------------------------------
// Texto a partir do que a ferramenta devolveu
// ---------------------------------------------------------------------------

function estadoDe(c: ContextoDoModelo, ferramenta: string): string {
  return String(c.ultimo(ferramenta)?.["estado"] ?? "");
}

function duasOpcoes(c: ContextoDoModelo): string {
  const [a, b] = c.opcoes();
  if (!a) throw new Error("a agenda não devolveu opção nenhuma");
  return b ? `${a.texto} ou ${b.texto}` : a.texto;
}

const CONFERIR_COM_A_EQUIPE =
  "Vou conferir isso com a equipe e já te retorno por aqui, tá?";

/** O que o modelo escreve depois de `consultar_horarios_edilaine` em modo sugerir. */
export function textoAposSugerir(c: ContextoDoModelo): string {
  switch (estadoDe(c, "consultar_horarios_edilaine")) {
    case "opcoes":
      return `Que bom! Olhei a agenda da Edilaine agora e ela tem ${duasOpcoes(c)}. Algum desses fica bom para vocês?`;
    case "sem_horario":
      return "Vou ver com a Edilaine se ela consegue abrir um horário nesse período e te retorno por aqui, tá?";
    default:
      return CONFERIR_COM_A_EQUIPE;
  }
}

/** Depois de conferir a opção escolhida: livre pede o e-mail; ocupado oferece duas novas. */
export function textoAposConferir(c: ContextoDoModelo): string {
  switch (estadoDe(c, "consultar_horarios_edilaine")) {
    case "livre":
      return "Perfeito, esse horário está livre! Me passa o seu e-mail para eu enviar o convite com o link da reunião?";
    case "ocupado":
      return `Desculpa, acabei de conferir e esse horário acabou de ser preenchido. Posso te oferecer ${duasOpcoes(c)}?`;
    default:
      return CONFERIR_COM_A_EQUIPE;
  }
}

/** Depois de agendar: só a criação confirma. */
export function textoAposAgendar(c: ContextoDoModelo): string {
  const r = c.ultimo("agendar_reuniao") ?? {};
  if (r["estado"] !== "criada") return CONFERIR_COM_A_EQUIPE;
  return `Prontinho! Sua reunião com a Edilaine está agendada para ${String(r["dia_semana"])}, ${String(r["data"])}, às ${String(r["hora"])}. O convite com o link chegou no seu e-mail. Na véspera eu te lembro por aqui 😊`;
}

export function textoAposRemarcar(c: ContextoDoModelo): string {
  const r = c.ultimo("remarcar_reuniao") ?? {};
  if (r["estado"] !== "remarcada") return CONFERIR_COM_A_EQUIPE;
  return `Prontinho! Sua reunião com a Edilaine mudou para ${String(r["dia_semana"])}, ${String(r["data"])}, às ${String(r["hora"])}. O convite com o link foi atualizado no seu e-mail.`;
}

// ---------------------------------------------------------------------------
// Turnos que se repetem
// ---------------------------------------------------------------------------

/** "Quero marcar": consulta a agenda e oferece as duas opções. */
export const T_SUGERIR: RoteiroDoTurno = {
  agente: { ferramentas: [sugerir()], texto: textoAposSugerir },
};

/** "Pode ser a primeira": confere de novo e, livre, pede o e-mail. */
export const T_ESCOLHER_A_PRIMEIRA: RoteiroDoTurno = {
  agente: { ferramentas: [conferir(1)], texto: textoAposConferir },
};

/** O e-mail: cria o evento e só depois confirma. */
export const T_DAR_O_EMAIL: RoteiroDoTurno = {
  agente: { ferramentas: [agendar(EMAIL_DA_CARLA)], texto: textoAposAgendar },
};

/** Os três primeiros turnos de todo caso que parte de uma reunião já marcada. */
export const ATE_AGENDAR: Record<number, RoteiroDoTurno> = {
  1: T_SUGERIR,
  2: T_ESCOLHER_A_PRIMEIRA,
  3: T_DAR_O_EMAIL,
};

/** Follow-up, lembrete, retomada: o gerador reescreve o texto aprovado que o sistema entregou. */
export function retornoComOTextoBase(): RoteiroDoTurno {
  return {
    followup: (c) => ({
      texto: `${c.textoBase.replace(/\s*\n\s*/g, " ").trim()} (teste ${c.digitos.slice(-5)})`,
    }),
  };
}

/** A devolutiva: a frase da equipe, dita com as palavras da Isadora. */
export function devolutivaDaEquipe(): RoteiroDoTurno {
  return {
    followup: (c) => {
      const fato = /Fato confirmado pela equipe:\s*([\s\S]*)$/.exec(
        c.textoBase,
      )?.[1];
      return {
        texto: `Oi! Conferi com a equipe. ${(fato ?? c.textoBase).replace(/\s*\n\s*/g, " ").trim()} (teste ${c.digitos.slice(-5)})`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Os roteiros
// ---------------------------------------------------------------------------

// Textos da cadência: a família escreve duas vezes antes de ficar em silêncio.
const PRIMEIRA_DA_CADENCIA =
  "Oi, boa tarde! Que bom receber a sua mensagem. Eu sou a Isadora, assistente virtual da Kraamzorg Brasil, e vou te acompanhar por aqui 🤍\n\nPra começar, como posso te chamar?";
const SEGUNDA_DA_CADENCIA =
  "Prazer, Beatriz! Você está com quantas semanas de gestação?";

function transferir(
  motivo: string,
  resumo: string,
  solicitacao: string,
): ChamadaDeFerramenta {
  return {
    ferramenta: "transferir_para_equipe",
    entrada: { motivo, resumo, solicitacao, dados: {} },
  };
}

export const ROTEIROS_DA_AGENDA: Record<
  string,
  Record<number, RoteiroDoTurno>
> = {
  // Antes da reunião o Leonardo não entra: a Isadora responde, anota e oferece a agenda.
  C04: {
    1: {
      agente: {
        ferramentas: [anotar("Perguntou se existe desconto no Pix")],
        texto:
          "Boa pergunta! As condições de pagamento o Leonardo apresenta depois da reunião com a Edilaine, tá? Já deixei anotado aqui. Se quiser, eu vejo um horário para vocês conversarem com ela.",
      },
    },
  },

  C05: {
    1: {
      agente: {
        ferramentas: [anotar("Perguntou se dá para parcelar em 7 vezes")],
        texto:
          "Entendo a dúvida! As formas de pagamento o Leonardo apresenta depois da reunião com a Edilaine, tá? Já deixei anotado o seu pedido. Se quiser, eu vejo um horário para vocês conversarem com ela.",
      },
    },
  },

  C06: {
    1: {
      agente: {
        ferramentas: [
          {
            ferramenta: "verificar_cobertura",
            entrada: { cidade: "Santo André", bairro: "", uf: "SP" },
          },
          consultarEquipe(
            "area",
            "A família vai estar em Santo André depois da alta. A região é atendida?",
          ),
        ],
        texto:
          "Deixa eu confirmar essa região com a equipe para te responder certinho, tá? A resposta vem por aqui, e enquanto isso posso seguir te ajudando.",
      },
    },
    3: devolutivaDaEquipe(),
  },

  C12: {
    1: {
      agente: {
        texto:
          "Claro, conversem com calma. Se quiserem, vocês dois podem conversar com a Edilaine, nossa cofundadora e enfermeira, numa reunião online de 30 minutos, sem compromisso. Se fizer sentido, eu vejo os horários dela para vocês.",
      },
    },
  },

  C13: { 1: T_SUGERIR },

  C14: { ...ATE_AGENDAR },

  C15: {
    1: T_SUGERIR,
    3: {
      agente: {
        // A opção de ontem não vale mais: o modelo tenta conferir, o banco recusa, e ela consulta de novo.
        ferramentas: [conferir(2), sugerir()],
        texto: (c) =>
          `Conferi a agenda agora e os horários de ontem já não valem. Hoje a Edilaine tem ${duasOpcoes(c)}. Algum desses fica bom?`,
      },
    },
  },

  C16: {
    1: T_SUGERIR,
    3: {
      ...retornoComOTextoBase(),
    },
  },

  C17: {
    1: T_SUGERIR,
    2: {
      agente: {
        texto:
          "Sem problema! Me conta quais dias e períodos ficam melhores para vocês (manhã, tarde ou noite), que eu olho a agenda da Edilaine.",
      },
    },
    3: {
      agente: {
        ferramentas: [sugerir("domingo de manhã")],
        texto: textoAposSugerir,
      },
    },
    5: retornoComOTextoBase(),
  },

  C18: {
    ...ATE_AGENDAR,
    5: retornoComOTextoBase(),
  },

  C19: {
    ...ATE_AGENDAR,
    4: {
      agente: { ferramentas: [sugerir()], texto: textoAposSugerir },
    },
    5: {
      agente: {
        ferramentas: [conferir(2), remarcar()],
        texto: textoAposRemarcar,
      },
    },
  },

  C26: {
    1: {
      agente: {
        ferramentas: [
          anotar(
            "Perguntou se o contrato terá tudo o que está na apresentação",
          ),
        ],
        texto:
          "Que bom que você está olhando isso com atenção 🤍 O que está na apresentação é o que a Kraamzorg entrega, e o Leonardo passa pelo contrato com você depois da reunião com a Edilaine. Já deixei a sua pergunta anotada.",
      },
    },
  },

  // Cadência: uma mensagem por etapa, cada uma com o texto aprovado da etapa como base.
  C27: {
    1: { agente: { texto: PRIMEIRA_DA_CADENCIA } },
    2: {
      agente: {
        ferramentas: [ficha({ nome: "Beatriz" })],
        texto: SEGUNDA_DA_CADENCIA,
      },
    },
    4: retornoComOTextoBase(),
    6: retornoComOTextoBase(),
    8: retornoComOTextoBase(),
  },

  // --- Extras [v4.3] --------------------------------------------------------------------

  V11: { 2: T_SUGERIR },

  V12: { 1: T_SUGERIR, 2: T_ESCOLHER_A_PRIMEIRA, 4: T_DAR_O_EMAIL },

  V13: { 1: T_SUGERIR, 3: T_ESCOLHER_A_PRIMEIRA },

  V17: {
    ...ATE_AGENDAR,
    5: { agente: { ferramentas: [sugerir()], texto: textoAposSugerir } },
    6: {
      agente: {
        ferramentas: [conferir(1), remarcar()],
        texto: textoAposRemarcar,
      },
    },
  },

  V18: { ...ATE_AGENDAR, 7: retornoComOTextoBase() },

  V19: { ...ATE_AGENDAR },

  V20: { ...ATE_AGENDAR, 5: retornoComOTextoBase() },

  V21: {
    ...ATE_AGENDAR,
    4: {
      agente: {
        ferramentas: [anotar("Perguntou se existe desconto no Pix")],
        texto:
          "Boa pergunta! As condições de pagamento o Leonardo apresenta depois da reunião com a Edilaine, tá? Já deixei anotado aqui. A reunião de vocês continua marcada.",
      },
    },
  },

  V22: { ...ATE_AGENDAR },

  V23: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "pos_venda_operacao",
            "Já é cliente e avisa que o bebê vai nascer na semana que vem.",
            "Já sou cliente e o bebê vai nascer na semana que vem.",
          ),
        ],
        texto:
          "Que alegria, parabéns! 🤍 Já avisei a equipe do atendimento para falar com vocês sobre a chegada do bebê, e a resposta vem por aqui.",
      },
    },
  },

  V24: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "parceiro_medico",
            "Médico pergunta pelo serviço para indicar às pacientes.",
            "Sou obstetra e queria conhecer o serviço de vocês.",
          ),
        ],
        texto:
          "Que bom o seu interesse! Vou pedir para a equipe comercial falar com você por aqui, tá?",
      },
    },
  },

  V25: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "reclamacao",
            "Insatisfeita com o atendimento recebido.",
            "Estou muito insatisfeita com o atendimento de vocês.",
          ),
        ],
        texto:
          "Sinto muito por isso, e obrigada por me contar. Já pedi para a coordenação falar com você por aqui, com prioridade.",
      },
    },
  },

  V26: {
    1: {
      agente: {
        ferramentas: [
          transferir(
            "pediu_humano",
            "Pede para falar com o Leonardo.",
            "Quero falar com o Leonardo.",
          ),
        ],
        texto:
          "Claro! Já pedi para o Leonardo falar com você por aqui. Enquanto isso, fico à disposição.",
      },
    },
  },

  V27: { 1: T_SUGERIR },

  V28: {
    ...ATE_AGENDAR,
    9: {
      agente: {
        texto: "Oi, tudo bem por aqui! Me conta, qual é a sua dúvida?",
      },
    },
  },

  V29: { ...ATE_AGENDAR },

  V30: {
    ...ATE_AGENDAR,
    4: {
      agente: {
        ferramentas: [cancelar("Não vamos conseguir participar")],
        texto:
          "Sem problema, cancelei a reunião por aqui. Quando fizer sentido, é só me chamar que eu vejo outro horário com a Edilaine.",
      },
    },
    6: retornoComOTextoBase(),
  },
};
