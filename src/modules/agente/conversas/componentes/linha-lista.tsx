import * as React from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Bot,
  CircleAlert,
  ClockAlert,
  Hourglass,
  OctagonPause,
  UserCheck,
} from "lucide-react";
import { Selo } from "@/components/ui/selo";
import { cn } from "@/lib/utils";
import {
  estadoPrazo,
  horaBrasilia,
  rotuloDaSituacao,
  textoVoltaDaPausa,
} from "../../formatacao";
import { FRASE_DESTINO_HANDOFF } from "../../tipos";
import type { SituacaoConversa } from "../../tipos";
import {
  MOTIVOS_SEM_PREVIA,
  nomeDaConversa,
  prazoCurto,
  quandoNaLista,
  transferenciaSensivel,
  type LinhaLista,
  type TransferenciaDaLinha,
} from "../lista";
import { AvatarContato } from "./avatar-contato";

const VARIANTE_SITUACAO: Record<
  SituacaoConversa,
  "neutro" | "marinho" | "aviso" | "contorno" | "sensivel"
> = {
  isadora: "neutro",
  equipe: "marinho",
  pausada: "aviso",
  nao_lead: "contorno",
  freio: "sensivel",
};

const ICONE_SITUACAO: Partial<Record<SituacaoConversa, React.ReactNode>> = {
  isadora: <Bot />,
  equipe: <UserCheck />,
  pausada: <Hourglass />,
  freio: <OctagonPause />,
};

function autorDaPrevia(autor: string): string | null {
  if (autor === "ia") return "Isadora";
  if (autor === "humano") return "Equipe";
  if (autor === "sistema") return "Resposta automática";
  return null;
}

