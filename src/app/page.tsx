import { redirect } from "next/navigation";

/**
 * Raiz do app. O proxy (src/proxy.ts) já manda quem entrou para o início do
 * papel e quem não entrou para /entrar; esta página só existe para o caso
 * de a requisição chegar sem passar por ele.
 */
export default function Raiz() {
  redirect("/entrar");
}
