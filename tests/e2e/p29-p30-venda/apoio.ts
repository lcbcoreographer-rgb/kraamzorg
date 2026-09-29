import type { Page, TestInfo } from "@playwright/test";
import { entrarComo, passarPeloMfa } from "../apoio/entrar";

/**
 * Apoio dos e2e da venda (P29 e P30). Rodam só nos projetos
 * "celular-venda" e "computador-venda" (playwright.config.ts), cada um com
 * um servidor próprio: marcam conversa, movem o P1 e o P2 e consomem o link
 * de uso único, e nada disso pode mexer nas famílias que os outros testes
 * leem.
 */
export function noCelular(info: TestInfo): boolean {
  return info.project.name.startsWith("celular");
}

/** "aaaa-mm-dd" daqui a alguns dias (o seletor de data nativo aceita assim). */
export function daquiDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * O script do Turnstile vem da Cloudflare; no e2e ele é trocado por um
 * dublê que responde como a chave de teste "sempre passa" (o servidor, em
 * desenvolvimento sem chaves, verifica com a chave de teste, sem rede). O
 * dublê devolve o token de novo a cada `reset`, como o widget real faz.
 */
export async function dubleTurnstile(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/**", (rota) =>
    rota.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile = {
        _o: null,
        render(el, o) { this._o = o; setTimeout(() => o.callback("XXXX.DUMMY.TOKEN.XXXX"), 30); return "duble"; },
        reset() { const o = this._o; if (o) setTimeout(() => o.callback("XXXX.DUMMY.TOKEN.XXXX"), 30); },
        remove() {}
      };`,
    }),
  );
}

/**
 * Entra e sobe para AAL2 na hora. O comercial não é obrigado a ter MFA,
 * mas a proposta pede AAL2, e os dois arquivos de teste rodam juntos no
 * mesmo servidor: quando um cadastra o MFA do comercial, a sessão AAL1 do
 * outro passa a ser levada ao desafio no meio do fluxo (acesso.ts,
 * precisaMfa). Começando em AAL2, nenhum teste depende da ordem do outro.
 */
export async function entrarEmAal2(page: Page, rotulo: string): Promise<void> {
  await entrarComo(page, rotulo);
  await page.goto("/mfa/cadastro");
  await passarPeloMfa(page);
}
