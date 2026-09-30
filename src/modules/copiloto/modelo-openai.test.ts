// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { criarModeloOpenAi, configuracaoCopiloto } from "./modelo-openai";

/**
 * Contrato com a OpenAI sem rede: o modelo só recebe a pergunta, a data de
 * hoje, o catálogo fechado de funções e os fatos já calculados. A chamada de
 * verdade (com chave) fica fora da suíte padrão.
 */

const config = { chave: "chave-de-teste", modelo: "modelo-de-teste" };
const lerPrompt = async (arquivo: string) => `prompt ${arquivo}`;

function respostaJson(corpo: unknown, ok = true) {
  return { ok, json: async () => corpo } as Response;
}

describe("modelo OpenAI do copiloto (P48)", () => {
  it("sem chave ou sem modelo o copiloto está desligado", () => {
    const antes = { ...process.env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODELO_COPILOTO;
    expect(configuracaoCopiloto()).toBeNull();
    process.env.OPENAI_API_KEY = "x";
    expect(configuracaoCopiloto()).toBeNull();
    process.env.OPENAI_MODELO_COPILOTO = "m";
    expect(configuracaoCopiloto()).toEqual({ chave: "x", modelo: "m" });
    process.env = antes;
  });

  it("envia só as cinco funções do catálogo, a pergunta e a data; lê a função escolhida", async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "copiloto_conversao",
                    arguments: '{"desde":"2026-09-01","ate":"2026-09-30"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 15 },
      }),
    );
    const modelo = criarModeloOpenAi(
      config,
      fetchFalso as unknown as typeof fetch,
      lerPrompt,
    );
    const r = await modelo.escolher({
      pergunta: "Quantos leads em setembro?",
      hoje: "2026-09-30",
      papeis: ["diretoria"],
    });
    expect(r).toEqual({
      tipo: "ferramenta",
      ferramenta: "copiloto_conversao",
      parametros: { desde: "2026-09-01", ate: "2026-09-30" },
      uso: { entrada: 120, saida: 15 },
    });

    const [url, init] = fetchFalso.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer chave-de-teste",
    );
    const corpo = JSON.parse(init.body as string);
    expect(corpo.model).toBe("modelo-de-teste");
    expect(
      corpo.tools
        .map((t: { function: { name: string } }) => t.function.name)
        .sort(),
    ).toEqual([
      "copiloto_conversao",
      "copiloto_leads_origem",
      "copiloto_ocupacao",
      "copiloto_pipeline",
      "copiloto_receita",
    ]);
    const texto = JSON.stringify(corpo.messages);
    expect(texto).toContain("Quantos leads em setembro?");
    expect(texto).toContain("2026-09-30");
  });

  it("resposta sem função vira recusa; argumentos quebrados viram parâmetros nulos (o servidor recusa)", async () => {
    const semFuncao = criarModeloOpenAi(
      config,
      (async () =>
        respostaJson({
          choices: [{ message: { content: "Não sei." } }],
        })) as unknown as typeof fetch,
      lerPrompt,
    );
    expect(
      await semFuncao.escolher({
        pergunta: "?",
        hoje: "2026-09-30",
        papeis: [],
      }),
    ).toMatchObject({ tipo: "recusa" });

    const quebrada = criarModeloOpenAi(
      config,
      (async () =>
        respostaJson({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "copiloto_receita",
                      arguments: "{quebrado",
                    },
                  },
                ],
              },
            },
          ],
        })) as unknown as typeof fetch,
      lerPrompt,
    );
    expect(
      await quebrada.escolher({
        pergunta: "?",
        hoje: "2026-09-30",
        papeis: [],
      }),
    ).toMatchObject({
      tipo: "ferramenta",
      parametros: null,
    });
  });

  it("a frase é escrita só sobre os fatos entregues", async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({
        choices: [{ message: { content: "Entraram 8 leads." } }],
        usage: { prompt_tokens: 50, completion_tokens: 6 },
      }),
    );
    const modelo = criarModeloOpenAi(
      config,
      fetchFalso as unknown as typeof fetch,
      lerPrompt,
    );
    const r = await modelo.redigir({
      pergunta: "Quantos?",
      hoje: "2026-09-30",
      fatos: ["8 leads entraram."],
    });
    expect(r).toEqual({
      texto: "Entraram 8 leads.",
      uso: { entrada: 50, saida: 6 },
    });
    const corpo = JSON.parse(
      (fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(corpo.tools).toBeUndefined();
    expect(JSON.stringify(corpo.messages)).toContain("- 8 leads entraram.");
  });

  it("erro do serviço vira exceção, que o orquestrador trata como erro sem detalhe", async () => {
    const modelo = criarModeloOpenAi(
      config,
      (async () => respostaJson({}, false)) as unknown as typeof fetch,
      lerPrompt,
    );
    await expect(
      modelo.escolher({ pergunta: "?", hoje: "2026-09-30", papeis: [] }),
    ).rejects.toThrow();
  });
});
