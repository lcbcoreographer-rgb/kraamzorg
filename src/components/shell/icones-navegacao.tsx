import {
  Bot,
  CalendarDays,
  Ellipsis,
  FileText,
  House,
  Inbox,
  Kanban,
  ListTodo,
  MessageCircle,
  Radar,
  Receipt,
  Settings,
  ShieldCheck,
  Siren,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NomeIcone } from "@/lib/navegacao";

/**
 * Ícone de cada item da navegação (DESIGN.md, seção 5: Lucide, traço 1,75).
 * O registro de navegação guarda só o nome, para o proxy não carregar React.
 */
export const ICONES_NAVEGACAO: Record<NomeIcone, LucideIcon> = {
  inicio: House,
  pipeline: Kanban,
  familias: Users,
  conversas: MessageCircle,
  transferencias: Inbox,
  agente: Bot,
  tarefas: ListTodo,
  configuracoes: Settings,
  equipe: UserCheck,
  sessoes: ShieldCheck,
  radar: Radar,
  agenda: CalendarDays,
  cobrancas: Receipt,
  notas: FileText,
  financeiro: Wallet,
  alertas: Siren,
  perfil: UserRound,
  mais: Ellipsis,
};

export function IconeNavegacao({ nome }: { nome: NomeIcone }) {
  const Icone = ICONES_NAVEGACAO[nome];
  return <Icone aria-hidden="true" strokeWidth={1.75} />;
}
