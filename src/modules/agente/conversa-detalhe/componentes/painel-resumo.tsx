"use client";

import { estadoInicialAgente } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Bot, UserCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { formatarData, localidade } from "@/lib/formatacao";
import { textoPrazo } from "@/modules/mensageria/tarefas/agrupar";
import {
  acaoAssumirTransferencia,
  acaoMarcarNaoLead,
  acaoPausarConversa,
  acaoResolverTransferencia,
  acaoRetomarAgenteComercial,
  acaoRetomarPausaManual,
} from "../../acoes";
import {
  horaBrasilia,
  pausaVenceuComTransferenciaAberta,
  primeiroNome,
  textoVoltaDaPausa,
} from "../../formatacao";
import { CLASSIFICACOES_NAO_LEAD } from "../../loja-extra";
import {
  ROTULO_DESFECHO,
  ROTULO_MOTIVO_HANDOFF,
  ROTULO_NAO_LEAD,
} from "../../tipos";
import type {
  ClassificacaoNaoLead,
  ConversaComPausa,
  TransferenciaTela,
} from "../../tipos";
import type { MotivoHandoff } from "@/lib/dados/tipos";
import type { FichaTela } from "@/modules/crm/ficha/tipos";

export interface PainelResumoProps {
  conversa: ConversaComPausa;
  ficha: FichaTela | null;
  transferenciaAberta: TransferenciaTela | null;
  /** `agente_pausa_humano_horas`; null quando o papel não lê `parametro`. */
  horasPausaHumano: number | null;
  /** Texto de encaminhamento (`mensagem_modelo.nao_lead_*`) de uma conversa de não lead. */
  textoNaoLead: string | null;
}

