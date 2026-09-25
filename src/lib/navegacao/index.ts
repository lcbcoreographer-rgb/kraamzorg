import type { Papel } from "@/lib/auth/papeis";

/**
 * Registro único da navegação por papel (PRD 20.4, DESIGN.md seção 6,
 * protótipo comercial-*.html e coordenacao-*.html).
 *
 * - Celular e tablet: abas inferiores, 4 ou 5 itens por papel, na ordem do
 *   PRD 20.4. A última é "Mais", que abre o resto do que o papel pode ver.
 * - Computador: barra lateral com os grupos do PRD 20.4, sempre nesta
 *   ordem: Comercial, Operação, Experiência, Gestão, Sistema. Cada papel
 *   só vê o que pode abrir.
 * - A mesma lista decide o acesso: o proxy (src/proxy.ts) manda para o
 *   início quem abre uma rota que a navegação do papel não tem. Isto é
 *   conforto de tela; a defesa é a RLS do banco (PRD 13).
 *
 * Este arquivo não importa React nem ícone: o proxy roda antes da tela e
 * precisa dele leve. O ícone de cada rota vai por nome
 * (src/components/shell/icones-navegacao.tsx).
 *
 * Cada rota tem um dono (o prompt do PROMPTS.md que preenche a tela). Um
 * módulo novo acrescenta a rota aqui e em NAVEGACAO, e nada mais da casca.
 */

export type GrupoLateral =
  | "Comercial"
  | "Operação"
  | "Experiência"
  | "Gestão"
  | "Sistema";

export const ORDEM_GRUPOS: readonly GrupoLateral[] = [
  "Comercial",
  "Operação",
  "Experiência",
  "Gestão",
  "Sistema",
];

export type NomeIcone =
  | "inicio"
  | "pipeline"
  | "familias"
  | "conversas"
  | "transferencias"
  | "agente"
  | "tarefas"
  | "configuracoes"
  | "equipe"
  | "sessoes"
  | "radar"
  | "agenda"
  | "cobrancas"
  | "notas"
  | "financeiro"
  | "alertas"
  | "perfil"
  | "mais";

export interface Rota {
  /** Caminho da rota; subcaminhos (ex: /familias/[id]) herdam o acesso. */
  caminho: string;
  rotulo: string;
  icone: NomeIcone;
  /** Prompt do PROMPTS.md que preenche a tela. */
  dono: string;
  /** Casca que a rota usa: painel (app) ou portal da enfermeira. */
  casca: "app" | "enfermeira";
}

export const ROTAS = {
  inicio: { caminho: "/inicio", rotulo: "Início", icone: "inicio", dono: "P18 e P27", casca: "app" },
  pipeline: { caminho: "/pipeline", rotulo: "Pipeline", icone: "pipeline", dono: "P15", casca: "app" },
  familias: { caminho: "/familias", rotulo: "Famílias", icone: "familias", dono: "P16", casca: "app" },
  conversas: { caminho: "/conversas", rotulo: "Conversas", icone: "conversas", dono: "P27", casca: "app" },
  transferencias: { caminho: "/transferencias", rotulo: "Transferências", icone: "transferencias", dono: "P27", casca: "app" },
  agente: { caminho: "/agente", rotulo: "Isadora", icone: "agente", dono: "P27", casca: "app" },
  tarefas: { caminho: "/tarefas", rotulo: "Tarefas", icone: "tarefas", dono: "P18", casca: "app" },
  configuracoes: { caminho: "/configuracoes", rotulo: "Configurações", icone: "configuracoes", dono: "P13", casca: "app" },
  equipe: { caminho: "/equipe", rotulo: "Equipe", icone: "equipe", dono: "P37", casca: "app" },
  sessoes: { caminho: "/sessoes", rotulo: "Sessões e acessos", icone: "sessoes", dono: "P07", casca: "app" },
  radar: { caminho: "/radar", rotulo: "Radar", icone: "radar", dono: "P36", casca: "app" },
  agenda: { caminho: "/agenda", rotulo: "Agenda", icone: "agenda", dono: "P37", casca: "app" },
  cobrancas: { caminho: "/cobrancas", rotulo: "Cobranças", icone: "cobrancas", dono: "P32", casca: "app" },
  notas: { caminho: "/notas", rotulo: "Notas", icone: "notas", dono: "P43", casca: "app" },
  financeiro: { caminho: "/financeiro", rotulo: "Financeiro", icone: "financeiro", dono: "P46", casca: "app" },
  mais: { caminho: "/mais", rotulo: "Mais", icone: "mais", dono: "P10", casca: "app" },
  hoje: { caminho: "/hoje", rotulo: "Hoje", icone: "inicio", dono: "P38", casca: "enfermeira" },
  minhasFamilias: { caminho: "/minhas-familias", rotulo: "Famílias", icone: "familias", dono: "P38", casca: "enfermeira" },
  alertas: { caminho: "/alertas", rotulo: "Alertas", icone: "alertas", dono: "P40", casca: "enfermeira" },
  perfil: { caminho: "/perfil", rotulo: "Perfil", icone: "perfil", dono: "P38", casca: "enfermeira" },
} as const satisfies Record<string, Rota>;

