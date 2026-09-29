/*
 * Service worker do app instalável da enfermeira (P38 item 2, PRD D-01 e
 * LGPD). Ele guarda SÓ o casco do portal: script, estilo, fonte, ícone e a
 * página de sem sinal (/portal-offline), que não tem dado de família. Nenhuma
 * página do portal (Hoje, Famílias, Perfil) é guardada aqui: dado de paciente
 * em repouso vive apenas no IndexedDB do aparelho, por 24 horas e apagado no
 * logout (src/lib/sync/cache.ts). Sem sinal, uma navegação para o portal vira
 * um redirecionamento para /portal-offline, que lê o IndexedDB.
 */
const VERSAO = "v1";
const CASCO = `kz-casco-${VERSAO}`;
const PAGINA_OFFLINE = "/portal-offline";
const ROTAS_DO_PORTAL = ["/hoje", "/minhas-familias", "/alertas", "/perfil"];
const ESTATICOS = ["/_next/static/", "/icones/", "/brand/"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("kz-casco-") && n !== CASCO)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function rotaDoPortal(caminho) {
  return (
    ROTAS_DO_PORTAL.find((r) => caminho === r || caminho.startsWith(`${r}/`)) ??
    null
  );
}

async function primeiroEstatico(pedido) {
  const cache = await caches.open(CASCO);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok) cache.put(pedido, resposta.clone()).catch(() => undefined);
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (ESTATICOS.some((p) => url.pathname.startsWith(p))) {
    evento.respondWith(primeiroEstatico(pedido));
    return;
  }

  if (pedido.mode !== "navigate") return;

  if (url.pathname === PAGINA_OFFLINE) {
    evento.respondWith(
      fetch(pedido).catch(async () => {
        const cache = await caches.open(CASCO);
        const pagina = await cache.match(PAGINA_OFFLINE, {
          ignoreSearch: true,
        });
        return pagina ?? Response.error();
      }),
    );
    return;
  }

  const rota = rotaDoPortal(url.pathname);
  if (rota) {
    evento.respondWith(
      fetch(pedido).catch(async () => {
        const cache = await caches.open(CASCO);
        const pagina = await cache.match(PAGINA_OFFLINE, {
          ignoreSearch: true,
        });
        if (!pagina) return Response.error();
        const destino = new URL(PAGINA_OFFLINE, self.location.origin);
        destino.searchParams.set("de", rota.slice(1));
        return Response.redirect(destino.href, 302);
      }),
    );
  }
});

/* Guarda a página de sem sinal e tudo o que ela carrega (scripts, estilo, fontes). */
async function precarregar() {
  const cache = await caches.open(CASCO);
  const pagina = await fetch(PAGINA_OFFLINE, { credentials: "same-origin" });
  if (!pagina.ok) return;
  await cache.put(PAGINA_OFFLINE, pagina.clone());
  const html = await pagina.text();
  const arquivos = new Set(
    (html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) ?? []).map((a) =>
      a.replace(/&amp;/g, "&"),
    ),
  );
  [
    "/icones/icone-192.png",
    "/icones/icone-512.png",
    "/icones/apple-touch-icon.png",
  ].forEach((i) => arquivos.add(i));
  for (const arquivo of arquivos) {
    try {
      let resposta = await cache.match(arquivo);
      if (!resposta) {
        resposta = await fetch(arquivo);
        if (!resposta.ok) continue;
        await cache.put(arquivo, resposta.clone());
      }
      if (arquivo.split("?")[0].endsWith(".css")) {
        const texto = await resposta.clone().text();
        const base = new URL(arquivo, self.location.origin);
        const fontes = new Set(
          [...texto.matchAll(/url\(([^)]+)\)/g)]
            .map((m) => m[1].replace(/["']/g, "").trim())
            .filter((u) => !u.startsWith("data:")),
        );
        for (const fonte of fontes) {
          const alvo = new URL(fonte, base);
          if (alvo.origin !== self.location.origin) continue;
          if (await cache.match(alvo.pathname + alvo.search)) continue;
          const f = await fetch(alvo.pathname + alvo.search);
          if (f.ok) await cache.put(alvo.pathname + alvo.search, f);
        }
      }
    } catch {
      // Sem sinal no meio: o que já entrou fica, o resto vem na próxima abertura.
    }
  }
}

self.addEventListener("message", (evento) => {
  const tipo = evento.data && evento.data.tipo;
  if (tipo === "precarregar") {
    evento.waitUntil(precarregar().catch(() => undefined));
  } else if (tipo === "limpar") {
    evento.waitUntil(
      caches
        .keys()
        .then((nomes) =>
          Promise.all(
            nomes
              .filter((n) => n.startsWith("kz-casco-"))
              .map((n) => caches.delete(n)),
          ),
        ),
    );
  }
});
