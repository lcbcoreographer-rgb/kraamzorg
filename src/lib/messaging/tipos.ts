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
  /**
   * Só o canal `cloud_api` lê os dois campos abaixo (P18b, PRD 4.1 D-08).
   * Quando a família escreveu pela última vez (`conversa.ultima_entrada_em`):
   * dentro de `whatsapp_janela_horas`, o texto livre sai; fora dela (ou sem
   * data), só sai modelo aprovado pela Meta e `texto` é ignorado.
   */
  ultimaMensagemFamiliaEm?: string | Date | null;
  /**
   * Fora da janela: a chave de `mensagem_modelo` cujo modelo aprovado deve
   * sair e os valores das variáveis do modelo, por nome. Variável sem valor
   * aqui usa o `valores_padrao` do cadastro.
   */
  modelo?: { mensagemChave: string; variaveis?: Record<string, string> };
}

export interface VerificacaoFreio {
  pode: boolean;
  /** Frase pronta para a tela quando `pode` é falso (PRD 20.3, sem jargão). */
  motivo: string;
  /**
   * Código de `privado.pode_enviar_mensagem` quando `pode` é falso
   * ("freio_bloqueio_total", "nao_contatar", "fora_da_janela"...). Serve para
   * a tela escolher o tom (ameixa para freio, PRD 8.3), nunca para mostrar.
   */
  codigo?: string;
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
  pedido: Pick<PedidoEnvio, "familiaId" | "categoria"> & {
    /** Canal que vai enviar: o banco só dispensa "conversa iniciada pela família" no cloud_api (0009). */
    canal?: CanalMensageria;
  },
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
      /** cloud_api: "texto_livre" dentro da janela, "modelo" fora dela. */
      via?: "texto_livre" | "modelo";
      /** cloud_api, quando `via` é "modelo": o nome do modelo aprovado na Meta. */
      modelo?: string;
      /** cloud_api em homologação sem credencial: a mensagem foi só capturada. */
      capturado?: boolean;
    }
  | {
      ok: false;
      motivo: string;
      /**
       * Código curto e estável para a tela e os testes escolherem o que
       * fazer ("fora_da_janela_sem_modelo", "grupo_nao_suportado", ...).
       * Nunca texto da API externa.
       */
      codigo?: string;
    };

export interface Mensageiro {
  readonly canal: CanalMensageria;
  enviar(
    pedido: PedidoEnvio,
    verificar: VerificadorFreio,
  ): Promise<ResultadoEnvio>;
}
