import type {
  FamiliaPortal,
  FichaPendentePortal,
  PortalHoje,
  VisitaPortal,
} from "@/lib/dados/tipos-equipe";
import {
  obterFamiliasDoDia,
  salvarFamiliasDoDia,
  type BancoOffline,
  type FamiliaDoDia,
} from "@/lib/sync";

/**
 * Cache offline do portal da enfermeira (P38 item 2), sobre o cache do dia
 * do P12: as visitas de hoje e as famílias atribuídas ficam no aparelho por
 * 24 horas e são apagadas no logout e quando a sessão é revogada
 * (src/lib/sync/cache.ts). Cada linha do cache tem um `tipo`: a visita do
 * dia, a família atribuída ou a linha de resumo do dia (a data, o estado da
 * enfermeira e as fichas pendentes). Só vai para o aparelho o que a
 * enfermeira já vê na tela, e nada de dado comercial.
 */

const CHAVE_USUARIO = "kz:portal:usuario";

export interface DiaNoAparelho {
  dia: string;
  profissionalId: string;
  profissionalNome: string;
  status: PortalHoje["status"];
  visitas: VisitaPortal[];
  fichasPendentes: FichaPendentePortal[];
  familias: FamiliaPortal[];
  /** Instante em que o cache foi gravado (epoch ms). */
  buscadoEm: number;
}

/** Quem está usando este aparelho (só o id; sem nome nem dado de família). */
export function guardarUsuarioDoAparelho(usuarioId: string): void {
  try {
    window.localStorage.setItem(CHAVE_USUARIO, usuarioId);
  } catch {
    // aparelho sem armazenamento local: o portal continua online
  }
}

export function lerUsuarioDoAparelho(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_USUARIO);
  } catch {
    return null;
  }
}

export function esquecerUsuarioDoAparelho(): void {
  try {
    window.localStorage.removeItem(CHAVE_USUARIO);
  } catch {
    // nada a apagar
  }
}

export async function guardarDiaNoAparelho(
  db: BancoOffline,
  dia: PortalHoje,
  familias: FamiliaPortal[],
  agora: number = Date.now(),
): Promise<void> {
  const linhas: FamiliaDoDia[] = [
    {
      familiaId: "resumo",
      visitaId: "resumo",
      tipo: "resumo",
      dia: dia.dia,
      profissionalId: dia.profissionalId,
      profissionalNome: dia.profissionalNome,
      status: dia.status,
      fichasPendentes: dia.fichasPendentes,
    },
    ...dia.visitas.map((v): FamiliaDoDia => ({
      ...v,
      tipo: "visita",
      familiaId: v.familiaId,
      visitaId: v.visitaId,
    })),
    ...familias.map((f): FamiliaDoDia => ({
      ...f,
      tipo: "familia",
      familiaId: f.familiaId,
      visitaId: `familia:${f.familiaId}`,
    })),
  ];
  await salvarFamiliasDoDia(db, linhas, agora);
}

/** null quando não há cache ou passou de 24 horas (a tela pede para abrir com sinal). */
export async function lerDiaDoAparelho(
  db: BancoOffline,
  agora: number = Date.now(),
): Promise<DiaNoAparelho | null> {
  const linhas = await obterFamiliasDoDia(db, agora);
  if (!linhas) return null;
  const resumo = linhas.find((l) => l.tipo === "resumo");
  if (!resumo) return null;
  const meta = await db.cacheMeta.get("familiasDoDia");
  const visitas = linhas
    .filter((l) => l.tipo === "visita")
    .map((l) => {
      const { tipo: _tipo, ...visita } = l;
      return visita as unknown as VisitaPortal;
    })
    .sort((a, b) =>
      (a.horaPrevista ?? "99:99").localeCompare(b.horaPrevista ?? "99:99"),
    );
  const familias = linhas
    .filter((l) => l.tipo === "familia")
    .map((l) => {
      const { tipo: _tipo, visitaId: _visitaId, ...familia } = l;
      return familia as unknown as FamiliaPortal;
    })
    .sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"));
  return {
    dia: String(resumo.dia),
    profissionalId: String(resumo.profissionalId),
    profissionalNome: String(resumo.profissionalNome),
    status: resumo.status as PortalHoje["status"],
    visitas,
    fichasPendentes: (resumo.fichasPendentes ?? []) as FichaPendentePortal[],
    familias,
    buscadoEm: meta?.buscadoEm ?? agora,
  };
}
