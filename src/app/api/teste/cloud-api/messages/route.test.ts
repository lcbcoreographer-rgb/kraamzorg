import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCapturas, listarCapturas } from "@/lib/messaging/captura";
import { POST } from "./route";

const pedir = (corpo: unknown) =>
  new Request("https://app.exemplo.invalid/api/teste/cloud-api/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

const MODELO = {
  messaging_product: "whatsapp",
  to: "5500000000001",
  type: "template",
  template: { name: "kz_x", language: { code: "pt_BR" } },
};

beforeEach(() => limparCapturas());
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/teste/cloud-api/messages", () => {
  it("fora de homologação recusa e não captura nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "producao");
    expect((await POST(pedir(MODELO))).status).toBe(403);
    expect(listarCapturas()).toHaveLength(0);
  });

  it("em homologação captura o corpo e responde no formato da Cloud API, com um wamid de teste", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "preview");
    const r = await POST(pedir(MODELO));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.messages[0].id).toMatch(/^wamid\.TESTE\./);
    expect(listarCapturas()[0]?.corpo).toMatchObject({ type: "template" });
  });

  it("recusa corpo que não parece o da Cloud API", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await POST(pedir({ number: "x", text: "y" }))).status).toBe(400);
    expect((await POST(pedir("não é json"))).status).toBe(400);
    expect(listarCapturas()).toHaveLength(0);
  });
});
