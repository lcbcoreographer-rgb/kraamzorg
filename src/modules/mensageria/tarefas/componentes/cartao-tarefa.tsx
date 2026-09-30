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
import { cn } from "@/lib/utils";
import { concluirTarefaSemMensagem, enviarTarefa } from "../acoes";
import { estadoInicialTarefa, type EstadoAcaoTarefa } from "../estado-acoes";
import {
  ehFormularioContrato,
  ehJustificarFreio,
  ROTULO_TIPO_TAREFA,
} from "../tipos";
import type { TarefaComFreio } from "../dados";
import { explicarTarefa } from "../origem";

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
  explicada = false,
}: {
  tarefa: TarefaComFreio;
  aoFeita?: (feita: TarefaFeita) => void;
  /**
   * Tela Tarefas: o cartão diz por que a tarefa existe e o que fazer, e no
   * computador a ação fica à direita (pedido do dono em 30/09). No Início,
   * o cartão continua curto.
   */
  explicada?: boolean;
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
  const formularioContrato = ehFormularioContrato(tarefa.payload);
  const explicacao = explicada ? explicarTarefa(tarefa) : null;

  return (
    <Cartao
      className={
        explicada
          ? "flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-x-8 lg:p-6"
          : "flex flex-col gap-3"
      }
      aria-labelledby={`titulo-${tarefa.id}`}
    >
      <div className={explicada ? "flex min-w-0 flex-col gap-3" : "contents"}>
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
          {/* Tarefa de justificar o freio é sobre uma família em luto: sem
            selo de prioridade em âmbar ou vermelho e sem relógio ao lado
            dela (DESIGN.md 11.3 e 11.8). O prazo continua escrito, para
            quem precisa agir. */}
          {tarefa.prioridade !== "normal" && !justificarFreio ? (
            <Selo
              variante={tarefa.prioridade === "maxima" ? "alerta" : "aviso"}
            >
              {tarefa.prioridade === "maxima"
                ? "Prioridade máxima"
                : "Prioridade alta"}
            </Selo>
          ) : null}
          {tarefa.prazo ? (
            // O prazo numa pílula areia (direção "Colo"); na tarefa do freio,
            // só a frase, sem relógio e sem pílula (DESIGN.md 11.8).
            <span
              className={cn(
                "text-apoio inline-flex shrink-0 items-center gap-1.5",
                justificarFreio
                  ? "text-texto-2"
                  : "rounded-pilula bg-areia-clara text-texto min-h-7 px-3 font-medium",
              )}
            >
              {justificarFreio ? null : (
                <Clock
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              )}
              {tarefa.prazo}
            </span>
          ) : null}
        </div>
        {explicacao ? (
          <dl className="text-apoio flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-mini text-texto-2 font-semibold">
                Por que existe
              </dt>
              <dd className="text-texto">{explicacao.origem}</dd>
            </div>
            {/* Na tarefa do freio e na do formulário, o bloco da ação já diz
              o que fazer; a frase não se repete. */}
            {justificarFreio || formularioContrato ? null : (
              <div className="flex flex-col gap-0.5">
                <dt className="text-mini text-texto-2 font-semibold">
                  O que fazer
                </dt>
                <dd className="text-texto">{explicacao.oQueFazer}</dd>
              </div>
            )}
          </dl>
        ) : null}
      </div>

      <div className={explicada ? "min-w-0" : "contents"}>
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
            Nenhuma mensagem automática sai para esta família. A justificativa
            se escreve na ficha e fecha esta tarefa.
          </FaixaAlerta>
        ) : formularioContrato && tarefa.familiaId ? (
          // P30: o link do formulário vale uma vez e não fica guardado; ele
          // nasce na proposta, dentro do texto aprovado, na hora de enviar.
          <div className="flex flex-col gap-2">
            <p className="text-apoio text-texto-2">
              {explicada
                ? "Abra a proposta e envie o link do formulário. Ele é gerado na hora, vale uma vez e não fica guardado em lugar nenhum."
                : "O link do formulário é gerado na proposta, na hora de enviar. Ele vale uma vez e não fica guardado em lugar nenhum."}
            </p>
            <Botao
              asChild
              tamanho="compacto"
              variante="secundario"
              className="self-start"
            >
              <Link href={`/familias/${tarefa.familiaId}/proposta`}>
                Abrir a proposta
              </Link>
            </Botao>
          </div>
        ) : !tarefa.temAcaoWhatsApp ? (
          <form action={acaoConcluir} className="flex flex-col gap-2">
            <input type="hidden" name="tarefaId" value={tarefa.id} />
            {estadoConcluir.erro ? (
              <FaixaAlerta
                variante="prioritario"
                titulo="A tarefa não foi concluída"
              >
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
              "O freio está acionado para essa família. Só contato humano, pelo nome."}
          </FaixaAlerta>
        ) : (
          <form action={acaoEnviar} className="flex flex-col gap-3">
            <input type="hidden" name="tarefaId" value={tarefa.id} />
            {/* O texto sugerido como a bolha que vai sair (DESIGN.md, 2.5:
              conversas em argila), com o canto de cima mais fechado. */}
            <div className="rounded-3 bg-argila-clara rounded-tl-1 p-3 pb-2">
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
            </div>
            {estadoEnvio.erro ? (
              <FaixaAlerta
                variante="prioritario"
                titulo="O envio não foi registrado"
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
      </div>
    </Cartao>
  );
}
