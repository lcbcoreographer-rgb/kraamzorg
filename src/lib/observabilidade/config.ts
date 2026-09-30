import { limparEvento, limparMigalha } from "./limpar";

/**
 * Opções do Sentry (P14 item 5), iguais no servidor e no navegador. Regras:
 *
 * - Sem `NEXT_PUBLIC_SENTRY_DSN`, ou em desenvolvimento, o Sentry não liga:
 *   `opcoesSentry()` devolve `null` e ninguém chama `init`.
 * - Sem dado de gente: `sendDefaultPii` falso, sem usuário, sem cabeçalho,
 *   cookie, corpo nem query string, e todo evento passa por `limparEvento`
 *   antes de sair (nome, telefone, e-mail, CPF e mensagem nunca saem).
 * - Sem desempenho: `tracesSampleRate` 0. O que interessa é o erro. Sem
 *   gravação de sessão.
 * - O ambiente e a versão vêm de variáveis (`NEXT_PUBLIC_APP_ENV`,
 *   `VERCEL_GIT_COMMIT_SHA`); nada de identificador de pessoa.
 */
export interface OpcoesSentry {
  dsn: string;
  environment: string;
  release?: string;
  enabled: true;
  sendDefaultPii: false;
  tracesSampleRate: 0;
  maxBreadcrumbs: number;
  beforeSend: <T>(evento: T) => T;
  beforeSendTransaction: <T>(evento: T) => T;
  beforeBreadcrumb: <T>(migalha: T) => T | null;
}

export function opcoesSentry(
  ambiente: NodeJS.ProcessEnv = process.env,
): OpcoesSentry | null {
  const dsn = ambiente.NEXT_PUBLIC_SENTRY_DSN;
  const app = ambiente.NEXT_PUBLIC_APP_ENV;
  if (!dsn) return null;
  if (app !== "homologacao" && app !== "producao") return null;
  return {
    dsn,
    environment: app,
    release: ambiente.VERCEL_GIT_COMMIT_SHA || undefined,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend: limparEvento,
    beforeSendTransaction: limparEvento,
    beforeBreadcrumb: limparMigalha,
  };
}
