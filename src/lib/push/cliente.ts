/**
 * Web Push no navegador (P11 item 4). Fluxo: a pessoa toca em "Ligar os
 * avisos"; o navegador pede permissão; o service worker assina o push com a
 * chave pública VAPID; o app manda a inscrição (endereço e chaves do
 * aparelho) para `POST /api/push/inscrever`, que guarda em `inscricao_push`
 * pela função `api.registrar_inscricao_push`.
 *
 * No iPhone e no iPad o push só existe com o app instalado na tela inicial
 * (iOS 16.4 em diante): fora dele `PushManager` nem aparece, e a tela explica.
 * O push é complemento; o canal de alerta crítico é o WhatsApp interno
 * (PRD 15.1).
 */

export type SituacaoPush =
  "sem_suporte" | "sem_chave" | "bloqueado" | "desligado" | "ligado";

/** Converte a chave pública VAPID (base64 url-safe) no formato que `subscribe` pede. */
export function chaveVapidParaBytes(
  base64Url: string,
): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + preenchimento)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bruto = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export function chavePublicaVapid(): string | null {
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return chave && chave.trim() !== "" ? chave.trim() : null;
}

export function pushSuportado(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registroAtivo(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function situacaoDoPush(): Promise<SituacaoPush> {
  if (!pushSuportado()) return "sem_suporte";
  if (!chavePublicaVapid()) return "sem_chave";
  if (Notification.permission === "denied") return "bloqueado";
  const registro = await registroAtivo();
  const inscricao = await registro?.pushManager.getSubscription();
  return inscricao && Notification.permission === "granted"
    ? "ligado"
    : "desligado";
}

async function enviar(
  metodo: "POST" | "DELETE",
  corpo: unknown,
): Promise<boolean> {
  try {
    const resposta = await fetch("/api/push/inscrever", {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return resposta.ok;
  } catch {
    return false;
  }
}

/** Liga o aviso neste aparelho. Devolve a situação depois da tentativa. */
export async function ligarPush(): Promise<SituacaoPush> {
  const antes = await situacaoDoPush();
  if (antes === "sem_suporte" || antes === "sem_chave" || antes === "bloqueado")
    return antes;

  const permissao = await Notification.requestPermission();
  if (permissao === "denied") return "bloqueado";
  if (permissao !== "granted") return "desligado";

  const registro = await registroAtivo();
  const chave = chavePublicaVapid();
  if (!registro || !chave) return "desligado";
  try {
    const inscricao =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveVapidParaBytes(chave),
      }));
    const json = inscricao.toJSON();
    const guardou = await enviar("POST", {
      endpoint: json.endpoint,
      chaves: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
    if (!guardou) {
      // O servidor não guardou: desfaz para a tela não dizer "ligado" sem estar.
      await inscricao.unsubscribe().catch(() => false);
      return "desligado";
    }
    return "ligado";
  } catch {
    return "desligado";
  }
}

/**
 * Reenvia ao servidor a inscrição que este aparelho já tem (idempotente).
 * Roda quando o portal abre: se o serviço de push trocou o endereço, ou se o
 * aparelho passou para outra pessoa, o servidor volta a ter a inscrição certa
 * do dono de agora. Sem permissão, sem inscrição ou sem sinal, não faz nada.
 */
export async function renovarInscricaoPush(): Promise<void> {
  if (!pushSuportado() || Notification.permission !== "granted") return;
  try {
    const registro = await registroAtivo();
    const inscricao = await registro?.pushManager.getSubscription();
    if (!inscricao) return;
    const json = inscricao.toJSON();
    await enviar("POST", {
      endpoint: json.endpoint,
      chaves: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
  } catch {
    // tenta de novo na próxima abertura
  }
}

/**
 * Desliga o aviso neste aparelho: apaga a inscrição no servidor e no
 * navegador. Também roda ao sair do app, para o próximo a usar o aparelho
 * não receber o aviso de outra pessoa. Nunca lança.
 */
export async function desligarPush(): Promise<void> {
  if (!pushSuportado()) return;
  try {
    const registro = await registroAtivo();
    const inscricao = await registro?.pushManager.getSubscription();
    if (!inscricao) return;
    await enviar("DELETE", { endpoint: inscricao.endpoint });
    await inscricao.unsubscribe();
  } catch {
    // sem inscrição para tirar
  }
}