export type IdRota = keyof typeof ROTAS;

export interface NavegacaoPapel {
  /** Abas inferiores do celular, na ordem do PRD 20.4. */
  abas: readonly IdRota[];
  /** Grupos da barra lateral do computador (só os que o papel tem). */
  grupos: readonly { titulo: GrupoLateral; itens: readonly IdRota[] }[];
  /** Tela de entrada do papel depois do login. */
  inicio: IdRota;
}

export const NAVEGACAO: Record<Papel, NavegacaoPapel> = {
  comercial: {
    abas: ["inicio", "pipeline", "conversas", "familias", "mais"],
    grupos: [
      { titulo: "Comercial", itens: ["inicio", "pipeline", "conversas", "transferencias", "familias", "tarefas"] },
      { titulo: "Sistema", itens: ["agente"] },
    ],
    inicio: "inicio",
  },
  coordenacao: {
    abas: ["inicio", "radar", "agenda", "familias", "mais"],
    grupos: [
      { titulo: "Operação", itens: ["inicio", "radar", "agenda", "equipe", "tarefas"] },
      { titulo: "Experiência", itens: ["familias", "conversas", "transferencias"] },
      { titulo: "Sistema", itens: ["configuracoes"] },
    ],
    inicio: "inicio",
  },
  financeiro: {
    abas: ["inicio", "cobrancas", "notas", "mais"],
    grupos: [
      { titulo: "Comercial", itens: ["familias"] },
      { titulo: "Gestão", itens: ["inicio", "cobrancas", "notas", "tarefas"] },
    ],
    inicio: "inicio",
  },
  marketing: {
    abas: ["inicio", "mais"],
    grupos: [{ titulo: "Gestão", itens: ["inicio"] }],
    inicio: "inicio",
  },
  diretoria: {
    abas: ["inicio", "pipeline", "radar", "financeiro", "mais"],
    grupos: [
      { titulo: "Comercial", itens: ["inicio", "pipeline", "conversas", "transferencias", "familias", "tarefas"] },
      { titulo: "Operação", itens: ["radar", "agenda", "equipe"] },
      { titulo: "Gestão", itens: ["financeiro", "cobrancas", "notas"] },
      { titulo: "Sistema", itens: ["agente", "configuracoes", "sessoes"] },
    ],
    inicio: "inicio",
  },
  enfermeira: {
    abas: ["hoje", "minhasFamilias", "alertas", "perfil"],
    grupos: [],
    inicio: "hoje",
  },
};

/**
 * Ordem de precedência quando a pessoa tem mais de um papel (o Leonardo tem
 * diretoria, comercial e financeiro; a Edilaine, diretoria e coordenação).
 * As abas do celular são as do primeiro papel desta lista; a barra lateral
 * junta os itens de todos.
 */
const PRECEDENCIA: readonly Papel[] = [
  "diretoria",
  "coordenacao",
  "comercial",
  "financeiro",
  "marketing",
  "enfermeira",
];

export function papelPrincipal(papeis: readonly Papel[]): Papel | null {
  return PRECEDENCIA.find((papel) => papeis.includes(papel)) ?? null;
}

/** Portal da enfermeira só para quem não tem outro papel. */
export function cascaDoUsuario(papeis: readonly Papel[]): "app" | "enfermeira" {
  return papelPrincipal(papeis) === "enfermeira" ? "enfermeira" : "app";
}

