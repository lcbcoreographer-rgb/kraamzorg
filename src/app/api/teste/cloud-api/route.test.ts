import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCapturas, registrarCaptura } from "@/lib/messaging/captura";
import { DELETE, GET } from "./route";

const req = (segredo?: string) =>
  new Request("https://app.exemplo.invalid/api/teste/cloud-api", {
    headers: segredo ? { "x-kz-interno-secret": segredo } : {},
  });

beforeEach(() => {
  limparCapturas();
  vi.stubEnv("INTERNAL_ROUTES_SECRET", "segredo-interno-teste");
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/teste/cloud-api", () => {
  it("fora de homologação recusa tudo", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "producao");
    registrarCaptura({ type: "text" });
    expect((await GET(req("segredo-interno-teste"))).status).toBe(403);
    expect((await DELETE(req("segredo-interno-teste"))).status).toBe(403);
  });

  it("em homologação exige o segredo das rotas internas", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("errado"))).status).toBe(401);
  });

  it("lista e limpa o que o adaptador capturou", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "preview");
    registrarCaptura({ type: "template", template: { name: "kz_x" } });
    const lista = await (await GET(req("segredo-interno-teste"))).json();
    expect(lista.envios).toHaveLength(1);
    expect(lista.envios[0].corpo.template.name).toBe("kz_x");
    expect((await DELETE(req("segredo-interno-teste"))).status).toBe(200);
    const vazia = await (await GET(req("segredo-interno-teste"))).json();
    expect(vazia.envios).toHaveLength(0);
  });
});
