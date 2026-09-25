import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração principal do Playwright (PRD 5.3, CLAUDE.md).
 * Dois projetos: celular (390 x 844) e computador. O Chromium do ambiente
 * de CI/sessão fica em /opt/pw-browsers e é referenciado por
 * PW_CHROMIUM_EXECUTABLE; sem essa variável, usa o Chromium padrão do
 * Playwright (útil fora deste ambiente).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
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
