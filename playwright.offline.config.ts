import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração do invariante 4 (CLAUDE.md, item 22): testes de
 * sincronização com a rede desligada. Ainda sem testes reais, o P12
 * preenche esta pasta junto com o motor offline (src/lib/sync).
 *
 * Cada teste liga a rede para o primeiro carregamento e desliga com
 * `page.context().setOffline(true)` antes de simular o uso sem sinal,
 * porque o próprio carregamento inicial da página precisa da rede.
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

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
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
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
