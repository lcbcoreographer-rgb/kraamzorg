import {
  BookOpen,
  Bot,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  Compass,
  DoorOpen,
  Ellipsis,
  FileText,
  GraduationCap,
  Handshake,
  House,
  Inbox,
  Kanban,
  ListChecks,
  ListTodo,
  Megaphone,
  MessageCircle,
  Radar,
  Receipt,
  Settings,
  ShieldCheck,
  Siren,
  UserCheck,
  UserRound,
  UserSearch,
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
  financeiro: Wallet,
  alertas: Siren,
  perfil: UserRound,
  marketing: Megaphone,
  copiloto: Compass,
  parceiros: Handshake,
  portalFamilia: DoorOpen,
  tarefasEquipe: ListChecks,
  manuais: BookOpen,
  talentos: UserSearch,
  treinamentos: GraduationCap,
  mais: Ellipsis,
};

export function IconeNavegacao({ nome }: { nome: NomeIcone }) {
  const Icone = ICONES_NAVEGACAO[nome];
  return <Icone aria-hidden="true" strokeWidth={1.75} />;
}
