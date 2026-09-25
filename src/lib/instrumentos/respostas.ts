import type {
  AlertaLigado,
  Bloco,
  Campo,
  Condicao,
  DefinicaoInstrumento,
} from "./schema";

/**
 * Respostas de um formulário gerado de um instrumento, e as regras puras
 * que o gerador e o motor offline compartilham: caminho de cada campo,
 * condição para aparecer, obrigatórios para concluir (PRD 9.2) e avaliação
 * da condição de alerta ligada ao campo. Nada aqui toca rede, banco ou
 * armazenamento: roda igual no aparelho e no servidor.
 */

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** Sim ou não com texto complementar. */
export interface ValorSimNaoTexto {
  resposta: boolean;
  texto?: string;
}

/** Nota de escala com a classificação que a acompanha (LATCH). */
export interface ValorEscalaComplemento {
  /** Nulo enquanto só a classificação foi marcada. */
  valor: number | null;
  complemento?: string;
}

/** Ausência justificada no lugar do valor (contato do pediatra, último dia). */
export interface ValorAusenciaJustificada {
  ausente: true;
  justificativa: string;
}

/** Número em partes (pressão arterial). */
export interface ValorPartes {
  partes: Record<string, number | null>;
}

export type ValorCampo =
  | string
  | number
  | boolean
  | string[]
  | ValorSimNaoTexto
  | ValorEscalaComplemento
  | ValorAusenciaJustificada
  | ValorPartes;

/** Respostas de um bloco comum: campo → valor. */
export type RespostasBloco = Record<string, ValorCampo>;

/**
 * Respostas do formulário. `blocos` guarda os blocos comuns; `por_bebe`
 * guarda os blocos repetidos, por id do bebê (PRD 9.2: bloco RN como lista,
 * um item por bebê).
 */
export interface RespostasFormulario {
  blocos: Record<string, RespostasBloco>;
  por_bebe: Record<string, Record<string, RespostasBloco>>;
}

export function respostasVazias(): RespostasFormulario {
  return { blocos: {}, por_bebe: {} };
}

/** Endereço de um campo dentro do formulário. `bebe` só em bloco repetido. */
export interface EnderecoCampo {
  bloco: string;
  campo: string;
  bebe?: string;
}

/** Bebê do acompanhamento, para os blocos repetidos (gemelares). */
export interface BebeFormulario {
  id: string;
  /** Como a tela chama o bebê ("Bebê 1", ou o nome, se houver). */
  rotulo: string;
}

/** Valores que a tela passa para as condições `contexto` (ex: ultimo_dia). */
export type ContextoFormulario = Record<string, string | number | boolean>;

// ---------------------------------------------------------------------------
// Leitura e escrita
// ---------------------------------------------------------------------------

export function lerValor(
  respostas: RespostasFormulario,
  endereco: EnderecoCampo,
): ValorCampo | undefined {
  if (endereco.bebe !== undefined) {
    return respostas.por_bebe[endereco.bloco]?.[endereco.bebe]?.[
      endereco.campo
    ];
  }
  return respostas.blocos[endereco.bloco]?.[endereco.campo];
}

/** Devolve um objeto novo com o valor gravado (ou removido, com `null`). */
export function comValor(
  respostas: RespostasFormulario,
  endereco: EnderecoCampo,
  valor: ValorCampo | null,
): RespostasFormulario {
  if (endereco.bebe !== undefined) {
    const doBloco = respostas.por_bebe[endereco.bloco] ?? {};
    const doBebe = { ...(doBloco[endereco.bebe] ?? {}) };
    if (valor === null) delete doBebe[endereco.campo];
    else doBebe[endereco.campo] = valor;
    return {
      ...respostas,
      por_bebe: {
        ...respostas.por_bebe,
        [endereco.bloco]: { ...doBloco, [endereco.bebe]: doBebe },
      },
    };
  }
  const doBloco = { ...(respostas.blocos[endereco.bloco] ?? {}) };
  if (valor === null) delete doBloco[endereco.campo];
  else doBloco[endereco.campo] = valor;
  return {
    ...respostas,
    blocos: { ...respostas.blocos, [endereco.bloco]: doBloco },
  };
}

/** Separa "2.1.temperatura" em bloco "2.1" e campo "temperatura". */
export function separarCaminho(caminho: string): {
  bloco: string;
  campo: string;
} {
  const ponto = caminho.lastIndexOf(".");
  return { bloco: caminho.slice(0, ponto), campo: caminho.slice(ponto + 1) };
}

export function chaveEndereco(endereco: EnderecoCampo): string {
  return [endereco.bloco, endereco.campo, endereco.bebe ?? ""].join("|");
}

// ---------------------------------------------------------------------------
// Condição
// ---------------------------------------------------------------------------

/** Valor usado na comparação: a parte principal de valores compostos. */
function valorComparavel(valor: ValorCampo | undefined): unknown {
  if (valor === undefined) return undefined;
  if (typeof valor !== "object" || Array.isArray(valor)) return valor;
  if ("resposta" in valor) return valor.resposta;
  if ("valor" in valor) return valor.valor;
  return undefined;
}

