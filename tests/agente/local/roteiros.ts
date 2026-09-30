/**
 * P28 · Todos os roteiros do modelo simulado, por caso: os do Apêndice C e
 * dos extras (`modelo-roteirizado.ts`) e os da agenda (`roteiros-agenda.ts`).
 * Um arquivo só junta os dois para os módulos não se importarem em círculo.
 */
import { ROTEIROS_BASE } from "./modelo-roteirizado";
import type { RoteiroDoTurno } from "./modelo-roteirizado";
import { ROTEIROS_DA_AGENDA } from "./roteiros-agenda";

export const ROTEIROS: Record<string, Record<number, RoteiroDoTurno>> = {
  ...ROTEIROS_BASE,
  ...ROTEIROS_DA_AGENDA,
};
