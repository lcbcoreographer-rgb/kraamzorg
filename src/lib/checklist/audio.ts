import type { LimitesAudio } from "@/lib/dados/tipos-assistencial";

/**
 * Áudio da visita (PRD 9.2 e 9.5, P39 item 6): anexado à visita no storage
 * privado da Kraamzorg, ouvido por URL assinada de 60 segundos. O caminho
 * nunca leva nome de paciente (CLAUDE.md, segurança): só o id da visita e um
 * id de arquivo. Limites, validade da URL, retenção e a chave que liga a
 * transcrição vêm de `parametro`, nunca do código.
 */

export const BUCKET_AUDIOS = "audios-visita";

const EXTENSOES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** "audio/webm;codecs=opus" vira "audio/webm". */
export function tipoBase(tipo: string): string {
  return tipo.split(";")[0]!.trim().toLowerCase();
}

export function extensaoDoTipo(tipo: string): string | null {
  return EXTENSOES[tipoBase(tipo)] ?? null;
}

/** `visitas/<visita>/<arquivo>.<ext>`, o formato que `api.registrar_anexo_audio` aceita. */
export function caminhoDoAudio(
  visitaId: string,
  arquivoId: string,
  extensao: string,
): string {
  return `visitas/${visitaId}/${arquivoId}.${extensao}`;
}

export type ProblemaDoAudio = "tipo" | "tamanho" | "duracao";

/** O áudio cabe nos limites do parâmetro `audio_visita`? Nulo quando cabe. */
export function conferirAudio(
  limites: LimitesAudio,
  audio: { tipo: string; tamanhoBytes: number; duracaoSeg: number | null },
): ProblemaDoAudio | null {
  if (!limites.tipos.map(tipoBase).includes(tipoBase(audio.tipo)))
    return "tipo";
  if (
    limites.tamanhoMaxBytes > 0 &&
    audio.tamanhoBytes > limites.tamanhoMaxBytes
  )
    return "tamanho";
  if (
    limites.duracaoMaxSeg > 0 &&
    audio.duracaoSeg !== null &&
    audio.duracaoSeg > limites.duracaoMaxSeg
  )
    return "duracao";
  return null;
}
