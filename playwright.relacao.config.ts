import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta do relacionamento da fase 3 (P47 a P51): captação
 * por canal, marketing, copiloto, portal da família, parceiros médicos,
 * tarefas por equipe, manuais e banco de talentos. Dois projetos, celular
 * (390 x 844) e computador, cada um com o próprio servidor: no modo
 * demonstração os dados vivem na memória do processo e estes testes mudam
 * canais, indicações, manuais e candidatas. Um trabalhador só, para a ordem
 * dos arquivos ficar previsível dentro de cada servidor.
 *
 * O build é de produção (`pnpm build`). O modo é o de demonstração
 * (KZ_DADOS=demonstracao): esta máquina não tem Supabase Auth. O banco de
 * verdade é coberto por supabase/tests/027_*.sql e pelos testes dos
 * repositórios.
 *
 * Uso: PW_CHROMIUM_EXECUTABLE=/caminho/do/chromium PW_PORT=3300 \
 *      pnpm e2e:relacao
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;
const porta = Number(process.env.PW_PORT || "3000");
const portaComputador = porta + 1;

const ambienteDemonstracao = {
  NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  KZ_DADOS: "demonstracao",
};

export default defineConfig({
  testDir: "./tests/e2e-relacao",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report-relacao" }],
  ],
  outputDir: "test-results-relacao",
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${porta}`,
      url: `http://127.0.0.1:${porta}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaComputador}`,
      url: `http://127.0.0.1:${portaComputador}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
  ],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        baseURL: `http://127.0.0.1:${porta}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${portaComputador}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
  ],
});
