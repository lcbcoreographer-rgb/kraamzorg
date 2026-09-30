import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * O service worker (`public/sw.js`) roda num contexto isolado de mentira
 * (`node:vm`), com só o que ele usa do navegador. Confere o Web Push do P11:
 * o aviso vira notificação genérica, o toque abre o app, e endereço de fora
 * do app nunca é aberto.
 */
const CODIGO = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

type Ouvinte = (evento: unknown) => void;

function carregar() {
  const ouvintes = new Map<string, Ouvinte>();
  const mostrar = vi.fn(async () => undefined);
  const abrir = vi.fn(async () => undefined);
  const focar = vi.fn(async () => undefined);
  const navegar = vi.fn(async () => undefined);
  let janelas: unknown[] = [];
  const self = {
    addEventListener: (nome: string, fn: Ouvinte) => ouvintes.set(nome, fn),
    skipWaiting: () => undefined,
    location: { origin: "https://app.exemplo.invalid" },
    registration: { showNotification: mostrar },
    clients: {
      claim: async () => undefined,
      matchAll: async () => janelas,
      openWindow: abrir,
    },
  };
  runInNewContext(CODIGO, {
    self,
    caches: {},
    fetch: () => undefined,
    URL,
    Response,
  });
  return {
    mostrar,
    abrir,
    focar,
    navegar,
    definirJanelas: (j: unknown[]) => (janelas = j),
    disparar: async (nome: string, evento: Record<string, unknown>) => {
      const promessas: Promise<unknown>[] = [];
      ouvintes.get(nome)?.({
        ...evento,
        waitUntil: (p: Promise<unknown>) => promessas.push(p),
      });
      await Promise.all(promessas);
    },
  };
}

const envio = (dados: unknown) => ({ data: { json: () => dados } });

describe("service worker · push (P11)", () => {
  it("mostra o aviso com o título e o texto genéricos que o servidor mandou", async () => {
    const sw = carregar();
    await sw.disparar(
      "push",
      envio({
        titulo: "Kraamzorg",
        corpo: "Há um aviso novo para você. Abra o aplicativo para ver.",
        url: "/",
      }),
    );
    expect(sw.mostrar).toHaveBeenCalledWith(
      "Kraamzorg",
      expect.objectContaining({
        body: "Há um aviso novo para você. Abra o aplicativo para ver.",
        icon: "/icones/icone-192.png",
        data: { url: "/" },
      }),
    );
  });

  it("carga vazia ou quebrada cai no texto genérico, sem lançar", async () => {
    const sw = carregar();
    await sw.disparar("push", {});
    await sw.disparar("push", {
      data: {
        json: () => {
          throw new Error("json ruim");
        },
      },
    });
    expect(sw.mostrar).toHaveBeenCalledTimes(2);
    for (const [titulo, opcoes] of sw.mostrar.mock.calls as unknown as [
      string,
      { body: string; data: { url: string } },
    ][]) {
      expect(titulo).toBe("Kraamzorg");
      expect(opcoes.body).toMatch(/aviso novo/);
      expect(opcoes.data.url).toBe("/");
    }
  });

  it("endereço de outro site, ou que finge ser do app, vira a raiz", async () => {
    const sw = carregar();
    for (const url of [
      "https://outro.invalid/x",
      "//outro.invalid/x",
      "javascript:alert(1)",
      42,
    ]) {
      await sw.disparar("push", envio({ url }));
    }
    for (const [, opcoes] of sw.mostrar.mock.calls as unknown as [
      string,
      { data: { url: string } },
    ][]) {
      expect(opcoes.data.url).toBe("/");
    }
  });

  it("o toque na notificação fecha o aviso e abre o app quando não há janela", async () => {
    const sw = carregar();
    const fechar = vi.fn();
    await sw.disparar("notificationclick", {
      notification: { close: fechar, data: { url: "/" } },
    });
    expect(fechar).toHaveBeenCalled();
    expect(sw.abrir).toHaveBeenCalledWith("/");
  });

  it("com o app já aberto, foca a janela em vez de abrir outra", async () => {
    const sw = carregar();
    sw.definirJanelas([{ focus: sw.focar, navigate: sw.navegar }]);
    await sw.disparar("notificationclick", {
      notification: { close: vi.fn(), data: { url: "/" } },
    });
    expect(sw.focar).toHaveBeenCalled();
    expect(sw.navegar).toHaveBeenCalledWith("/");
    expect(sw.abrir).not.toHaveBeenCalled();
  });
});
