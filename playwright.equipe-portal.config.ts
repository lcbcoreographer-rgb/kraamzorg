import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração dos testes de ponta a ponta da equipe, da agenda e do portal
 * da enfermeira (P37 e P38). Dois projetos, celular (390 x 844) e computador,
 * cada um com o próprio servidor: no modo demonstração os dados vivem na
 * memória do processo, e estes testes mudam a agenda e o estado da
 * enfermeira (chegada, saída, reagendamento). Um trabalhador só e a ordem
 * dos arquivos (agenda, equipe, portal) mantêm os testes previsíveis dentro
 * de cada servidor.
 *
 * O build é de produção (`pnpm build`): o service worker do app instalável
 * só se registra assim. O modo é o de demonstração (KZ_DADOS=demonstracao),
 * porque esta máquina não tem Supabase Auth; o Supabase de verdade é coberto
 * por supabase/tests/022_agenda_portal.sql e pelos testes do repositório.
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;
const porta = Number(process.env.PW_PORT || "3000");
const portaComputador = porta + 1;

const ambienteDemonstracao = {
  NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  KZ_DADOS: "demonstracao",
};

export default defineConfig({
  testDir: "./tests/e2e-equipe-portal",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    [
      "html",
      { open: "never", outputFolder: "playwright-report-equipe-portal" },
    ],
  ],
  outputDir: "test-results-equipe-portal",
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${porta}`,
      url: `http://127.0.0.1:${porta}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
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
