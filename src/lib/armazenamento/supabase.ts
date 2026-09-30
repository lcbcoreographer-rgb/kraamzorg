import "server-only";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import { caminhoValido } from "./caminhos";
import type { ArmazenamentoPrivado } from "./tipos";

/**
 * Armazenamento privado no Supabase Storage. O bucket `documentos` é
 * privado (supabase/config.toml); a chave de serviço só grava e lê aqui,
 * depois de a rota ou a ação ter conferido papel e AAL2 do usuário, e quem
 * abre o arquivo recebe uma URL assinada de vida curta.
 */
const BUCKET = "documentos";

export function criarArmazenamentoSupabase(): ArmazenamentoPrivado {
  const storage = () =>
    criarClienteServico("armazenamento_privado").storage.from(BUCKET);

  return {
    async salvar(caminho, conteudo, contentType, substituir) {
      if (!caminhoValido(caminho)) {
        throw new Error("armazenamento: caminho fora do padrão");
      }
      const { error } = await storage().upload(caminho, conteudo, {
        contentType,
        upsert: substituir,
      });
      if (error) throw new Error("armazenamento: não gravou o arquivo");
    },

    async ler(caminho) {
      if (!caminhoValido(caminho)) return null;
      const { data, error } = await storage().download(caminho);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },

    async abrir(caminho, segundos) {
      if (!caminhoValido(caminho)) return null;
      const { data, error } = await storage().createSignedUrl(
        caminho,
        segundos,
      );
      if (error || !data?.signedUrl) return null;
      return { tipo: "url", url: data.signedUrl };
    },
  };
}
