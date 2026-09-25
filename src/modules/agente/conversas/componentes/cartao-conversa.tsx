"use client";

import { estadoInicialAgente } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Bot,
  ClockAlert,
  Hourglass,
  MessageCircle,
  OctagonPause,
  UserCheck,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import {
  acaoMarcarNaoLead,
  acaoPausarConversa,
  acaoResolverTransferencia,
  acaoRetomarPausaManual,
} from "../../acoes";
import { CLASSIFICACOES_NAO_LEAD } from "../../loja-extra";
import {
  horaBrasilia,
  pausaVenceuComTransferenciaAberta,
  primeiroNome,
  ROTULO_SITUACAO,
  textoVoltaDaPausa,
} from "../../formatacao";
import {
  MOTIVOS_SENSIVEIS,
  ROTULO_DESFECHO,
  ROTULO_NAO_LEAD,
} from "../../tipos";
import type { ConversaComPausa } from "../../tipos";

const horaCurta = horaBrasilia;

function autorPrevia(autor: string): string {
  if (autor === "ia") return "Isadora";
  if (autor === "humano") return "Equipe";
  if (autor === "sistema") return "Sistema";
  return "Família";
}

const variantePorSituacao = {
  isadora: "neutro",
  equipe: "marinho",
  pausada: "aviso",
  nao_lead: "contorno",
} as const;

