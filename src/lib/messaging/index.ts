import { criarMensageiroCloudApi } from "./cloud-api";
import { criarMensageiroManual } from "./manual";
import { criarMensageiroUazapi } from "./uazapi";
import type { CanalMensageria, Mensageiro } from "./tipos";

export * from "./tipos";
export { ErroMensageiro, type CodigoErroMensageiro } from "./erros";
export { montarLinkWhatsApp, digitosTelefone } from "./link-whatsapp";
export { criarMensageiroManual } from "./manual";
export {
  criarMensageiroUazapi,
  configUazapiDoAmbiente,
  type ConfigUazapi,
} from "./uazapi";
export { criarMensageiroCloudApi } from "./cloud-api";

/**
 * Fábrica dos três canais (PRD 4.1 D-08, item 1 do P18). Quem decide qual
 * canal usar é quem chama (a régua manda "manual"; um aviso interno manda
 * "uazapi"); esta função só monta a implementação certa, sem nenhuma regra
 * de negócio. `cloud_api` sempre lança ao enviar até o P18b.
 */
export function criarMensageiro(canal: CanalMensageria): Mensageiro {
  switch (canal) {
    case "manual":
      return criarMensageiroManual();
    case "uazapi":
      return criarMensageiroUazapi();
    case "cloud_api":
      return criarMensageiroCloudApi();
  }
}
