import type { Json } from "@/lib/db/types";
import { ErroRepositorio } from "@/lib/dados/erros";
import type {
  ConfigCopiloto,
  CopilotoRepositorio,
  NomeFerramentaCopiloto,
  SituacaoPerguntaCopiloto,
} from "@/lib/dados/tipos-relacao";
import { CATALOGO, ehFerramenta } from "./catalogo";

/**
 * O caminho de uma pergunta ao copiloto (P48), sem depender de rede nem de
 * modelo de verdade: quem escolhe a função e escreve a frase é um
 * `ModeloCopiloto` injetado (o da OpenAI em produção, um dublê nos testes).
 *
 * Ordem, e cada passo que falha para aqui e deixa a pergunta registrada:
 *   1. pergunta vazia ou longa demais;
 *   2. copiloto desligado (parametro, ou sem chave/modelo no servidor);
 *   3. pergunta sobre registro assistencial, recusada ANTES de qualquer
 *      modelo (lista de termos em parametro.copiloto, para todos os papéis);
 *   4. orçamento do mês esgotado;
 *   5. o modelo escolhe uma das cinco funções de leitura (ou recusa);
 *   6. os parâmetros são validados contra o catálogo e a função roda com as
 *      permissões de quem perguntou (papel sem acesso vira recusa);
 *   7. os fatos saem do resultado, sem modelo; o modelo só escreve a frase.
 */

export interface UsoDeTokens {
  entrada: number;
  saida: number;
}

export type EscolhaDoModelo =
  | {
      tipo: "ferramenta";
      ferramenta: string;
      parametros: unknown;
      uso: UsoDeTokens;
    }
  | { tipo: "recusa"; motivo: string; uso: UsoDeTokens };

export interface ModeloCopiloto {
  escolher(entrada: {
    pergunta: string;
    hoje: string;
    papeis: readonly string[];
  }): Promise<EscolhaDoModelo>;
  redigir(entrada: {
    pergunta: string;
    hoje: string;
    fatos: string[];
  }): Promise<{ texto: string; uso: UsoDeTokens }>;
}

export type MotivoRecusa =
  "vazia" | "longa" | "assistencial" | "fora_do_escopo" | "sem_permissao";

export type RespostaCopiloto =
  | {
      situacao: "respondida";
      resposta: string;
      fatos: string[];
      ferramenta: NomeFerramentaCopiloto;
      parametros: Record<string, Json>;
    }
  | { situacao: "recusada"; motivo: MotivoRecusa; mensagem: string }
  | { situacao: "desligado"; mensagem: string }
  | { situacao: "orcamento"; mensagem: string }
  | { situacao: "erro"; mensagem: string };

/** Frases da tela (microcopy da equipe, voz.md). */
export const MENSAGENS = {
  vazia: "Escreva a pergunta antes de enviar.",
  longa: (max: number) =>
    `A pergunta passou de ${max} caracteres. Encurte e tente de novo.`,
  desligado:
    "O copiloto está desligado neste ambiente. Nada foi enviado a nenhum serviço de IA.",
  assistencial:
    "O copiloto não responde sobre registro assistencial nem sobre a saúde de mães e bebês. Esse dado só se abre pela ficha da família, com o código do aplicativo (MFA), e fica registrado.",
  foraDoEscopo:
    "Isso está fora do que o copiloto consulta. Ele responde sobre pipeline, conversão, receita, ocupação e origem dos leads.",
  semPermissao:
    "Seu perfil não vê essa informação, então o copiloto também não mostra. Quem pode ver é a diretoria ou o financeiro.",
  orcamento:
    "O orçamento do copiloto neste mês acabou. Ele volta no início do próximo mês, ou a diretoria pode aumentar o limite.",
  erro: "O copiloto não conseguiu responder agora. Nada foi alterado; tente de novo em instantes.",
} as const;

/** Minúsculas e sem acento, para comparar a pergunta com os termos. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Termo da lista de parametro.copiloto que aparece na pergunta, ou null. */
export function termoAssistencial(
  pergunta: string,
  termos: readonly string[],
): string | null {
  const texto = ` ${normalizar(pergunta).replace(/[^a-z0-9 ]/g, " ")} `;
  for (const termo of termos) {
    const t = normalizar(termo)
      .replace(/[^a-z0-9 ]/g, " ")
      .trim();
    if (t && texto.includes(` ${t} `)) return termo;
  }
  return null;
}

const somaTokens = (...usos: UsoDeTokens[]): UsoDeTokens => ({
  entrada: usos.reduce((s, u) => s + u.entrada, 0),
  saida: usos.reduce((s, u) => s + u.saida, 0),
});
const SEM_USO: UsoDeTokens = { entrada: 0, saida: 0 };

