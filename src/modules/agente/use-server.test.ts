// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

/**
 * Um arquivo "use server" só pode exportar funções assíncronas: com um
 * objeto exportado (o estado inicial do useActionState, por exemplo), o
 * Next recusa o módulo em tempo de execução e todas as ações da tela
 * quebram com erro 500, sem o typecheck nem o lint perceberem.
 */
const ARQUIVOS = ["acoes.ts", "admin-acoes.ts", "conversa-detalhe/acoes.ts"];

describe('arquivos "use server" do agente exportam só funções assíncronas', () => {
  it.each(ARQUIVOS)("%s", async (arquivo) => {
    const fonte = readFileSync(join(__dirname, arquivo), "utf8");
    expect(fonte.startsWith('"use server"')).toBe(true);
    const modulo = (await import(
      `./${arquivo.replace(/\.ts$/, "")}`
    )) as Record<string, unknown>;
    for (const [nome, valor] of Object.entries(modulo)) {
      expect(typeof valor, nome).toBe("function");
      expect((valor as () => unknown).constructor.name, nome).toBe(
        "AsyncFunction",
      );
    }
  });
});
