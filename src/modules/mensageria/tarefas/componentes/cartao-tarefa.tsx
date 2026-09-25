"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, MessageCircle, OctagonPause } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { montarLinkWhatsApp } from "@/lib/messaging/link-whatsapp";
import { concluirTarefaSemMensagem, enviarTarefa } from "../acoes";
import { estadoInicialTarefa, type EstadoAcaoTarefa } from "../estado-acoes";
import { ehJustificarFreio, ROTULO_TIPO_TAREFA } from "../tipos";
import type { TarefaComFreio } from "../dados";

export interface TarefaFeita {
  id: string;
  /** Tipo e família ("Follow-up comercial da Família Teste Cedro"), não o título do cartão. */
  titulo: string;
  detalhe: string;
}

/**
 * Cartão de tarefa (protótipo `comercial-inicio.html`, `.c1-tarefa`): texto
 * sugerido editável, "Abrir no WhatsApp" (link puro, calculado no cliente a
 * partir do texto editado) e "Enviei", que confirma o envio pelo servidor
 * (lê a tarefa de novo, checa o freio, grava a mensagem e conclui). Tarefa
 * sem texto e telefone (uma tarefa interna) só tem "Concluir". Família com
 * o freio acionado não recebe campo nem link, só o aviso e o atalho para a
 * ficha (PRD 8.3).
 *
 * `aoFeita` avisa a lista antes de o cartão sumir na revalidação, para a
 * confirmação ficar visível em "Feitas agora" (o cartão desmonta junto com a
 * resposta da ação e não teria onde mostrar).
 */
