import { ErroMensageiro } from "./erros";
import type {
  Mensageiro,
  PedidoEnvio,
  ResultadoEnvio,
  VerificadorFreio,
} from "./tipos";

/**
 * Canal `uazapi` (PRD 4.1 D-08, 1966 e 2115; P18 item 1): só para conversa
 * já iniciada pela família (checado por `pode_enviar_mensagem`, que é a
 * mesma regra da UAZAPI) e para os grupos internos da equipe (23.3), que
 * nunca passam pelo freio (categoria "interna" sempre executa, 8.2).
 * `track_source: "kraamzorg-app"` identifica que a mensagem saiu do app,
 * não do fluxo n8n da Isadora (que usa "kraamzorg-agente", PRD 2115).
 *
 * Configuração só por variável de ambiente (nunca no código): URL base em
 * `UAZAPI_BASE_URL`, token do cabeçalho `token` em `UAZAPI_TOKEN`. Faltando
 * uma das duas, `enviar` devolve `{ ok: false }` em vez de lançar: uma
 * tarefa sem canal configurado não pode derrubar a tela de tarefas.
 */
export interface ConfigUazapi {
  baseUrl: string;
  token: string;
  /** Injeção para teste; padrão é o `fetch` global. */
  fetchImpl?: typeof fetch;
}

export function configUazapiDoAmbiente(): ConfigUazapi | null {
  const baseUrl = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

export function criarMensageiroUazapi(
  config: ConfigUazapi | null = configUazapiDoAmbiente(),
): Mensageiro {
  return {
    canal: "uazapi",

    async enviar(
      pedido: PedidoEnvio,
      verificar: VerificadorFreio,
    ): Promise<ResultadoEnvio> {
      if (!config) {
        return {
          ok: false,
          motivo:
            "A UAZAPI não está configurada neste ambiente (faltam UAZAPI_BASE_URL e UAZAPI_TOKEN).",
        };
      }

      if (pedido.destinatario === "familia") {
        const verificacao = await verificar({
          familiaId: pedido.familiaId,
          categoria: pedido.categoria,
          canal: "uazapi",
        });
        if (!verificacao.pode) {
          return { ok: false, motivo: verificacao.motivo };
        }
      }
      // destinatario "equipe" (grupo interno): categoria "interna", nunca
      // checa o freio (PRD 8.2: "interna" fala com a equipe mesmo com a
      // família em bloqueio_total ou encerrado_sensivel).

      const buscar = config.fetchImpl ?? fetch;
      let resposta: Response;
      try {
        resposta = await buscar(`${config.baseUrl}/send/text`, {
          method: "POST",
          headers: { "content-type": "application/json", token: config.token },
          body: JSON.stringify({
            number: pedido.telefoneOuJid,
            text: pedido.texto,
            track_source: "kraamzorg-app",
          }),
        });
      } catch {
        return {
          ok: false,
          motivo:
            "Não deu para falar com o WhatsApp agora. Tente de novo em instantes.",
        };
      }

      if (!resposta.ok) {
        return {
          ok: false,
          motivo: `A UAZAPI recusou o envio (HTTP ${resposta.status}).`,
        };
      }

      const corpo = (await resposta.json().catch(() => null)) as {
        id?: string;
        messageid?: string;
      } | null;

      return {
        ok: true,
        canal: "uazapi",
        modo: "enviado",
        texto: pedido.texto,
        idExterno: corpo?.id ?? corpo?.messageid,
      };
    },
  };
}

/** Erro explícito para quem tentar montar uma config inválida na mão. */
export function exigirConfigUazapi(config: ConfigUazapi | null): ConfigUazapi {
  if (!config) {
    throw new ErroMensageiro(
      "nao_configurado",
      "UAZAPI_BASE_URL e UAZAPI_TOKEN precisam estar definidos",
    );
  }
  return config;
}
