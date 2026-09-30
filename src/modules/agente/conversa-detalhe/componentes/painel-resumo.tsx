"use client";

import { estadoInicialAgente } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import { Bot, ChevronDown, Hourglass, Info, UserCheck } from "lucide-react";
import { OctagonPause } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { formatarData, formatarDataHora, localidade } from "@/lib/formatacao";
import { rotulo } from "@/lib/rotulos-a-confirmar";
import { cn } from "@/lib/utils";
import {
  acaoPausarConversa,
  acaoRetomarAgenteComercial,
  acaoRetomarPausaManual,
} from "../../acoes";
import {
  pausaVenceuComTransferenciaAberta,
  primeiroNome,
  textoVoltaDaPausa,
} from "../../formatacao";
import { ROTULO_MOTIVO_HANDOFF, ROTULO_NAO_LEAD } from "../../tipos";
import type { ClassificacaoNaoLead, ConversaComPausa } from "../../tipos";
import type { MotivoHandoff } from "@/lib/dados/tipos";
import type { FichaTela } from "@/modules/crm/ficha/tipos";

export interface FaixaEstadoConversaProps {
  conversa: ConversaComPausa;
  /** A conversa tem transferência aberta ou assumida. */
  comTransferencia: boolean;
  /** `agente_pausa_humano_horas`; null quando o papel não lê `parametro`. */
  horasPausaHumano: number | null;
  /** Texto de encaminhamento (`mensagem_modelo.nao_lead_*`) de uma conversa de não lead. */
  textoNaoLead: string | null;
  /** A família da conversa, para o freio e as quatro datas. */
  ficha: FichaTela | null;
}

function textoFreioAtivo(estado: EstadoSensivel, em: string | null): string {
  const quando = em ? formatarDataHora(em) : null;
  const desde = quando ? ` desde ${quando}` : "";
  if (estado === "atencao") {
    return `Freio em atenção${desde}. Conteúdo e marketing pausados; os avisos da operação continuam.`;
  }
  if (estado === "encerrado_sensivel") {
    return `Encerrado em estado sensível${desde}. Nenhuma pesquisa, pedido de indicação ou remarketing sai mais para esta família.`;
  }
  return `Freio em bloqueio total${desde}. Só contato humano e pelo nome.`;
}

/**
 * Bloco de "quem conduz" no topo da conversa: ícone, uma frase e, quando
 * houver, a ação ao lado (celular: embaixo). Tom pelo papel (DESIGN.md,
 * 2.5): a Isadora conduzindo é o agora (dourado); pausa, equipe e não lead
 * ficam em branco com contorno; o freio em ameixa, sem tom de apoio.
 */
function BlocoConducao({
  id,
  jeito,
  icone,
  titulo,
  children,
  depois,
  acao,
}: {
  id: string;
  jeito: "agora" | "neutro" | "sensivel";
  icone: React.ReactNode;
  titulo: React.ReactNode;
  /** A frase, na mesma linha do título. */
  children?: React.ReactNode;
  /** O que vem embaixo da frase (as quatro datas no freio). */
  depois?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-3 tablet:flex-row tablet:items-center flex flex-col gap-2 px-3 py-2.5 lg:px-4",
        jeito === "agora" && "bg-dourado-claro",
        jeito === "neutro" && "bg-superficie border-linha border",
        jeito === "sensivel" &&
          "bg-sensivel-lavado border-sensivel-borda border",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {icone}
        <div className="flex min-w-0 flex-col">
          <div className="text-apoio text-texto-2">
            <h3
              id={id}
              className={cn(
                "inline font-semibold",
                jeito === "sensivel" ? "text-sensivel" : "text-texto",
              )}
            >
              {titulo}
            </h3>
            {children ? <> {children}</> : null}
          </div>
          {depois}
        </div>
      </div>
      {acao ? <div className="tablet:shrink-0">{acao}</div> : null}
    </section>
  );
}

/**
 * Em que mão está a conversa, num bloco só no topo do painel, junto da
 * transferência. O freio vem antes de tudo: com a família em bloqueio
 * total ou encerrada em estado sensível, a Isadora está desligada, e a
 * tela não oferece assumir, pausar nem triagem comercial; as quatro datas
 * continuam, com "sem registro" nas que não aconteceram (DESIGN.md, 11.8).
 */
