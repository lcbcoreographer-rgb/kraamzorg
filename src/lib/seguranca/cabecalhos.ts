/**
 * Cabeçalhos de segurança (P14 item 4, PRD 21.2): CSP com nonce, HSTS,
 * `frame-ancestors 'none'`, `Referrer-Policy` e `Permissions-Policy`. Funções
 * puras, sem Next: o proxy (`src/proxy.ts`) monta a CSP de cada requisição
 * com o nonce novo, e `next.config.ts` aplica os cabeçalhos fixos a tudo,
 * inclusive às rotas de API, que o proxy não atravessa.
 *
 * O que a CSP libera, e por quê:
 * - `script-src`: só o que carrega com o nonce da requisição
 *   (`'strict-dynamic'` deixa esses scripts carregarem os seus) e o script
 *   do Cloudflare Turnstile dos formulários públicos. Nunca `unsafe-inline`;
 *   `unsafe-eval` só no `next dev`, para o React mostrar a pilha de erro.
 * - `style-src`: `unsafe-inline`, porque componentes de interface (Radix,
 *   Recharts) escrevem `style` inline; a superfície de ataque por CSS é bem
 *   menor que a de script.
 * - `connect-src`: o próprio app, o projeto Supabase (HTTPS e WebSocket) e o
 *   Sentry (só se houver DSN).
 * - `img-src`: o próprio app, `data:`, `blob:` e o Storage do Supabase (URL
 *   assinada curta).
 * - `frame-src`: só o Turnstile. `frame-ancestors 'none'`: ninguém embute o app.
 * - `worker-src` e `manifest-src`: o service worker e o manifesto do app
 *   instalável (P11).
 * Nenhum outro domínio de terceiro entra sem mudar este arquivo e o teste.
 */

export interface OpcoesCsp {
  nonce: string;
  /** `next dev`: libera `unsafe-eval` e WebSocket do HMR. */
  desenvolvimento?: boolean;
  /**
   * Ambiente da máquina de quem desenvolve (`NEXT_PUBLIC_APP_ENV=
   * desenvolvimento`), mesmo com o build de produção: sem
   * `upgrade-insecure-requests`, porque `http://127.0.0.1` não tem https.
   */
  ambienteLocal?: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL; sem ela, só o próprio app. */
  supabaseUrl?: string;
  /** NEXT_PUBLIC_SENTRY_DSN; sem ela, o Sentry não entra. */
  sentryDsn?: string;
}

const TURNSTILE = "https://challenges.cloudflare.com";

/** Origem (`https://host`) de uma URL, ou nulo se não for uma URL https/http válida. */
function origem(url?: string): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** Nonce novo por requisição: 128 bits aleatórios em base64. */
export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto);
}

export function montarCsp(opcoes: OpcoesCsp): string {
  const supabase = origem(opcoes.supabaseUrl);
  const sentry = origem(opcoes.sentryDsn);
  const dev = opcoes.desenvolvimento === true;

  const conexoes = ["'self'"];
  const imagens = ["'self'", "data:", "blob:"];
  if (supabase) {
    conexoes.push(supabase.origin);
    conexoes.push(
      `${supabase.protocol === "https:" ? "wss" : "ws"}://${supabase.host}`,
    );
    imagens.push(supabase.origin);
  }
  if (sentry) conexoes.push(sentry.origin);
  if (dev) conexoes.push("ws:");

  const diretivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${opcoes.nonce}' 'strict-dynamic' ${TURNSTILE}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imagens.join(" ")}`,
    "font-src 'self'",
    `connect-src ${conexoes.join(" ")}`,
    `frame-src ${TURNSTILE}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!dev && !opcoes.ambienteLocal)
    diretivas.push("upgrade-insecure-requests");
  return diretivas.join("; ");
}

/**
 * CSP das rotas de API (JSON, sem página): nada carrega, ninguém embute. O
 * proxy não atravessa `/api`, então isto sai pelo `next.config.ts`.
 */
export const CSP_API = "default-src 'none'; frame-ancestors 'none'";

export interface Cabecalho {
  key: string;
  value: string;
}

/**
 * Cabeçalhos fixos de toda resposta. HSTS por um ano com subdomínios (a
 * inclusão na lista de pré-carga é decisão da diretoria, `docs/runbooks/
 * ambientes.md`). Microfone só do próprio app: o gravador de áudio da visita
 * usa; câmera, localização, pagamento e USB ficam fechados.
 */
export function cabecalhosFixos(): Cabecalho[] {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
