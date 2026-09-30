// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sair = vi.fn(async () => undefined);
vi.mock("@/lib/auth/sessao", () => ({
  obterAutenticacao: () => ({ sair }),
}));

import { GET, POST } from "./route";

beforeEach(() => sair.mockClear());

describe("/sair", () => {
  it("POST encerra a sessão e volta para entrar com um Location relativo (a CSP form-action 'self' recusa outro host)", async () => {
    const r = await POST();
    expect(sair).toHaveBeenCalledOnce();
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/entrar?aviso=saiu");
  });

  it("GET com motivo conhecido mostra o aviso dele; motivo desconhecido vira sessão encerrada", async () => {
    const pedir = (q: string) =>
      GET(new NextRequest(`http://localhost:3000/sair${q}`));
    expect((await pedir("?motivo=sem-acesso")).headers.get("location")).toBe(
      "/entrar?aviso=sem-acesso",
    );
    expect((await pedir("?motivo=qualquer")).headers.get("location")).toBe(
      "/entrar?aviso=sessao-encerrada",
    );
    expect((await pedir("")).headers.get("location")).toBe(
      "/entrar?aviso=sessao-encerrada",
    );
    expect(sair).toHaveBeenCalledTimes(3);
  });
});
