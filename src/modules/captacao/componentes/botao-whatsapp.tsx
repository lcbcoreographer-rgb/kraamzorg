"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  VerificacaoTurnstile,
  type ControleTurnstile,
} from "@/modules/crm/formulario/componentes/verificacao-turnstile";
import { acaoIniciarCaptacao } from "../acoes";

/**
 * O botão da página de captação: só liga depois que o Turnstile confirmou
 * que é uma pessoa; ao tocar, pede o link ao servidor e abre o WhatsApp com
 * a mensagem pronta. Se o WhatsApp não abrir sozinho, o link fica na tela.
 */
export function BotaoWhatsApp({
  canal,
  utm,
  siteKey,
  textos,
}: {
  canal: string;
  utm: Record<string, string>;
  siteKey: string | null;
  textos: Record<string, string>;
}) {
  const [token, definirToken] = React.useState<string | null>(null);
  const [falhaTurnstile, definirFalhaTurnstile] = React.useState(
    siteKey === null,
  );
  const [enviando, definirEnviando] = React.useState(false);
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [link, definirLink] = React.useState<string | null>(null);
  const turnstile = React.useRef<ControleTurnstile>(null);

  async function abrir() {
    definirEnviando(true);
    definirAviso(null);
    const resposta = await acaoIniciarCaptacao({
      canal,
      utm,
      verificacao: token,
    });
    turnstile.current?.reiniciar();
    definirEnviando(false);
    if (resposta.situacao === "ok") {
      definirLink(resposta.url);
      window.location.assign(resposta.url);
      return;
    }
    definirAviso(
      (resposta.situacao === "limite"
        ? textos.limite
        : resposta.situacao === "verificacao"
          ? textos.verificacao_falhou
          : resposta.situacao === "indisponivel"
            ? textos.indisponivel
            : textos.erro) ?? null,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {siteKey ? (
        <VerificacaoTurnstile
          ref={turnstile}
          siteKey={siteKey}
          onToken={(t) => {
            definirToken(t);
            if (t) definirFalhaTurnstile(false);
          }}
          onFalha={() => definirFalhaTurnstile(true)}
        />
      ) : null}
      <Botao
        type="button"
        largaTotal
        disabled={!token || enviando}
        carregando={enviando}
        rotuloCarregando="Abrindo o WhatsApp"
        onClick={abrir}
        iconeEsquerda={
          <MessageCircle
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
          />
        }
      >
        {textos.botao ?? "Conversar pelo WhatsApp"}
      </Botao>
      <p role="status" className="text-corpo text-texto-2 min-h-6">
        {aviso ??
          (falhaTurnstile
            ? textos.verificacao_falhou
            : !token
              ? textos.verificando
              : "")}
      </p>
      {link ? (
        <p className="text-corpo text-texto">
          Se o WhatsApp não abriu,{" "}
          <a className="underline underline-offset-4" href={link}>
            toque aqui
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
