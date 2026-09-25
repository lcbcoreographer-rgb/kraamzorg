import { comoNumero, obterValorPorCaminho } from "./caminho";
import { avaliarCurvaPeso } from "./curva-peso";
import type {
  Condicao,
  CondicaoComparacao,
  CondicaoJson,
  DadosCondicao,
  OperadorComparacao,
  ValorPrimitivo,
} from "./tipos";

export { obterValorPorCaminho };
export type { DadosCondicao };

const OPERADORES_COMPARACAO: readonly OperadorComparacao[] = [
  "igual",
  "diferente",
  "maior",
  "maior_igual",
  "menor",
  "menor_igual",
  "entre",
  "em",
  "contem",
  "presente",
  "ausente",
];

const OPERADORES_SERIE: readonly OperadorComparacao[] = [
  "igual",
  "diferente",
  "maior",
  "maior_igual",
  "menor",
  "menor_igual",
  "entre",
];

const OPERADOR_CURTO_PARA_COMPLETO: Record<string, OperadorComparacao> = {
  "=": "igual",
  "!=": "diferente",
  ">": "maior",
  ">=": "maior_igual",
  "<": "menor",
  "<=": "menor_igual",
};

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function ehTextoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function ehPrimitivo(valor: unknown): valor is ValorPrimitivo {
  return (
    valor === null ||
    typeof valor === "string" ||
    typeof valor === "boolean" ||
    ehNumeroFinito(valor)
  );
}

/** Confere os parâmetros que cada operador de comparação exige. */
function parametrosValidos(
  operador: OperadorComparacao,
  bruto: Record<string, unknown>,
): boolean {
  switch (operador) {
    case "presente":
    case "ausente":
      return true;
    case "entre":
      return (
        ehNumeroFinito(bruto.valorMinimo) &&
        ehNumeroFinito(bruto.valorMaximo) &&
        bruto.valorMinimo <= bruto.valorMaximo
      );
    case "em":
      return (
        Array.isArray(bruto.valores) &&
        bruto.valores.length > 0 &&
        bruto.valores.every(ehPrimitivo)
      );
    case "maior":
    case "maior_igual":
    case "menor":
    case "menor_igual":
      return ehNumeroFinito(bruto.valor);
    default:
      return bruto.valor !== undefined && ehPrimitivo(bruto.valor);
  }
}

/** Converte o formato curto do seed (`{campo, operador: ">=", valor}`) no completo. */
function normalizarCurta(bruto: Record<string, unknown>): Condicao | null {
  const { campo, operador } = bruto;
  if (!ehTextoNaoVazio(campo) || typeof operador !== "string") return null;

  if (operador === "entre" || operador === "fora_da_faixa") {
    const { min, max } = bruto;
    if (!ehNumeroFinito(min) || !ehNumeroFinito(max) || min > max) return null;
    if (operador === "entre") {
      return {
        tipo: "comparacao",
        campo,
        operador: "entre",
        valorMinimo: min,
        valorMaximo: max,
      };
    }
    // fora_da_faixa: abaixo do mínimo ou acima do máximo (RN-08: < 36 ou > 38).
    return {
      tipo: "ou",
      condicoes: [
        { tipo: "comparacao", campo, operador: "menor", valor: min },
        { tipo: "comparacao", campo, operador: "maior", valor: max },
      ],
    };
  }

  const completo = OPERADOR_CURTO_PARA_COMPLETO[operador];
  if (!completo) return null;
  if (!parametrosValidos(completo, bruto)) return null;
  return {
    tipo: "comparacao",
    campo,
    operador: completo,
    valor: bruto.valor as ValorPrimitivo,
  };
}

/**
 * Valida o JSON de `regra_alerta.condicao` e devolve a forma completa, ou
 * `null` quando o JSON não segue nenhum dos dois formatos documentados
 * (README). Nada de desconhecido passa adiante: o motor nunca avalia uma
 * forma que não entende.
 */
export function normalizarCondicao(json: unknown): Condicao | null {
  if (!ehObjeto(json)) return null;
  if (!("tipo" in json)) return normalizarCurta(json);

  switch (json.tipo) {
    case "comparacao": {
      const { campo, operador } = json;
      if (!ehTextoNaoVazio(campo)) return null;
      if (!OPERADORES_COMPARACAO.includes(operador as OperadorComparacao)) {
        return null;
      }
      if (!parametrosValidos(operador as OperadorComparacao, json)) return null;
      return json as unknown as CondicaoComparacao;
    }
    case "serie": {
      const { campo, operador, visitasConsecutivas } = json;
      if (!ehTextoNaoVazio(campo)) return null;
      if (!OPERADORES_SERIE.includes(operador as OperadorComparacao)) {
        return null;
      }
      if (!parametrosValidos(operador as OperadorComparacao, json)) return null;
      if (
        !Number.isInteger(visitasConsecutivas) ||
        (visitasConsecutivas as number) < 1
      ) {
        return null;
      }
      if (
        json.incluirAtual !== undefined &&
        typeof json.incluirAtual !== "boolean"
      ) {
        return null;
      }
      return json as unknown as Condicao;
    }
    case "curva_peso": {
      const { campoPeso, percentualPerdaMaximo, diaVidaLimiteRecuperacao } =
        json;
      if (!ehTextoNaoVazio(campoPeso)) return null;
      if (
        !ehNumeroFinito(percentualPerdaMaximo) ||
        percentualPerdaMaximo <= 0
      ) {
        return null;
      }
      if (
        !ehNumeroFinito(diaVidaLimiteRecuperacao) ||
        diaVidaLimiteRecuperacao < 0
      ) {
        return null;
      }
      return json as unknown as Condicao;
    }
    case "e":
    case "ou": {
      if (!Array.isArray(json.condicoes) || json.condicoes.length === 0) {
        return null;
      }
      const condicoes: Condicao[] = [];
      for (const sub of json.condicoes) {
        const normalizada = normalizarCondicao(sub);
        if (!normalizada) return null;
        condicoes.push(normalizada);
      }
      return { tipo: json.tipo as "e" | "ou", condicoes };
    }
    case "nao": {
      const normalizada = normalizarCondicao(json.condicao);
      return normalizada ? { tipo: "nao", condicao: normalizada } : null;
    }
    default:
      return null;
  }
}

