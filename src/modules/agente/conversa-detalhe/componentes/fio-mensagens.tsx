import { Bot, Mic, UserCheck } from "lucide-react";
import type { Mensagem } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";
import { horaBrasilia } from "../../formatacao";
import { rotuloDoDia } from "../../conversas/lista";

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
      <p className="rounded-2 bg-marinho-08 text-mini text-texto my-1 max-w-[85%] self-center px-3 py-1.5 text-center">
        {mensagem.conteudo}
      </p>
    );
  }

  const daFamilia = mensagem.direcao === "entrada";
  const daIsadora = mensagem.enviadoPor === "ia";
  // Texto aprovado que sai pelo sistema (alerta de saúde, perda, não
  // lead): fica do lado da Kraamzorg, em areia, sem parecer da equipe.
  const daSistema = !daFamilia && mensagem.enviadoPor === "sistema";
  const daEquipe = !daFamilia && !daIsadora && !daSistema;
  // Áudio que a Isadora transcreveu: o texto vem com o aviso de que é a
  // transcrição, não o que a família digitou.
  const audioTranscrito = mensagem.tipo === "audio" && mensagem.conteudo;

  return (
    <div
      className={cn(
        "rounded-3 flex max-w-[85%] flex-col gap-1 px-4 pt-2.5 pb-2 lg:max-w-[72%]",
        daFamilia && "bg-superficie shadow-1 rounded-bl-1 self-start",
        (daIsadora || daSistema) && "bg-superficie-2 rounded-br-1 self-end",
        daEquipe && "bg-marinho text-texto-inverso rounded-br-1 self-end",
      )}
    >
      {daIsadora ? (
        <span className="text-mini text-texto-2 flex items-center gap-1.5 font-semibold">
          <Bot aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Isadora (IA)
        </span>
      ) : daSistema ? (
        <span className="text-mini text-texto-2 font-semibold">
          Resposta automática, texto aprovado
        </span>
      ) : daEquipe ? (
        <span className="text-mini text-texto-inverso-2 flex items-center gap-1.5 font-semibold">
          <UserCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Equipe
        </span>
      ) : null}
      {audioTranscrito ? (
        <span
          className={cn(
            "text-mini flex items-center gap-1.5",
            daEquipe ? "text-texto-inverso-2" : "text-texto-2",
          )}
        >
          <Mic aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Áudio transcrito
        </span>
      ) : null}
      <p className="text-corpo whitespace-pre-wrap">
        {mensagem.conteudo ?? <TextoMidia tipo={mensagem.tipo} />}
      </p>
      <span
        className={cn(
          "text-mini self-end font-mono",
          daEquipe ? "text-texto-inverso-2" : "text-texto-2",
        )}
      >
        {horaBrasilia(mensagem.enviadaEm)}
      </span>
    </div>
  );
}

/**
 * Linha de mensagens, como no WhatsApp (P27 item 1; DESIGN.md, componente
 * "Conversa"): família à esquerda em branco; Isadora e resposta automática
 * à direita em areia, com o nome; pessoa da equipe à direita em marinho;
 * eventos do sistema no meio; um separador por dia ("Hoje", "Ontem" ou a
 * data). A tabela `mensagem` não guarda quem da equipe escreveu cada
 * mensagem (só `enviado_por = 'humano'`), então a bolha diz "Equipe" em
 * vez de adivinhar um nome.
 */
export function FioMensagens({
  mensagens,
  agora = new Date(),
}: {
  mensagens: Mensagem[];
  agora?: Date;
}) {
  if (mensagens.length === 0) {
    return (
      <p className="rounded-3 bg-areia-clara text-apoio text-texto-2 self-center p-5 text-center">
        Ainda não há mensagens registradas nesta conversa.
      </p>
    );
  }

  const comDia = mensagens.reduce<
    { mensagem: Mensagem; dia: string; mostrarDia: boolean }[]
  >((acumulado, mensagem) => {
    const dia = rotuloDoDia(mensagem.enviadaEm, agora);
    const anterior = acumulado.at(-1)?.dia;
    acumulado.push({ mensagem, dia, mostrarDia: dia !== anterior });
    return acumulado;
  }, []);

  return (
    <ol aria-label="Mensagens" className="flex flex-col gap-2">
      {comDia.map(({ mensagem, dia, mostrarDia }) => (
        <li key={mensagem.id} className="flex flex-col gap-2">
          {mostrarDia ? (
            <span
              className={cn(
                "rounded-pilula bg-superficie shadow-1 text-mini text-texto my-2 self-center px-3 py-1 font-medium",
                /\d/.test(dia) && "font-mono",
              )}
            >
              {dia}
            </span>
          ) : null}
          <Bolha mensagem={mensagem} />
        </li>
      ))}
    </ol>
  );
}
