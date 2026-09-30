import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta de P11 (app instalável e instalação guiada) e P14
 * (cabeçalhos de segurança, CSP com nonce e saúde do sistema), sobre o build
 * de produção (`pnpm build`): o service worker, a CSP de produção e o
 * `/api/saude` só se comportam de verdade assim. Dois projetos, celular
 * (390 x 844) e computador, cada um com o próprio servidor.
 *
 * O modo é o de demonstração (KZ_DADOS=demonstracao), porque esta máquina
 * não tem Supabase Auth. A chave pública VAPID é a de exemplo da
 * especificação do protocolo (não é segredo, não tem chave privada aqui).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;
const porta = Number(process.env.PW_PORT || "3000");
const portaComputador = porta + 1;

// Segredo das rotas internas só deste teste: sorteado a cada execução (nenhum
// segredo, nem de mentira, mora no repositório) e repassado ao spec pelo
// ambiente do processo.
const segredoInterno =
  process.env.KZ_E2E_SEGREDO ?? `e2e-${randomBytes(16).toString("hex")}`;
process.env.KZ_E2E_SEGREDO = segredoInterno;

const ambiente = {
  NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  KZ_DADOS: "demonstracao",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY:
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  NEXT_PUBLIC_SUPABASE_URL: "https://exemplo-nao-real.supabase.invalid",
  NEXT_PUBLIC_SENTRY_DSN: "https://chave@o1.ingest.sentry.io/1",
  INTERNAL_ROUTES_SECRET: segredoInterno,
};

export default defineConfig({
  testDir: "./tests/e2e-infra",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report-infra" }],
  ],
  outputDir: "test-results-infra",
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${porta}`,
      url: `http://127.0.0.1:${porta}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: ambiente,
    },
    {
      command: `pnpm start -p ${portaComputador}`,
      url: `http://127.0.0.1:${portaComputador}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambiente,
    },
  ],
  use: { trace: "on-first-retry" },
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
