import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { PainelOcorrencia } from "@/modules/operacao/ocorrencias/componentes/painel-ocorrencia";
import {
  obterTelaOcorrencia,
  type TelaOcorrencia,
} from "@/modules/operacao/ocorrencias/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Ocorrência · Kraamzorg OS" };

/** Uma ocorrência: descrição, prazo, andamento e histórico (P42). */
export default async function PaginaOcorrencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await exigirSessao("/ocorrencias");

  let tela: TelaOcorrencia | null = null;
  try {
    tela = await obterTelaOcorrencia(id);
  } catch {
    tela = null;
  }
  if (tela?.situacao === "nao_encontrada") notFound();

  const voltar = (
    <Link
      href="/ocorrencias"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Ocorrências
    </Link>
  );

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Ocorrência
          </h1>
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="A ocorrência não abriu agora">
              Confira a conexão e recarregue a página. Nada foi alterado.
            </FaixaAlerta>
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="Esta ocorrência não está com o seu papel"
            >
              As ocorrências são da coordenação e da diretoria. A enfermeira vê
              só as que estão sob a responsabilidade dela.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  const { ocorrencia, responsaveis } = tela;
  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="bg-superficie-2 -mx-4 flex flex-col gap-1 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8">
          <h1 className="font-titulo text-1 text-texto font-normal">
            {ocorrencia.titulo}
          </h1>
        </header>
        <PainelOcorrencia ocorrencia={ocorrencia} responsaveis={responsaveis} />
      </div>
    </>
  );
}
