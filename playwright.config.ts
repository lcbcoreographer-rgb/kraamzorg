import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração principal do Playwright (PRD 5.3, CLAUDE.md).
 * Dois projetos: celular (390 x 844) e computador. O Chromium do ambiente
 * de CI/sessão fica em /opt/pw-browsers e é referenciado por
 * PW_CHROMIUM_EXECUTABLE; sem essa variável, usa o Chromium padrão do
 * Playwright (útil fora deste ambiente).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

// Porta do servidor de teste. PW_PORT evita colidir com outra sessão que já
// tenha um `next start` na 3000 (reuseExistingServer usaria o app errado).
const porta = process.env.PW_PORT || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  webServer: {
    command: `pnpm build && pnpm start -p ${porta}`,
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // /design-system só existe em desenvolvimento e homologação (P10 item
    // 4): sem isto, `vitrineLiberada()` recusa por omissão e os testes de
    // design-system.spec.ts e overflow.spec.ts quebram.
    //
    // KZ_DADOS=demonstracao: as telas rodam sobre os dados fictícios em
    // memória (src/lib/dados/modo.ts), porque esta máquina não tem Supabase
    // Auth nem PostgREST. Só vale junto de NEXT_PUBLIC_APP_ENV=desenvolvimento.
    env: { NEXT_PUBLIC_APP_ENV: "desenvolvimento", KZ_DADOS: "demonstracao" },
  },
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
  ],
});
