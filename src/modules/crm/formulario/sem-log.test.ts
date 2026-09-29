// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aceite do P30: CPF nunca em log, URL ou Sentry. Guarda estática sobre o
 * caminho do dado (formulário público, ações, repositórios e a integração
 * do Turnstile): nenhum console.*, nenhum dado da família em query string
 * e nenhum envio de erro para serviço de monitoramento. O teste de
 * comportamento (acoes.test.ts) confere o console com um CPF de verdade.
 */

const RAIZ = process.cwd();
const ALVOS = [
  "src/modules/crm/formulario",
  "src/modules/crm/proposta",
  "src/modules/crm/sessao-venda",
  "src/app/(publico)",
  "src/app/(app)/familias/[id]/proposta",
  "src/app/(app)/sessoes-venda",
  "src/lib/dados/formulario.ts",
  "src/lib/dados/supabase/formulario.ts",
  "src/lib/dados/supabase/venda.ts",
  "src/lib/dados/demonstracao/venda.ts",
  "src/lib/integracoes/turnstile",
];

function arquivos(alvo: string): string[] {
  const caminho = path.join(RAIZ, alvo);
  if (statSync(caminho).isFile()) return [caminho];
  return readdirSync(caminho, { recursive: true })
    .map((nome) => path.join(caminho, String(nome)))
    .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p));
}

describe("caminho do dado de contrato sem log", () => {
  const fontes = ALVOS.flatMap(arquivos);

  it("encontra os arquivos", () => {
    expect(fontes.length).toBeGreaterThan(20);
  });

  it.each(fontes.map((f) => [path.relative(RAIZ, f), f]))(
    "%s não escreve no console nem manda erro para monitoramento",
    (_nome, arquivo) => {
      const codigo = readFileSync(arquivo, "utf8");
      expect(codigo).not.toMatch(/\bconsole\.(log|info|warn|error|debug)\b/);
      expect(codigo).not.toMatch(/captureException|Sentry\./);
    },
  );

  it("o link do formulário leva só o token no caminho, sem query string", () => {
    const acoes = readFileSync(
      path.join(RAIZ, "src/modules/crm/proposta/acoes.ts"),
      "utf8",
    );
    expect(acoes).toMatch(/\/formulario\/\$\{link\.token\}`/);
    expect(acoes).not.toMatch(/\/formulario\/[^`]*\?/);
  });
});
