import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type {
  BaseEvolucao,
  EvolucaoDetalhe,
  ListaEvolucoes,
  TipoEvolucao,
} from "@/lib/dados/tipos-evolucao";
import { agregarBase } from "./agregar";
import { faltasDaEntrada, type Dados } from "./campos";
import { resolverDocumento, rotuloDocumento } from "./documento";
import { comSugestoes } from "./montar";

/**
 * Dados das telas da evolução (P41). O recorte por papel é do banco
 * (api.evolucoes, api.base_evolucao, api.evolucao): a enfermeira só recebe os
 * acompanhamentos em que atende; a coordenação e a diretoria recebem todos. A
 * tela só traduz "sem permissão" em uma frase.
 */

export type TelaListaEvolucoes =
  { situacao: "sem_permissao" } | { situacao: "ok"; lista: ListaEvolucoes };

export async function obterTelaListaEvolucoes(
  situacao: "abertas" | "todas",
): Promise<TelaListaEvolucoes> {
  const { evolucoes } = await obterRepositorios();
  try {
    return { situacao: "ok", lista: await evolucoes.listar(situacao) };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}

export interface DocumentoDaTela {
  tipo: TipoEvolucao;
  bebeId: string | null;
  bebeOrdem: number;
  bebeNome: string | null;
  rotulo: string;
}

export type TelaDocumento =
  | { situacao: "sem_permissao" }
  | { situacao: "nao_encontrado" }
  | {
      situacao: "ok";
      base: BaseEvolucao;
      documento: DocumentoDaTela;
      /** O documento salvo; nulo enquanto o rascunho não foi montado. */
      detalhe: EvolucaoDetalhe | null;
      /** O que já está preenchido: o salvo, ou a prévia do que o checklist trouxe. */
      dados: Dados;
      /** Sem rascunho ainda: o que falta para o documento fechar. */
      faltas: string[];
      demonstracao: boolean;
    };

export async function obterTelaDocumento(
  acompanhamentoId: string,
  slug: string,
): Promise<TelaDocumento> {
  const { evolucoes } = await obterRepositorios();
  let base: BaseEvolucao;
  try {
    base = await evolucoes.base(acompanhamentoId);
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      if (erro.codigo === "sem_permissao") return { situacao: "sem_permissao" };
      if (
        erro.codigo === "nao_encontrado" ||
        /acompanhamento_inexistente/.test(erro.message)
      ) {
        return { situacao: "nao_encontrado" };
      }
    }
    throw erro;
  }

  const ref = resolverDocumento(slug, base.bebes);
  if (!ref) return { situacao: "nao_encontrado" };
  const bebe = ref.bebeId
    ? (base.bebes.find((b) => b.id === ref.bebeId) ?? null)
    : null;
  const documento: DocumentoDaTela = {
    tipo: ref.tipo,
    bebeId: ref.bebeId,
    bebeOrdem: bebe?.ordem ?? 0,
    bebeNome: bebe?.nome ?? null,
    rotulo: rotuloDocumento(
      ref.tipo,
      bebe?.ordem ?? 0,
      bebe?.nome ?? null,
      base.bebes.length,
    ),
  };

  const existente = base.relatorios.find(
    (r) => r.tipo === ref.tipo && r.bebeId === ref.bebeId,
  );
  if (existente) {
    const detalhe = await evolucoes.obter(existente.id);
    return {
      situacao: "ok",
      base,
      documento,
      detalhe,
      dados: detalhe.conteudo.dados,
      faltas: [],
      demonstracao: modoDados() === "demonstracao",
    };
  }

  const previa = previaDoDocumento(base, ref.tipo, ref.bebeId);
  return {
    situacao: "ok",
    base,
    documento,
    detalhe: null,
    dados: previa,
    faltas: faltasDaEntrada(ref.tipo, previa),
    demonstracao: modoDados() === "demonstracao",
  };
}

/** A entrada que o checklist e os cadastros já permitem montar, com as sugestões de conclusão. */
export function previaDoDocumento(
  base: BaseEvolucao,
  tipo: TipoEvolucao,
  bebeId: string | null,
): Dados {
  const agregado = agregarBase(base);
  const bruto: Dados =
    tipo === "puerperal"
      ? (agregado.puerperal as unknown as Dados)
      : ((agregado.neonatais.find((n) => n.bebeId === bebeId)?.dados ??
          {}) as unknown as Dados);
  return comSugestoes(tipo, bruto);
}
