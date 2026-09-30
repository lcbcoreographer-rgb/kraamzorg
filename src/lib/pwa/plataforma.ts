/**
 * Reconhece onde o app está aberto para a tela de instalação guiada
 * (`/instalar`, P11 item 2). Função pura: recebe o `User-Agent` e o que o
 * navegador informa, e devolve um dos casos que a tela sabe explicar. O
 * `User-Agent` não é confiável para decidir segurança (não decide nenhuma
 * aqui); só escolhe qual passo a passo mostrar.
 *
 * Casos:
 * - `instalado`: já abriu como aplicativo (modo standalone).
 * - `android_chrome`: Android com Chrome, onde o navegador oferece o botão de
 *   instalar (`beforeinstallprompt`).
 * - `android_outro`: Android com Firefox, Samsung Internet, navegador de
 *   dentro de outro aplicativo etc. A tela pede para abrir no Chrome.
 * - `iphone_safari`: iPhone ou iPad no Safari, onde se instala por
 *   Compartilhar e Adicionar à Tela de Início (não há botão de instalar).
 * - `iphone_outro`: iPhone ou iPad em outro navegador ou dentro de outro
 *   aplicativo. A tela orienta abrir no Safari (P11 item 2).
 * - `computador_chromium`: Chrome ou Edge no computador.
 * - `computador_outro`: Safari, Firefox e o resto no computador.
 */
export type PlataformaInstalacao =
  | "instalado"
  | "android_chrome"
  | "android_outro"
  | "iphone_safari"
  | "iphone_outro"
  | "computador_chromium"
  | "computador_outro";

export interface EntradaPlataforma {
  userAgent: string;
  /** `navigator.maxTouchPoints`: o iPad recente se apresenta como Mac. */
  maxTouchPoints?: number;
  /** Aberto como aplicativo (display-mode standalone ou navigator.standalone). */
  standalone?: boolean;
}

// Navegadores de terceiros e visualizadores embutidos em aplicativos
// (Instagram, Facebook, LinkedIn, Line, TikTok...). Nenhum deles instala.
const OUTROS_NAVEGADORES_IOS =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|Brave|FBAN|FBAV|Instagram|Line\/|LinkedInApp|TikTok|Snapchat|MicroMessenger/i;

const OUTROS_NAVEGADORES_ANDROID =
  /EdgA|OPR\/|SamsungBrowser|Firefox|FBAN|FBAV|Instagram|Line\/|LinkedInApp|TikTok|Snapchat|MicroMessenger|UCBrowser|; wv\)|Version\/[\d.]+ Chrome/i;

export function ehIos({ userAgent, maxTouchPoints = 0 }: EntradaPlataforma) {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    // iPadOS 13 em diante diz que é um Mac; o toque múltiplo o denuncia.
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

export function detectarPlataforma(
  entrada: EntradaPlataforma,
): PlataformaInstalacao {
  const { userAgent } = entrada;
  if (entrada.standalone) return "instalado";

  if (ehIos(entrada)) {
    // Safari de verdade traz "Safari/" e nenhum dos marcadores de terceiros.
    const safari =
      /Safari\//.test(userAgent) && !OUTROS_NAVEGADORES_IOS.test(userAgent);
    return safari ? "iphone_safari" : "iphone_outro";
  }

  if (/Android/.test(userAgent)) {
    const chrome =
      /Chrome\//.test(userAgent) && !OUTROS_NAVEGADORES_ANDROID.test(userAgent);
    return chrome ? "android_chrome" : "android_outro";
  }

  const chromium =
    /Chrome\/|Edg\//.test(userAgent) && !/OPR\/|Firefox/.test(userAgent);
  return chromium ? "computador_chromium" : "computador_outro";
}

/** Lê do navegador o que a função pura precisa. Só no navegador. */
export function plataformaDoNavegador(): PlataformaInstalacao {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectarPlataforma({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  });
}
