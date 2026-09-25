import "server-only";

/**
 * E-mail pelo Resend, reserva da central interna (P18 item 3: "e-mail pelo
 * Resend como reserva"). Sem SDK própria (nada de dependência nova nesta
 * sessão): POST direto na API HTTP do Resend.
 *
 * `RESEND_API_KEY` já está em `.env.example` (raiz, fora das pastas deste
 * módulo). Falta lá `RESEND_FROM_EMAIL` (o remetente verificado no
 * domínio da Kraamzorg), sem ela, `enviarEmail` devolve falha sem tentar
 * a rede, do mesmo jeito que `src/lib/messaging/uazapi.ts` faz sem
 * configuração.
 */
export interface ResultadoEmail {
  ok: boolean;
  motivo?: string;
}

export async function enviarEmail(
  destinatario: string,
  assunto: string,
  texto: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEmail> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.RESEND_FROM_EMAIL;
  if (!chave || !remetente) {
    return {
      ok: false,
      motivo:
        "O e-mail de reserva não está configurado (RESEND_API_KEY, RESEND_FROM_EMAIL).",
    };
  }

  let resposta: Response;
  try {
    resposta = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        from: remetente,
        to: [destinatario],
        subject: assunto,
        text: texto,
      }),
    });
  } catch {
    return { ok: false, motivo: "Não deu para falar com o Resend agora." };
  }

  if (!resposta.ok) {
    return {
      ok: false,
      motivo: `O Resend recusou o envio (HTTP ${resposta.status}).`,
    };
  }
  return { ok: true };
}
