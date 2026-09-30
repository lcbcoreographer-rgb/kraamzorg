"use client";

import { estadoInicialEnvioConversa } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useMemo, useState } from "react";
import { FileText, MessageCircle, SendHorizontal } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { montarLinkWhatsApp } from "@/lib/messaging";
import { primeiroNome } from "../../formatacao";
import { acaoEnviarMensagemConversa } from "../acoes";

export interface CompositorProps {
  conversaId: string;
  familiaId: string | null;
  telefoneE164: string | null;
  nomeContato: string | null;
  /** `mensagem_modelo.formulario_contrato` e se já foi aprovado. */
  formularioContrato: { texto: string; aprovado: boolean } | null;
  comercialRespondeNoApp: boolean;
  freioAtivo: boolean;
  /** Falso em conversa de não lead: nenhum atalho de texto comercial. */
  ofereceTextoComercial?: boolean;
}

/** Variáveis `{nome}`, `{link}`... que ainda estão no texto. */
function variaveisPendentes(texto: string): string[] {
  return [...new Set(texto.match(/\{[a-z_]+\}/g) ?? [])];
}

/**
 * Compositor da conversa (protótipo `comercial-conversa.html`, C2): atalho
 * do formulário do contrato, "Abrir no WhatsApp" sempre disponível (a tela
 * está desenhada para as duas saídas, `fluxos.md` item 3) e "Enviar" pelo
 * app só quando `comercial_resposta_no_app` estiver ligado.
 */
export function Compositor({
  conversaId,
  familiaId,
  telefoneE164,
  nomeContato,
  formularioContrato,
  comercialRespondeNoApp,
  freioAtivo,
  ofereceTextoComercial = true,
}: CompositorProps) {
  const [texto, definirTexto] = useState("");
  const [estado, acaoEnviar, enviando] = useActionState(
    acaoEnviarMensagemConversa,
    estadoInicialEnvioConversa,
  );

  const pendentes = useMemo(() => variaveisPendentes(texto), [texto]);
  // Sem família ligada não há freio para conferir (`pode_enviar_mensagem`
  // é por família): nesse caso a resposta é só pelo WhatsApp do aparelho.
  const podeEnviarPeloApp = comercialRespondeNoApp && Boolean(familiaId);

  const linkWhatsApp = useMemo(
    () => (telefoneE164 ? montarLinkWhatsApp(telefoneE164, texto) : null),
    [telefoneE164, texto],
  );

  if (!telefoneE164) {
    return (
      <p className="bg-superficie text-apoio text-texto-2 shrink-0 px-4 py-4">
        Esta conversa não tem telefone cadastrado; não é possível responder por
        aqui.
      </p>
    );
  }

  const idCampo = `mensagem-${conversaId}`;

  return (
    // O campo de resposta embaixo, como no WhatsApp: a barra branca que
    // fecha a conversa, com o atalho do formulário por cima e as duas
    // saídas (app e WhatsApp do aparelho) ao lado do campo.
    <form
      action={acaoEnviar}
      className="bg-superficie flex shrink-0 flex-col gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:px-4 lg:pb-4"
    >
      <input type="hidden" name="conversaId" value={conversaId} />
      <input type="hidden" name="familiaId" value={familiaId ?? ""} />
      <input type="hidden" name="telefoneE164" value={telefoneE164} />

      {/* Com freio, nenhuma sugestão de texto comercial (fluxos.md, fluxo E, estados). */}
      {formularioContrato && !freioAtivo && ofereceTextoComercial ? (
        <div className="flex flex-wrap items-center gap-2">
          <Botao
            type="button"
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={
              <FileText
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
            onClick={() =>
              definirTexto(
                // Sem nome de pessoa, o {nome} fica no texto e a tela pede
                // para trocar antes de enviar ("Oi, a família" não serve).
                primeiroNome(nomeContato) === "a família"
                  ? formularioContrato.texto
                  : formularioContrato.texto.replaceAll(
                      "{nome}",
                      primeiroNome(nomeContato),
                    ),
              )
            }
          >
            {formularioContrato.aprovado
              ? "Formulário do contrato"
              : "Formulário do contrato (rascunho)"}
          </Botao>
        </div>
      ) : null}

      <label htmlFor={idCampo} className="text-mini text-texto-2 font-semibold">
        Mensagem para {primeiroNome(nomeContato)}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={idCampo}
          name="texto"
          rows={1}
          value={texto}
          onChange={(evento) => definirTexto(evento.target.value)}
          placeholder={
            freioAtivo
              ? "Escreva você, pelo nome"
              : `Escreva para ${primeiroNome(nomeContato)}`
          }
          className="rounded-3 border-borda-campo bg-superficie text-corpo text-texto placeholder:text-texto-3 min-h-toque hover:border-marinho-72 field-sizing-content max-h-40 w-full flex-1 resize-none border-[1.5px] px-4 py-2.5"
        />
        <div className="flex shrink-0 items-center gap-2">
          {linkWhatsApp ? (
            <Botao
              asChild
              tamanho="compacto"
              variante="secundario"
              iconeEsquerda={
                <MessageCircle
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              <a href={linkWhatsApp} target="_blank" rel="noopener">
                {/* No celular, só "WhatsApp" aparece; o nome acessível
                    continua "Abrir no WhatsApp". */}
                <span>
                  <span className="max-tablet:sr-only">Abrir no </span>
                  WhatsApp
                </span>
              </a>
            </Botao>
          ) : null}
          {podeEnviarPeloApp ? (
            <Botao
              type="submit"
              tamanho="compacto"
              disabled={texto.trim().length === 0 || pendentes.length > 0}
              carregando={enviando}
              rotuloCarregando="Enviando"
              iconeEsquerda={
                <SendHorizontal
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              <span>
                Enviar
                <span className="max-tablet:sr-only"> pelo app</span>
              </span>
            </Botao>
          ) : null}
        </div>
      </div>

      {pendentes.length > 0 ? (
        <p className="text-apoio text-aviso-texto" role="status">
          Troque {pendentes.join(", ")} pelo dado certo antes de enviar.
        </p>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="A mensagem não saiu">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <p className="text-sucesso text-apoio" role="status">
          {estado.sucesso}{" "}
          {estado.link ? (
            <a
              href={estado.link}
              target="_blank"
              rel="noopener"
              className="font-semibold underline"
            >
              Abrir no WhatsApp com o texto
            </a>
          ) : null}
        </p>
      ) : null}

      <p className="text-mini text-texto-2 max-tablet:hidden">
        {podeEnviarPeloApp
          ? "Sai pelo número da Kraamzorg. O botão ao lado abre no WhatsApp do seu celular."
          : "A conversa segue no seu celular. As mensagens voltam para cá pelo número da Kraamzorg."}
      </p>
    </form>
  );
}