function comMaiuscula(frase: string): string {
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** Motivo da transferência: saúde em alerta, perda em ameixa, o resto neutro. */
function SeloTransferencia({ t }: { t: TransferenciaDaLinha }) {
  const sensivel = transferenciaSensivel(t);
  return (
    <Selo
      variante={
        sensivel ? "sensivel" : t.prioridade === "maxima" ? "alerta" : "neutro"
      }
      icone={<ArrowRightLeft />}
    >
      {t.motivoRotulo}
      {t.status === "assumido" ? ", assumida" : ""}
    </Selo>
  );
}

/**
 * Prazo no canto da linha, como o contador de não lidas do WhatsApp:
 * areia no tempo, aviso perto de vencer, alerta vencido (fluxos.md, fluxo
 * E, "Prazos"). Nunca ao lado de uma perda (DESIGN.md, 11.8): ali vale a
 * hora do relato, na prévia.
 */
function PrazoDaLinha({ t, agora }: { t: TransferenciaDaLinha; agora: Date }) {
  if (t.status !== "aberto" || transferenciaSensivel(t) || !t.slaVenceEm) {
    return null;
  }
  const estado = t.criadoEm
    ? estadoPrazo(t.criadoEm, t.slaVenceEm, agora)
    : "normal";
  const curto = prazoCurto(t.slaVenceEm, agora);
  if (!curto) return null;
  return (
    <span
      className={cn(
        "rounded-pilula text-mini inline-flex min-h-6 shrink-0 items-center gap-1 px-2 font-mono font-medium whitespace-nowrap tabular-nums",
        estado === "vencido" && "bg-alerta-lavado text-alerta",
        estado === "perto" && "bg-aviso-lavado text-aviso-texto",
        estado === "normal" && "bg-areia-clara text-texto",
      )}
    >
      {estado === "vencido" ? (
        <ClockAlert
          aria-hidden="true"
          className="size-3.5"
          strokeWidth={1.75}
        />
      ) : (
        <Hourglass aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      )}
      {curto.antes ? <span className="sr-only">{curto.antes}</span> : null}
      {curto.visivel}
      {curto.depois ? <span className="sr-only">{curto.depois}</span> : null}
    </span>
  );
}

/** Falhas que a fila mostrava em vermelho, agora como selo na linha. */
function SelosDeFalha({ t }: { t: TransferenciaDaLinha }) {
  const sensivel = transferenciaSensivel(t);
  return (
    <>
      {t.notificacaoOk === false ? (
        <Selo
          variante={sensivel ? "sensivel" : "alerta"}
          icone={<CircleAlert />}
        >
          Aviso não saiu
        </Selo>
      ) : null}
      {t.pausaVenceu && !sensivel ? (
        <Selo variante="alerta" icone={<ClockAlert />}>
          Pausa venceu, a Isadora voltou
        </Selo>
      ) : null}
    </>
  );
}

/**
 * Linha da lista, como uma conversa do WhatsApp Web: avatar, nome, hora,
 * prévia da última mensagem e selos pequenos. A linha inteira é o link
 * que abre a conversa ao lado (computador) ou em tela cheia (celular). As
 * ações moram na conversa aberta, não na lista.
 *
 * Família com freio (DESIGN.md, 11.8): sem tom, em ameixa, e a prévia fica
 * fechada. Relato de saúde, perda e mídia também não viram prévia.
 */
export function LinhaLista({
  linha,
  href,
  selecionada,
  agora,
  motivoFixada,
}: {
  linha: LinhaLista;
  href: string;
  selecionada: boolean;
  agora: Date;
  /** Por que esta linha está fora do filtro, fixada no topo. */
  motivoFixada?: string;
}) {
  const t = linha.transferencia;
  const sensivelT = transferenciaSensivel(t);

  let nome: string;
  let quando: string;
  let jeito: React.ComponentProps<typeof AvatarContato>["jeito"];
  let previa: React.ReactNode;
  let selos: React.ReactNode;
  let familiaSensivel = false;

  if (linha.tipo === "pedido") {
    nome = linha.pedido.nomeFamilia ?? "Contato sem família";
    quando = quandoNaLista(linha.pedido.criadoEm, agora);
    jeito = sensivelT ? "sensivel" : "pedido";
    previa = (
      <>
        <span className="font-medium">Sem conversa ligada: </span>
        {linha.pedido.resumo}
      </>
    );
    selos = (
      <>
        <SeloTransferencia t={linha.transferencia} />
        <SelosDeFalha t={linha.transferencia} />
      </>
    );
  } else {
    const c = linha.conversa;
    nome = nomeDaConversa(c);
    quando = quandoNaLista(c.ultimaEntradaEm ?? c.ultimaSaidaEm, agora);
    familiaSensivel = c.situacao === "freio";
    jeito =
      familiaSensivel || sensivelT
        ? "sensivel"
        : c.situacao === "nao_lead"
          ? "neutro"
          : "pessoa";

    const horaRelato = t?.criadoEm ? horaBrasilia(t.criadoEm) : "";
    if (t && sensivelT) {
      // Perda ou estado sensível: a hora do relato e com quem está, sem
      // prazo, sem relógio e sem a mensagem dela na lista (DESIGN.md, 11.8).
      const partes = [
        horaRelato ? `Recebida às ${horaRelato}` : null,
        t.destino ? FRASE_DESTINO_HANDOFF[t.destino] : null,
      ].filter(Boolean);
      previa = partes.length
        ? `${comMaiuscula(partes.join(", "))}.`
        : "Prévia fechada. Abra com cuidado.";
    } else if (familiaSensivel) {
      previa = "Prévia fechada. Só a equipe responde, pelo nome.";
    } else if (c.ultimaMensagem) {
      const autor = autorDaPrevia(c.ultimaMensagem.enviadoPor);
      previa = (
        <>
          {autor ? <span className="font-medium">{autor}: </span> : null}
          {c.ultimaMensagem.conteudo ?? "Mandou foto, áudio ou documento."}
        </>
      );
    } else if (t && MOTIVOS_SEM_PREVIA.includes(t.motivo)) {
      previa = "Prévia fechada nesta lista. Abra a conversa para ler.";
    } else {
      previa = "Sem mensagens ainda.";
    }

    const voltaDaPausa =
      c.situacao === "pausada"
        ? textoVoltaDaPausa(c.agentePausadoAte, agora)
        : null;
    // A pausa que vem da própria transferência não repete o que o selo da
    // transferência já diz.
    const mostrarSituacao = !(c.situacao === "pausada" && t);
    selos = (
      <>
        {mostrarSituacao ? (
          <Selo
            variante={VARIANTE_SITUACAO[c.situacao]}
            icone={ICONE_SITUACAO[c.situacao]}
          >
            {rotuloDaSituacao(c.situacao, c.agenteEncerradoMotivo)}
            {voltaDaPausa ? `, ${voltaDaPausa}` : ""}
          </Selo>
        ) : null}
        {t ? <SeloTransferencia t={t} /> : null}
        {t ? <SelosDeFalha t={t} /> : null}
      </>
    );
  }

  return (
    <li>
      <Link
        href={href}
        aria-current={selecionada ? "page" : undefined}
        className={cn(
          "rounded-2 ease-estado flex gap-3 px-3 py-3 no-underline transition-colors duration-140",
          selecionada
            ? familiaSensivel || sensivelT
              ? "bg-sensivel-lavado"
              : "bg-argila-clara"
            : "hover:bg-marinho-08",
        )}
      >
        <AvatarContato nome={nome} jeito={jeito} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-corpo text-texto truncate font-semibold">
              {nome}
            </span>
            {quando ? (
              <span className="text-mini text-texto-2 shrink-0 font-mono">
                {quando}
              </span>
            ) : null}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="text-apoio text-texto-2 line-clamp-1">
              {previa}
            </span>
            {t ? <PrazoDaLinha t={t} agora={agora} /> : null}
          </span>
          {motivoFixada ? (
            <span className="text-mini text-texto-2">{motivoFixada}</span>
          ) : null}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {selos}
          </span>
        </span>
      </Link>
    </li>
  );
}
