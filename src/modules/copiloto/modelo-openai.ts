import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CATALOGO } from "./catalogo";
import type {
  EscolhaDoModelo,
  ModeloCopiloto,
  UsoDeTokens,
} from "./orquestrador";

/**
 * O modelo do copiloto (P48): OpenAI, chamada só no servidor. Desligado
 * quando falta a chave (OPENAI_API_KEY) ou o modelo (OPENAI_MODELO_COPILOTO):
 * `modeloCopilotoDoAmbiente()` devolve null e a tela diz isso com calma.
 * As instruções moram em src/modules/copiloto/prompts/ (mudança de texto passa
 * pela mesma aprovação dos textos da Isadora). O modelo só escolhe entre as
 * cinco funções do catálogo e escreve uma frase sobre fatos já calculados.
 * Nenhum dado de família vai ao modelo: só a pergunta, a data de hoje e os
 * números agregados.
 */

const URL_OPENAI = "https://api.openai.com/v1/chat/completions";
const PASTA_PROMPTS = path.join(
  process.cwd(),
  "src",
  "modules",
  "copiloto",
  "prompts",
);

export interface ConfiguracaoCopiloto {
  chave: string;
  modelo: string;
}

export function configuracaoCopiloto(): ConfiguracaoCopiloto | null {
  const chave = process.env.OPENAI_API_KEY?.trim();
  const modelo = process.env.OPENAI_MODELO_COPILOTO?.trim();
  return chave && modelo ? { chave, modelo } : null;
}

interface RespostaChat {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const usoDe = (r: RespostaChat): UsoDeTokens => ({
  entrada: r.usage?.prompt_tokens ?? 0,
  saida: r.usage?.completion_tokens ?? 0,
});

export function criarModeloOpenAi(
  configuracao: ConfiguracaoCopiloto,
  fetchImpl: typeof fetch = fetch,
  lerPrompt: (arquivo: string) => Promise<string> = (arquivo) =>
    readFile(path.join(PASTA_PROMPTS, arquivo), "utf8"),
): ModeloCopiloto {
  async function chamar(corpo: Record<string, unknown>): Promise<RespostaChat> {
    const resposta = await fetchImpl(URL_OPENAI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuracao.chave}`,
      },
      body: JSON.stringify({ model: configuracao.modelo, ...corpo }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error("copiloto: o modelo não respondeu");
    return (await resposta.json()) as RespostaChat;
  }

  return {
    async escolher({ pergunta, hoje }): Promise<EscolhaDoModelo> {
      const sistema = await lerPrompt("copiloto-sistema.md");
      const r = await chamar({
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: `Hoje é ${hoje}.\n\nPergunta: ${pergunta}` },
        ],
        tools: Object.values(CATALOGO).map((f) => ({
          type: "function",
          function: {
            name: f.nome,
            description: f.descricao,
            parameters: f.parametrosJson,
          },
        })),
        tool_choice: "auto",
      });
      const uso = usoDe(r);
      const mensagem = r.choices?.[0]?.message;
      const chamada = mensagem?.tool_calls?.[0]?.function;
      if (chamada?.name) {
        let parametros: unknown = {};
        try {
          parametros = chamada.arguments ? JSON.parse(chamada.arguments) : {};
        } catch {
          parametros = null;
        }
        return {
          tipo: "ferramenta",
          ferramenta: chamada.name,
          parametros,
          uso,
        };
      }
      return {
        tipo: "recusa",
        motivo: mensagem?.content?.slice(0, 200) ?? "",
        uso,
      };
    },

    async redigir({ pergunta, hoje, fatos }) {
      const sistema = await lerPrompt("copiloto-resposta.md");
      const r = await chamar({
        messages: [
          { role: "system", content: sistema },
          {
            role: "user",
            content: `Hoje é ${hoje}.\n\nPergunta: ${pergunta}\n\nFatos:\n${fatos.map((f) => `- ${f}`).join("\n")}`,
          },
        ],
      });
      return { texto: r.choices?.[0]?.message?.content ?? "", uso: usoDe(r) };
    },
  };
}

export function modeloCopilotoDoAmbiente(): ModeloCopiloto | null {
  const configuracao = configuracaoCopiloto();
  return configuracao ? criarModeloOpenAi(configuracao) : null;
}
