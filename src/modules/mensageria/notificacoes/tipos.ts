import type { Papel } from "@/lib/auth/papeis";
import type { Prioridade } from "@/lib/dados/tipos";

/** PRD 6.7 (`notificacao.canais`). */
export type CanalNotificacao = "app" | "push" | "whatsapp_interno" | "email";

export interface NotificacaoInterna {
  id: string;
  usuarioId: string | null;
  papel: Papel | null;
  prioridade: Prioridade;
  titulo: string;
  corpo: string | null;
  link: string | null;
  canais: CanalNotificacao[];
  lidaEm: string | null;
  criadaEm: string;
}

/** Ligado por padrão: uma central que nasce calada não avisa ninguém. */
export interface PreferenciasNotificacao {
  usuarioId: string;
  push: boolean;
  whatsappInterno: boolean;
  email: boolean;
}

export const PREFERENCIAS_PADRAO = (
  usuarioId: string,
): PreferenciasNotificacao => ({
  usuarioId,
  push: true,
  whatsappInterno: true,
  email: true,
});