export function CartaoConversa({ conversa }: { conversa: ConversaComPausa }) {
  const nome =
    conversa.nomeFamilia ??
    conversa.nomeContato ??
    conversa.telefoneE164 ??
    "Contato sem nome";
  const hora = horaCurta(conversa.ultimaEntradaEm ?? conversa.ultimaSaidaEm);
  const voltaDaPausa = textoVoltaDaPausa(conversa.agentePausadoAte);
  const pausaVenceu =
    conversa.situacao === "isadora" &&
    pausaVenceuComTransferenciaAberta(
      conversa,
      Boolean(conversa.transferenciaAbertaId),
    );
  const [mostrarResolver, definirMostrarResolver] = useState(false);
  const [mostrarNaoLead, definirMostrarNaoLead] = useState(false);

  const [estadoAssumir, acaoAssumir, assumindo] = useActionState(
    acaoPausarConversa,
    estadoInicialAgente,
  );
  const [estadoPausar, acaoPausar, pausando] = useActionState(
    acaoPausarConversa,
    estadoInicialAgente,
  );
  const [estadoRetomar, acaoRetomar, retomando] = useActionState(
    acaoRetomarPausaManual,
    estadoInicialAgente,
  );
  const [estadoResolver, acaoResolver, resolvendo] = useActionState(
    acaoResolverTransferencia,
    estadoInicialAgente,
  );
  const [estadoNaoLead, acaoNaoLead, marcandoNaoLead] = useActionState(
    acaoMarcarNaoLead,
    estadoInicialAgente,
  );

  // Freio em bloqueio total (PRD 8.3): a lista não oferece "Assumir
  // conversa" nem "Pausar a Isadora" para uma família que só pode receber
  // contato humano e pelo nome, e não mostra a prévia da última mensagem.
  // Uma ação só, para abrir a conversa com cuidado (crítica do CRM, P0
  // item 3).
  if (conversa.estadoSensivel === "bloqueio_total") {
    return (
      <Cartao
        className="bg-sensivel-lavado border-sensivel-borda flex flex-col gap-2 border"
        aria-labelledby={`conversa-${conversa.id}`}
      >
        <div className="flex items-start gap-3">
          <Link
            id={`conversa-${conversa.id}`}
            href={`/conversas/${conversa.id}`}
            className="text-3 text-texto min-h-toque inline-flex flex-1 items-center font-semibold no-underline hover:underline"
          >
            {nome}
          </Link>
          {hora ? (
            <span className="text-mini text-texto-2 font-mono whitespace-nowrap">
              {hora}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Selo variante="sensivel" icone={<OctagonPause />}>
            Freio: Isadora desligada
          </Selo>
        </div>
        <p className="text-apoio text-texto-2">
          Só contato humano e nominal. A prévia fica fechada nesta lista.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={
              <OctagonPause
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            <Link href={`/conversas/${conversa.id}`}>Abrir com cuidado</Link>
          </Botao>
        </div>
      </Cartao>
    );
  }

  return (
    <Cartao
      className="flex flex-col gap-2"
      aria-labelledby={`conversa-${conversa.id}`}
    >
      <div className="flex items-start gap-3">
        <Link
          id={`conversa-${conversa.id}`}
          href={`/conversas/${conversa.id}`}
          className="text-3 text-texto min-h-toque inline-flex flex-1 items-center font-semibold no-underline hover:underline"
        >
          {nome}
        </Link>
        {hora ? (
          <span className="text-mini text-texto-2 font-mono whitespace-nowrap">
            {hora}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Selo
          variante={variantePorSituacao[conversa.situacao]}
          icone={
            conversa.situacao === "isadora" ? (
              <Bot />
            ) : conversa.situacao === "equipe" ? (
              <UserCheck />
            ) : conversa.situacao === "pausada" ? (
              <Hourglass />
            ) : undefined
          }
        >
          {ROTULO_SITUACAO[conversa.situacao]}
        </Selo>
        {conversa.transferenciaAberta ? (
          <Selo
            variante={
              conversa.transferenciaAberta.prioridade !== "maxima"
                ? "neutro"
                : // Perda gestacional e estado sensível nunca em vermelho
                  // (DESIGN.md, seção 8): o selo vai para ameixa, e não
                  // para alerta, nesses casos (crítica do CRM, P0 item 2).
                  MOTIVOS_SENSIVEIS.includes(
                      conversa.transferenciaAberta.motivo,
                    )
                  ? "sensivel"
                  : "alerta"
            }
            icone={<ArrowRightLeft />}
          >
            {conversa.transferenciaAberta.motivoRotulo}
            {conversa.transferenciaAberta.status === "assumido"
              ? ", assumida"
              : ""}
          </Selo>
        ) : null}
        {conversa.situacao === "equipe" ? (
          <span className="text-mini text-texto-2">
            A Isadora não volta sozinha.
          </span>
        ) : null}
        {conversa.situacao === "pausada" ? (
          <span className="text-mini text-texto-2">
            {[
              conversa.pausaMotivo,
              voltaDaPausa ? `A Isadora ${voltaDaPausa}.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        ) : null}
      </div>

      {pausaVenceu ? (
        <p className="text-apoio text-alerta inline-flex items-center gap-1.5 font-medium">
          <ClockAlert
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
          A pausa venceu com a transferência aberta. A Isadora voltou a
          responder.
        </p>
      ) : null}

      {conversa.ultimaMensagem ? (
        <p className="text-apoio text-texto-2 line-clamp-2">
          <span className="text-texto font-semibold">
            {autorPrevia(conversa.ultimaMensagem.enviadoPor)}:{" "}
          </span>
          {conversa.ultimaMensagem.conteudo ??
            "Mandou foto, áudio ou documento."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {conversa.situacao === "isadora" ? (
          <form action={acaoAssumir} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <input type="hidden" name="origem" value="assumir" />
            <Botao
              type="submit"
              variante="secundario"
              tamanho="compacto"
              carregando={assumindo}
              rotuloCarregando="Assumindo"
              iconeEsquerda={
                <UserCheck
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              Assumir conversa
            </Botao>
          </form>
        ) : null}
        {conversa.situacao === "isadora" ? (
          <form action={acaoPausar} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <input type="hidden" name="origem" value="pausar" />
            <Botao
              type="submit"
              variante="fantasma"
              tamanho="compacto"
              carregando={pausando}
            >
              Pausar a Isadora
            </Botao>
          </form>
        ) : null}

        {conversa.situacao === "equipe" ? (
          <Botao
            asChild
            tamanho="compacto"
            iconeEsquerda={
              <MessageCircle
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            <Link href={`/conversas/${conversa.id}`}>Abrir conversa</Link>
          </Botao>
        ) : null}
        {conversa.situacao === "equipe" && conversa.transferenciaAbertaId ? (
          <Botao
            type="button"
            variante="fantasma"
            tamanho="compacto"
            onClick={() => definirMostrarResolver((v) => !v)}
          >
            Marcar como resolvida
          </Botao>
        ) : null}

        {conversa.situacao === "pausada" && conversa.transferenciaAbertaId ? (
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={
              <UserCheck
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            <Link href="/transferencias">Assumir na fila</Link>
          </Botao>
        ) : null}
        {conversa.situacao === "pausada" && !conversa.transferenciaAbertaId ? (
          <form action={acaoRetomar} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <Botao
              type="submit"
              variante="secundario"
              tamanho="compacto"
              carregando={retomando}
            >
              Devolver agora
            </Botao>
          </form>
        ) : null}

        {conversa.situacao === "isadora" || conversa.situacao === "pausada" ? (
          <Botao
            type="button"
            variante="fantasma"
            tamanho="compacto"
            onClick={() => definirMostrarNaoLead((v) => !v)}
          >
            Marcar como não lead
          </Botao>
        ) : null}
      </div>

      {estadoAssumir.erro || estadoPausar.erro ? (
        <FaixaAlerta variante="erro" titulo="Não deu certo">
          {estadoAssumir.erro ?? estadoPausar.erro}
        </FaixaAlerta>
      ) : null}
      {estadoRetomar.erro ? (
        <FaixaAlerta variante="erro" titulo="Não deu certo">
          {estadoRetomar.erro}
        </FaixaAlerta>
      ) : null}

      {mostrarResolver ? (
        <form
          action={acaoResolver}
          className="border-linha flex flex-col gap-3 border-t pt-3"
        >
          <input
            type="hidden"
            name="transferenciaId"
            value={conversa.transferenciaAbertaId ?? ""}
          />
          <input type="hidden" name="conversaId" value={conversa.id} />
          <EscolhaUnica
            rotulo="Como terminou"
            name="desfecho"
            opcoes={Object.entries(ROTULO_DESFECHO).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            }))}
          />
          {estadoResolver.erro ? (
            <FaixaAlerta variante="erro" titulo="Não deu certo">
              {estadoResolver.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex gap-2">
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={resolvendo}
              rotuloCarregando="Salvando"
            >
              Marcar como resolvida
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              tamanho="compacto"
              onClick={() => definirMostrarResolver(false)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : null}

      {mostrarNaoLead ? (
        <form
          action={acaoNaoLead}
          className="border-linha flex flex-col gap-3 border-t pt-3"
        >
          <input type="hidden" name="conversaId" value={conversa.id} />
          <EscolhaUnica
            rotulo="Não é lead porque"
            name="classificacao"
            opcoes={CLASSIFICACOES_NAO_LEAD.map((valor) => ({
              valor,
              rotulo: ROTULO_NAO_LEAD[valor],
            }))}
          />
          <p className="text-apoio text-texto-2">
            A Isadora encaminha {primeiroNome(nome)} e para de responder depois
            disso.
          </p>
          {estadoNaoLead.erro ? (
            <FaixaAlerta variante="erro" titulo="Não deu certo">
              {estadoNaoLead.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex gap-2">
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={marcandoNaoLead}
              rotuloCarregando="Salvando"
            >
              Marcar como não lead
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              tamanho="compacto"
              onClick={() => definirMostrarNaoLead(false)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : null}
    </Cartao>
  );
}
