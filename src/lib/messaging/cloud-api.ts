import { ErroMensageiro } from "./erros";
import type {
  Mensageiro,
  PedidoEnvio,
  ResultadoEnvio,
  VerificadorFreio,
} from "./tipos";

/**
 * Canal `cloud_api` (PRD 4.1 D-08 e 14; item 1 do P18): interface e
 * assinatura prontas, implementação real no P18b, quando a Isadora migrar
 * para a API oficial do WhatsApp (Cloud API da Meta). Até lá, todo
 * `enviar()` lança `ErroMensageiro("nao_implementado")`, nenhum módulo
 * deve tentar usar este canal em produção antes do P18b.
 *
 * P18b vai acrescentar: janela de 24 horas desde a última mensagem da
 * família (mensagem livre dentro dela, modelo aprovado pela Meta fora),
 * cadastro dos modelos aprovados e webhook de status de entrega.
 */
export function criarMensageiroCloudApi(): Mensageiro {
  return {
    canal: "cloud_api",

    enviar(
      _pedido: PedidoEnvio,
      _verificar: VerificadorFreio,
    ): Promise<ResultadoEnvio> {
      throw new ErroMensageiro(
        "nao_implementado",
        "cloud_api é implementado no P18b; use manual ou uazapi por enquanto",
      );
    },
  };
}
