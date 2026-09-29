/**
 * P28 · Payloads iguais aos que a UAZAPI manda ao webhook do fluxo 3
 * (evento `messages`, o mesmo formato lido por `n8n/src/code/extrair-dados.js`).
 * Texto, áudio, foto com legenda e figurinha. O token que a UAZAPI real manda
 * no corpo não entra aqui: o fluxo nunca o lê (PRD 11.10).
 */
import type { Objeto, TurnoMensagem } from "./tipos";

export interface Interlocutora {
  /** Dígitos com DDI, sem "+" (ex.: 5511900000101). */
  digitos: string;
  jid: string;
  e164: string;
}

export function interlocutora(digitos: string): Interlocutora {
  return { digitos, jid: `${digitos}@s.whatsapp.net`, e164: `+${digitos}` };
}

export function idDaMensagem(casoId: string, turno: number): string {
  const sufixo = Math.random().toString(36).slice(2, 8);
  return `kz-p28-${casoId.toLowerCase()}-${turno}-${sufixo}`;
}

export function montarPayload(
  turno: TurnoMensagem,
  opcoes: { quem: Interlocutora; instancia: string; messageId: string },
): Objeto {
  const { quem, instancia, messageId } = opcoes;
  const base = {
    chatid: quem.jid,
    sender_pn: quem.jid,
    fromMe: false,
    wasSentByApi: false,
    isGroup: false,
    messageid: messageId,
    senderName: "Teste Homologação",
    messageTimestamp: Date.now(),
  };
  const chat = { phone: quem.digitos, wa_contactName: "Teste Homologação" };

  let message: Objeto;
  switch (turno.tipo) {
    case "texto":
      message = { ...base, text: turno.texto, messageType: "Conversation" };
      break;
    case "audio":
      message = {
        ...base,
        text: "",
        messageType: "AudioMessage",
        mediaType: "ptt",
      };
      break;
    case "foto":
      message = {
        ...base,
        text: turno.legenda,
        messageType: "ImageMessage",
        mediaType: "image",
      };
      break;
    case "figurinha":
      message = { ...base, text: "", messageType: "StickerMessage" };
      break;
  }
  return { EventType: "messages", instanceName: instancia, message, chat };
}

/** O que a família "disse", em texto, para o relatório. */
export function descreverTurno(turno: TurnoMensagem): string {
  switch (turno.tipo) {
    case "texto":
      return turno.texto;
    case "audio":
      return turno.falharTranscricao
        ? "[áudio, transcrição forçada a falhar]"
        : `[áudio] ${turno.transcricao}`;
    case "foto":
      return `[foto] ${turno.legenda}`;
    case "figurinha":
      return "[figurinha]";
  }
}