export function FaixaEstadoConversa({
  conversa,
  comTransferencia,
  horasPausaHumano,
  textoNaoLead,
  ficha,
}: FaixaEstadoConversaProps) {
  const nome = conversa.nomeContato ?? conversa.nomeFamilia ?? "a família";
  const estadoFreio = ficha?.estadoSensivel ?? "normal";

  if (conversa.situacao === "freio") {
    return (
      <BlocoConducao
        id="t-conduz"
        jeito="sensivel"
        icone={
          <OctagonPause
            aria-hidden="true"
            className="text-sensivel mt-px size-5 shrink-0"
            strokeWidth={1.75}
          />
        }
        titulo="A Isadora está desligada para esta família."
        depois={ficha ? <QuatroDatas ficha={ficha} /> : null}
      >
        {textoFreioAtivo(estadoFreio, ficha?.estadoSensivelEm ?? null)} Nenhuma
        mensagem automática sai para {primeiroNome(nome)}.
      </BlocoConducao>
    );
  }

  const atencao =
    estadoFreio === "atencao" ? (
      <FaixaAlerta variante="sensivel" anunciar={false} titulo="Freio ativo">
        {textoFreioAtivo(estadoFreio, ficha?.estadoSensivelEm ?? null)}
      </FaixaAlerta>
    ) : null;

  let bloco: React.ReactNode = null;
  if (conversa.situacao === "nao_lead") {
    bloco = (
      <BlocoConducao
        id="t-conduz"
        jeito="neutro"
        icone={<IconeNeutro icone={<Info />} />}
        titulo={`${rotulo("naoLead")}: ${
          conversa.classificacao in ROTULO_NAO_LEAD
            ? ROTULO_NAO_LEAD[
                conversa.classificacao as ClassificacaoNaoLead
              ].toLowerCase()
            : "fora do comercial"
        }.`}
        depois={
          textoNaoLead ? (
            <p className="text-apoio text-texto-2 mt-1 italic">
              &ldquo;{textoNaoLead}&rdquo;
            </p>
          ) : null
        }
      >
        A Isadora manda uma resposta de encaminhamento e depois fica em silêncio
        nesta conversa.
      </BlocoConducao>
    );
  } else if (conversa.agenteEncerradoEm) {
    bloco = (
      <BlocoEncerrada
        conversaId={conversa.id}
        motivo={conversa.agenteEncerradoMotivo}
      />
    );
  } else if (conversa.situacao === "pausada" && comTransferencia) {
    // A pausa que vem da transferência mora dentro da faixa dela
    // (`LinhaPausa`), para o topo da conversa não empilhar dois blocos.
    bloco = null;
  } else if (conversa.situacao === "pausada") {
    bloco = (
      <BlocoPausa
        conversaId={conversa.id}
        pausaMotivo={conversa.pausaMotivo}
        pausadoAte={conversa.agentePausadoAte}
        comTransferencia={comTransferencia}
      />
    );
  } else if (conversa.situacao === "isadora") {
    bloco = (
      <>
        {comTransferencia &&
        pausaVenceuComTransferenciaAberta(conversa, true) ? (
          <FaixaAlerta
            variante="erro"
            titulo="A pausa venceu com a transferência aberta"
          >
            A Isadora voltou a responder, sem retomar o assunto transferido.
            Assuma para responder a família.
          </FaixaAlerta>
        ) : null}
        <BlocoIsadoraAtiva
          conversaId={conversa.id}
          horasPausa={horasPausaHumano}
          comTransferencia={comTransferencia}
        />
      </>
    );
  }

  return (
    <>
      {atencao}
      {bloco}
    </>
  );
}

/**
 * A pausa da Isadora dentro da faixa da transferência aberta: uma linha,
 * sem ação (quem devolve a conversa é o encerramento da transferência).
 */
export function LinhaPausa({
  pausaMotivo,
  pausadoAte,
}: {
  pausaMotivo: string | null;
  pausadoAte: string | null;
}) {
  const volta = textoVoltaDaPausa(pausadoAte);
  return (
    <p className="text-apoio text-texto-2 flex items-start gap-2">
      <Hourglass
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        strokeWidth={1.75}
      />
      <span>
        <strong className="text-texto font-semibold">
          Isadora pausada nesta conversa.
        </strong>{" "}
        {pausaMotivo ?? "Pausada pela transferência aberta."}
        {volta ? ` A Isadora ${volta}.` : null}
      </span>
    </p>
  );
}

function IconeNeutro({ icone }: { icone: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="text-texto-2 mt-px inline-flex shrink-0 [&_svg]:size-5 [&_svg]:stroke-[1.75]"
    >
      {icone}
    </span>
  );
}

