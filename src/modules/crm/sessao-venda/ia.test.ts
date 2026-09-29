// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { gerarResumoIa, resumoIaLigado } from "./ia";

const ORIGINAL = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODELO_RESUMO: process.env.OPENAI_MODELO_RESUMO,
};

afterEach(() => {
  for (const [chave, valor] of Object.entries(ORIGINAL)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
  vi.restoreAllMocks();
});

const TRANSCRICAO = "Juliana: A gente ficou com medo da amamentação, sabe?";

describe("resumo por IA", () => {
  it("sem chave ou sem modelo fica desligado e não chama ninguém", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_MODELO_RESUMO = "modelo-teste";
    const fetchImpl = vi.fn();
    expect(resumoIaLigado()).toBe(false);
    expect(await gerarResumoIa(TRANSCRICAO, fetchImpl)).toEqual({
      ok: false,
      motivo: "desligado",
    });
    process.env.OPENAI_API_KEY = "chave-falsa-de-teste";
    delete process.env.OPENAI_MODELO_RESUMO;
    expect(resumoIaLigado()).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("manda o prompt do arquivo e a transcrição, e devolve só o que a transcrição sustenta", async () => {
    process.env.OPENAI_API_KEY = "chave-falsa-de-teste";
    process.env.OPENAI_MODELO_RESUMO = "modelo-teste";
    const conteudo = JSON.stringify({
      duvidas: [],
      objecoes: [
        {
          texto: "Medo da amamentação.",
          trecho: "ficou com medo da amamentação",
        },
        { texto: "Achou caro.", trecho: "achou o valor alto" },
      ],
      plano_interesse: null,
      proximos_passos: [],
    });
    const fetchImpl = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: conteudo } }] }),
    );
    const resultado = await gerarResumoIa(TRANSCRICAO, fetchImpl);
    expect(resultado).toMatchObject({
      ok: true,
      modelo: "modelo-teste",
      descartados: 1,
    });
    if (resultado.ok) {
      expect(resultado.resumo.objecoes.map((i) => i.texto)).toEqual([
        "Medo da amamentação.",
      ]);
    }

    const [url, pedido] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const corpo = JSON.parse(String(pedido.body));
    const prompt = readFileSync(
      path.join(process.cwd(), "src/modules/crm/prompts/resumo-sessao.md"),
      "utf8",
    );
    expect(corpo.messages[0]).toEqual({ role: "system", content: prompt });
    expect(corpo.messages[1]).toEqual({ role: "user", content: TRANSCRICAO });
    expect(corpo.model).toBe("modelo-teste");
  });

  it("falha da API vira 'falhou' e nada da transcrição vai para o console", async () => {
    process.env.OPENAI_API_KEY = "chave-falsa-de-teste";
    process.env.OPENAI_MODELO_RESUMO = "modelo-teste";
    const espioes = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];
    expect(
      await gerarResumoIa(
        TRANSCRICAO,
        vi.fn(async () => new Response("erro", { status: 500 })),
      ),
    ).toEqual({ ok: false, motivo: "falhou" });
    expect(
      await gerarResumoIa(
        TRANSCRICAO,
        vi.fn(async () =>
          Response.json({ choices: [{ message: { content: "não é json" } }] }),
        ),
      ),
    ).toEqual({ ok: false, motivo: "falhou" });
    for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled();
  });

  it("o prompt proíbe inventar e pede o trecho de prova", () => {
    const prompt = readFileSync(
      path.join(process.cwd(), "src/modules/crm/prompts/resumo-sessao.md"),
      "utf8",
    );
    expect(prompt).toMatch(/Nada inventado/);
    expect(prompt).toMatch(/"trecho"/);
    expect(prompt).not.toMatch(/[\u2014\u2013]/);
  });
});
