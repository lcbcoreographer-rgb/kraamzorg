import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Ficha da família · Kraamzorg OS" };

/**
 * Dono: P16 (ficha 360 e estado sensível). O id vem na URL; o nome da
 * família nunca (CLAUDE.md). A ficha real lê por
 * `obterRepositorios().ficha.obterFicha(id)` e chama notFound() quando a
 * RLS não deixa ver.
 */
export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <TelaEmConstrucao
      titulo="Ficha da família"
      tituloVazio="A ficha desta família vai aparecer aqui"
      texto="As quatro datas, a linha do tempo, as pessoas, o comercial, as conversas e o botão de freio no cabeçalho, em todas as telas da família."
      acao={{ rotulo: "Voltar para famílias", href: "/familias" }}
    />
  );
}
