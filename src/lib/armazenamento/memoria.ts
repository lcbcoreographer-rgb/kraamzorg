import { garantirDemonstracaoPermitida } from "@/lib/dados/modo";
import { caminhoValido } from "./caminhos";
import type { ArmazenamentoPrivado } from "./tipos";

/**
 * Armazenamento em memória do modo demonstração (mesma ideia da loja de
 * dados): vive enquanto o processo do servidor viver e nunca guarda nada em
 * disco. Só com KZ_DADOS=demonstracao em desenvolvimento.
 */
interface Arquivo {
  bytes: Uint8Array;
  contentType: string;
}

const CHAVE_GLOBAL = "__kraamzorgArmazenamentoMemoria";

function mapa(): Map<string, Arquivo> {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<
    string,
    Map<string, Arquivo> | undefined
  >;
  global[CHAVE_GLOBAL] ??= new Map();
  return global[CHAVE_GLOBAL];
}

export function criarArmazenamentoMemoria(): ArmazenamentoPrivado {
  return {
    async salvar(caminho, conteudo, contentType, substituir) {
      if (!caminhoValido(caminho)) {
        throw new Error("armazenamento: caminho fora do padrão");
      }
      const arquivos = mapa();
      if (!substituir && arquivos.has(caminho)) {
        throw new Error("armazenamento: o arquivo já existe");
      }
      arquivos.set(caminho, { bytes: new Uint8Array(conteudo), contentType });
    },

    async ler(caminho) {
      if (!caminhoValido(caminho)) return null;
      return mapa().get(caminho)?.bytes ?? null;
    },

    async abrir(caminho) {
      if (!caminhoValido(caminho)) return null;
      const arquivo = mapa().get(caminho);
      if (!arquivo) return null;
      return {
        tipo: "bytes",
        bytes: arquivo.bytes,
        contentType: arquivo.contentType,
      };
    },
  };
}

/** Só para testes: esvazia o armazenamento. */
export function reiniciarArmazenamentoMemoria(): void {
  mapa().clear();
}
