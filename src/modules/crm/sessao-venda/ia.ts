import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { verificarSaidaIa, type ResumoVerificado } from "./resumo";

/**
 * Resumo estruturado da sessão de venda por IA (P29 item 3). Só no
 * servidor: a chave da OpenAI nunca chega ao navegador. Desligado quando
 * falta a chave (OPENAI_API_KEY) ou o modelo (OPENAI_MODELO_RESUMO), e a
 * tela diz isso com calma: a pessoa escreve o resumo à mão e ele fica
 * guardado do mesmo jeito. O prompt mora em
 * src/modules/crm/prompts/resumo-sessao.md (mudança de texto passa pela
 * mesma aprovação dos textos da Isadora).
 *
 * Nada da transcrição vai para log: em qualquer falha, só o motivo volta.
 */

const URL_OPENAI = "https://api.openai.com/v1/chat/completions";
const CAMINHO_PROMPT = path.join(
  process.cwd(),
  "src",
  "modules",
  "crm",
  "prompts",
  "resumo-sessao.md",
);

export interface ConfiguracaoResumoIa {
  chave: string;
  modelo: string;
}

export function configuracaoResumoIa(): ConfiguracaoResumoIa | null {
  const chave = process.env.OPENAI_API_KEY?.trim();
  const modelo = process.env.OPENAI_MODELO_RESUMO?.trim();
  return chave && modelo ? { chave, modelo } : null;
}

export function resumoIaLigado(): boolean {
  return configuracaoResumoIa() !== null;
}

export type ResultadoResumoIa =
  | ({ ok: true; modelo: string } & ResumoVerificado)
  | { ok: false; motivo: "desligado" | "falhou" | "sem_transcricao" };

interface RespostaChat {
  choices?: { message?: { content?: string | null } }[];
}

export async function gerarResumoIa(
  transcricao: string,
  fetchImpl: typeof fetch = fetch,
  lerPrompt: () => Promise<string> = () => readFile(CAMINHO_PROMPT, "utf8"),
): Promise<ResultadoResumoIa> {
  const configuracao = configuracaoResumoIa();
  if (!configuracao) return { ok: false, motivo: "desligado" };
  if (!transcricao.trim()) return { ok: false, motivo: "sem_transcricao" };

  try {
    const prompt = await lerPrompt();
    const resposta = await fetchImpl(URL_OPENAI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuracao.chave}`,
      },
      body: JSON.stringify({
        model: configuracao.modelo,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: transcricao },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    if (!resposta.ok) return { ok: false, motivo: "falhou" };
    const corpo = (await resposta.json()) as RespostaChat;
    const conteudo = corpo.choices?.[0]?.message?.content;
    if (!conteudo) return { ok: false, motivo: "falhou" };
    const saida: unknown = JSON.parse(conteudo);
    return {
      ok: true,
      modelo: configuracao.modelo,
      ...verificarSaidaIa(saida, transcricao),
    };
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}
