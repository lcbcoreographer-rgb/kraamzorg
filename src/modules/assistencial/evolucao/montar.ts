import "server-only";
import {
  rascunhoEvolucaoNeonatal,
  rascunhoEvolucaoPuerperal,
  type DadosEvolucaoNeonatal,
  type DadosEvolucaoPuerperal,
} from "@/lib/pdf";
import { sugerirConclusaoNeonatal, type ParcialNeonatal } from "./agregar";
import { definir, faltasDaEntrada, obter, tem, type Dados } from "./campos";

/**
 * Da entrada (o que o checklist e a enfermeira preencheram) ao rascunho:
 * primeiro confere o que falta, depois passa pelas validações e pelo
 * montador de `src/lib/pdf`. O resultado é o que `relatorio_medico` guarda:
 * a entrada, as seções montadas (nulas enquanto há erro) e a lista de erros.
 * Só sem erro o documento pode ir para a revisão e ser aprovado.
 */
export interface Montagem {
  dados: Dados;
  conteudo: Record<string, unknown> | null;
  erros: string[];
}

function normalizar(tipo: "puerperal" | "neonatal", dados: Dados): Dados {
  let atual = dados;
  if (tipo === "puerperal") {
    // Lista vazia é "nenhuma orientação além das padrão", não campo ausente:
    // aplicar o formulário com a caixa em branco apaga a chave e o objeto pai.
    if (!Array.isArray(obter(atual, "orientacoesAlta.itensPersonalizados"))) {
      atual = definir(atual, "orientacoesAlta.itensPersonalizados", []);
    }
    const retorno = obter(atual, "encaminhamentos.retornoObstetrico");
    if (
      retorno &&
      !Array.isArray(obter(atual, "encaminhamentos.retornoObstetrico.motivos"))
    ) {
      atual = definir(atual, "encaminhamentos.retornoObstetrico.motivos", []);
    }
  }
  return atual;
}

export function montar(
  tipo: "puerperal" | "neonatal",
  dados: Dados,
  textos: Record<string, string>,
): Montagem {
  const faltas = faltasDaEntrada(tipo, dados);
  if (faltas.length > 0) return { dados, conteudo: null, erros: faltas };

  const entrada = normalizar(tipo, dados);
  try {
    const resultado =
      tipo === "puerperal"
        ? rascunhoEvolucaoPuerperal(
            { ...entrada, id: "rascunho" } as unknown as DadosEvolucaoPuerperal,
            textos,
          )
        : rascunhoEvolucaoNeonatal(
            { ...entrada, id: "rascunho" } as unknown as DadosEvolucaoNeonatal,
            textos,
          );
    if (!resultado.ok) {
      return { dados: entrada, conteudo: null, erros: resultado.erros };
    }
    return {
      dados: entrada,
      conteudo: resultado.conteudo as unknown as Record<string, unknown>,
      erros: [],
    };
  } catch (erro) {
    // Dado que o gerador não aceita (peso zerado, texto aprovado que falta)
    // vira erro na tela, não queda. Erro de programação (TypeError) nunca vai
    // para a tela com a mensagem do motor: a enfermeira não tem o que fazer com ela.
    return {
      dados: entrada,
      conteudo: null,
      erros: [
        erro instanceof Error && !(erro instanceof TypeError)
          ? erro.message
          : "Não foi possível montar o documento com estes dados. Confira os campos e salve de novo.",
      ],
    };
  }
}

/**
 * Valores que a tela sugere nos campos de conclusão enquanto a enfermeira
 * ainda não escolheu: o que o período mostrou. Ela confirma ou troca; a
 * validação compara a escolha com os achados.
 */
export function comSugestoes(
  tipo: "puerperal" | "neonatal",
  dados: Dados,
): Dados {
  let atual = dados;
  if (tipo === "puerperal") {
    const observado = obter(atual, "alimentacaoObservada");
    if (observado !== undefined && !tem(atual, "conclusao.amamentacao")) {
      atual = definir(atual, "conclusao.amamentacao", observado);
    }
    return atual;
  }
  const sugestao = sugerirConclusaoNeonatal(
    dados as unknown as ParcialNeonatal,
  );
  if (sugestao.aleitamento && !tem(atual, "conclusao.aleitamento")) {
    atual = definir(atual, "conclusao.aleitamento", sugestao.aleitamento);
  }
  if (sugestao.ganhoPeso && !tem(atual, "conclusao.ganhoPeso")) {
    atual = definir(atual, "conclusao.ganhoPeso", sugestao.ganhoPeso);
  }
  if (sugestao.ictericia && !tem(atual, "conclusao.ictericia")) {
    atual = definir(atual, "conclusao.ictericia", sugestao.ictericia);
  }
  return atual;
}
