"use client";

import * as React from "react";

/**
 * Widget do Cloudflare Turnstile (P30 item 2), renderizado de forma
 * explícita. `appearance: "interaction-only"`: na maior parte das vezes a
 * verificação acontece em segundo plano e nada aparece; só quando a
 * Cloudflare pede uma interação o quadro surge, no fim do formulário. O
 * token dura cinco minutos e o widget renova sozinho; depois de cada envio
 * o formulário pede um novo (`reiniciar`), porque o token vale uma vez.
 */

interface OpcoesTurnstile {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  language?: string;
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
}

interface ApiTurnstile {
  render: (alvo: HTMLElement, opcoes: OpcoesTurnstile) => string | undefined;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const URL_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let carregamento: Promise<ApiTurnstile> | null = null;

function carregarTurnstile(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carregamento ??= new Promise<ApiTurnstile>((resolver, rejeitar) => {
    const script = document.createElement("script");
    script.src = URL_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile
        ? resolver(window.turnstile)
        : rejeitar(new Error("turnstile"));
    script.onerror = () => {
      carregamento = null;
      rejeitar(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return carregamento;
}

export interface ControleTurnstile {
  reiniciar: () => void;
}

export const VerificacaoTurnstile = React.forwardRef<
  ControleTurnstile,
  {
    siteKey: string;
    onToken: (token: string | null) => void;
    onFalha: () => void;
  }
>(({ siteKey, onToken, onFalha }, ref) => {
  const alvo = React.useRef<HTMLDivElement>(null);
  const idWidget = React.useRef<string | undefined>(undefined);
  const retornos = React.useRef({ onToken, onFalha });
  React.useEffect(() => {
    retornos.current = { onToken, onFalha };
  });

  React.useImperativeHandle(ref, () => ({
    reiniciar() {
      retornos.current.onToken(null);
      if (idWidget.current) window.turnstile?.reset(idWidget.current);
    },
  }));

  React.useEffect(() => {
    let ativo = true;
    carregarTurnstile()
      .then((api) => {
        if (!ativo || !alvo.current) return;
        idWidget.current = api.render(alvo.current, {
          sitekey: siteKey,
          callback: (token) => retornos.current.onToken(token),
          "expired-callback": () => retornos.current.onToken(null),
          "error-callback": () => retornos.current.onFalha(),
          language: "pt-br",
          appearance: "interaction-only",
          theme: "light",
          size: "flexible",
        });
      })
      .catch(() => {
        if (ativo) retornos.current.onFalha();
      });
    return () => {
      ativo = false;
      if (idWidget.current) window.turnstile?.remove(idWidget.current);
      idWidget.current = undefined;
    };
  }, [siteKey]);

  return <div ref={alvo} className="empty:hidden" />;
});
VerificacaoTurnstile.displayName = "VerificacaoTurnstile";
