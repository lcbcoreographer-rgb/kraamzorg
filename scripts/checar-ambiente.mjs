#!/usr/bin/env node
/**
 * Confere as variáveis de ambiente de um ambiente do Kraamzorg OS (P14 item 1
 * e 2, docs/runbooks/ambientes.md) antes de promover um deploy. Lê
 * `process.env` (carregue o arquivo com `node --env-file=.env.hml ...` ou
 * rode dentro do ambiente da Vercel) e escreve só NOMES de variável e o
 * motivo, nunca um valor: a saída pode ir para o log do CI sem vazar segredo.
 *
 *   node --env-file=.env.hml scripts/checar-ambiente.mjs --env hml
 *   node scripts/checar-ambiente.mjs --env producao
 *
 * Ambientes: desenvolvimento, homologacao (ou hml), producao (ou prod). Sai
 * com código 1 se houver problema.
 *
 * As regras que importam para o LGPD:
 * - Homologação e produção nunca ligam o modo demonstração (`KZ_DADOS`).
 * - `NEXT_PUBLIC_APP_ENV` tem de ser o do ambiente que se confere.
 * - Produção nunca usa o sandbox da Autentique nem a chave de teste do
 *   Turnstile, e exige a Cloud API do WhatsApp (T-01) e a assinatura do
 *   webhook.
 */

const APELIDOS = {
  hml: "homologacao",
  homologacao: "homologacao",
  prod: "producao",
  producao: "producao",
  dev: "desenvolvimento",
  desenvolvimento: "desenvolvimento",
};

