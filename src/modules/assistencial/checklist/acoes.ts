"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";

/**
 * Ações de servidor do checklist. Só o freio: o registro, o alerta e o
 * adendo sobem pela fila do aparelho (`POST /api/sync`), porque precisam
 * funcionar sem conexão.
 */

const idFamilia = z.uuid();

/**
 * Freio em um toque no cabeçalho do checklist (PRD 8.3, CLAUDE.md): sempre
 * `bloqueio_total`, sem pergunta antes. Qualquer usuário com acesso à
 * família aciona; o banco confere (`api.acionar_freio`). O registro clínico
 * continua liberado com o freio ligado.
 */
export async function acaoAcionarFreioDoChecklist(
  familiaId: string,
): Promise<{ ok: boolean }> {
  await exigirSessao("/visita");
  if (!idFamilia.safeParse(familiaId).success) return { ok: false };
  try {
    const { assistencial } = await obterRepositorios();
    await assistencial.acionarFreio(familiaId);
  } catch {
    return { ok: false };
  }
  revalidatePath("/visita/[visitaId]", "page");
  return { ok: true };
}
