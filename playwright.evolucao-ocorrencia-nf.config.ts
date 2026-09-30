import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração dos testes de ponta a ponta da evolução aos médicos, das
 * ocorrências com pesquisa e pós-venda, e das notas fiscais (P41, P42 e P43).
 * Dois projetos, celular (390 x 844) e computador, cada um com o próprio
 * servidor: no modo demonstração os dados vivem na memória do processo, e
 * estes testes preenchem, aprovam e enviam evolução, respondem a pesquisa e
 * emitem nota. Um trabalhador só e a ordem dos arquivos mantêm os testes
 * previsíveis dentro de cada servidor.
 *
 * O modo é o de demonstração (KZ_DADOS=demonstracao), porque esta máquina não
 * tem Supabase Auth: o e-mail cai numa caixa de saída local, o provedor de
 * notas é de mentira e o Turnstile é um dublê. O Supabase de verdade é coberto
 * por supabase/tests/024_evolucao_ocorrencia_nf.sql e pelos testes dos
 * repositórios.
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;
const porta = Number(process.env.PW_PORT || "3000");
const portaComputador = porta + 1;

const ambienteDemonstracao = {
  NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  KZ_DADOS: "demonstracao",
};

export default defineConfig({
  testDir: "./tests/e2e-evolucao-ocorrencia-nf",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    [
      "html",
      {
        open: "never",
        outputFolder: "playwright-report-evolucao-ocorrencia-nf",
      },
    ],
  ],
  outputDir: "test-results-evolucao-ocorrencia-nf",
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
