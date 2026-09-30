/**
 * Registro do service worker do app instalável (`public/sw.js`, P38 e P11).
 * Só em produção e com sinal: em desenvolvimento o worker atrapalharia o
 * recarregamento, e o registro precisa buscar o arquivo na rede. Devolve o
 * registro pronto, ou `null` se o navegador não suporta ou o registro falhou.
 * Nunca lança: o app funciona sem worker (só não abre sem sinal).
 */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return null;
  if (process.env.NODE_ENV !== "production" || !navigator.onLine) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}