export function CartaoTarefa({
  tarefa,
  aoFeita,
}: {
  tarefa: TarefaComFreio;
  aoFeita?: (feita: TarefaFeita) => void;
}) {
  const textoOriginal = tarefa.mensagem.textoSugerido ?? "";
  const resumoFeita = tarefa.nomeFamilia
    ? `${ROTULO_TIPO_TAREFA[tarefa.tipo]} da ${tarefa.nomeFamilia}`
    : ROTULO_TIPO_TAREFA[tarefa.tipo];
  const [texto, setTexto] = useState(textoOriginal);

  const [estadoEnvio, acaoEnviar, enviando] = useActionState(
    async (anterior: EstadoAcaoTarefa, formulario: FormData) => {
      const resultado = await enviarTarefa(anterior, formulario);
      if (resultado.sucesso) {
        aoFeita?.({
          id: tarefa.id,
          titulo: resumoFeita,
          detalhe: resultado.sucesso,
        });
      }
      return resultado;
    },
    estadoInicialTarefa,
  );
  const [estadoConcluir, acaoConcluir, concluindo] = useActionState(
    async (anterior: EstadoAcaoTarefa, formulario: FormData) => {
      const resultado = await concluirTarefaSemMensagem(anterior, formulario);
      if (resultado.sucesso) {
        aoFeita?.({
          id: tarefa.id,
          titulo: resumoFeita,
          detalhe: resultado.sucesso,
        });
      }
      return resultado;
    },
    estadoInicialTarefa,
  );

  const link = useMemo(
    () =>
      tarefa.mensagem.telefoneE164 && texto.trim()
        ? montarLinkWhatsApp(tarefa.mensagem.telefoneE164, texto)
        : null,
    [tarefa.mensagem.telefoneE164, texto],
  );
  const idTexto = `texto-${tarefa.id}`;
  const editado = texto !== textoOriginal;
  const linkFicha = tarefa.familiaId ? `/familias/${tarefa.familiaId}` : null;
  const justificarFreio = ehJustificarFreio(tarefa.payload);

  return (
    <Cartao
      className="flex flex-col gap-3"
      aria-labelledby={`titulo-${tarefa.id}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-48">
          {/* Inter 600 (t-3), como o título dos outros cartões (cartão de
              transferência, cartão de conversa): `font-titulo` é Jost,
              reservado a título de seção (crítica do CRM, P1 item 18).
              Sem a linha repetida com o nome da família: o título já traz
              o nome quando há um. */}
          <h3
            id={`titulo-${tarefa.id}`}
            className="text-3 text-texto font-semibold"
          >
            {tarefa.titulo}
          </h3>
        </div>
        {tarefa.prioridade !== "normal" ? (
          <Selo variante={tarefa.prioridade === "maxima" ? "alerta" : "aviso"}>
            {tarefa.prioridade === "maxima"
              ? "Prioridade máxima"
              : "Prioridade alta"}
          </Selo>
        ) : null}
        {tarefa.prazo ? (
          <span className="text-apoio text-texto-2 inline-flex shrink-0 items-center gap-1">
            <Clock aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {tarefa.prazo}
          </span>
        ) : null}
      </div>

      {justificarFreio ? (
        // "Justificar o freio" não pode virar "Concluir" liso: a
        // justificativa só se escreve na ficha, e ela é quem conclui a
        // tarefa (crítica do CRM, P1 item 11).
        <FaixaAlerta
          variante="sensivel"
          titulo="Freio em bloqueio total"
          acoes={
            linkFicha ? (
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                iconeEsquerda={
                  <OctagonPause aria-hidden="true" className="size-4" />
                }
              >
                <Link href={linkFicha}>Escrever justificativa</Link>
              </Botao>
            ) : null
          }
        >
          Sem texto sugerido: com o freio, só contato humano e nominal.
        </FaixaAlerta>
      ) : !tarefa.temAcaoWhatsApp ? (
        <form action={acaoConcluir} className="flex flex-col gap-2">
          <input type="hidden" name="tarefaId" value={tarefa.id} />
          {estadoConcluir.erro ? (
            <FaixaAlerta variante="prioritario" titulo="Não deu para concluir">
              {estadoConcluir.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Botao
              tamanho="compacto"
              variante="secundario"
              type="submit"
              carregando={concluindo}
              rotuloCarregando="Concluindo"
              iconeEsquerda={
                <Check
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              Concluir
            </Botao>
            {linkFicha ? (
              <Botao asChild variante="fantasma" tamanho="compacto">
                <Link href={linkFicha}>Ver família</Link>
              </Botao>
            ) : null}
          </div>
        </form>
      ) : !tarefa.podeEnviarMensagem ? (
        <FaixaAlerta
          variante={tarefa.bloqueioSensivel ? "sensivel" : "prioritario"}
          anunciar={false}
          titulo={
            tarefa.bloqueioSensivel
              ? "Mensagem pausada para esta família"
              : "Não dá para enviar agora"
          }
          acoes={
            linkFicha ? (
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href={linkFicha}>Ver família</Link>
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
            <FaixaAlerta
              variante="prioritario"
              titulo="Não deu para registrar o envio"
            >
              {estadoEnvio.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {link ? (
              <Botao asChild tamanho="compacto" variante="secundario">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                  <span>Abrir no WhatsApp</span>
                </a>
              </Botao>
            ) : (
              <Botao
                tamanho="compacto"
                variante="secundario"
                disabled
                iconeEsquerda={
                  <MessageCircle
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                }
              >
                Abrir no WhatsApp
              </Botao>
            )}
            <Botao
              type="submit"
              tamanho="compacto"
              variante="secundario"
              disabled={texto.trim().length === 0}
              carregando={enviando}
              rotuloCarregando="Registrando"
              iconeEsquerda={
                <Check
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              Enviei
            </Botao>
            {editado ? (
              <Botao
                type="button"
                tamanho="compacto"
                variante="fantasma"
                onClick={() => {
                  setTexto(textoOriginal);
                  document.getElementById(idTexto)?.focus();
                }}
              >
                Voltar ao texto sugerido
              </Botao>
            ) : null}
          </div>
        </form>
      )}
    </Cartao>
  );
}