export async function perguntarAoCopiloto(entrada: {
  pergunta: string;
  hoje: string;
  papeis: readonly string[];
  repositorio: CopilotoRepositorio;
  /** null = sem chave ou sem modelo no servidor: desligado. */
  modelo: ModeloCopiloto | null;
}): Promise<RespostaCopiloto> {
  const { repositorio, modelo, hoje, papeis } = entrada;
  const pergunta = entrada.pergunta.trim();

  const registrar = async (
    situacao: SituacaoPerguntaCopiloto,
    extra: {
      ferramenta?: NomeFerramentaCopiloto | null;
      parametros?: Record<string, Json>;
      motivo?: string | null;
      uso?: UsoDeTokens;
    } = {},
  ) => {
    try {
      await repositorio.registrar({
        pergunta: pergunta || "(vazia)",
        ferramenta: extra.ferramenta ?? null,
        parametros: extra.parametros ?? {},
        situacao,
        motivo: extra.motivo ?? null,
        tokensEntrada: extra.uso?.entrada ?? 0,
        tokensSaida: extra.uso?.saida ?? 0,
      });
    } catch {
      // O registro nunca impede a resposta; a falha aparece no monitoramento.
    }
  };

  if (!pergunta) {
    return { situacao: "recusada", motivo: "vazia", mensagem: MENSAGENS.vazia };
  }

  let config: ConfigCopiloto;
  try {
    config = await repositorio.config();
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return {
        situacao: "recusada",
        motivo: "sem_permissao",
        mensagem: MENSAGENS.semPermissao,
      };
    }
    return { situacao: "erro", mensagem: MENSAGENS.erro };
  }

  if (pergunta.length > config.perguntaMaxCaracteres) {
    return {
      situacao: "recusada",
      motivo: "longa",
      mensagem: MENSAGENS.longa(config.perguntaMaxCaracteres),
    };
  }
  if (!config.ativo || !modelo) {
    await registrar("desligado");
    return { situacao: "desligado", mensagem: MENSAGENS.desligado };
  }
  if (termoAssistencial(pergunta, config.termosAssistenciais)) {
    await registrar("recusada", { motivo: "assistencial" });
    return {
      situacao: "recusada",
      motivo: "assistencial",
      mensagem: MENSAGENS.assistencial,
    };
  }
  if (
    config.orcamentoMensalCentavos !== null &&
    config.custoMesCentavos >= config.orcamentoMensalCentavos
  ) {
    await registrar("orcamento");
    return { situacao: "orcamento", mensagem: MENSAGENS.orcamento };
  }

  let uso = SEM_USO;
  try {
    const escolha = await modelo.escolher({ pergunta, hoje, papeis });
    uso = escolha.uso;
    if (escolha.tipo === "recusa") {
      await registrar("recusada", { motivo: "fora_do_escopo", uso });
      return {
        situacao: "recusada",
        motivo: "fora_do_escopo",
        mensagem: MENSAGENS.foraDoEscopo,
      };
    }
    if (!ehFerramenta(escolha.ferramenta)) {
      // O modelo inventou uma função: fora do conjunto fechado, nunca executa.
      await registrar("recusada", { motivo: "fora_do_escopo", uso });
      return {
        situacao: "recusada",
        motivo: "fora_do_escopo",
        mensagem: MENSAGENS.foraDoEscopo,
      };
    }
    const ferramenta = CATALOGO[escolha.ferramenta];
    const parametros = ferramenta.esquema.safeParse(escolha.parametros ?? {});
    if (!parametros.success) {
      await registrar("erro", {
        ferramenta: ferramenta.nome,
        motivo: "parametros",
        uso,
      });
      return { situacao: "erro", mensagem: MENSAGENS.erro };
    }

    let resultado: Json;
    try {
      resultado = await repositorio.executar(ferramenta.nome, parametros.data);
    } catch (erro) {
      if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
        await registrar("recusada", {
          ferramenta: ferramenta.nome,
          parametros: parametros.data,
          motivo: "sem_permissao",
          uso,
        });
        return {
          situacao: "recusada",
          motivo: "sem_permissao",
          mensagem: MENSAGENS.semPermissao,
        };
      }
      throw erro;
    }

    const fatos = ferramenta.resumir(resultado);
    let resposta = fatos.join(" ");
    try {
      const redacao = await modelo.redigir({ pergunta, hoje, fatos });
      uso = somaTokens(uso, redacao.uso);
      if (redacao.texto.trim()) resposta = redacao.texto.trim();
    } catch {
      // Sem a frase do modelo, os fatos já respondem a pergunta.
    }
    await registrar("respondida", {
      ferramenta: ferramenta.nome,
      parametros: parametros.data,
      uso,
    });
    return {
      situacao: "respondida",
      resposta,
      fatos,
      ferramenta: ferramenta.nome,
      parametros: parametros.data,
    };
  } catch {
    await registrar("erro", { uso });
    return { situacao: "erro", mensagem: MENSAGENS.erro };
  }
}
