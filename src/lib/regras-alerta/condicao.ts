import { avaliarCurvaPeso } from "./curva-peso";
import type {
  Condicao,
  CondicaoComparacao,
  DadosCondicao,
  OperadorComparacao,
  ValorPrimitivo,
} from "./tipos";

export type { DadosCondicao };

/** Lê um caminho pontuado ("3.1.peso_gramas") dentro de um objeto aninhado. */
export function obterValorPorCaminho(
  origem: Record<string, unknown> | undefined,
  caminho: string,
): unknown {
  if (!origem) return undefined;
  const partes = caminho.split(".");
  let atual: unknown = origem;
  for (const parte of partes) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return atual;
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function valoresIguais(a: unknown, b: ValorPrimitivo | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return a === b;
}

function ehPresente(valor: unknown): boolean {
  return valor !== undefined && valor !== null && valor !== "";
}

/** Avalia uma condição folha contra um valor já resolvido do registro. */
function avaliarComparacaoContraValor(
  valorObservado: unknown,
  condicao: Pick<
    CondicaoComparacao,
    "operador" | "valor" | "valores" | "valorMinimo" | "valorMaximo"
  >,
): boolean {
  const { operador } = condicao;
  switch (operador) {
    case "igual":
      return valoresIguais(valorObservado, condicao.valor);
    case "diferente":
      return !valoresIguais(valorObservado, condicao.valor);
    case "presente":
      return ehPresente(valorObservado);
    case "ausente":
      return !ehPresente(valorObservado);
    case "em":
      return (
        Array.isArray(condicao.valores) &&
        condicao.valores.some((v) => valoresIguais(valorObservado, v))
      );
    case "contem":
      if (
        typeof valorObservado === "string" &&
        typeof condicao.valor === "string"
      ) {
        return valorObservado.includes(condicao.valor);
      }
      if (Array.isArray(valorObservado)) {
        return valorObservado.some((v) => valoresIguais(v, condicao.valor));
      }
      return false;
    case "maior":
    case "maior_igual":
    case "menor":
    case "menor_igual": {
      if (!ehNumeroFinito(valorObservado) || !ehNumeroFinito(condicao.valor)) {
        return false;
      }
      if (operador === "maior") return valorObservado > condicao.valor;
      if (operador === "maior_igual") return valorObservado >= condicao.valor;
      if (operador === "menor") return valorObservado < condicao.valor;
      return valorObservado <= condicao.valor;
    }
    case "entre": {
      if (
        !ehNumeroFinito(valorObservado) ||
        !ehNumeroFinito(condicao.valorMinimo) ||
        !ehNumeroFinito(condicao.valorMaximo)
      ) {
        return false;
      }
      return (
        valorObservado >= condicao.valorMinimo &&
        valorObservado <= condicao.valorMaximo
      );
    }
    default: {
      const _exaustivo: never = operador;
      return _exaustivo;
    }
  }
}

/** Devolve os registros da série, mais recente primeiro, com o atual na frente quando pedido. */
function registrosDaSerie(
  dados: DadosCondicao,
  incluirAtual: boolean,
): Record<string, unknown>[] {
  const anteriores = (dados.serieAnterior ?? []).map((v) => v.registro);
  return incluirAtual ? [dados.registro, ...anteriores] : anteriores;
}

/**
 * Avalia uma `Condicao` (o JSON de `regra_alerta.condicao`) contra os dados
 * de uma visita e, quando aplicável, sua série anterior. Função pura: não
 * lê nada além do que está em `dados`, roda igual no aparelho e no servidor.
 */
export function avaliarCondicao(
  condicao: Condicao,
  dados: DadosCondicao,
): boolean {
  switch (condicao.tipo) {
    case "comparacao": {
      const valor = obterValorPorCaminho(dados.registro, condicao.campo);
      return avaliarComparacaoContraValor(valor, condicao);
    }
    case "serie": {
      const incluirAtual = condicao.incluirAtual ?? true;
      const registros = registrosDaSerie(dados, incluirAtual);
      if (registros.length < condicao.visitasConsecutivas) {
        // Ainda não há visitas suficientes para confirmar a série.
        return false;
      }
      const janela = registros.slice(0, condicao.visitasConsecutivas);
      return janela.every((registro) => {
        const valor = obterValorPorCaminho(registro, condicao.campo);
        return avaliarComparacaoContraValor(valor, condicao);
      });
    }
    case "curva_peso": {
      return avaliarCurvaPeso(condicao, dados);
    }
    case "e":
      return condicao.condicoes.every((sub) => avaliarCondicao(sub, dados));
    case "ou":
      return condicao.condicoes.some((sub) => avaliarCondicao(sub, dados));
    case "nao":
      return !avaliarCondicao(condicao.condicao, dados);
    default: {
      const _exaustivo: never = condicao;
      return _exaustivo;
    }
  }
}

export type { OperadorComparacao };
