import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { TelaDocumentoEvolucao } from "@/modules/assistencial/evolucao/componentes/tela-documento";
import {
  obterTelaDocumento,
  type TelaDocumento,
} from "@/modules/assistencial/evolucao/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Evolução · Kraamzorg OS" };

/** Um documento da evolução, na visão da enfermeira (P41). */
export default async function PaginaMinhaEvolucao({
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
  await exigirSessao("/minhas-evolucoes");

  let tela: TelaDocumento | null = null;
  try {
    tela = await obterTelaDocumento(acompanhamentoId, documento);
  } catch {
    tela = null;
  }
  if (tela?.situacao === "nao_encontrado") notFound();

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        <CabecalhoTela titulo="Evolução" />
        <div className="pt-6">
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="O documento não abriu agora">
              Confira a conexão e recarregue a página. Nada foi alterado.
            </FaixaAlerta>
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="Esta evolução é de outra profissional"
            >
              Você vê as evoluções dos acompanhamentos em que atende.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  return (
    <TelaDocumentoEvolucao
      tela={tela}
      base="/minhas-evolucoes"
      ehCoordenacao={false}
    />
  );
}
