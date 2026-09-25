import "server-only";
import { obterConfiguracaoAgente } from "../repositorio";

export { obterConfiguracaoAgente };

/** "Modo do agente" (P27 item 3, PRD 11.3, 11.7): diretoria escolhe
 * desligado, teste ou produção, e a lista de números de teste. */
export async function obterModoAgenteTela() {
  return obterConfiguracaoAgente();
}
