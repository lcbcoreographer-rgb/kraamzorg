"use client";

import { estadoInicialAgente } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, OctagonPause, UserCheck } from "lucide-react";
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
import { TileIcone } from "@/components/ui/tile-icone";
import { Selo } from "@/components/ui/selo";
import { formatarData, localidade } from "@/lib/formatacao";
import { rotulo } from "@/lib/rotulos-a-confirmar";
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
  MOTIVOS_SENSIVEIS,
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

/**
 * Em que mão está a conversa, numa faixa só (DESIGN.md, 11.5: no celular,
 * logo abaixo do cabeçalho e antes das mensagens; no computador, no topo
 * da coluna da direita). O freio vem antes de tudo: com a família em
 * bloqueio total ou encerrada em estado sensível, a Isadora está
 * desligada, e a tela não oferece assumir, pausar nem triagem comercial
 * (DESIGN.md, 11.8).
 */
export function FaixaEstadoConversa({
  conversa,
  transferenciaAberta,
  horasPausaHumano,
  textoNaoLead,
}: Omit<PainelResumoProps, "ficha">) {
  const nome = conversa.nomeContato ?? conversa.nomeFamilia ?? "a família";

  if (conversa.situacao === "freio") {
    return (
      <FaixaAlerta
        variante="sensivel"
        anunciar={false}
        titulo="A Isadora está desligada para esta família"
      >
        Só a equipe responde, pelo nome. Nenhuma mensagem automática sai para{" "}
        {primeiroNome(nome)}.
      </FaixaAlerta>
    );
  }
  if (conversa.situacao === "nao_lead") {
    return (
      <FaixaAlerta
        variante="info"
        titulo={`${rotulo("naoLead")}: ${
          conversa.classificacao in ROTULO_NAO_LEAD
            ? ROTULO_NAO_LEAD[
                conversa.classificacao as ClassificacaoNaoLead
              ].toLowerCase()
            : "fora do comercial"
        }`}
      >
        A Isadora manda uma resposta de encaminhamento e depois fica em silêncio
        nesta conversa.
        {textoNaoLead ? (
          <span className="mt-2 block italic">
            &ldquo;{textoNaoLead}&rdquo;
          </span>
        ) : null}
      </FaixaAlerta>
    );
  }
  if (conversa.agenteEncerradoEm) {
    return (
      <FaixaInfoEncerrada
        conversaId={conversa.id}
        nome={nome}
        motivo={conversa.agenteEncerradoMotivo}
      />
    );
  }
  if (conversa.situacao === "pausada") {
    return (
      <FaixaPausa
        conversaId={conversa.id}
        pausaMotivo={conversa.pausaMotivo}
        pausadoAte={conversa.agentePausadoAte}
        comTransferencia={Boolean(transferenciaAberta)}
      />
    );
  }
  if (conversa.situacao === "isadora") {
    return (
      <div className="flex flex-col gap-3">
        {transferenciaAberta &&
        pausaVenceuComTransferenciaAberta(conversa, true) ? (
          <FaixaAlerta
            variante="erro"
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
      </div>
    );
  }
  return null;
}

/**
 * O resto do painel da conversa: o resumo da Isadora, a transferência
 * aberta e as ações. No celular vem depois das mensagens (DESIGN.md, 11.5:
 * o que a família disse vem antes do estado do sistema).
 */
export function PainelResumo({
  conversa,
  ficha,
  transferenciaAberta,
}: Omit<PainelResumoProps, "horasPausaHumano" | "textoNaoLead">) {
  // Nome de quem escreve (WhatsApp) para as frases; o da família fica no cabeçalho.
  const nome = conversa.nomeContato ?? conversa.nomeFamilia ?? "a família";
  const comFreio = conversa.situacao === "freio";

  return (
    <aside className="flex flex-col gap-3" aria-label="Resumo da família">
      {/* Com o freio, o resumo comercial da Isadora sai da tela (estágio,
          IG, apresentação): o que importa já está no cabeçalho. */}
      {ficha && !comFreio ? <ResumoIsadora ficha={ficha} /> : null}

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

/**
 * Resumo da Isadora (DESIGN.md, 11.5). No celular, uma linha que abre ao
 * tocar ("Resumo da Isadora: Pinheiros, 9s1d, DPP 03/05/2027"); no
 * computador, o bloco aberto na coluna da direita. As duas formas moram
 * no DOM e o CSS mostra uma: `<details>` não abre por largura de tela sem
 * JavaScript, e abrir depois da hidratação faria o bloco pular.
 */
function ResumoIsadora({ ficha }: { ficha: FichaTela }) {
  const oportunidade = ficha.oportunidade;
  const dpp = ficha.datas.find((d) => d.rotulo === "DPP")?.valor ?? null;
  const onde =
    [localidade(ficha.bairro, ficha.cidade), ficha.uf]
      .filter(Boolean)
      .join(", ") || null;
  const linha = [
    localidade(ficha.bairro, ficha.cidade),
    ficha.idadeGestacional,
    dpp ? `DPP ${formatarData(dpp)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const lista = (
    <dl className="text-apoio grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
      <dt className="text-marinho-72">Onde</dt>
      <dd>{onde ?? "não informado"}</dd>
      {dpp ? (
        <>
          <dt className="text-marinho-72">DPP</dt>
          <dd>
            <span className="font-mono">{formatarData(dpp)}</span>{" "}
            <span className="text-texto-2 italic">estimativa</span>
          </dd>
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
          <dd>
            Enviada em{" "}
            <span className="font-mono">
              {formatarData(oportunidade.pdfEnviadoEm)}
            </span>
          </dd>
        </>
      ) : null}
      {ficha.estagioRotulo ? (
        <>
          <dt className="text-marinho-72">Estágio</dt>
          <dd>{ficha.estagioRotulo}</dd>
        </>
      ) : null}
    </dl>
  );

  return (
    <>
      <details className="bg-areia-clara rounded-3 group px-4 lg:hidden">
        <summary className="min-h-toque flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
          <Bot
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
          <span className="text-apoio min-w-0 flex-1">
            <span className="font-semibold">Resumo da Isadora</span>
            {linha ? <span className="text-texto-2">: {linha}</span> : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-140 group-open:rotate-180"
            strokeWidth={1.75}
          />
        </summary>
        <div className="pb-4">{lista}</div>
      </details>
      <section
        aria-label="Resumo da Isadora"
        className="bg-areia-clara rounded-3 hidden flex-col gap-4 p-5 lg:flex"
      >
        <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
          <TileIcone tom="areia" forma="quadrado" tamanho="p">
            <Bot />
          </TileIcone>
          Resumo da Isadora
        </h2>
        {lista}
      </section>
    </>
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
  // Quem está com a conversa agora (DESIGN.md, 2.5: dourado-claro é o
  // agora), com o robô num tile e a ação de assumir em marinho, o único
  // bloco forte da tela. Não é alerta: é a mão em que a conversa está.
  return (
    <section
      aria-labelledby="t-isadora-conduz"
      className="rounded-3 bg-dourado-claro flex flex-col gap-3 p-5"
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="dourado" forma="quadrado">
          <Bot />
        </TileIcone>
        <div className="flex flex-col gap-1">
          <h2
            id="t-isadora-conduz"
            className="font-titulo text-2 text-texto font-medium"
          >
            A Isadora está conduzindo esta conversa
          </h2>
          <p className="text-apoio text-texto-2">
            {horasPausa
              ? `Se você assumir, ela fica pausada aqui por ${horasPausa} h ou até você devolver.`
              : "Se você assumir, ela fica pausada aqui até a pausa vencer ou até você devolver."}
          </p>
        </div>
      </div>
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
      {estado.erro ? (
        <p role="alert" className="text-apoio text-alerta">
          {estado.erro}
        </p>
      ) : null}
    </section>
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
          {motivo === "reuniao_realizada"
            ? "Leonardo conduzindo"
            : "Com a equipe"}
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
      {motivo === "reuniao_realizada"
        ? "A reunião com a Edilaine aconteceu e a conversa é do Leonardo. "
        : "Esta conversa está com o comercial. "}
      A Isadora não volta sozinha, nem quando a transferência é resolvida: só o
      botão abaixo devolve a conversa, e ela responde a partir da próxima
      mensagem de {primeiroNome(nome)}.
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
  // Perda e estado sensível: a hora do relato no lugar do prazo, em ameixa,
  // sem relógio (DESIGN.md, 11.8, regra 1).
  const sensivel = MOTIVOS_SENSIVEIS.includes(transferencia.motivo);
  const prazo = sensivel ? null : textoPrazo(transferencia.slaVenceEm);
  const horaRecebida = horaBrasilia(transferencia.criadoEm);
  const horaAssumida = horaBrasilia(transferencia.assumidoEm);
  const rotuloResolver = sensivel
    ? rotulo("resolverSensivel")
    : "Marcar como resolvida";

  return (
    <section
      aria-label="Transferência aberta"
      className={
        sensivel
          ? "bg-sensivel-lavado border-sensivel-borda rounded-3 flex flex-col gap-3 border p-4"
          : "bg-superficie border-linha rounded-3 flex flex-col gap-3 border p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className={
            sensivel
              ? "text-sensivel font-semibold"
              : "text-texto font-semibold"
          }
        >
          {transferencia.motivoRotulo}
        </h2>
        {sensivel && horaRecebida ? (
          <span className="text-apoio text-texto-2 inline-flex items-center gap-1">
            <OctagonPause
              aria-hidden="true"
              className="text-sensivel size-4"
              strokeWidth={1.75}
            />
            recebida às{" "}
            <span className="font-mono tabular-nums">{horaRecebida}</span>
          </span>
        ) : prazo ? (
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
        <FaixaAlerta
          variante={sensivel ? "sensivel" : "erro"}
          titulo="A conversa não foi assumida"
        >
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
        {rotuloResolver}
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
            descricao="Encerra a transferência e não muda quem responde a conversa."
          />
          {estado.erro ? (
            <FaixaAlerta
              variante={sensivel ? "sensivel" : "erro"}
              titulo="A transferência continua aberta"
            >
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={enviando}
            rotuloCarregando="Salvando"
          >
            {rotuloResolver}
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
        {rotulo("marcarNaoLead")}
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
            <FaixaAlerta variante="erro" titulo="A classificação não foi salva">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={enviando}
            rotuloCarregando="Salvando"
          >
            {rotulo("marcarNaoLead")}
          </Botao>
        </form>
      ) : null}
    </div>
  );
}
