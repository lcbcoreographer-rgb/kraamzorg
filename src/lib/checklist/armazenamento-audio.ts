import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { modoDados } from "@/lib/dados/modo";
import { BUCKET_AUDIOS } from "./audio";

/**
 * Onde o áudio da visita fica (P39 item 6): bucket privado `audios-visita`
 * do Supabase Storage, com URL assinada curta (o parâmetro
 * `audio_url_assinada_segundos`, 60 s). Na demonstração, a memória do
 * processo. Só o servidor toca aqui: o navegador nunca recebe credencial de
 * storage, só a URL assinada.
 */
export interface ArmazenamentoAudio {
  guardar(caminho: string, bytes: Uint8Array, tipo: string): Promise<void>;
  /** URL para ouvir que vale `segundos`. */
  urlAssinada(caminho: string, segundos: number): Promise<string>;
}

const CHAVE_GLOBAL = "__kraamzorgAudiosDemonstracao";

function armazenamentoEmMemoria(): ArmazenamentoAudio {
  const g = globalThis as unknown as Record<
    string,
    Map<string, { bytes: Uint8Array; tipo: string }>
  >;
  g[CHAVE_GLOBAL] ??= new Map();
  const mapa = g[CHAVE_GLOBAL]!;
  return {
    async guardar(caminho, bytes, tipo) {
      mapa.set(caminho, { bytes, tipo });
    },
    async urlAssinada(caminho) {
      const guardado = mapa.get(caminho);
      if (!guardado) throw new Error("áudio não encontrado");
      return `data:${guardado.tipo};base64,${Buffer.from(guardado.bytes).toString("base64")}`;
    },
  };
}

function armazenamentoSupabase(
  cliente: Awaited<ReturnType<typeof criarClienteServidor>>,
): ArmazenamentoAudio {
  const balde = cliente.storage.from(BUCKET_AUDIOS);
  return {
    async guardar(caminho, bytes, tipo) {
      const { error } = await balde.upload(caminho, bytes, {
        contentType: tipo,
        upsert: false,
      });
      if (error) throw new Error(`storage: ${error.message}`);
    },
    async urlAssinada(caminho, segundos) {
      const { data, error } = await balde.createSignedUrl(caminho, segundos);
      if (error || !data)
        throw new Error(`storage: ${error?.message ?? "sem URL"}`);
      return data.signedUrl;
    },
  };
}

export async function criarArmazenamentoAudio(): Promise<ArmazenamentoAudio> {
  if (modoDados() === "demonstracao") return armazenamentoEmMemoria();
  return armazenamentoSupabase(await criarClienteServidor());
}
