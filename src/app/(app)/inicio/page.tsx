import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";
import type { Papel } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { papelPrincipal } from "@/lib/navegacao";

export const metadata: Metadata = { title: "Início · Kraamzorg OS" };

/** O que o Início de cada papel vai mostrar (PRD 20.4). */
const INICIO_POR_PAPEL: Record<
  Exclude<Papel, "enfermeira">,
  { titulo: string; texto: string; acao?: { rotulo: string; href: string } }
> = {
  comercial: {
    titulo: "A fila do dia vai aparecer aqui",
    texto:
      "Transferências da Isadora por prioridade e prazo, com o botão para assumir, e as tarefas que vencem hoje.",
    acao: { rotulo: "Ver transferências", href: "/transferencias" },
  },
  coordenacao: {
    titulo: "O que pede decisão vai aparecer aqui",
    texto:
      "Alertas clínicos abertos, transferências de saúde, fichas pendentes, ofertas sem resposta e a síntese da equipe.",
  },
  financeiro: {
    titulo: "O que pede atenção no financeiro vai aparecer aqui",
    texto: "Cobranças vencendo, pagamentos confirmados e notas com erro.",
    acao: { rotulo: "Ver cobranças", href: "/cobrancas" },
  },
  marketing: {
    titulo: "Os números de origem e funil vão aparecer aqui",
    texto:
      "Leads por origem e por estágio, sempre em agregado, sem dado de família.",
  },
  diretoria: {
    titulo: "As cinco perguntas do dia vão aparecer aqui",
    texto:
      "Vendas, operação, equipe, financeiro e alertas, cada uma com a comparação ao período anterior.",
    acao: { rotulo: "Ver pipeline", href: "/pipeline" },
  },
};

/**
 * Dono: P18 (fila e tarefas do comercial) e P27 (transferências); cada
 * papel ganha o próprio Início no módulo dele (coordenação P36, financeiro
 * P46, marketing P47, diretoria P52).
 */
export default async function PaginaInicio() {
  const sessao = await exigirSessao();
  const principal = papelPrincipal(sessao.papeis);
  const conteudo =
    INICIO_POR_PAPEL[
      principal && principal !== "enfermeira" ? principal : "comercial"
    ];
  return (
    <TelaEmConstrucao
      titulo="Início"
      tituloVazio={conteudo.titulo}
      texto={conteudo.texto}
      acao={conteudo.acao}
    />
  );
}
