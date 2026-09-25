import { Bot } from "lucide-react";
import { formatarDataHora } from "@/lib/formatacao";
import type { Mensagem } from "@/lib/dados/tipos";

function horaCurta(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);
}

/**
 * Mensagem sem texto (foto, áudio, vídeo, documento): a lista nunca mostra
 * prévia automática do arquivo, porque pode ser saúde (telas.md C2,
 * "mídia recebida": "Pode conter informação de saúde. Abra com cuidado.").
 */
const FRASE_MIDIA: Record<string, string> = {
  imagem: "Chegou uma foto pelo WhatsApp",
  audio: "Chegou um áudio pelo WhatsApp",
  documento: "Chegou um documento pelo WhatsApp",
  figurinha: "Chegou uma figurinha pelo WhatsApp",
  video: "Chegou um vídeo pelo WhatsApp",
};

function TextoMidia({ tipo }: { tipo: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-semibold">
        {FRASE_MIDIA[tipo] ?? "Chegou um arquivo pelo WhatsApp"}
      </span>
      <span className="text-apoio">
        Pode conter informação de saúde. Abra com cuidado no WhatsApp.
      </span>
    </span>
  );
}

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  // Evento do sistema no meio da linha ("Transferida ao comercial às
  // 14:02."), `mensagem.tipo = 'sistema'` (0003).
  if (mensagem.tipo === "sistema") {
    return (
      <span className="text-mini text-texto-2 max-w-[85%] self-center text-center">
        {mensagem.conteudo}
      </span>
    );
  }

  const daFamilia = mensagem.direcao === "entrada";
  const daIsadora = mensagem.enviadoPor === "ia";
  // Texto aprovado que sai pelo sistema (alerta de saúde, perda, não
  // lead): fica do lado da Kraamzorg, em areia, sem parecer da equipe.
  const daSistema = !daFamilia && mensagem.enviadoPor === "sistema";

  return (
    <div
      className={
        daFamilia
          ? "bg-superficie shadow-1 rounded-3 rounded-bl-1 max-w-[85%] self-start px-4 py-3"
          : daIsadora || daSistema
            ? "bg-superficie-2 rounded-3 rounded-br-1 max-w-[85%] self-end px-4 py-3"
            : "bg-marinho text-texto-inverso rounded-3 rounded-br-1 max-w-[85%] self-end px-4 py-3"
      }
    >
      {daIsadora ? (
        <div className="text-apoio text-texto-2 mb-1 flex items-center gap-1.5 font-semibold">
          <Bot aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Isadora (IA)
        </div>
      ) : !daFamilia ? (
        <div
          className={
            daSistema
              ? "text-apoio text-texto-2 mb-1 font-semibold"
              : "text-apoio text-texto-inverso-2 mb-1 font-semibold"
          }
        >
          {daSistema ? "Texto aprovado, enviado pelo sistema" : "Equipe"}
        </div>
      ) : null}
      <p className="text-corpo whitespace-pre-wrap">
        {mensagem.conteudo ?? <TextoMidia tipo={mensagem.tipo} />}
      </p>
      <div
        className={
          daFamilia || daIsadora || daSistema
            ? "text-mini text-texto-2 mt-1 font-mono"
            : "text-mini text-texto-inverso-2 mt-1 font-mono"
        }
      >
        {horaCurta(mensagem.enviadaEm)}
      </div>
    </div>
  );
}

/**
 * Linha de mensagens (P27 item 1, protótipo `comercial-conversa.html`, C2;
 * DESIGN.md, componente "Conversa"): família à esquerda, Isadora à direita
 * em areia, pessoa da equipe à direita em marinho, eventos do sistema no
 * meio. A tabela `mensagem` não guarda quem da equipe escreveu cada
 * mensagem (só `enviado_por = 'humano'`), então a bolha diz "Equipe" em vez
 * de adivinhar um nome.
 */
export function FioMensagens({ mensagens }: { mensagens: Mensagem[] }) {
  if (mensagens.length === 0) {
    return (
      <p className="text-apoio text-texto-2">
        Ainda não há mensagens registradas nesta conversa.
      </p>
    );
  }

  const comDia = mensagens.reduce<
    { mensagem: Mensagem; dia: string; mostrarDia: boolean }[]
  >((acumulado, mensagem) => {
    const dia = formatarDataHora(mensagem.enviadaEm)?.slice(0, 10) ?? "";
    const anterior = acumulado.at(-1)?.dia;
    acumulado.push({ mensagem, dia, mostrarDia: dia !== anterior });
    return acumulado;
  }, []);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {comDia.map(({ mensagem, dia, mostrarDia }) => {
        return (
          <div key={mensagem.id} className="flex flex-col gap-3">
            {mostrarDia ? (
              <span className="text-mini text-texto-2 self-center font-mono">
                {dia}
              </span>
            ) : null}
            <Bolha mensagem={mensagem} />
          </div>
        );
      })}
    </div>
  );
}