export function estaRespondido(
  campo: Campo,
  valor: ValorCampo | undefined,
): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "boolean") return true;
  if (Array.isArray(valor)) return valor.length > 0;
  if ("ausente" in valor) return valor.justificativa.trim() !== "";
  if ("partes" in valor) {
    const partes = campo.tipo === "numero" ? (campo.partes ?? []) : [];
    return (
      partes.length > 0 &&
      partes.every((p) => typeof valor.partes[p.id] === "number")
    );
  }
  if ("resposta" in valor) return typeof valor.resposta === "boolean";
  if ("valor" in valor) {
    if (typeof valor.valor !== "number" || !Number.isFinite(valor.valor))
      return false;
    if (campo.tipo === "escala" && campo.complemento) {
      return typeof valor.complemento === "string" && valor.complemento !== "";
    }
    return true;
  }
  return false;
}

/** Busca um campo pelo caminho "bloco.campo" na definição. */
export function acharCampo(
  definicao: DefinicaoInstrumento,
  caminho: string,
): { bloco: Bloco; campo: Campo } | undefined {
  const { bloco: idBloco, campo: idCampo } = separarCaminho(caminho);
  const blocos = [...(definicao.cabecalho ?? []), ...definicao.blocos];
  const bloco = blocos.find((b) => b.id === idBloco);
  const campo = bloco?.campos.find((c) => c.id === idCampo);
  return bloco && campo ? { bloco, campo } : undefined;
}

export interface AmbienteCondicao {
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  contexto?: ContextoFormulario;
  /** Bebê da vez, quando a condição é avaliada dentro de bloco repetido. */
  bebe?: string;
}

function comparar(a: unknown, operador: string, b: unknown): boolean {
  switch (operador) {
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    case ">":
      return typeof a === "number" && typeof b === "number" && a > b;
    case ">=":
      return typeof a === "number" && typeof b === "number" && a >= b;
    case "<":
      return typeof a === "number" && typeof b === "number" && a < b;
    case "<=":
      return typeof a === "number" && typeof b === "number" && a <= b;
    default:
      return false;
  }
}

/**
 * Avalia uma condição. Campo sem resposta nunca satisfaz comparação (só
 * `sem_resposta`), para que nada apareça nem dispare por omissão.
 */
export function avaliarCondicao(
  cond: Condicao,
  ambiente: AmbienteCondicao,
): boolean {
  if ("todas" in cond)
    return cond.todas.every((c) => avaliarCondicao(c, ambiente));
  if ("alguma" in cond)
    return cond.alguma.some((c) => avaliarCondicao(c, ambiente));

  let bruto: ValorCampo | undefined;
  let respondido: boolean;
  if (typeof cond.contexto === "string") {
    const valor = ambiente.contexto?.[cond.contexto];
    bruto = valor;
    respondido = valor !== undefined;
  } else {
    const caminho = cond.campo as string;
    const achado = acharCampo(ambiente.definicao, caminho);
    const { bloco, campo } = separarCaminho(caminho);
    const repetido = achado?.bloco.repete_por_bebe === true;
    bruto = lerValor(ambiente.respostas, {
      bloco,
      campo,
      bebe: repetido ? ambiente.bebe : undefined,
    });
    respondido = achado ? estaRespondido(achado.campo, bruto) : false;
  }

  if (cond.operador === "respondido") return respondido;
  if (cond.operador === "sem_resposta") return !respondido;
  if (!respondido) return false;

  const valor = valorComparavel(bruto);
  switch (cond.operador) {
    case "em":
      return cond.valores.some((v) =>
        Array.isArray(valor) ? valor.includes(v as string) : v === valor,
      );
    case "fora_de":
      return !cond.valores.some((v) =>
        Array.isArray(valor) ? valor.includes(v as string) : v === valor,
      );
    case "entre":
      return (
        typeof valor === "number" && valor >= cond.min && valor <= cond.max
      );
    case "fora_da_faixa":
      return (
        typeof valor === "number" && (valor < cond.min || valor > cond.max)
      );
    default:
      return "valor" in cond
        ? comparar(valor, cond.operador, cond.valor)
        : false;
  }
}

// ---------------------------------------------------------------------------
// Etapas, visibilidade e pendências
// ---------------------------------------------------------------------------

export function blocoVisivel(
  bloco: Bloco,
  ambiente: AmbienteCondicao,
): boolean {
  return bloco.aparece_se ? avaliarCondicao(bloco.aparece_se, ambiente) : true;
}

export function campoVisivel(
  campo: Campo,
  ambiente: AmbienteCondicao,
): boolean {
  return campo.aparece_se ? avaliarCondicao(campo.aparece_se, ambiente) : true;
}

/** Uma etapa por bloco visível (P34 item 3), na ordem da definição. */
export function etapasVisiveis(ambiente: AmbienteCondicao): Bloco[] {
  return ambiente.definicao.blocos.filter((b) => blocoVisivel(b, ambiente));
}

