import { Constants, type Enums } from "@/lib/db/types";

/** Papel de usuário (enum `papel_usuario`, PRD 6.0 e 13). */
export type Papel = Enums<"papel_usuario">;

/** Todos os papéis, na ordem do enum do banco. */
export const PAPEIS: readonly Papel[] = Constants.public.Enums.papel_usuario;

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
}

/**
 * Papéis que só trabalham com sessão AAL2 (MFA). Espelha
 * `privado.perfil_exige_mfa()` da migration 0007 (PRD 13: perfis com acesso a
 * dado assistencial ou financeiro). O banco é a defesa: as políticas
 * `exige_mfa_do_perfil` recusam a sessão AAL1 desses perfis. Aqui a lista só
 * serve para o proxy levar a pessoa ao desafio do MFA antes de a tela
 * aparecer vazia. O teste `papeis.test.ts` lê a migration e falha se as duas
 * listas divergirem.
 */
export const PAPEIS_COM_MFA: readonly Papel[] = [
  "enfermeira",
  "financeiro",
  "coordenacao",
  "diretoria",
];

export function exigeMfa(papeis: readonly Papel[]): boolean {
  return papeis.some((papel) => PAPEIS_COM_MFA.includes(papel));
}

/** Nome do papel na interface (rótulo, não regra). */
export const ROTULO_PAPEL: Record<Papel, string> = {
  comercial: "Comercial",
  enfermeira: "Enfermeira",
  financeiro: "Financeiro",
  marketing: "Marketing",
  coordenacao: "Coordenação",
  diretoria: "Diretoria",
};

/** "Comercial e diretoria", "Coordenação", sem travessão. */
export function descreverPapeis(papeis: readonly Papel[]): string {
  const nomes = papeis.map((papel, i) =>
    i === 0 ? ROTULO_PAPEL[papel] : ROTULO_PAPEL[papel].toLowerCase(),
  );
  if (nomes.length <= 1) return nomes[0] ?? "Sem papel";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
