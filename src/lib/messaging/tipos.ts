import type { Enums } from "@/lib/db/types";

/**
 * Tipos do mensageiro (P18, PRD 4.1 D-08 e 8.2). `CanalMensageria` é o
 * enum `modo_mensageria` do banco: três implementações, uma interface.
 * Nenhum módulo fora de `src/lib/messaging` monta URL de API de mensageria
 * nem fala com a UAZAPI ou a Cloud API direto (CLAUDE.md).
 */
export type CanalMensageria = Enums<"modo_mensageria">; // 'manual' | 'uazapi' | 'cloud_api'

/** PRD 8.2: decide o que o freio deixa passar. */
export type CategoriaAutomacao = Enums<"categoria_automacao">; // 'interna' | 'operacional' | 'conteudo' | 'marketing'

/** Quem recebe: família (passa pelo freio) ou grupo interno da equipe (nunca passa). */
export type DestinatarioMensagem = "familia" | "equipe";

export interface PedidoEnvio {
  /** Família dona da conversa; obrigatório quando `destinatario` é "familia". */
  familiaId?: string;
  categoria: CategoriaAutomacao;
  destinatario: DestinatarioMensagem;
  /** E.164 (família) ou JID do grupo (equipe). */
  telefoneOuJid: string;
  texto: string;
  /** Contexto para log e depuração (nunca entra no texto enviado). */
  contexto?: string;
}

export interface VerificacaoFreio {
  pode: boolean;
  /** Frase pronta para a tela quando `pode` é falso (PRD 20.3, sem jargão). */
  motivo: string;
}

/**
 * Porta que checa `privado.pode_enviar_mensagem` (via `api.*` por RPC,
 * PRD 8.2) antes de qualquer envio à família. Mensagem para grupo interno
 * (categoria "interna") não chama isto: a matriz do freio já deixa
 * `interna` passar sempre, e grupo interno não é família.
 * Implementação real em `src/modules/mensageria` (não pode morar aqui:
 * este módulo não conhece `src/lib/dados`).
 */
export type VerificadorFreio = (
  pedido: Pick<PedidoEnvio, "familiaId" | "categoria">,
) => Promise<VerificacaoFreio>;

export type ResultadoEnvio =
  | {
      ok: true;
      canal: CanalMensageria;
      /** "link": o app só monta o link; a pessoa envia pelo próprio WhatsApp
       *  (canal manual). "enviado": a mensagem já saiu por uma API. */
      modo: "link" | "enviado";
      texto: string;
      /** Presente só quando `modo` é "link". */
      link?: string;
      /** Id da mensagem na API externa, quando houver (uazapi, cloud_api). */
      idExterno?: string;
    }
  | {
      ok: false;
      motivo: string;
    };

export interface Mensageiro {
  readonly canal: CanalMensageria;
  enviar(pedido: PedidoEnvio, verificar: VerificadorFreio): Promise<ResultadoEnvio>;
}
