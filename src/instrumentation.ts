import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/observabilidade/config";

/**
 * Instrumentação do servidor (node_modules/next/dist/docs, guides/
 * instrumentation.md). Liga o Sentry, sem dado de gente (P14 item 5,
 * `src/lib/observabilidade`). Sem DSN ou em desenvolvimento, não faz nada.
 */
export function register() {
  const opcoes = opcoesSentry();
  if (opcoes) Sentry.init(opcoes);
}

/** Erro de requisição do servidor (página, ação, rota) vai para o Sentry já limpo pelo `beforeSend`. */
export const onRequestError = Sentry.captureRequestError;