/**
 * Campos com resposta gravada cuja condição para aparecer deixou de valer
 * (ex: "Motivo do contato realizado" depois que "Contato com médico
 * necessário" virou não). O gerador apaga essas respostas, para que o
 * registro não leve dado de uma pergunta que não se aplica mais. Só olha a
 * condição do campo; bloco escondido por contexto (último dia) não entra,
 * porque o contexto vem da tela e não de uma resposta.
 */
export function camposOcultosComValor(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  opcoes: { bebes?: BebeFormulario[]; contexto?: ContextoFormulario } = {},
): EnderecoCampo[] {
  const ocultos: EnderecoCampo[] = [];
  const base: AmbienteCondicao = {
    definicao,
    respostas,
    contexto: opcoes.contexto,
  };
  for (const bloco of definicao.blocos) {
    const bebes: (BebeFormulario | undefined)[] = bloco.repete_por_bebe
      ? (opcoes.bebes ?? [])
      : [undefined];
    for (const bebe of bebes) {
      const ambiente = { ...base, bebe: bebe?.id };
      for (const campo of bloco.campos) {
        if (!campo.aparece_se) continue;
        const endereco = { bloco: bloco.id, campo: campo.id, bebe: bebe?.id };
        if (lerValor(respostas, endereco) === undefined) continue;
        if (!campoVisivel(campo, ambiente)) ocultos.push(endereco);
      }
    }
  }
  return ocultos;
}

export interface Pendencia extends EnderecoCampo {
  rotulo: string;
  rotuloBloco: string;
  rotuloBebe?: string;
}

/**
 * Campos obrigatórios ainda sem resposta (PRD 9.2 v4.2: data, horário,
 * sinais vitais da puérpera, sinais vitais e peso de cada bebê, bloco de
 * amamentação 2.5 a 2.13 inteiro, resumo e assinatura). Campo escondido por
 * condição não conta; bloco repetido conta uma vez por bebê. Campo
 * `automatico` fica de fora: quem preenche é o sistema (a assinatura, por
 * exemplo, é conferida pelo P39 no ato de assinar).
 */
export function pendenciasParaConcluir(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  opcoes: { bebes?: BebeFormulario[]; contexto?: ContextoFormulario } = {},
): Pendencia[] {
  const pendencias: Pendencia[] = [];
  const base: AmbienteCondicao = {
    definicao,
    respostas,
    contexto: opcoes.contexto,
  };

  for (const bloco of etapasVisiveis(base)) {
    const bebes: (BebeFormulario | undefined)[] = bloco.repete_por_bebe
      ? (opcoes.bebes ?? [])
      : [undefined];
    for (const bebe of bebes) {
      const ambiente = { ...base, bebe: bebe?.id };
      for (const campo of bloco.campos) {
        if (!campo.obrigatorio || campo.tipo === "automatico") continue;
        if (!campoVisivel(campo, ambiente)) continue;
        const endereco = { bloco: bloco.id, campo: campo.id, bebe: bebe?.id };
        if (!estaRespondido(campo, lerValor(respostas, endereco))) {
          pendencias.push({
            ...endereco,
            rotulo: campo.rotulo,
            rotuloBloco: bloco.titulo,
            rotuloBebe: bebe?.rotulo,
          });
        }
      }
    }
  }
  return pendencias;
}

// ---------------------------------------------------------------------------
// Alertas ligados
// ---------------------------------------------------------------------------

/**
 * Ligações de alerta do campo cuja condição foi satisfeita pela resposta.
 * Só avalia a condição do instrumento; se a regra está ativa, a conduta e
 * a faixa na tela são do motor de alertas (P40), a partir de `regra_alerta`.
 */
export function alertasSatisfeitos(
  campo: Campo,
  endereco: EnderecoCampo,
  ambiente: AmbienteCondicao,
): AlertaLigado[] {
  return (campo.alertas ?? []).filter(
    (alerta) =>
      alerta.condicao !== undefined &&
      avaliarCondicao(alerta.condicao, { ...ambiente, bebe: endereco.bebe }),
  );
}

// ---------------------------------------------------------------------------
// Forma gravada em registro_atendimento.dados
// ---------------------------------------------------------------------------

/**
 * Converte as respostas para a forma de `registro_atendimento.dados`
 * (PRD 6.5): um objeto por bloco; bloco repetido vira lista, um item por
 * bebê, com `bebe_id`.
 */
export function paraDados(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  bebes: BebeFormulario[] = [],
): Record<
  string,
  RespostasBloco | Array<RespostasBloco & { bebe_id: string }>
> {
  const dados: Record<
    string,
    RespostasBloco | Array<RespostasBloco & { bebe_id: string }>
  > = {};
  for (const bloco of definicao.blocos) {
    if (bloco.repete_por_bebe) {
      dados[bloco.id] = bebes.map((bebe) => ({
        ...(respostas.por_bebe[bloco.id]?.[bebe.id] ?? {}),
        bebe_id: bebe.id,
      }));
    } else if (respostas.blocos[bloco.id]) {
      dados[bloco.id] = { ...respostas.blocos[bloco.id] };
    }
  }
  return dados;
}