/**
 * As quatro datas depois de uma perda (PRD 20.4; DESIGN.md, 11.8 regra 3):
 * as que existem como fato, as outras "sem registro", em texto simples,
 * sem legenda de futuro.
 */
function QuatroDatas({ ficha }: { ficha: FichaTela }) {
  return (
    <dl className="tablet:grid-cols-4 mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
      {ficha.datas.map((data) => (
        <div key={data.rotulo} className="flex flex-col gap-0.5">
          <dt className="text-mini text-texto-2">{data.rotulo}</dt>
          <dd className="text-apoio text-texto">
            {data.valor ? (
              <span className="font-mono">{formatarData(data.valor)}</span>
            ) : (
              "sem registro"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Resumo da Isadora (DESIGN.md, 11.5): uma linha que abre ao tocar
 * ("Resumo da Isadora: Pinheiros, 9s1d, DPP 03/05/2027"), no celular e no
 * computador, para a conversa ficar com o espaço da tela.
 */
export function ResumoIsadora({ ficha }: { ficha: FichaTela }) {
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

  return (
    <details className="bg-areia-clara rounded-3 group px-4">
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
      <dl className="text-apoio grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 pb-4">
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
    </details>
  );
}

function BlocoIsadoraAtiva({
  conversaId,
  horasPausa,
  comTransferencia,
}: {
  conversaId: string;
  horasPausa: number | null;
  comTransferencia: boolean;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoPausarConversa,
    estadoInicialAgente,
  );
  // Com transferência aberta, quem assume é a faixa da transferência (que
  // também pausa a Isadora): aqui fica só a frase, sem um segundo
  // "Assumir conversa".
  return (
    <BlocoConducao
      id="t-conduz"
      jeito="agora"
      icone={
        <span
          aria-hidden="true"
          className="text-texto mt-px inline-flex shrink-0 [&_svg]:size-5 [&_svg]:stroke-[1.75]"
        >
          <Bot />
        </span>
      }
      titulo="A Isadora está conduzindo esta conversa."
      acao={
        comTransferencia ? undefined : (
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
        )
      }
    >
      {horasPausa
        ? `Se você assumir, ela fica pausada aqui por ${horasPausa} h ou até você devolver.`
        : "Se você assumir, ela fica pausada aqui até a pausa vencer ou até você devolver."}
      {estado.erro ? (
        <span role="alert" className="text-alerta mt-1 block">
          {estado.erro}
        </span>
      ) : null}
    </BlocoConducao>
  );
}

function BlocoPausa({
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
    <BlocoConducao
      id="t-conduz"
      jeito="neutro"
      icone={<IconeNeutro icone={<Hourglass />} />}
      titulo="Isadora pausada nesta conversa."
      acao={
        comTransferencia ? undefined : (
          <form action={acao}>
            <input type="hidden" name="conversaId" value={conversaId} />
            <Botao
              type="submit"
              variante="secundario"
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
        ? " Resolva a transferência acima quando terminar."
        : null}
      {estado.erro ? (
        <span className="text-alerta mt-1 block">{estado.erro}</span>
      ) : null}
    </BlocoConducao>
  );
}

function BlocoEncerrada({
  conversaId,
  motivo,
}: {
  conversaId: string;
  motivo: string | null;
}) {
  const [aberto, definirAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    acaoRetomarAgenteComercial,
    estadoInicialAgente,
  );
  const doLeonardo = motivo === "reuniao_realizada";

  return (
    <BlocoConducao
      id="t-conduz"
      jeito="neutro"
      icone={<IconeNeutro icone={<UserCheck />} />}
      titulo="A Isadora saiu desta conversa."
      acao={
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
      {doLeonardo
        ? "A reunião com a Edilaine aconteceu e a conversa é do Leonardo. "
        : "Esta conversa está com o comercial. "}
      {motivo && !doLeonardo
        ? `Motivo: ${
            motivo in ROTULO_MOTIVO_HANDOFF
              ? ROTULO_MOTIVO_HANDOFF[motivo as MotivoHandoff].toLowerCase()
              : motivo
          }. `
        : null}
      A Isadora não volta sozinha, nem quando a transferência é resolvida; só
      &ldquo;Devolver à Isadora&rdquo; devolve a conversa a ela.
      {estado.erro ? (
        <span className="text-alerta mt-1 block">{estado.erro}</span>
      ) : null}
    </BlocoConducao>
  );
}
