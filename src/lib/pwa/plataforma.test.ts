import { describe, expect, it } from "vitest";
import { detectarPlataforma, ehIos } from "./plataforma";

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  androidEdge:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  androidInstagram:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 320.0.0.0",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0",
  ipadComoMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  windowsFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  operaDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0",
} as const;

const de = (
  userAgent: string,
  extra: { maxTouchPoints?: number; standalone?: boolean } = {},
) => detectarPlataforma({ userAgent, ...extra });

describe("detectarPlataforma", () => {
  it("Android com Chrome oferece o botão de instalar", () => {
    expect(de(UA.androidChrome)).toBe("android_chrome");
  });
  it("Android com outro navegador ou visualizador embutido pede o Chrome", () => {
    for (const ua of [
      UA.androidSamsung,
      UA.androidFirefox,
      UA.androidEdge,
      UA.androidWebView,
      UA.androidInstagram,
    ]) {
      expect(de(ua), ua).toBe("android_outro");
    }
  });
  it("iPhone no Safari usa Compartilhar e Adicionar à Tela de Início", () => {
    expect(de(UA.iphoneSafari)).toBe("iphone_safari");
  });
  it("iPhone em outro navegador ou dentro de outro aplicativo orienta abrir no Safari", () => {
    for (const ua of [UA.iphoneChrome, UA.iphoneFirefox, UA.iphoneInstagram]) {
      expect(de(ua), ua).toBe("iphone_outro");
    }
  });
  it("iPad que se apresenta como Mac é tratado como iPhone; Mac de verdade não", () => {
    expect(de(UA.ipadComoMac, { maxTouchPoints: 5 })).toBe("iphone_safari");
    expect(ehIos({ userAgent: UA.ipadComoMac, maxTouchPoints: 5 })).toBe(true);
    expect(de(UA.macSafari, { maxTouchPoints: 0 })).toBe("computador_outro");
  });
  it("computador: Chrome e Edge instalam, o resto não", () => {
    expect(de(UA.windowsChrome)).toBe("computador_chromium");
    expect(de(UA.windowsEdge)).toBe("computador_chromium");
    expect(de(UA.windowsFirefox)).toBe("computador_outro");
    expect(de(UA.macSafari)).toBe("computador_outro");
    expect(de(UA.operaDesktop)).toBe("computador_outro");
  });
  it("já aberto como aplicativo vale em qualquer aparelho", () => {
    for (const ua of Object.values(UA))
      expect(de(ua, { standalone: true }), ua).toBe("instalado");
  });
  it("user agent vazio ou desconhecido cai no computador comum", () => {
    expect(de("")).toBe("computador_outro");
    expect(de("curl/8.0")).toBe("computador_outro");
  });
});
