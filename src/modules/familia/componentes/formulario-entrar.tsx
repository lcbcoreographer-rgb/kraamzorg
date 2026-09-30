"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  VerificacaoTurnstile,
  type ControleTurnstile,
} from "@/modules/crm/formulario/componentes/verificacao-turnstile";
import { acaoPedirLinkPortal } from "../acoes";
import type { ResultadoPedidoLink } from "../tipos";

/**
 * Pedido do link de acesso ao portal (P49). A resposta é a mesma para quem
 * tem acesso e para quem não tem, para ninguém descobrir quem é cliente
 * digitando e-mail; só o limite de pedidos e a verificação têm frase própria.
 */
export function FormularioEntrar({
  siteKey,
  textos,
  emailInicial,
}: {
  siteKey: string | null;
  textos: Record<string, string>;
  emailInicial?: string;
}) {
  const [email, definirEmail] = React.useState(emailInicial ?? "");
  const [token, definirToken] = React.useState<string | null>(null);
  const [falhaTurnstile, definirFalhaTurnstile] = React.useState(
    siteKey === null,
  );
  const [enviando, definirEnviando] = React.useState(false);
  const [resultado, definirResultado] =
    React.useState<ResultadoPedidoLink | null>(null);
  const turnstile = React.useRef<ControleTurnstile>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirEnviando(true);
    const r = await acaoPedirLinkPortal({ email, verificacao: token });
    turnstile.current?.reiniciar();
    definirEnviando(false);
    definirResultado(r);
  }

  const enviado = resultado?.situacao === "enviado";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <CampoTexto
        rotulo="Seu e-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => definirEmail(e.target.value)}
        erro={
          resultado?.situacao === "invalido"
            ? "Confira o e-mail: ele parece incompleto."
            : undefined
        }
      />
      {siteKey ? (
        <VerificacaoTurnstile
          ref={turnstile}
          siteKey={siteKey}
          onToken={definirToken}
          onFalha={() => definirFalhaTurnstile(true)}
        />
      ) : null}
      <Botao
        type="submit"
        largaTotal
        disabled={!token || enviando || email.trim().length < 5}
        carregando={enviando}
        rotuloCarregando="Enviando"
      >
        Enviar o link
      </Botao>
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {enviado ? (
          <p className="text-corpo text-texto" data-teste="link-enviado">
            {textos.enviado}
          </p>
        ) : resultado?.situacao === "limite" ? (
          <p className="text-corpo text-texto">{textos.limite}</p>
        ) : resultado?.situacao === "verificacao" ? (
          <p className="text-corpo text-texto">
            Não deu para confirmar que você é uma pessoa. Recarregue a página e
            tente de novo.
          </p>
        ) : resultado?.situacao === "erro" ? (
          <p className="text-corpo text-texto">{textos.erro}</p>
        ) : falhaTurnstile && !token ? (
          <p className="text-corpo text-texto-2">
            A verificação de segurança não carregou. Recarregue a página para
            tentar de novo.
          </p>
        ) : null}
        {resultado?.situacao === "enviado" && resultado.linkDemonstracao ? (
          <p className="text-apoio text-texto-2">
            Modo demonstração, sem e-mail de verdade:{" "}
            <a
              className="underline underline-offset-4"
              href={resultado.linkDemonstracao}
              data-teste="link-demonstracao"
            >
              abrir o link de acesso
            </a>
            .
          </p>
        ) : null}
      </div>
    </form>
  );
}
