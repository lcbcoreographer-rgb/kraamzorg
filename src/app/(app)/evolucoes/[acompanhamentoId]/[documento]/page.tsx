import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { TelaDocumentoEvolucao } from "@/modules/assistencial/evolucao/componentes/tela-documento";
import {
  obterTelaDocumento,
  type TelaDocumento,
} from "@/modules/assistencial/evolucao/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Evolução · Kraamzorg OS" };

/** Um documento da evolução, na visão da coordenação e da diretoria (P41). */
export default async function PaginaDocumentoEvolucao({
  params,
}: {
  params: Promise<{ acompanhamentoId: string; documento: string }>;
}) {
  const { acompanhamentoId, documento } = await params;
  if (
    !z.uuid().safeParse(acompanhamentoId).success ||
    !/^(puerperal|bebe-[1-9])$/.test(documento)
  ) {
    notFound();
  }
  const usuario = await exigirSessao("/evolucoes");

  let tela: TelaDocumento | null = null;
  try {
    tela = await obterTelaDocumento(acompanhamentoId, documento);
  } catch {
    tela = null;
  }
  if (tela?.situacao === "nao_encontrado") notFound();

  if (!tela || tela.situacao !== "ok") {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Evolução
        </h1>
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="O documento não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : (
          <FaixaAlerta
            variante="info"
            titulo="Esta evolução não está com o seu papel"
          >
            As evoluções são da enfermeira que atende, da coordenação e da
            diretoria.
          </FaixaAlerta>
        )}
      </div>
    );
  }

  return (
    <TelaDocumentoEvolucao
      tela={tela}
      base="/evolucoes"
      ehCoordenacao={usuario.papeis.includes("coordenacao")}
    />
  );
}
