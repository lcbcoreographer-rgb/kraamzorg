import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { MesclagemForm } from "@/modules/crm/deduplicacao/componentes/mesclagem-form";

export const metadata: Metadata = { title: "Mesclar famílias · Kraamzorg OS" };

const parSchema = z.uuid();

/**
 * Mesclagem lado a lado (P17 item 2). O par vem na URL como
 * "idA~idB" (dois `uuid`, PRD 6.10 regra 2).
 */
export default async function PaginaMesclagem({
  params,
}: {
  params: Promise<{ par: string }>;
}) {
  await exigirSessao("/pipeline/duplicatas");
  const { par } = await params;
  const [idA, idB] = par.split("~");
  if (
    !idA ||
    !idB ||
    !parSchema.safeParse(idA).success ||
    !parSchema.safeParse(idB).success
  ) {
    notFound();
  }

  const { ficha } = await obterRepositorios();
  const [fichaA, fichaB] = await Promise.all([
    ficha.obterFicha(idA),
    ficha.obterFicha(idB),
  ]);
  if (!fichaA || !fichaB) notFound();

  return (
    <>
      <CabecalhoTela
        titulo="Mesclar famílias"
        lateral={
          <Link
            href="/pipeline/duplicatas"
            className="text-apoio text-texto min-h-toque inline-flex items-center gap-2 font-medium hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar às duplicatas
          </Link>
        }
      />
      <p className="text-apoio text-texto-2 max-w-leitura mt-3">
        Compare os dois lados, escolha qual família fica e confirme. Não há como
        desfazer (P17).
      </p>

      <div className="pt-6">
        <MesclagemForm
          a={{ familia: fichaA.familia, oportunidade: fichaA.oportunidade }}
          b={{ familia: fichaB.familia, oportunidade: fichaB.oportunidade }}
        />
      </div>
    </>
  );
}
