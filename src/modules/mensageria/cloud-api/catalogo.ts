import "server-only";
import { modoDados } from "@/lib/dados/modo";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import type { CatalogoModelos, ModeloAprovado } from "@/lib/messaging";

/**
 * Catálogo dos modelos aprovados pela Meta (P18b item 2). Só devolve modelo
 * com status `aprovado` em `modelo_whatsapp`: rascunho, submetido, rejeitado,
 * pausado e desativado nunca saem. O cadastro é a única fonte do texto
 * (nenhum texto de modelo mora no código).
 *
 * Supabase: `api.modelo_whatsapp_aprovado` (0025), que checa papel e AAL2.
 * Demonstração: dois modelos fictícios já "aprovados", só para as telas e os
 * testes rodarem sem banco; o texto é de mentira e não vale para a Meta.
 */

export const MODELOS_DEMONSTRACAO: ModeloAprovado[] = [
  {
    mensagemChave: "followup_d1_pos_pdf",
    nomeMeta: "kz_demo_retorno_apresentacao",
    idioma: "pt_BR",
    variaveis: ["nome"],
    valoresPadrao: { nome: "tudo bem" },
    texto: "Oi, {{1}} 😊 Este é um modelo de demonstração, sem valor na Meta.",
  },
  {
    mensagemChave: "followup_d1_pos_abertura",
    nomeMeta: "kz_demo_retorno_conversa",
    idioma: "pt_BR",
    variaveis: [],
    valoresPadrao: {},
    texto: "Oi! Este é um modelo de demonstração, sem valor na Meta.",
  },
];

interface LinhaModelo {
  mensagem_chave?: unknown;
  nome_meta?: unknown;
  idioma?: unknown;
  variaveis?: unknown;
  valores_padrao?: unknown;
  texto?: unknown;
}

/** Lê o jsonb de `api.modelo_whatsapp_aprovado`; formato inesperado vira "sem modelo". */
export function modeloDoBanco(json: unknown): ModeloAprovado | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const l = json as LinhaModelo;
  if (
    typeof l.mensagem_chave !== "string" ||
    typeof l.nome_meta !== "string" ||
    typeof l.idioma !== "string" ||
    typeof l.texto !== "string" ||
    !Array.isArray(l.variaveis)
  ) {
    return null;
  }
  const padrao: Record<string, string> = {};
  if (l.valores_padrao && typeof l.valores_padrao === "object") {
    for (const [k, v] of Object.entries(l.valores_padrao)) {
      if (typeof v === "string") padrao[k] = v;
    }
  }
  return {
    mensagemChave: l.mensagem_chave,
    nomeMeta: l.nome_meta,
    idioma: l.idioma,
    variaveis: l.variaveis.filter((v): v is string => typeof v === "string"),
    valoresPadrao: padrao,
    texto: l.texto,
  };
}

export function criarCatalogoModelos(): CatalogoModelos {
  if (modoDados() === "demonstracao") {
    return {
      async buscarAprovado(mensagemChave, idioma = "pt_BR") {
        return (
          MODELOS_DEMONSTRACAO.find(
            (m) => m.mensagemChave === mensagemChave && m.idioma === idioma,
          ) ?? null
        );
      },
    };
  }
  return {
    async buscarAprovado(mensagemChave, idioma = "pt_BR") {
      const cliente = await criarClienteServidor();
      const { data, error } = await cliente
        .schema("api")
        .rpc("modelo_whatsapp_aprovado", {
          p_mensagem_chave: mensagemChave,
          p_idioma: idioma,
        });
      // Sem permissão ou erro do banco: nenhum modelo, nada sai (falha fechada).
      if (error) return null;
      return modeloDoBanco(data);
    },
  };
}

/**
 * parametro.whatsapp_janela_horas. No banco vem de `api.whatsapp_janela_horas`
 * (a tabela parametro só a diretoria lê). Na demonstração usa 24, a regra da
 * plataforma para os dados de mentira. Nulo: o adaptador trata tudo como
 * fora da janela.
 */
export async function lerJanelaHoras(): Promise<number | null> {
  if (modoDados() === "demonstracao") return 24;
  const cliente = await criarClienteServidor();
  const { data, error } = await cliente
    .schema("api")
    .rpc("whatsapp_janela_horas");
  if (error || typeof data !== "number" || data <= 0) return null;
  return data;
}