/** Obrigatórias em homologação e produção. */
const COMUNS = [
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "CRON_SECRET",
  "INTERNAL_ROUTES_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "AUTENTIQUE_API_TOKEN",
  "AUTENTIQUE_WEBHOOK_SECRET",
  "INFINITEPAY_HANDLE",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

/** Só produção: o agente só volta com a Cloud API (PRD 4.1 D-08, T-01). */
const SO_PRODUCAO = [
  "WHATSAPP_CLOUD_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
];

/** Segredos que precisam ter comprimento decente. */
const SEGREDOS_MINIMO_24 = [
  "CRON_SECRET",
  "INTERNAL_ROUTES_SECRET",
  "AUTENTIQUE_WEBHOOK_SECRET",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
];

const CHAVES_DE_TESTE_TURNSTILE = [
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "3x00000000000000000000FF",
  "1x0000000000000000000000AA",
];

const vazio = (v) => v === undefined || v === null || String(v).trim() === "";

export function normalizarAmbiente(nome) {
  return APELIDOS[String(nome ?? "").toLowerCase()] ?? null;
}

/**
 * @param {string} ambiente desenvolvimento | homologacao | producao (ou apelido)
 * @param {Record<string, string | undefined>} variaveis normalmente process.env
 * @returns {{ ambiente: string, problemas: { variavel: string, motivo: string }[] }}
 */
export function checarAmbiente(ambiente, variaveis) {
  const alvo = normalizarAmbiente(ambiente);
  if (!alvo)
    throw new Error(
      `ambiente desconhecido: "${ambiente}" (use desenvolvimento, homologacao ou producao)`,
    );
  const problemas = [];
  const falta = (variavel, motivo = "está vazia ou ausente") =>
    problemas.push({ variavel, motivo });

  if (alvo === "desenvolvimento") {
    for (const v of ["NEXT_PUBLIC_APP_ENV"]) if (vazio(variaveis[v])) falta(v);
    if (
      !vazio(variaveis.NEXT_PUBLIC_APP_ENV) &&
      variaveis.NEXT_PUBLIC_APP_ENV !== "desenvolvimento"
    ) {
      falta(
        "NEXT_PUBLIC_APP_ENV",
        `vale "${variaveis.NEXT_PUBLIC_APP_ENV}", esperado "desenvolvimento"`,
      );
    }
    return { ambiente: alvo, problemas };
  }

  for (const v of COMUNS) if (vazio(variaveis[v])) falta(v);
  if (alvo === "producao")
    for (const v of SO_PRODUCAO) if (vazio(variaveis[v])) falta(v);

  if (
    !vazio(variaveis.NEXT_PUBLIC_APP_ENV) &&
    variaveis.NEXT_PUBLIC_APP_ENV !== alvo
  ) {
    falta("NEXT_PUBLIC_APP_ENV", `deveria valer "${alvo}" neste ambiente`);
  }
  if (!vazio(variaveis.KZ_DADOS)) {
    falta(
      "KZ_DADOS",
      "o modo demonstração (dado fictício em memória) não pode estar ligado em homologação nem em produção",
    );
  }
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "APP_BASE_URL"]) {
    if (!vazio(variaveis[v]) && !String(variaveis[v]).startsWith("https://"))
      falta(v, "precisa começar com https://");
  }
  if (
    !vazio(variaveis.APP_BASE_URL) &&
    /\/$/.test(String(variaveis.APP_BASE_URL))
  )
    falta("APP_BASE_URL", "sem barra no fim");
  for (const v of SEGREDOS_MINIMO_24) {
    if (!vazio(variaveis[v]) && String(variaveis[v]).length < 24)
      falta(v, "curto demais (mínimo de 24 caracteres)");
  }
  if (
    !vazio(variaveis.VAPID_SUBJECT) &&
    !/^(mailto:|https:\/\/)/.test(String(variaveis.VAPID_SUBJECT))
  ) {
    falta("VAPID_SUBJECT", "precisa começar com mailto: ou https://");
  }
  if (
    !vazio(variaveis.NEXT_PUBLIC_SENTRY_DSN) &&
    !String(variaveis.NEXT_PUBLIC_SENTRY_DSN).startsWith("https://")
  ) {
    falta("NEXT_PUBLIC_SENTRY_DSN", "precisa começar com https://");
  }

  if (alvo === "producao") {
    if (
      !vazio(variaveis.AUTENTIQUE_SANDBOX) &&
      variaveis.AUTENTIQUE_SANDBOX !== "false"
    ) {
      falta(
        "AUTENTIQUE_SANDBOX",
        'em produção só "false" (qualquer outro valor mantém o sandbox ligado)',
      );
    }
    if (vazio(variaveis.AUTENTIQUE_SANDBOX)) {
      falta(
        "AUTENTIQUE_SANDBOX",
        'em produção precisa valer "false" explicitamente',
      );
    }
    if (
      CHAVES_DE_TESTE_TURNSTILE.includes(
        String(variaveis.TURNSTILE_SECRET_KEY ?? ""),
      )
    ) {
      falta(
        "TURNSTILE_SECRET_KEY",
        "é a chave de teste pública da Cloudflare (sempre passa)",
      );
    }
    if (
      variaveis.VERCEL_ENV !== undefined &&
      variaveis.VERCEL_ENV !== "production"
    ) {
      falta(
        "VERCEL_ENV",
        `vale "${variaveis.VERCEL_ENV}"; produção só sobe do ambiente Production da Vercel`,
      );
    }
  }
  if (alvo === "homologacao" && variaveis.VERCEL_ENV === "production") {
    falta(
      "VERCEL_ENV",
      "homologação não pode rodar no ambiente Production da Vercel",
    );
  }

  return { ambiente: alvo, problemas };
}

function argumento(argv, opcao) {
  const i = argv.indexOf(opcao);
  return i === -1 ? null : (argv[i + 1] ?? null);
}

function principal() {
  const nome = argumento(process.argv.slice(2), "--env");
  if (!nome) {
    console.error(
      "uso: node scripts/checar-ambiente.mjs --env <desenvolvimento|homologacao|producao>",
    );
    process.exitCode = 2;
    return;
  }
  let resultado;
  try {
    resultado = checarAmbiente(nome, process.env);
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 2;
    return;
  }
  if (resultado.problemas.length === 0) {
    console.log(
      `ambiente ${resultado.ambiente}: variáveis conferidas, nenhum problema.`,
    );
    return;
  }
  console.error(
    `ambiente ${resultado.ambiente}: ${resultado.problemas.length} problema(s):`,
  );
  for (const p of resultado.problemas)
    console.error(`  - ${p.variavel}: ${p.motivo}`);
  process.exitCode = 1;
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  principal();
