import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/sessao";
import { PainelSemConversa } from "@/modules/agente/conversas/componentes/painel-sem-conversa";
import { listarFilaTela } from "@/modules/agente/transferencias/dados";
import type { TransferenciaTela } from "@/modules/agente/tipos";

export const metadata: Metadata = { title: "Conversas · Kraamzorg OS" };

/**
 * Conversas sem nenhuma aberta (P27 item 1; pedido do dono em 30/09,
 * "estilo WhatsApp Web"). A lista mora no layout; aqui fica só o lado
 * direito, que no computador diz quem espera alguém e no celular não
 * aparece (a lista ocupa a tela). Dono: P27.
 */
export default async function PaginaConversas() {
  await exigirSessao("/conversas");
  let fila: TransferenciaTela[] | null = null;
  try {
    fila = await listarFilaTela();
  } catch {
    fila = null;
  }
  return <PainelSemConversa fila={fila} />;
}
