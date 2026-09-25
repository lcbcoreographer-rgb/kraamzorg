// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, DELETE } from "./route";
import { POST as postTexto } from "./send/text/route";
import { obterLojaTesteUazapi, reiniciarLojaTesteUazapi } from "./_lib/loja";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_SEGREDO = process.env.INTERNAL_ROUTES_SECRET;
const ORIGINAL_VERCEL = process.env.VERCEL_ENV;
const SEGREDO = "segredo-de-teste-da-captura";

function requisicaoPainel(metodo: "GET" | "DELETE", segredo?: string) {
  return new Request("http://localhost/api/teste/uazapi", {
    method: metodo,
    headers: segredo ? { "x-kz-interno-secret": segredo } : {},
  });
}

function requisicaoTexto(corpo: unknown) {
  return new Request("http://localhost/api/teste/uazapi/send/text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = "homologacao";
  process.env.INTERNAL_ROUTES_SECRET = SEGREDO;
  delete process.env.VERCEL_ENV;
  reiniciarLojaTesteUazapi();
});

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_ENV;
  process.env.INTERNAL_ROUTES_SECRET = ORIGINAL_SEGREDO;
  if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL;
});

describe("rota de captura da UAZAPI (P25 item 5, P27)", () => {
  it("fora de homologação, GET recusa com 403 e não devolve nada", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
    const resposta = await GET(requisicaoPainel("GET", SEGREDO));
    expect(resposta.status).toBe(403);
  });

  it("fora de homologação, DELETE recusa com 403 e não limpa nada", async () => {
    obterLojaTesteUazapi().envios.push({
      id: "x",
      tipo: "texto",
      corpo: {},
      capturadoEm: new Date().toISOString(),
    });
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    const resposta = await DELETE(requisicaoPainel("DELETE", SEGREDO));
    expect(resposta.status).toBe(403);
    expect(obterLojaTesteUazapi().envios).toHaveLength(1);
  });

  it("em homologação, GET lista o que foi capturado por send/text", async () => {
    await postTexto(
      requisicaoTexto({
        number: "+5511900000001",
        text: "Oi!",
        track_source: "kraamzorg-agente",
      }),
    );
    const resposta = await GET(requisicaoPainel("GET", SEGREDO));
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as { envios: unknown[] };
    expect(corpo.envios).toHaveLength(1);
  });

  it("em homologação, o painel sem o segredo (ou com o errado) recusa com 401", async () => {
    await postTexto(requisicaoTexto({ number: "+5511900000001", text: "Oi!" }));
    expect((await GET(requisicaoPainel("GET"))).status).toBe(401);
    expect((await GET(requisicaoPainel("GET", "errado"))).status).toBe(401);
    expect((await DELETE(requisicaoPainel("DELETE"))).status).toBe(401);
    expect(obterLojaTesteUazapi().envios).toHaveLength(1);
  });

  it("num deploy de produção da Vercel, recusa mesmo com homologacao configurado", async () => {
    process.env.VERCEL_ENV = "production";
    const resposta = await postTexto(
      requisicaoTexto({ number: "+5511900000001", text: "Oi!" }),
    );
    expect(resposta.status).toBe(403);
    expect(obterLojaTesteUazapi().envios).toHaveLength(0);
  });

  it("em homologação, DELETE limpa a loja", async () => {
    await postTexto(requisicaoTexto({ number: "+5511900000001", text: "Oi!" }));
    const resposta = await DELETE(requisicaoPainel("DELETE", SEGREDO));
    expect(resposta.status).toBe(200);
    expect(obterLojaTesteUazapi().envios).toHaveLength(0);
  });
});

describe("POST /api/teste/uazapi/send/text", () => {
  it("fora de homologação, recusa com 403 e não captura", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
    const resposta = await postTexto(
      requisicaoTexto({ number: "+5511900000001", text: "Oi!" }),
    );
    expect(resposta.status).toBe(403);
    expect(obterLojaTesteUazapi().envios).toHaveLength(0);
  });

  it("captura number e text e devolve um id", async () => {
    const resposta = await postTexto(
      requisicaoTexto({
        number: "+5511900000001",
        text: "Oi, tudo bem?",
        track_source: "kraamzorg-agente",
      }),
    );
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as { id: string };
    expect(corpo.id).toBeTruthy();
    const loja = obterLojaTesteUazapi();
    expect(loja.envios[0]?.corpo).toMatchObject({
      number: "+5511900000001",
      text: "Oi, tudo bem?",
    });
  });

  it("sem number ou text, devolve 400 e não captura", async () => {
    const resposta = await postTexto(
      requisicaoTexto({ number: "+5511900000001" }),
    );
    expect(resposta.status).toBe(400);
    expect(obterLojaTesteUazapi().envios).toHaveLength(0);
  });
});
