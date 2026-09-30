import {
  Bot,
  CalendarDays,
  ChartColumn,
  CalendarClock,
  ClipboardList,
  ClipboardPen,
  Ellipsis,
  FileText,
  Gauge,
  House,
  Inbox,
  Kanban,
  ListTodo,
  MessageCircle,
  MessageSquareHeart,
  Radar,
  Receipt,
  Settings,
  ShieldAlert,
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
  sessoesVenda: CalendarClock,
  radar: Radar,
  prenatal: ClipboardList,
  agenda: CalendarDays,
  cobrancas: Receipt,
  notas: FileText,
  evolucoes: ClipboardPen,
  ocorrencias: ShieldAlert,
  posVenda: MessageSquareHeart,
  financeiro: Wallet,
  capacidade: ChartColumn,
  painel: Gauge,
  alertas: Siren,
  perfil: UserRound,
  mais: Ellipsis,
};

export function IconeNavegacao({ nome }: { nome: NomeIcone }) {
  const Icone = ICONES_NAVEGACAO[nome];
  return <Icone aria-hidden="true" strokeWidth={1.75} />;
}
