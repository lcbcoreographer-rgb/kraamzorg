"use client";

import * as React from "react";
import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  VerificacaoTurnstile,
  type ControleTurnstile,
} from "@/modules/crm/formulario/componentes/verificacao-turnstile";
import { acaoEnviarCandidatura, type EstadoCandidatura } from "../candidatura";

const INICIAL: EstadoCandidatura = { situacao: "inicial" };

const ERRO_CAMPO: Record<string, string> = {
  invalido: "Confira este campo.",
  obrigatorio: "Este campo é necessário.",
  muito_longo: "O texto passou do limite.",
};

/**
 * Formulário da página pública de candidatura (P51 item 3). Pede só o que a
 * seleção precisa, com o consentimento explícito e a versão do termo. O
 * botão só liga depois do Turnstile. Textos vêm de mensagem_modelo.
 */
export function FormularioCandidatura({
  siteKey,
  termoVersao,
  textos,
}: {
  siteKey: string | null;
  termoVersao: string;
  textos: Record<string, string>;
}) {
  const [estado, acao, enviando] = useFormularioSemReset(
    acaoEnviarCandidatura,
    INICIAL,
  );
  const [token, definirToken] = React.useState<string | null>(null);
  const [falhaTurnstile, definirFalhaTurnstile] = React.useState(
    siteKey === null,
  );
  const turnstile = React.useRef<ControleTurnstile>(null);

  React.useEffect(() => {
    if (estado.situacao !== "inicial") turnstile.current?.reiniciar();
  }, [estado]);

  if (estado.situacao === "recebido") {
    return (
      <p
        role="status"
        className="rounded-2 bg-salvia-clara text-3 text-texto max-w-[60ch] px-4 py-3"
      >
        {textos.recebido}
      </p>
    );
  }

  const erros = estado.situacao === "corrigir" ? estado.erros : {};
  const campo = (chave: string) =>
    erros[chave]
      ? (ERRO_CAMPO[erros[chave]] ?? ERRO_CAMPO.invalido)
      : undefined;
  const aviso =
    estado.situacao === "limite"
      ? textos.limite
      : estado.situacao === "erro"
        ? textos.erro
        : estado.situacao === "verificacao"
          ? "Não conseguimos confirmar que você é uma pessoa. Tente de novo."
          : estado.situacao === "desligada"
            ? textos.desligada
            : estado.situacao === "corrigir"
              ? "Confira os campos marcados e envie de novo."
              : falhaTurnstile
                ? "A verificação não carregou. Recarregue a página e tente de novo."
                : "";

  return (
    <form onSubmit={acao} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="termoVersao" value={termoVersao} />
      <input type="hidden" name="cf-turnstile-response" value={token ?? ""} />
      <CampoTexto
        rotulo="Nome completo"
        name="nome"
        required
        maxLength={120}
        autoComplete="name"
        erro={campo("nome")}
      />
      <CampoTexto
        rotulo="Telefone com DDD"
        name="telefone"
        inputMode="tel"
        autoComplete="tel"
        opcional
        erro={campo("telefone") ?? campo("contato")}
      />
      <CampoTexto
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        opcional
        erro={campo("email")}
        descricao="Informe o telefone ou o e-mail, para podermos falar com você."
      />
      <CampoTexto
        rotulo="Cidade"
        name="cidade"
        maxLength={80}
        opcional
        erro={campo("cidade")}
      />
      <CampoTexto
        rotulo="Conselho e número"
        name="conselho"
        maxLength={60}
        opcional
        erro={campo("conselho")}
      />
      <CampoTexto
        rotulo="Conte um pouco sobre você"
        name="apresentacao"
        multilinha
        linhas={5}
        maxLength={1500}
        opcional
        erro={campo("apresentacao")}
      />
      <label className="text-corpo text-texto min-h-toque flex items-start gap-3">
        <input
          type="checkbox"
          name="consentimento"
          value="sim"
          required
          className="mt-1 size-5"
        />
        <span>
          {textos.consentimento}
          {campo("consentimento") ? (
            <span className="text-alerta block">Marque para poder enviar.</span>
          ) : null}
        </span>
      </label>
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
        type="submit"
        largaTotal
        disabled={!token}
        carregando={enviando}
        rotuloCarregando="Enviando"
      >
        Enviar candidatura
      </Botao>
      <p role="status" className="text-corpo text-texto-2 min-h-6">
        {aviso}
      </p>
    </form>
  );
}
