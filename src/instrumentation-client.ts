import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/observabilidade/config";

/**
 * Instrumentação do navegador (node_modules/next/dist/docs,
 * file-conventions/instrumentation-client.md): liga o Sentry antes de o app
 * ficar interativo, com a mesma limpeza do servidor (P14 item 5). Só as
 * variáveis `NEXT_PUBLIC_*` chegam aqui.
 */
try {
  const opcoes = opcoesSentry({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  } as unknown as NodeJS.ProcessEnv);
  if (opcoes) Sentry.init(opcoes);
} catch {
  // Observabilidade nunca derruba o app.
}
