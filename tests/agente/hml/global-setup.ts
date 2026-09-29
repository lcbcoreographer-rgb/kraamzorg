/**
 * P28 · Começa cada rodada do roteiro com a pasta de resultados por caso vazia,
 * para o relatório e o teste de aceite nunca misturarem duas rodadas.
 */
import { rmSync } from "node:fs";
import { DIRETORIO_DOS_CASOS } from "./ambiente";

export default function globalSetup(): void {
  rmSync(DIRETORIO_DOS_CASOS, { recursive: true, force: true });
}
