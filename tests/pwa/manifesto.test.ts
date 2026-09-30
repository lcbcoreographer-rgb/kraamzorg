import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Manifesto do app instalável da enfermeira (P38 item 2, PRD D-01). Vive em
 * `public/manifest.webmanifest` (e não em `src/app/manifest.ts`) porque as
 * cores da marca só podem aparecer em `globals.css` dentro de `src/`
 * (tests/tokens/sem-cor-solta.test.ts); um manifesto exige hexadecimal.
 */
const RAIZ = process.cwd();
const manifesto = JSON.parse(
  readFileSync(join(RAIZ, "public", "manifest.webmanifest"), "utf8"),
) as {
  start_url: string;
  scope: string;
  display: string;
  lang: string;
  short_name: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; purpose?: string }[];
};

describe("manifesto do app instalável (P38)", () => {
  it("abre no Hoje, em tela cheia, em português", () => {
    expect(manifesto.start_url).toBe("/hoje");
    expect(manifesto.display).toBe("standalone");
    expect(manifesto.lang).toBe("pt-BR");
    expect(manifesto.short_name).toBe("Kraamzorg");
  });

  it("usa as cores da marca (creme de fundo, marinho na barra)", () => {
    expect(manifesto.background_color).toBe("#FCF8ED");
    expect(manifesto.theme_color).toBe("#0F1F36");
  });

  it("tem os ícones que o navegador exige para instalar, e os arquivos existem", () => {
    const tamanhos = manifesto.icons.map((i) => i.sizes);
    expect(tamanhos).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifesto.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icone of manifesto.icons) {
      expect(existsSync(join(RAIZ, "public", icone.src))).toBe(true);
    }
  });

  it("o service worker cobre o site e não guarda página nenhuma do portal", () => {
    const sw = readFileSync(join(RAIZ, "public", "sw.js"), "utf8");
    // Só estáticos e o casco sem dado entram no cache (LGPD).
    expect(sw).toContain('"/_next/static/"');
    expect(sw).toContain('const PAGINA_OFFLINE = "/portal-offline"');
    expect(sw).toMatch(/Response\.redirect/);
  });
});
