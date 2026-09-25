import { expect, test } from "@playwright/test";

/**
 * P25 item 5, P27 · Rota de captura da UAZAPI (`/api/teste/uazapi`), fora
 * de homologação: o servidor de teste do Playwright sobe com
 * `NEXT_PUBLIC_APP_ENV=desenvolvimento` (`playwright.config.ts`, para o
 * modo demonstração funcionar), então a rota tem que recusar sempre por
 * aqui. O comportamento dela ligada mora em
 * `src/app/api/teste/uazapi/route.test.ts` (Vitest, com o ambiente trocado
 * pelo teste).
 */
test("GET recusa fora de homologação", async ({ request }) => {
  const resposta = await request.get("/api/teste/uazapi");
  expect(resposta.status()).toBe(403);
});

test("POST /send/text recusa fora de homologação e não captura nada", async ({
  request,
}) => {
  const resposta = await request.post("/api/teste/uazapi/send/text", {
    data: { number: "+5511900000001", text: "teste" },
  });
  expect(resposta.status()).toBe(403);
});

test("POST /api/agente/reindexar sem sessão recusa com 401", async ({
  request,
}) => {
  const resposta = await request.post("/api/agente/reindexar");
  expect(resposta.status()).toBe(401);
});
