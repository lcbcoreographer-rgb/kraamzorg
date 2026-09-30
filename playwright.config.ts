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
// A venda (P29 e P30) marca conversas, move o P1 e o P2 e consome o link de
// uso único do formulário: roda em dois servidores só dela, para não mudar
// as famílias que os outros testes leem (e para eles não mudarem as dela).
const portaVendaCelular = porta + 2;
const portaVendaComputador = porta + 3;
const PASTA_VENDA = "**/p29-p30-venda/**";
const TESTES_VENDA = "**/p29-p30-venda/**/*.spec.ts";
// O contrato e a cobrança (P31 e P32) levam uma família da proposta até o
// pagamento, assinam, pagam e dão baixa: dois servidores só deles, pelo mesmo
// motivo da venda.
const portaContratoCelular = porta + 4;
const portaContratoComputador = porta + 5;
const PASTA_CONTRATO = "**/p31-p32-contrato/**";
const TESTES_CONTRATO = "**/p31-p32-contrato/**/*.spec.ts";
// A operação (P35 e P36) marca consultas, designa, registra nascimento e alta
// na loja em memória: também roda em dois servidores só dela.
const portaOperacaoCelular = porta + 6;
const portaOperacaoComputador = porta + 7;
const PASTA_OPERACAO = "**/p35-p36-operacao/**";
const TESTES_OPERACAO = "**/p35-p36-operacao/**/*.spec.ts";
const PASTAS_A_PARTE = [PASTA_VENDA, PASTA_CONTRATO, PASTA_OPERACAO];

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
    {
      command: `pnpm start -p ${portaVendaCelular}`,
      url: `http://127.0.0.1:${portaVendaCelular}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaVendaComputador}`,
      url: `http://127.0.0.1:${portaVendaComputador}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaContratoCelular}`,
      url: `http://127.0.0.1:${portaContratoCelular}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaOperacaoCelular}`,
      url: `http://127.0.0.1:${portaOperacaoCelular}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaContratoComputador}`,
      url: `http://127.0.0.1:${portaContratoComputador}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: ambienteDemonstracao,
    },
    {
      command: `pnpm start -p ${portaOperacaoComputador}`,
      url: `http://127.0.0.1:${portaOperacaoComputador}`,
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
      testIgnore: PASTAS_A_PARTE,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        baseURL: `http://127.0.0.1:${porta}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador",
      testIgnore: PASTAS_A_PARTE,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${portaComputador}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "celular-venda",
      testMatch: TESTES_VENDA,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        baseURL: `http://127.0.0.1:${portaVendaCelular}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador-venda",
      testMatch: TESTES_VENDA,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${portaVendaComputador}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "celular-contrato",
      testMatch: TESTES_CONTRATO,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        baseURL: `http://127.0.0.1:${portaContratoCelular}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "celular-operacao",
      testMatch: TESTES_OPERACAO,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        baseURL: `http://127.0.0.1:${portaOperacaoCelular}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador-contrato",
      testMatch: TESTES_CONTRATO,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${portaContratoComputador}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: "computador-operacao",
      testMatch: TESTES_OPERACAO,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${portaOperacaoComputador}`,
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
  ],
});