export interface ItemNavegacao {
  id: IdRota;
  caminho: string;
  rotulo: string;
  icone: NomeIcone;
}

function item(id: IdRota): ItemNavegacao {
  const rota = ROTAS[id];
  return { id, caminho: rota.caminho, rotulo: rota.rotulo, icone: rota.icone };
}

/** Abas inferiores de quem tem estes papéis. */
export function abasDe(papeis: readonly Papel[]): ItemNavegacao[] {
  const principal = papelPrincipal(papeis);
  return principal ? NAVEGACAO[principal].abas.map(item) : [];
}

/** Grupos da barra lateral, na ordem fixa, juntando os papéis sem repetir item. */
export function gruposDe(
  papeis: readonly Papel[],
): { titulo: GrupoLateral; itens: ItemNavegacao[] }[] {
  const principal = papelPrincipal(papeis);
  const ordenados = principal
    ? [principal, ...papeis.filter((papel) => papel !== principal)]
    : [];
  const vistos = new Set<IdRota>();
  const porGrupo = new Map<GrupoLateral, IdRota[]>();

  for (const papel of ordenados) {
    for (const grupo of NAVEGACAO[papel].grupos) {
      const lista = porGrupo.get(grupo.titulo) ?? [];
      for (const id of grupo.itens) {
        if (vistos.has(id)) continue;
        vistos.add(id);
        lista.push(id);
      }
      porGrupo.set(grupo.titulo, lista);
    }
  }

  return ORDEM_GRUPOS.filter((titulo) => (porGrupo.get(titulo) ?? []).length > 0).map(
    (titulo) => ({ titulo, itens: (porGrupo.get(titulo) ?? []).map(item) }),
  );
}

/** O que a aba "Mais" mostra: tudo da barra lateral que não está nas abas. */
export function gruposDoMais(
  papeis: readonly Papel[],
): { titulo: GrupoLateral; itens: ItemNavegacao[] }[] {
  const nasAbas = new Set(abasDe(papeis).map((aba) => aba.id));
  return gruposDe(papeis)
    .map((grupo) => ({
      titulo: grupo.titulo,
      itens: grupo.itens.filter((it) => !nasAbas.has(it.id)),
    }))
    .filter((grupo) => grupo.itens.length > 0);
}

/** Caminho da tela de entrada de quem tem estes papéis. */
export function caminhoInicial(papeis: readonly Papel[]): string {
  const principal = papelPrincipal(papeis);
  return principal ? ROTAS[NAVEGACAO[principal].inicio].caminho : "/entrar";
}

/** Todas as rotas que estes papéis podem abrir (abas e barra lateral). */
export function rotasPermitidas(papeis: readonly Papel[]): Set<IdRota> {
  const ids = new Set<IdRota>();
  for (const papel of papeis) {
    NAVEGACAO[papel].abas.forEach((id) => ids.add(id));
    NAVEGACAO[papel].grupos.forEach((grupo) => grupo.itens.forEach((id) => ids.add(id)));
  }
  return ids;
}

/** A rota da navegação que contém este caminho (ex: /familias/abc é "familias"). */
export function rotaDoCaminho(caminho: string): IdRota | null {
  let melhor: IdRota | null = null;
  for (const [id, rota] of Object.entries(ROTAS) as [IdRota, Rota][]) {
    const casa = caminho === rota.caminho || caminho.startsWith(`${rota.caminho}/`);
    if (casa && (!melhor || rota.caminho.length > ROTAS[melhor].caminho.length)) {
      melhor = id;
    }
  }
  return melhor;
}

/**
 * Pode abrir este caminho? Caminho fora do registro (ex: /mfa, /api) não é
 * decidido aqui: devolve null e quem chama decide.
 */
export function podeAbrir(papeis: readonly Papel[], caminho: string): boolean | null {
  const id = rotaDoCaminho(caminho);
  if (!id) return null;
  return rotasPermitidas(papeis).has(id);
}

/** Item da navegação ativo para o caminho atual. */
export function ativo(item: ItemNavegacao, caminho: string): boolean {
  return rotaDoCaminho(caminho) === item.id;
}