export function PainelResumo({
  conversa,
  ficha,
  transferenciaAberta,
  horasPausaHumano,
  textoNaoLead,
}: PainelResumoProps) {
  // Nome de quem escreve (WhatsApp) para as frases; o da família fica no cabeçalho.
  const nome = conversa.nomeContato ?? conversa.nomeFamilia ?? "a família";
  const oportunidade = ficha?.oportunidade ?? null;
  const dpp = ficha?.datas.find((d) => d.rotulo === "DPP")?.valor ?? null;

  return (
    <aside className="flex flex-col gap-3" aria-label="Resumo da família">
      {ficha ? (
        <details className="bg-superficie-2 rounded-3 p-4" open>
          <summary className="min-h-toque flex cursor-pointer list-none items-center gap-2 font-semibold">
            <Bot aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Resumo da Isadora
          </summary>
          <dl className="text-apoio mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
            <dt className="text-marinho-72">Onde</dt>
            <dd>
              {[localidade(ficha.bairro, ficha.cidade), ficha.uf]
                .filter(Boolean)
                .join(", ") || "não informado"}
            </dd>
            {dpp ? (
              <>
                <dt className="text-marinho-72">DPP</dt>
                <dd className="font-mono">{formatarData(dpp)} (estimativa)</dd>
              </>
            ) : null}
            {ficha.idadeGestacional ? (
              <>
                <dt className="text-marinho-72">Semanas</dt>
                <dd className="font-mono">{ficha.idadeGestacional}</dd>
              </>
            ) : null}
            {oportunidade?.pdfEnviadoEm ? (
              <>
                <dt className="text-marinho-72">Apresentação</dt>
                <dd>Enviada em {formatarData(oportunidade.pdfEnviadoEm)}</dd>
              </>
            ) : null}
            {ficha.estagioRotulo ? (
              <>
                <dt className="text-marinho-72">Estágio</dt>
                <dd>{ficha.estagioRotulo}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}

      {conversa.situacao === "nao_lead" ? (
        <FaixaAlerta
          variante="info"
          titulo={`Não lead: ${
            conversa.classificacao in ROTULO_NAO_LEAD
              ? ROTULO_NAO_LEAD[conversa.classificacao as ClassificacaoNaoLead]
              : "fora do comercial"
          }`}
        >
          A Isadora manda uma resposta de encaminhamento e depois fica em
          silêncio nesta conversa.
          {textoNaoLead ? (
            <span className="mt-2 block italic">
              &ldquo;{textoNaoLead}&rdquo;
            </span>
          ) : null}
        </FaixaAlerta>
      ) : conversa.agenteEncerradoEm ? (
        <FaixaInfoEncerrada
          conversaId={conversa.id}
          nome={nome}
          motivo={conversa.agenteEncerradoMotivo}
        />
      ) : conversa.situacao === "pausada" ? (
        <FaixaPausa
          conversaId={conversa.id}
          pausaMotivo={conversa.pausaMotivo}
          pausadoAte={conversa.agentePausadoAte}
          comTransferencia={Boolean(transferenciaAberta)}
        />
      ) : conversa.situacao === "isadora" ? (
        <>
          {transferenciaAberta &&
          pausaVenceuComTransferenciaAberta(conversa, true) ? (
            <FaixaAlerta
              variante="imediato"
              titulo="A pausa venceu com a transferência aberta"
            >
              A Isadora voltou a responder, sem retomar o assunto transferido.
              Assuma para responder a família.
            </FaixaAlerta>
          ) : null}
          <FaixaIsadoraAtiva
            conversaId={conversa.id}
            horasPausa={horasPausaHumano}
          />
        </>
      ) : null}

      {transferenciaAberta ? (
        <CartaoTransferenciaAberta
          transferencia={transferenciaAberta}
          conversaId={conversa.id}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {conversa.familiaId ? (
          <Botao asChild variante="secundario" tamanho="compacto">
            <Link href={`/familias/${conversa.familiaId}`}>Ver ficha</Link>
          </Botao>
        ) : null}
        {conversa.situacao === "isadora" || conversa.situacao === "pausada" ? (
          <MarcarNaoLead conversaId={conversa.id} nome={nome} />
        ) : null}
      </div>
    </aside>
  );
}

function FaixaIsadoraAtiva({
  conversaId,
  horasPausa,
}: {
  conversaId: string;
  horasPausa: number | null;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoPausarConversa,
    estadoInicialAgente,
  );
  return (
    <FaixaAlerta
      variante="info"
      titulo="A Isadora está conduzindo esta conversa"
      acoes={
        <form action={acao}>
          <input type="hidden" name="conversaId" value={conversaId} />
          <input type="hidden" name="origem" value="assumir" />
          <Botao
            type="submit"
            variante="primario"
            tamanho="compacto"
            carregando={enviando}
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
      }
    >
      {horasPausa
        ? `Se você assumir, ela fica pausada aqui por ${horasPausa} h ou até você devolver.`
        : "Se você assumir, ela fica pausada aqui até a pausa vencer ou até você devolver."}
      {estado.erro ? (
        <span className="text-alerta block">{estado.erro}</span>
      ) : null}
    </FaixaAlerta>
  );
}

function FaixaPausa({
  conversaId,
  pausaMotivo,
  pausadoAte,
  comTransferencia,
}: {
  conversaId: string;
  pausaMotivo: string | null;
  pausadoAte: string | null;
  comTransferencia: boolean;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoRetomarPausaManual,
    estadoInicialAgente,
  );
  const volta = textoVoltaDaPausa(pausadoAte);
  return (
    <FaixaAlerta
      variante="info"
      titulo="Isadora pausada nesta conversa"
      acoes={
        comTransferencia ? undefined : (
          <form action={acao}>
            <input type="hidden" name="conversaId" value={conversaId} />
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={enviando}
              rotuloCarregando="Devolvendo"
            >
              Devolver agora
            </Botao>
          </form>
        )
      }
    >
      {pausaMotivo ??
        (comTransferencia
          ? "Pausada pela transferência aberta."
          : "Pausada por alguém da equipe.")}
      {volta ? ` A Isadora ${volta}.` : null}
      {comTransferencia
        ? " Resolva a transferência abaixo quando terminar."
        : null}
      {estado.erro ? (
        <span className="text-alerta block">{estado.erro}</span>
      ) : null}
    </FaixaAlerta>
  );
}

function FaixaInfoEncerrada({
  conversaId,
  nome,
  motivo,
}: {
  conversaId: string;
  nome: string;
  motivo: string | null;
}) {
  const [aberto, definirAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    acaoRetomarAgenteComercial,
    estadoInicialAgente,
  );

  return (
    <FaixaAlerta
      variante="info"
      titulo="A Isadora saiu desta conversa"
      acoes={
        <Dialogo open={aberto} onOpenChange={definirAberto}>
          <DialogoGatilho asChild>
            <Botao type="button" variante="secundario" tamanho="compacto">
              Devolver à Isadora
            </Botao>
          </DialogoGatilho>
          <DialogoConteudo
            titulo="Devolver esta conversa à Isadora"
            rotuloFechar="Fechar"
            descricao="A Isadora volta a responder nesta conversa a partir da próxima mensagem da família, inclusive com follow-up. A devolução fica registrada no histórico."
          >
            <form
              action={acao}
              onSubmit={() => {
                definirAberto(false);
              }}
            >
              <input type="hidden" name="conversaId" value={conversaId} />
              <DialogoRodape>
                <DialogoFechar asChild>
                  <Botao type="button" variante="secundario">
                    Cancelar
                  </Botao>
                </DialogoFechar>
                <Botao
                  type="submit"
                  carregando={enviando}
                  rotuloCarregando="Devolvendo"
                >
                  Devolver à Isadora
                </Botao>
              </DialogoRodape>
            </form>
          </DialogoConteudo>
        </Dialogo>
      }
    >
      <span className="mb-2 flex flex-wrap items-center gap-2">
        <Selo variante="marinho" icone={<UserCheck />}>
          Com a equipe
        </Selo>
        {motivo ? (
          <span className="text-apoio">
            Motivo:{" "}
            {motivo in ROTULO_MOTIVO_HANDOFF
              ? ROTULO_MOTIVO_HANDOFF[motivo as MotivoHandoff].toLowerCase()
              : motivo}
          </span>
        ) : null}
      </span>
      Lead qualificado passado ao comercial. A Isadora não volta sozinha, nem
      quando a transferência é resolvida. Só o botão abaixo devolve, e ela só
      responde a partir da próxima mensagem de {primeiroNome(nome)}.
      {estado.erro ? (
        <span className="text-alerta mt-2 block">{estado.erro}</span>
      ) : null}
    </FaixaAlerta>
  );
}

function CartaoTransferenciaAberta({
  transferencia,
  conversaId,
}: {
  transferencia: TransferenciaTela;
  conversaId: string;
}) {
  const [mostrar, definirMostrar] = useState(false);
  const [estadoAssumir, acaoAssumir, assumindo] = useActionState(
    acaoAssumirTransferencia,
    estadoInicialAgente,
  );
  const [estado, acao, enviando] = useActionState(
    acaoResolverTransferencia,
    estadoInicialAgente,
  );

  if (transferencia.status === "resolvido") return null;
  const prazo = textoPrazo(transferencia.slaVenceEm);
  const horaAssumida = horaBrasilia(transferencia.assumidoEm);

  return (
    <section
      aria-label="Transferência aberta"
      className="bg-superficie border-linha rounded-3 flex flex-col gap-3 border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-texto font-semibold">
          {transferencia.motivoRotulo}
        </h2>
        {prazo ? (
          <span className="text-apoio text-texto-2 tabular-nums">{prazo}</span>
        ) : null}
      </div>
      <p className="text-apoio text-texto">{transferencia.resumo}</p>
      {transferencia.status === "assumido" ? (
        <Selo variante="sucesso" icone={<UserCheck />}>
          {horaAssumida ? `Assumida às ${horaAssumida}` : "Assumida"}
        </Selo>
      ) : (
        <form action={acaoAssumir}>
          <input
            type="hidden"
            name="transferenciaId"
            value={transferencia.id}
          />
          <input type="hidden" name="conversaId" value={conversaId} />
          <Botao
            type="submit"
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
      )}
      {estadoAssumir.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu certo">
          {estadoAssumir.erro}
        </FaixaAlerta>
      ) : null}

      <Botao
        type="button"
        variante="secundario"
        tamanho="compacto"
        // `section` é `flex-col`: sem `self-start`, este botão (filho
        // direto) esticava para a largura toda, enquanto "Assumir
        // conversa" (dentro do próprio `<form>`) ficava do tamanho do
        // texto (crítica do CRM, P1 item 10).
        className="self-start"
        aria-expanded={mostrar}
        onClick={() => definirMostrar((v) => !v)}
      >
        Marcar como resolvida
      </Botao>
      {mostrar ? (
        <form
          action={acao}
          className="border-linha flex flex-col gap-3 border-t pt-3"
        >
          <input
            type="hidden"
            name="transferenciaId"
            value={transferencia.id}
          />
          <input type="hidden" name="conversaId" value={conversaId} />
          <EscolhaUnica
            rotulo="Como terminou"
            name="desfecho"
            opcoes={Object.entries(ROTULO_DESFECHO).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            }))}
            descricao="Resolver encerra a transferência e não muda quem responde a conversa."
          />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={enviando}
            rotuloCarregando="Salvando"
          >
            Marcar como resolvida
          </Botao>
        </form>
      ) : null}
    </section>
  );
}

function MarcarNaoLead({
  conversaId,
  nome,
}: {
  conversaId: string;
  nome: string;
}) {
  const [mostrar, definirMostrar] = useState(false);
  const [estado, acao, enviando] = useActionState(
    acaoMarcarNaoLead,
    estadoInicialAgente,
  );

  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante="fantasma"
        tamanho="compacto"
        aria-expanded={mostrar}
        onClick={() => definirMostrar((v) => !v)}
      >
        Marcar como não lead
      </Botao>
      {mostrar ? (
        <form
          action={acao}
          className="border-linha flex flex-col gap-3 border-t pt-3"
        >
          <input type="hidden" name="conversaId" value={conversaId} />
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
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={enviando}
            rotuloCarregando="Salvando"
          >
            Marcar como não lead
          </Botao>
        </form>
      ) : null}
    </div>
  );
}
