import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração principal do Playwright (PRD 5.3, CLAUDE.md).
 * Dois projetos: celular (390 x 844) e computador. O Chromium do ambiente
 * de CI/sessão fica em /opt/pw-browsers e é referenciado por
 * PW_CHROMIUM_EXECUTABLE; sem essa variável, usa o Chromium padrão do
 * Playwright (útil fora deste ambiente).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

// Portas dos servidores de teste. PW_PORT evita colidir com outra sessão
// que já tenha um `next start` na 3000 (reuseExistingServer usaria o app
// errado). Cada projeto tem o próprio servidor (PW_PORT e PW_PORT + 1): no
// modo demonstração os dados vivem na memória do processo, e com um
// servidor só o celular e o computador gravavam na mesma loja ao mesmo
// tempo (um concluía a tarefa, resolvia a transferência ou movia a
// família que o outro ainda ia ler). Achado da integração do CRM.
const porta = Number(process.env.PW_PORT || "3000");
const portaComputador = porta + 1;

// /design-system só existe em desenvolvimento e homologação (P10 item 4):
// sem isto, `vitrineLiberada()` recusa por omissão e os testes de
// design-system.spec.ts e overflow.spec.ts quebram.
//
// KZ_DADOS=demonstracao: as telas rodam sobre os dados fictícios em memória
// (src/lib/dados/modo.ts), porque esta máquina não tem Supabase Auth nem
// PostgREST. Só vale junto de NEXT_PUBLIC_APP_ENV=desenvolvimento.
const ambienteDemonstracao = {
  NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  KZ_DADOS: "demonstracao",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  // Os servidores sobem em ordem: o primeiro faz o build, o segundo só
  // inicia outro processo sobre o mesmo build.
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${porta}`,
      url: `http://127.0.0.1:${porta}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
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
