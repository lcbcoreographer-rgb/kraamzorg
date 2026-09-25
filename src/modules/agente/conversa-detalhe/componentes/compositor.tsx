"use client";

import { estadoInicialEnvioConversa } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useMemo, useState } from "react";
import { ArrowRight, FileText, MessageCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
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
      <p className="text-apoio text-texto-2">
        Esta conversa não tem telefone cadastrado; não é possível responder por
        aqui.
      </p>
    );
  }

  return (
    <form action={acaoEnviar} className="flex flex-col gap-3">
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
            Formulário do contrato
          </Botao>
          {!formularioContrato.aprovado ? (
            <span className="text-mini text-texto-2">
              Texto em rascunho, ainda sem aprovação.
            </span>
          ) : null}
        </div>
      ) : null}

      <CampoTexto
        id={`mensagem-${conversaId}`}
        name="texto"
        rotulo={`Mensagem para ${primeiroNome(nomeContato)}`}
        multilinha
        linhas={3}
        value={texto}
        onChange={(evento) => definirTexto(evento.target.value)}
        placeholder={
          freioAtivo
            ? "Escreva você, pelo nome"
            : `Escreva para ${primeiroNome(nomeContato)}`
        }
      />

      {pendentes.length > 0 ? (
        <p className="text-apoio text-aviso-texto" role="status">
          Troque {pendentes.join(", ")} pelo dado certo antes de enviar.
        </p>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu para enviar">
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

      <div className="flex flex-wrap gap-2">
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
              Abrir no WhatsApp
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
              <ArrowRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            Enviar pelo app
          </Botao>
        ) : null}
      </div>
      {!podeEnviarPeloApp ? (
        <p className="text-mini text-texto-2">
          A conversa segue no seu celular. As mensagens voltam para cá pelo
          número da Kraamzorg.
        </p>
      ) : (
        <p className="text-mini text-texto-2">
          Sai pelo número da Kraamzorg. O botão ao lado abre no WhatsApp do seu
          celular.
        </p>
      )}
    </form>
  );
}
