import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { ListaDuplicatas } from "@/modules/crm/deduplicacao/componentes/lista-duplicatas";
import { listarDuplicatas } from "@/modules/crm/deduplicacao/deteccao";

export const metadata: Metadata = { title: "Duplicatas · Kraamzorg OS" };

/**
 * Duplicatas e vínculo de nova gestação (P17 item 1). Subrota de
 * `/pipeline`, porque este módulo só é dono de `src/app/(app)/pipeline`; a
 * rota em si já herda o acesso de `/pipeline` (src/lib/navegacao).
 */
export default async function PaginaDuplicatas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pesquisa = await searchParams;
  const resultado = await listarDuplicatas();

  return (
    <>
      <CabecalhoTela
        titulo="Duplicatas"
        lateral={
          <Link
            href="/pipeline"
            className="text-apoio text-texto min-h-toque inline-flex items-center gap-2 font-medium hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar ao pipeline
          </Link>
        }
      />
      <p className="text-apoio text-texto-2 max-w-leitura mt-3">
        Famílias que podem ser a mesma pessoa, por telefone ou por nome parecido
        com DPP próxima.
      </p>

      {pesquisa.mesclada ? (
        <div className="pt-4">
          <FaixaAlerta variante="sucesso" titulo="Famílias mescladas" />
        </div>
      ) : null}
      {pesquisa.vinculada ? (
        <div className="pt-4">
          <FaixaAlerta
            variante="sucesso"
            titulo="Famílias vinculadas como a mesma gestante"
          />
        </div>
      ) : null}

      <div className="pt-6">
        <ListaDuplicatas resultado={resultado} />
      </div>
    </>
  );
}
