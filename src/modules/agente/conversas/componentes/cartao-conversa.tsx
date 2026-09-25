"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Bot, Hourglass, MessageCircle, OctagonPause, UserCheck } from "lucide-react";
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
  estadoInicialAgente,
} from "../../acoes";
import { CLASSIFICACOES_NAO_LEAD } from "../../loja-extra";
import { primeiroNome, ROTULO_SITUACAO } from "../../formatacao";
import { ROTULO_DESFECHO, ROTULO_NAO_LEAD } from "../../tipos";
import type { ConversaComPausa } from "../../tipos";

function horaCurta(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);
}

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
  const nome = conversa.nomeFamilia ?? conversa.nomeContato ?? conversa.telefoneE164 ?? "Contato sem nome";
  const hora = horaCurta(conversa.ultimaEntradaEm ?? conversa.ultimaSaidaEm);
  const [mostrarResolver, definirMostrarResolver] = useState(false);
  const [mostrarNaoLead, definirMostrarNaoLead] = useState(false);

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

  return (
    <Cartao className="flex flex-col gap-2" aria-labelledby={`conversa-${conversa.id}`}>
      <div className="flex items-start gap-3">
        <Link
          id={`conversa-${conversa.id}`}
          href={`/conversas/${conversa.id}`}
          className="text-3 text-texto min-h-toque inline-flex flex-1 items-center font-semibold no-underline hover:underline"
        >
          {nome}
        </Link>
        {hora ? (
          <span className="text-mini text-texto-2 font-mono whitespace-nowrap">{hora}</span>
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
        {conversa.situacao === "equipe" ? (
          <span className="text-mini text-texto-2">A Isadora não volta.</span>
        ) : null}
        {conversa.situacao === "pausada" && conversa.pausaMotivo ? (
          <span className="text-mini text-texto-2">{conversa.pausaMotivo}</span>
        ) : null}
      </div>

      {conversa.ultimaMensagem ? (
        <p className="text-apoio text-texto-2 line-clamp-2">
          <span className="text-texto font-semibold">
            {autorPrevia(conversa.ultimaMensagem.enviadoPor)}:{" "}
          </span>
          {conversa.ultimaMensagem.conteudo ?? "(sem texto)"}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {conversa.situacao === "isadora" ? (
          <form action={acaoPausar} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <input type="hidden" name="origem" value="assumir" />
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={pausando}
              rotuloCarregando="Assumindo"
              iconeEsquerda={<UserCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            >
              Assumir conversa
            </Botao>
          </form>
        ) : null}
        {conversa.situacao === "isadora" ? (
          <form action={acaoPausar} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <input type="hidden" name="origem" value="pausar" />
            <Botao type="submit" variante="fantasma" tamanho="compacto" carregando={pausando}>
              Pausar a Isadora
            </Botao>
          </form>
        ) : null}

        {conversa.situacao === "equipe" ? (
          <Botao asChild tamanho="compacto" iconeEsquerda={<MessageCircle aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
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
          <Botao asChild variante="secundario" tamanho="compacto" iconeEsquerda={<UserCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
            <Link href="/transferencias">Assumir na fila</Link>
          </Botao>
        ) : null}
        {conversa.situacao === "pausada" && !conversa.transferenciaAbertaId ? (
          <form action={acaoRetomar} className="contents">
            <input type="hidden" name="conversaId" value={conversa.id} />
            <Botao type="submit" variante="secundario" tamanho="compacto" carregando={retomando}>
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

      {estadoPausar.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu certo">
          {estadoPausar.erro}
        </FaixaAlerta>
      ) : null}
      {estadoRetomar.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu certo">
          {estadoRetomar.erro}
        </FaixaAlerta>
      ) : null}

      {mostrarResolver ? (
        <form action={acaoResolver} className="border-linha flex flex-col gap-3 border-t pt-3">
          <input type="hidden" name="transferenciaId" value={conversa.transferenciaAbertaId ?? ""} />
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
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estadoResolver.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex gap-2">
            <Botao type="submit" tamanho="compacto" carregando={resolvendo} rotuloCarregando="Salvando">
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
        <form action={acaoNaoLead} className="border-linha flex flex-col gap-3 border-t pt-3">
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
            A Isadora encaminha {primeiroNome(nome)} e para de responder depois disso.
          </p>
          {estadoNaoLead.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estadoNaoLead.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex gap-2">
            <Botao type="submit" tamanho="compacto" carregando={marcandoNaoLead} rotuloCarregando="Salvando">
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
