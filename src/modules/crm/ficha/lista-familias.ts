import type { FamiliaListaTela } from "./tipos";

/**
 * Regras de apresentação da lista de famílias (pedido do dono em 30/09:
 * "mais organizada e mais fácil de visualizar"). Nada aqui decide negócio:
 * a fase sai das quatro datas e do estado do freio que a família já tem, a
 * busca e a ordem são só da tela. Sem `server-only`: a lista filtra e
 * ordena no navegador, na hora em que a pessoa digita.
 */

export type FaseFamilia =
  "gestando" | "nasceu" | "atendimento" | "sem_data" | "freio";

/** Ordem dos grupos: a linha do tempo da família, o freio por último. */
export const ORDEM_FASES: readonly FaseFamilia[] = [
  "gestando",
  "nasceu",
  "atendimento",
  "sem_data",
  "freio",
];

export const TITULO_FASE: Record<FaseFamilia, string> = {
  gestando: "Gestando",
  nasceu: "O bebê já nasceu",
  atendimento: "Em atendimento",
  sem_data: "Sem data registrada",
  freio: "Com o freio puxado",
};

/** Filtros em pílula: todas, as fases e "com freio" (qualquer estado). */
export type FiltroFase = "todas" | Exclude<FaseFamilia, "freio"> | "com_freio";

export const FILTROS_FASE: readonly { valor: FiltroFase; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "gestando", rotulo: "Gestando" },
  { valor: "nasceu", rotulo: "Bebê nasceu" },
  { valor: "atendimento", rotulo: "Em atendimento" },
  { valor: "sem_data", rotulo: "Sem data" },
  { valor: "com_freio", rotulo: "Com freio" },
];

export type OrdemFamilias = "nome" | "semanas" | "cidade";

export const ORDENS: readonly { valor: OrdemFamilias; rotulo: string }[] = [
  { valor: "nome", rotulo: "Nome" },
  { valor: "semanas", rotulo: "Semanas" },
  { valor: "cidade", rotulo: "Cidade" },
];

type BaseFase = Pick<
  FamiliaListaTela,
  "estadoSensivel" | "dpp" | "dataNascimento" | "dataInicioEfetivo"
>;

/**
 * Em que ponto da linha do tempo a família está. Freio em bloqueio total
 * ou encerrada em estado sensível sai da palavra "gestando" (DESIGN.md,
 * 11.8); freio em atenção fica na fase dela, com o selo. O atendimento
 * começa no primeiro dia efetivo (fato), nunca pela DPP.
 */
export function faseDaFamilia(familia: BaseFase): FaseFamilia {
  if (
    familia.estadoSensivel === "bloqueio_total" ||
    familia.estadoSensivel === "encerrado_sensivel"
  ) {
    return "freio";
  }
  if (familia.dataInicioEfetivo) return "atendimento";
  if (familia.dataNascimento) return "nasceu";
  if (familia.dpp) return "gestando";
  return "sem_data";
}

/** A família entra neste filtro em pílula? */
export function passaNoFiltro(
  familia: FamiliaListaTela,
  filtro: FiltroFase,
): boolean {
  if (filtro === "todas") return true;
  if (filtro === "com_freio") return familia.estadoSensivel !== "normal";
  return familia.fase === filtro;
}

/** Minúsculas e sem acento, para "dalia" achar "Dália". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Parece telefone: 4 dígitos ou mais e nenhuma letra (a busca vai ao servidor). */
export function pareceTelefone(consulta: string): boolean {
  return consulta.replace(/\D/g, "").length >= 4 && !/\p{L}/u.test(consulta);
}

/** Nome, bairro ou cidade contém o que foi digitado. */
export function combinaComBusca(
  familia: Pick<FamiliaListaTela, "nome" | "bairro" | "cidade">,
  consulta: string,
): boolean {
  const alvo = normalizarBusca(consulta);
  if (!alvo) return true;
  return [familia.nome, familia.bairro, familia.cidade].some(
    (campo) => campo !== null && normalizarBusca(campo).includes(alvo),
  );
}

function compararNome(a: FamiliaListaTela, b: FamiliaListaTela): number {
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/**
 * Ordena uma cópia. "Semanas" põe primeiro quem está mais perto da DPP
 * (a DPP mais cedo), sem DPP no fim; "cidade" agrupa cidade e bairro.
 */
export function ordenarFamilias(
  familias: readonly FamiliaListaTela[],
  ordem: OrdemFamilias,
): FamiliaListaTela[] {
  const copia = [...familias];
  if (ordem === "semanas") {
    return copia.sort((a, b) => {
      if (a.dpp && b.dpp && a.dpp !== b.dpp) return a.dpp.localeCompare(b.dpp);
      if (a.dpp && !b.dpp) return -1;
      if (!a.dpp && b.dpp) return 1;
      return compararNome(a, b);
    });
  }
  if (ordem === "cidade") {
    const chave = (f: FamiliaListaTela) =>
      `${f.cidade ?? "￿"}\u0000${f.bairro ?? "￿"}`;
    return copia.sort(
      (a, b) => chave(a).localeCompare(chave(b), "pt-BR") || compararNome(a, b),
    );
  }
  return copia.sort(compararNome);
}

/** Contagem de cada filtro em pílula sobre as famílias que a busca deixou. */
export function contarPorFiltro(
  familias: readonly FamiliaListaTela[],
): Record<FiltroFase, number> {
  const contagem = Object.fromEntries(
    FILTROS_FASE.map((f) => [f.valor, 0]),
  ) as Record<FiltroFase, number>;
  for (const familia of familias) {
    for (const { valor } of FILTROS_FASE) {
      if (passaNoFiltro(familia, valor)) contagem[valor] += 1;
    }
  }
  return contagem;
}

/** Os grupos por fase, na ordem da linha do tempo, só os que têm família. */
export function agruparPorFase(
  familias: readonly FamiliaListaTela[],
): { fase: FaseFamilia; familias: FamiliaListaTela[] }[] {
  return ORDEM_FASES.map((fase) => ({
    fase,
    familias: familias.filter((f) => f.fase === fase),
  })).filter((grupo) => grupo.familias.length > 0);
}

/** Frase do filtro sem resultado, que diz qual filtro está ligado (11.7). */
export const VAZIO_FILTRO: Record<Exclude<FiltroFase, "todas">, string> = {
  gestando: "Nenhuma família gestando nesta lista.",
  nasceu: "Nenhuma família com o bebê já nascido e o atendimento por começar.",
  atendimento: "Nenhuma família em atendimento nesta lista.",
  sem_data: "Toda família desta lista tem uma data registrada.",
  com_freio: "Nenhuma família com o freio puxado agora.",
};
