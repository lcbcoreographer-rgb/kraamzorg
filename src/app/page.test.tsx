import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT ${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));

describe("raiz do app", () => {
  it("manda para /entrar quando o proxy não decidiu antes", async () => {
    const { default: Raiz } = await import("./page");
    expect(() => Raiz()).toThrow("NEXT_REDIRECT /entrar");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });
});
