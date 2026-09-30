import Link from "next/link";
import { ArrowLeft, Baby, ClipboardPen, ListChecks } from "lucide-react";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
import { formatarData } from "@/lib/formatacao";
import { camposVisiveis } from "../campos";
import type { TelaDocumento } from "../dados";
import { slugDoDocumento } from "../documento";
import { EditorEvolucao } from "./editor-evolucao";
import { MontarEvolucao } from "./montar-evolucao";

type TelaOk = Extract<TelaDocumento, { situacao: "ok" }>;

/**
 * Um documento da evolução, para a coordenação (`/evolucoes/...`) e para a
 * enfermeira (`/minhas-evolucoes/...`). Sem rascunho, mostra o que o
 * checklist já trouxe, o que falta e o botão de montar; com rascunho, abre o
 * editor. O nome da família aparece só aqui, dentro da página.
 */
export function TelaDocumentoEvolucao({
  tela,
  base,
  ehCoordenacao,
}: {
  tela: TelaOk;
  base: "/evolucoes" | "/minhas-evolucoes";
  ehCoordenacao: boolean;
}) {
  const { detalhe, documento, dados, faltas, demonstracao } = tela;
  const slug = slugDoDocumento({
    tipo: documento.tipo,
    bebeOrdem: documento.bebeOrdem,
  });
  const acompanhamentoId = tela.base.acompanhamento.id;
  const periodo = tela.base.acompanhamento;

  const voltar = (
    <Link
      href={base}
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Evoluções
    </Link>
  );

  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="rounded-3 bg-areia-clara flex items-start gap-4 p-5 lg:p-6">
          <TileIcone tom="areia" forma="quadrado" tamanho="g">
            {documento.tipo === "neonatal" ? <Baby /> : <ClipboardPen />}
          </TileIcone>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-titulo text-1 lg:text-display text-texto font-normal">
              {documento.rotulo}
            </h1>
            <p className="text-corpo text-texto-2">
              {tela.base.familiaNome}
              {periodo.inicio && periodo.fim ? (
                <>
                  , de{" "}
                  <span className="font-mono">
                    {formatarData(periodo.inicio)}
                  </span>{" "}
                  a{" "}
                  <span className="font-mono">{formatarData(periodo.fim)}</span>
                </>
              ) : null}
              .
            </p>
          </div>
        </header>

        {detalhe ? (
          <EditorEvolucao
            detalhe={detalhe}
            rotulo={documento.rotulo}
            campos={camposVisiveis(documento.tipo, dados)}
            dados={dados}
            ehCoordenacao={ehCoordenacao}
            caminhoPdf={`${base}/${acompanhamentoId}/${slug}/pdf${detalhe.temPdf ? "" : "?previa=1"}`}
            demonstracao={demonstracao}
          />
        ) : (
          <div className="rounded-3 bg-superficie shadow-1 flex flex-col gap-5 p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <TileIcone tom="dourado" forma="quadrado">
                <ListChecks />
              </TileIcone>
              <p className="text-corpo text-texto max-w-[60ch] pt-2">
                Este documento ainda não foi montado. O rascunho junta o que o
                checklist registrou em cada visita e o que está no cadastro da
                família, e deixa em branco o que só a enfermeira pode dizer.
              </p>
            </div>
            {faltas.length > 0 ? (
              <FaixaAlerta
                variante="info"
                titulo="O que ainda vai faltar depois de montar"
              >
                <ul className="list-disc pl-5">
                  {faltas.map((falta) => (
                    <li key={falta}>{falta}</li>
                  ))}
                </ul>
              </FaixaAlerta>
            ) : null}
            <MontarEvolucao acompanhamentoId={acompanhamentoId} slug={slug} />
          </div>
        )}
      </div>
    </>
  );
}
