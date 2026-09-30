import "server-only";
import { criarMensageiro, type Mensageiro } from "@/lib/messaging";
import { criarCatalogoModelos, lerJanelaHoras } from "./catalogo";

export { criarCatalogoModelos, lerJanelaHoras } from "./catalogo";

/**
 * O adaptador `cloud_api` montado para o app (P18b): janela lida do banco
 * (`parametro.whatsapp_janela_horas`), catálogo dos modelos aprovados e as
 * credenciais do ambiente (`WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).
 * Sem credencial, fora de produção, cai na captura de homologação
 * (`/api/teste/cloud-api`). Quem manda mensagem para a família chama isto e
 * passa o `VerificadorFreio` de `../tarefas/verificador-freio`.
 */
export async function criarMensageiroCloudApiDoApp(): Promise<Mensageiro> {
  return criarMensageiro("cloud_api", {
    cloudApi: {
      janelaHoras: await lerJanelaHoras(),
      catalogo: criarCatalogoModelos(),
    },
  });
}
