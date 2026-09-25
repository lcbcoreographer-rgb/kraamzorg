"use client";

import * as React from "react";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, MessageCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { montarLinkWhatsApp } from "@/lib/messaging";
import {
  concluirTarefaSemMensagem,
  enviarTarefa,
  estadoInicialTarefa,
} from "../acoes";
import { textoPrazo } from "../agrupar";
import { ROTULO_TIPO_TAREFA } from "../tipos";
import type { TarefaComFreio } from "../dados";

/**
 * Cartão de tarefa (protótipo `comercial-inicio.html`, `.c1-tarefa`): texto
 * sugerido editável, "Abrir no WhatsApp" (link puro, calculado no cliente a
 * partir do texto editado, para abrir como aba mesmo depois de editar) e
 * "Enviei", que confirma o envio pelo servidor (checa o freio de novo,
 * grava a mensagem e conclui a tarefa). Tarefa sem texto e telefone (uma
 * tarefa interna, como "outro") só tem "Concluir".
 */
export function CartaoTarefa({ tarefa }: { tarefa: TarefaComFreio }) {
  const [texto, setTexto] = useState(tarefa.mensagem.textoSugerido ?? "");
  const [estadoEnvio, acaoEnviar, enviando] = useActionState(
    enviarTarefa,
    estadoInicialTarefa,
  );
  const [estadoConcluir, acaoConcluir, concluindo] = useActionState(
    concluirTarefaSemMensagem,
    estadoInicialTarefa,
  );

  const link = useMemo(
    () =>
      tarefa.mensagem.telefoneE164
        ? montarLinkWhatsApp(tarefa.mensagem.telefoneE164, texto)
        : null,
    [tarefa.mensagem.telefoneE164, texto],
  );
  const prazo = textoPrazo(tarefa.venceEm);
  const idTexto = `texto-${tarefa.id}`;

  return (
    <Cartao className="flex flex-col gap-3" aria-labelledby={`titulo-${tarefa.id}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3
            id={`titulo-${tarefa.id}`}
            className="font-titulo text-3 text-texto font-medium"
          >
            {tarefa.titulo}
          </h3>
          <p className="text-apoio text-texto-2">
            {tarefa.nomeFamilia ?? ROTULO_TIPO_TAREFA[tarefa.tipo]}
          </p>
        </div>
        {tarefa.prioridade !== "normal" ? (
          <Selo variante={tarefa.prioridade === "maxima" ? "alerta" : "aviso"}>
            {tarefa.prioridade === "maxima" ? "Prioridade máxima" : "Prioridade alta"}
          </Selo>
        ) : null}
        {prazo ? (
          <span className="text-apoio text-texto-2 ml-auto inline-flex shrink-0 items-center gap-1">
            <Clock aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {prazo}
          </span>
        ) : null}
      </div>

      {!tarefa.temAcaoWhatsApp ? (
        <form action={acaoConcluir} className="flex flex-col gap-2">
          <input type="hidden" name="tarefaId" value={tarefa.id} />
          {estadoConcluir.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu para concluir">
              {estadoConcluir.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="compacto" type="submit" carregando={concluindo} rotuloCarregando="Concluindo">
              Concluir
            </Botao>
            {tarefa.familiaId ? (
              <Botao asChild variante="fantasma" tamanho="compacto">
                <Link href={`/familias/${tarefa.familiaId}`}>Ver família</Link>
              </Botao>
            ) : null}
          </div>
        </form>
      ) : !tarefa.podeEnviarMensagem ? (
        <FaixaAlerta
          variante="sensivel"
          titulo="Sem texto sugerido"
          acoes={
            tarefa.familiaId ? (
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href={`/familias/${tarefa.familiaId}`}>Ver família</Link>
              </Botao>
            ) : null
          }
        >
          {tarefa.motivoBloqueio ??
            "O freio está acionado para essa família. Só contato humano e nominal."}
        </FaixaAlerta>
      ) : (
        <form action={acaoEnviar} className="flex flex-col gap-3">
          <input type="hidden" name="tarefaId" value={tarefa.id} />
          <input type="hidden" name="familiaId" value={tarefa.familiaId ?? ""} />
          <input type="hidden" name="telefoneE164" value={tarefa.mensagem.telefoneE164 ?? ""} />
          <CampoTexto
            id={idTexto}
            name="texto"
            rotulo="Texto sugerido"
            multilinha
            linhas={5}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            descricao="Edite à vontade. O WhatsApp abre com este texto; nada sai antes de você tocar em enviar lá."
          />
          {estadoEnvio.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu para enviar">
              {estadoEnvio.erro}
            </FaixaAlerta>
          ) : null}
          {estadoEnvio.sucesso ? (
            <div className="text-sucesso flex items-center gap-2 text-apoio">
              <CircleCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
              {estadoEnvio.sucesso}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {link ? (
              <Botao
                asChild
                tamanho="compacto"
                variante="secundario"
                iconeEsquerda={
                  <MessageCircle aria-hidden="true" className="size-4" strokeWidth={1.75} />
                }
              >
                <a href={link} target="_blank" rel="noopener">
                  Abrir no WhatsApp
                </a>
              </Botao>
            ) : (
              <Botao
                tamanho="compacto"
                variante="secundario"
                disabled
                iconeEsquerda={
                  <MessageCircle aria-hidden="true" className="size-4" strokeWidth={1.75} />
                }
              >
                Abrir no WhatsApp
              </Botao>
            )}
            <Botao
              type="submit"
              tamanho="compacto"
              disabled={texto.trim().length === 0}
              carregando={enviando}
              rotuloCarregando="Enviando"
            >
              Enviei
            </Botao>
          </div>
        </form>
      )}
    </Cartao>
  );
}
