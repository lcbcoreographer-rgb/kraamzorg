import "server-only";

/**
 * Cloudflare Turnstile nos formulários públicos (PRD 21.3; P30 item 2).
 * Chaves só em variável de ambiente (.env.example): a site key vai ao
 * navegador, o segredo fica no servidor.
 *
 * Modo de teste só em desenvolvimento: sem chaves configuradas e com
 * NEXT_PUBLIC_APP_ENV=desenvolvimento (fora de um deploy de produção da
 * Vercel), valem as chaves de teste que a própria Cloudflare publica
 * ("always passes"). Elas não são segredo: estão na documentação pública
 * do Turnstile e não validam nada de verdade. Com chave de teste, a
 * verificação acontece aqui mesmo, sem rede, com o comportamento
 * documentado de cada uma (1x aceita, 2x recusa, 3x "token já usado"), o
 * que deixa o e2e determinístico.
 *
 * Em produção a regra fecha: sem chave, ou com chave de teste, nenhum
 * envio passa (o formulário diz que a verificação não carregou). Em
 * homologação as chaves precisam estar configuradas (a Kraamzorg cria o
 * widget do domínio de homologação na Cloudflare).
 */

export const TURNSTILE_TESTE = {
  /** Site key de teste visível que sempre passa. */
  siteSempreAceita: "1x00000000000000000000AA",
  segredoSempreAceita: "1x0000000000000000000000000000000AA",
  segredoSempreRecusa: "2x0000000000000000000000000000000AA",
  segredoTokenGasto: "3x0000000000000000000000000000000AA",
} as const;

const URL_VERIFICAR =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** As chaves de teste da Cloudflare têm esta forma (1x, 2x ou 3x e zeros). */
export function ehChaveDeTeste(chave: string): boolean {
  return /^[1-3]x0{15,}[A-Z]{2}$/.test(chave);
}

function emProducao(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_ENV === "producao" ||
    process.env.VERCEL_ENV === "production"
  );
}

function modoTestePermitido(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_ENV === "desenvolvimento" &&
    process.env.VERCEL_ENV !== "production"
  );
}

export interface ConfiguracaoTurnstile {
  /** null quando não há como verificar (o envio fica fechado). */
  siteKey: string | null;
  segredo: string | null;
}

export function configuracaoTurnstile(): ConfiguracaoTurnstile {
  const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const segredo = process.env.TURNSTILE_SECRET_KEY?.trim() || null;

  if (!site && !segredo && modoTestePermitido()) {
    return {
      siteKey: TURNSTILE_TESTE.siteSempreAceita,
      segredo: TURNSTILE_TESTE.segredoSempreAceita,
    };
  }
  if (!site || !segredo) return { siteKey: null, segredo: null };
  if (emProducao() && (ehChaveDeTeste(site) || ehChaveDeTeste(segredo))) {
    return { siteKey: null, segredo: null };
  }
  return { siteKey: site, segredo };
}

export type ResultadoTurnstile =
  | { ok: true }
  | { ok: false; motivo: "sem_token" | "recusado" | "indisponivel" };

interface RespostaCloudflare {
  success?: boolean;
  "error-codes"?: string[];
}

/**
 * Confere o token do widget. `ip` é o endereço de quem enviou, que a
 * Cloudflare usa como sinal extra; nunca é gravado nem logado aqui.
 * `fetchImpl` é injetável para o teste (sem chamar a Cloudflare de verdade).
 */
export async function verificarTurnstile(
  token: string | null | undefined,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoTurnstile> {
  const resposta = token?.trim();
  if (!resposta || resposta.length > 2048) {
    return { ok: false, motivo: "sem_token" };
  }
  const { segredo } = configuracaoTurnstile();
  if (!segredo) return { ok: false, motivo: "indisponivel" };

  if (ehChaveDeTeste(segredo)) {
    return segredo.startsWith("1x")
      ? { ok: true }
      : { ok: false, motivo: "recusado" };
  }

  const corpo = new URLSearchParams({ secret: segredo, response: resposta });
  if (ip) corpo.set("remoteip", ip);
  try {
    const http = await fetchImpl(URL_VERIFICAR, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!http.ok) return { ok: false, motivo: "indisponivel" };
    const json = (await http.json()) as RespostaCloudflare;
    return json.success === true
      ? { ok: true }
      : { ok: false, motivo: "recusado" };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}
