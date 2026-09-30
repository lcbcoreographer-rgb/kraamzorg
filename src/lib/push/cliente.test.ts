import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chaveVapidParaBytes,
  desligarPush,
  ligarPush,
  pushSuportado,
  renovarInscricaoPush,
  situacaoDoPush,
} from "./cliente";

const CHAVE =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function inscricaoFalsa(endpoint = "https://push.exemplo.invalid/abc") {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      keys: { p256dh: "chave-publica", auth: "segredo" },
    }),
    unsubscribe: vi.fn(async () => true),
  };
}

function montarNavegador(
  opcoes: {
    inscricao?: ReturnType<typeof inscricaoFalsa> | null;
    permissao?: NotificationPermission;
    pedir?: NotificationPermission;
  } = {},
) {
  const inscricao = opcoes.inscricao === undefined ? null : opcoes.inscricao;
  const gerenciador = {
    getSubscription: vi.fn(async () => inscricao),
    subscribe: vi.fn(async () => inscricaoFalsa()),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => ({ pushManager: gerenciador }) },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class {},
  });
  const notificacao = {
    permission: opcoes.permissao ?? "default",
    requestPermission: vi.fn(async () => opcoes.pedir ?? "granted"),
  };
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: notificacao,
  });
  return { gerenciador, notificacao };
}

function limparNavegador() {
  // @ts-expect-error remove o que os testes definiram
  delete navigator.serviceWorker;
  // @ts-expect-error idem
  delete window.PushManager;
  // @ts-expect-error idem
  delete window.Notification;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", CHAVE);
});
afterEach(() => {
  limparNavegador();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("chaveVapidParaBytes", () => {
  it("converte a chave pública VAPID (65 bytes, começa com 0x04)", () => {
    const bytes = chaveVapidParaBytes(CHAVE);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("situacaoDoPush", () => {
  it("navegador sem push (como o iPhone fora do aplicativo instalado)", async () => {
    expect(pushSuportado()).toBe(false);
    expect(await situacaoDoPush()).toBe("sem_suporte");
  });
  it("sem chave VAPID configurada", async () => {
    montarNavegador();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    expect(await situacaoDoPush()).toBe("sem_chave");
  });
  it("permissão negada no navegador", async () => {
    montarNavegador({ permissao: "denied" });
    expect(await situacaoDoPush()).toBe("bloqueado");
  });
  it("sem inscrição: desligado; com inscrição e permissão: ligado", async () => {
    montarNavegador({ permissao: "granted" });
    expect(await situacaoDoPush()).toBe("desligado");
    limparNavegador();
    montarNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });
    expect(await situacaoDoPush()).toBe("ligado");
  });
});

describe("ligarPush", () => {
  it("pede permissão, assina com a chave VAPID e manda a inscrição ao servidor", async () => {
    const { gerenciador, notificacao } = montarNavegador();
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);
    expect(await ligarPush()).toBe("ligado");
    expect(notificacao.requestPermission).toHaveBeenCalledOnce();
    expect(gerenciador.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    const [url, init] = buscar.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/push/inscrever");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      endpoint: "https://push.exemplo.invalid/abc",
      chaves: { p256dh: "chave-publica", auth: "segredo" },
    });
  });

  it("pessoa nega a permissão: bloqueado, sem assinar nada", async () => {
    const { gerenciador } = montarNavegador({ pedir: "denied" });
    vi.stubGlobal("fetch", vi.fn());
    expect(await ligarPush()).toBe("bloqueado");
    expect(gerenciador.subscribe).not.toHaveBeenCalled();
  });

  it("servidor não guardou: desfaz a assinatura e não diz que ligou", async () => {
    const criada = inscricaoFalsa();
    const { gerenciador } = montarNavegador();
    gerenciador.subscribe.mockResolvedValue(criada);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    expect(await ligarPush()).toBe("desligado");
    expect(criada.unsubscribe).toHaveBeenCalled();
  });

  it("sem rede na hora de guardar: também desfaz", async () => {
    const criada = inscricaoFalsa();
    const { gerenciador } = montarNavegador();
    gerenciador.subscribe.mockResolvedValue(criada);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await ligarPush()).toBe("desligado");
    expect(criada.unsubscribe).toHaveBeenCalled();
  });

  it("sem suporte não pede nada", async () => {
    expect(await ligarPush()).toBe("sem_suporte");
  });
});

describe("desligarPush", () => {
  it("apaga a inscrição no servidor e no navegador", async () => {
    const inscricao = inscricaoFalsa();
    montarNavegador({ permissao: "granted", inscricao });
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);
    await desligarPush();
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({
      endpoint: inscricao.endpoint,
    });
    expect(inscricao.unsubscribe).toHaveBeenCalled();
  });

  it("sem inscrição ou sem suporte, não faz nada e não lança", async () => {
    await expect(desligarPush()).resolves.toBeUndefined();
    montarNavegador({ permissao: "granted" });
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    await expect(desligarPush()).resolves.toBeUndefined();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("renovarInscricaoPush", () => {
  it("reenvia a inscrição que o aparelho já tem, para o servidor acompanhar quem está com ele", async () => {
    const inscricao = inscricaoFalsa();
    montarNavegador({ permissao: "granted", inscricao });
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);
    await renovarInscricaoPush();
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).endpoint).toBe(inscricao.endpoint);
  });

  it("sem permissão, sem inscrição, sem suporte ou sem rede, não faz nada e não lança", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", buscar);
    await expect(renovarInscricaoPush()).resolves.toBeUndefined();
    montarNavegador({ permissao: "default", inscricao: inscricaoFalsa() });
    await renovarInscricaoPush();
    limparNavegador();
    montarNavegador({ permissao: "granted" });
    await renovarInscricaoPush();
    expect(buscar).not.toHaveBeenCalled();
    limparNavegador();
    montarNavegador({ permissao: "granted", inscricao: inscricaoFalsa() });
    await expect(renovarInscricaoPush()).resolves.toBeUndefined();
  });
});
