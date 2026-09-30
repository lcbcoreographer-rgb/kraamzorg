// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sessao = vi.fn();
vi.mock("@/lib/auth/sessao", () => ({ obterSessao: () => sessao() }));

import {
  inscricoesDemonstracao,
  reiniciarInscricoesDemonstracao,
} from "@/modules/mensageria/push/repositorio";
import { DELETE, POST } from "./route";

const SESSAO = {
  usuarioId: "u1",
  ativo: true,
  papeis: ["enfermeira"],
  aal: "aal2",
};
const corpo = {
  endpoint: "https://push.exemplo.invalid/abc",
  chaves: { p256dh: "publica", auth: "segredo" },
};
const req = (metodo: string, dados: unknown) =>
  new Request("https://app.exemplo.invalid/api/push/inscrever", {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: typeof dados === "string" ? dados : JSON.stringify(dados),
  });

beforeEach(() => {
  vi.stubEnv("KZ_DADOS", "demonstracao");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
  reiniciarInscricoesDemonstracao();
  sessao.mockReset();
  sessao.mockResolvedValue(SESSAO);
});

describe("/api/push/inscrever", () => {
  it("sem sessão, ou com perfil desativado ou sem papel, recusa com 401", async () => {
    sessao.mockResolvedValue(null);
    expect((await POST(req("POST", corpo))).status).toBe(401);
    sessao.mockResolvedValue({ ...SESSAO, ativo: false });
    expect((await POST(req("POST", corpo))).status).toBe(401);
    sessao.mockResolvedValue({ ...SESSAO, papeis: [] });
    expect(
      (await DELETE(req("DELETE", { endpoint: corpo.endpoint }))).status,
    ).toBe(401);
    expect(inscricoesDemonstracao()).toHaveLength(0);
  });

  it("guarda a inscrição da pessoa logada e não repete endereço nem chaves na resposta", async () => {
    const r = await POST(req("POST", corpo));
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).not.toContain("push.exemplo");
    expect(inscricoesDemonstracao("u1")).toEqual([corpo]);
  });

  it("recusa endereço que não é https, chaves faltando e corpo que não é JSON", async () => {
    expect(
      (
        await POST(
          req("POST", { ...corpo, endpoint: "http://push.exemplo.invalid/x" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          req("POST", { endpoint: corpo.endpoint, chaves: { p256dh: "x" } }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(req("POST", "não é json"))).status).toBe(400);
    expect(inscricoesDemonstracao()).toHaveLength(0);
  });

  it("DELETE tira só a inscrição de quem pediu", async () => {
    await POST(req("POST", corpo));
    sessao.mockResolvedValue({ ...SESSAO, usuarioId: "u2" });
    await DELETE(req("DELETE", { endpoint: corpo.endpoint }));
    expect(inscricoesDemonstracao()).toHaveLength(1);
    sessao.mockResolvedValue(SESSAO);
    expect(
      (await DELETE(req("DELETE", { endpoint: corpo.endpoint }))).status,
    ).toBe(200);
    expect(inscricoesDemonstracao()).toHaveLength(0);
  });
});
