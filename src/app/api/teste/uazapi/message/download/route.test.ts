// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { POST as postTranscricoes } from "../../transcricoes/route";
import { reiniciarLojaTesteUazapi } from "../../_lib/loja";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_ENV;

function requisicaoDownload(corpo: unknown) {
  return new Request("http://localhost/api/teste/uazapi/message/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

const SEGREDO = "segredo-de-teste-da-captura";
const ORIGINAL_SEGREDO = process.env.INTERNAL_ROUTES_SECRET;

function requisicaoTranscricao(
  corpo: unknown,
  segredo: string | null = SEGREDO,
) {
  return new Request("http://localhost/api/teste/uazapi/transcricoes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(segredo ? { "x-kz-interno-secret": segredo } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = "homologacao";
  process.env.INTERNAL_ROUTES_SECRET = SEGREDO;
  reiniciarLojaTesteUazapi();
});

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_ENV;
  process.env.INTERNAL_ROUTES_SECRET = ORIGINAL_SEGREDO;
});

describe("POST /api/teste/uazapi/message/download (transcrição simulada, P25 item 5)", () => {
  it("devolve o texto registrado antes em /transcricoes para o mesmo id", async () => {
    await postTranscricoes(
      requisicaoTranscricao({ id: "msg-1", texto: "Estou sangrando" }),
    );
    const resposta = await POST(requisicaoDownload({ id: "msg-1" }));
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as { transcricao: string };
    expect(corpo.transcricao).toBe("Estou sangrando");
  });

  it("aceita 'messageid' no lugar de 'id'", async () => {
    await postTranscricoes(requisicaoTranscricao({ id: "msg-2", texto: "Oi" }));
    const resposta = await POST(requisicaoDownload({ messageid: "msg-2" }));
    const corpo = (await resposta.json()) as { transcricao: string };
    expect(corpo.transcricao).toBe("Oi");
  });

  it("registrado para falhar, devolve 502 (caso do Apêndice C: transcrição forçada a falhar)", async () => {
    await postTranscricoes(
      requisicaoTranscricao({ id: "msg-3", falhar: true }),
    );
    const resposta = await POST(requisicaoDownload({ id: "msg-3" }));
    expect(resposta.status).toBe(502);
  });

  it("sem id nem messageid, devolve 400", async () => {
    const resposta = await POST(requisicaoDownload({}));
    expect(resposta.status).toBe(400);
  });

  it("fora de homologação, recusa com 403", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    const resposta = await POST(requisicaoDownload({ id: "msg-1" }));
    expect(resposta.status).toBe(403);
  });

  it("registrar transcrição sem o segredo das rotas internas recusa com 401", async () => {
    const resposta = await postTranscricoes(
      requisicaoTranscricao({ id: "msg-x", texto: "nada" }, null),
    );
    expect(resposta.status).toBe(401);
  });
});