/** Campos do registro que uma condição consulta (para ligar a regra ao campo salvo). */
export function camposDaCondicao(json: unknown): string[] {
  const condicao = normalizarCondicao(json);
  if (!condicao) return [];
  const campos = new Set<string>();
  const visitar = (atual: Condicao): void => {
    switch (atual.tipo) {
      case "comparacao":
      case "serie":
        campos.add(atual.campo);
        return;
      case "curva_peso":
        campos.add(atual.campoPeso);
        return;
      case "e":
      case "ou":
        atual.condicoes.forEach(visitar);
        return;
      case "nao":
        visitar(atual.condicao);
        return;
    }
  };
  visitar(condicao);
  return [...campos];
}

function ehPresente(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

/** Igualdade tolerante a número guardado como texto ("38,2" igual a 38.2). */
function valoresIguais(
  observado: unknown,
  esperado: ValorPrimitivo | undefined,
): boolean {
  if (observado === undefined || esperado === undefined) return false;
  if (typeof esperado === "number") return comoNumero(observado) === esperado;
  return observado === esperado;
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
      // Campo sem resposta não dispara alerta por "diferente".
      return (
        ehPresente(valorObservado) &&
        !valoresIguais(valorObservado, condicao.valor)
      );
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
      // Seletor de múltipla escolha (ex.: SM-01 e SM-04 marcados juntos).
      if (Array.isArray(valorObservado)) {
        return valorObservado.some((v) => valoresIguais(v, condicao.valor));
      }
      return valoresIguais(valorObservado, condicao.valor);
    case "maior":
    case "maior_igual":
    case "menor":
    case "menor_igual": {
      const observado = comoNumero(valorObservado);
      const limite = condicao.valor;
      if (observado === undefined || !ehNumeroFinito(limite)) return false;
      if (operador === "maior") return observado > limite;
      if (operador === "maior_igual") return observado >= limite;
      if (operador === "menor") return observado < limite;
      return observado <= limite;
    }
    case "entre": {
      const observado = comoNumero(valorObservado);
      if (
        observado === undefined ||
        !ehNumeroFinito(condicao.valorMinimo) ||
        !ehNumeroFinito(condicao.valorMaximo)
      ) {
        return false;
      }
      return (
        observado >= condicao.valorMinimo && observado <= condicao.valorMaximo
      );
    }
    default:
      return false;
  }
}

/** Registros da série, mais recente primeiro, com o atual na frente quando pedido. */
function registrosDaSerie(
  dados: DadosCondicao,
  incluirAtual: boolean,
): Record<string, unknown>[] {
  const anteriores = (dados.serieAnterior ?? []).map((v) => v.registro);
  return incluirAtual ? [dados.registro, ...anteriores] : anteriores;
}

function avaliarNormalizada(condicao: Condicao, dados: DadosCondicao): boolean {
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
    case "curva_peso":
      return avaliarCurvaPeso(condicao, dados);
    case "e":
      return condicao.condicoes.every((sub) => avaliarNormalizada(sub, dados));
    case "ou":
      return condicao.condicoes.some((sub) => avaliarNormalizada(sub, dados));
    case "nao":
      return !avaliarNormalizada(condicao.condicao, dados);
    default:
      return false;
  }
}

/**
 * Avalia o JSON de `regra_alerta.condicao` (formato completo ou curto)
 * contra os dados de uma visita e, quando aplicável, sua série anterior.
 * Função pura: não lê nada além de `dados`, roda igual no aparelho e no
 * servidor. Sempre devolve `true` ou `false`; condição que não passa em
 * `normalizarCondicao` devolve `false` (quem carrega o cache usa
 * `validarCatalogo` para descobrir a regra quebrada antes).
 */
export function avaliarCondicao(
  condicao: CondicaoJson | null | undefined,
  dados: DadosCondicao,
): boolean {
  const normalizada = normalizarCondicao(condicao);
  if (!normalizada) return false;
  return avaliarNormalizada(normalizada, dados);
}

export type { OperadorComparacao };
