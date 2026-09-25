"use client";

import * as React from "react";
import { useActionState, useMemo, useState } from "react";
import { ArrowRight, FileText, MessageCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { montarLinkWhatsApp } from "@/lib/messaging";
import { primeiroNome } from "../../formatacao";
import { acaoEnviarMensagemConversa, estadoInicialEnvioConversa } from "../acoes";

export interface CompositorProps {
  conversaId: string;
  familiaId: string | null;
  telefoneE164: string | null;
  nomeContato: string | null;
  textoFormularioContrato: string | null;
  comercialRespondeNoApp: boolean;
  freioAtivo: boolean;
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
  textoFormularioContrato,
  comercialRespondeNoApp,
  freioAtivo,
}: CompositorProps) {
  const [texto, definirTexto] = useState("");
  const [estado, acaoEnviar, enviando] = useActionState(
    acaoEnviarMensagemConversa,
    estadoInicialEnvioConversa,
  );

  const linkWhatsApp = useMemo(
    () => (telefoneE164 ? montarLinkWhatsApp(telefoneE164, texto) : null),
    [telefoneE164, texto],
  );

  if (!telefoneE164) {
    return (
      <p className="text-apoio text-texto-2">
        Esta conversa não tem telefone cadastrado; não é possível responder por aqui.
      </p>
    );
  }

  return (
    <form action={acaoEnviar} className="flex flex-col gap-3">
      <input type="hidden" name="conversaId" value={conversaId} />
      <input type="hidden" name="familiaId" value={familiaId ?? ""} />
      <input type="hidden" name="telefoneE164" value={telefoneE164} />

      {textoFormularioContrato ? (
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<FileText aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            onClick={() => definirTexto(textoFormularioContrato)}
          >
            Formulário do contrato
          </Botao>
        </div>
      ) : null}

      <CampoTexto
        id={`mensagem-${conversaId}`}
        name="texto"
        rotulo={`Mensagem para ${nomeContato ? primeiroNome(nomeContato) : "a família"}`}
        multilinha
        linhas={3}
        value={texto}
        onChange={(evento) => definirTexto(evento.target.value)}
        placeholder={freioAtivo ? "Escreva você, pelo nome" : `Escreva para ${primeiroNome(nomeContato)}`}
      />

      {estado.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu para enviar">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <p className="text-sucesso text-apoio" role="status">
          {estado.sucesso}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {linkWhatsApp ? (
          <Botao
            asChild
            tamanho="compacto"
            variante="secundario"
            iconeEsquerda={<MessageCircle aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          >
            <a href={linkWhatsApp} target="_blank" rel="noopener">
              Abrir no WhatsApp
            </a>
          </Botao>
        ) : null}
        {comercialRespondeNoApp ? (
          <Botao
            type="submit"
            tamanho="compacto"
            disabled={texto.trim().length === 0}
            carregando={enviando}
            rotuloCarregando="Enviando"
            iconeEsquerda={<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          >
            Enviar pelo app
          </Botao>
        ) : null}
      </div>
      {!comercialRespondeNoApp ? (
        <p className="text-mini text-texto-2">
          A conversa segue no seu celular. As mensagens voltam para cá pelo número da Kraamzorg.
        </p>
      ) : (
        <p className="text-mini text-texto-2">
          Sai pelo número da Kraamzorg. O botão ao lado abre no WhatsApp do seu celular.
        </p>
      )}
    </form>
  );
}
