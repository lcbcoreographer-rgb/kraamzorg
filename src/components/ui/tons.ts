/**
 * Tons de apoio (PRD 20.2 [v4.4]; DESIGN.md, 2.5). A cor diz o que o bloco
 * é, nunca o estado: `dourado` é o agora, `areia` a família e o que já foi
 * guardado, `salvia` o que está feito, `lavanda` o tempo e a agenda,
 * `argila` as pessoas e as conversas. Estado continua com lavado, borda,
 * ícone e palavra (`Selo`, `FaixaAlerta`).
 *
 * Nunca em momento sensível: família em freio, perda ou intercorrência e
 * alerta clínico ficam em creme, branco, ameixa e alerta.
 */
export type Tom = "dourado" | "areia" | "salvia" | "lavanda" | "argila";

/** Fundo claro do bloco (texto marinho ou texto-2 por cima). */
export const FUNDO_CLARO: Record<Tom, string> = {
  dourado: "bg-dourado-claro",
  areia: "bg-areia-clara",
  salvia: "bg-salvia-clara",
  lavanda: "bg-lavanda-clara",
  argila: "bg-argila-clara",
};

/** Fundo médio do tile e da trilha (só texto marinho por cima). */
export const FUNDO_MEDIO: Record<Tom, string> = {
  dourado: "bg-dourado-medio",
  areia: "bg-areia",
  salvia: "bg-salvia-media",
  lavanda: "bg-lavanda-media",
  argila: "bg-argila-media",
};
