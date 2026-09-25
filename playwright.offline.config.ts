import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração do invariante 4 (CLAUDE.md, item 22): testes de
 * sincronização com a rede desligada, sobre o motor offline do P12
 * (src/lib/sync) e a demonstração em /dev/sync.
 *
 * Cada teste liga a rede para o primeiro carregamento e desliga com
 * `page.context().setOffline(true)` antes de simular o uso sem sinal,
 * porque o próprio carregamento inicial da página precisa da rede.
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

// Mesma porta configurável de playwright.config.ts (PW_PORT), para não
// reaproveitar por engano um `next start` de outra sessão na 3000.
const porta = Number(process.env.PW_PORT || "3000");

export default defineConfig({
  testDir: "./tests/e2e-offline",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report-offline" }],
  ],
  outputDir: "test-results-offline",
  webServer: {
    command: `pnpm build && pnpm start -p ${porta}`,
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // /dev/sync só existe fora de produção (P12 item 5, mesma regra do
    // /design-system em playwright.config.ts): sem isto, vitrineLiberada()
    // recusa por omissão e os specs deste diretório quebram.
    // KZ_DADOS=demonstracao: /dev/sync e POST /api/sync exigem a sessão do
    // CRM, e nesta máquina a sessão é a do seletor fictício (sem Supabase
    // Auth), igual a playwright.config.ts.
    env: { NEXT_PUBLIC_APP_ENV: "desenvolvimento", KZ_DADOS: "demonstracao" },
  },
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "offline",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
  ],
});
