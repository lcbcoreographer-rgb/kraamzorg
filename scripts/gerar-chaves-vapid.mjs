#!/usr/bin/env node
/**
 * Gera um par de chaves VAPID para o Web Push (P11). Escreve as três linhas
 * no formato de `.env` na saída padrão e mais nada: nenhum arquivo é criado,
 * a chave privada nunca vai para o repositório nem para o log do CI.
 *
 *   node scripts/gerar-chaves-vapid.mjs mailto:avisos@dominio-da-kraamzorg
 *
 * Um par por ambiente (homologação e produção). Guarde a chave privada no
 * cofre da Kraamzorg e na variável `VAPID_PRIVATE_KEY` da Vercel. Trocar o
 * par derruba as inscrições existentes: cada aparelho liga os avisos de novo.
 * O primeiro argumento é o contato do assinante (`mailto:` ou `https://`),
 * exigido pelo protocolo.
 */
import webpush from "web-push";

const assunto = process.argv[2];
if (!assunto || !/^(mailto:|https:\/\/)/.test(assunto)) {
  console.error(
    "uso: node scripts/gerar-chaves-vapid.mjs <mailto:contato@dominio | https://dominio>",
  );
  process.exitCode = 2;
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
  console.log(`VAPID_SUBJECT=${assunto}`);
}
