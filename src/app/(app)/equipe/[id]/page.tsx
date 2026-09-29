import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/formatacao";
import { FormularioProfissional } from "@/modules/operacao/equipe/componentes/formulario-profissional";
import { SecaoBloqueios } from "@/modules/operacao/equipe/componentes/secao-bloqueios";
import { SecaoDocumentos } from "@/modules/operacao/equipe/componentes/secao-documentos";
import {
  LegendaSemana,
  SemanaEquipe,
} from "@/modules/operacao/equipe/componentes/semana-equipe";
import { SeloEstadoProfissional } from "@/modules/operacao/equipe/componentes/selo-estado";
import {
  carregarProfissional,
  type DetalheProfissional,
} from "@/modules/operacao/equipe/dados";
import { ROTULO_FUNCAO } from "@/modules/operacao/equipe/textos";

export const metadata: Metadata = { title: "Profissional · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

const FEITO: Record<string, string> = {
  criada: "Profissional cadastrada. Ela já aparece na equipe e na escala.",
  salva: "Cadastro salvo.",
};

function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
    >
      <h2 id={id} className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Cadastro de uma profissional (P37 item 1): estado de hoje e semana,
 * famílias em curso, documentos com validade, bloqueios de agenda e os
 * dados do cadastro. O estado é só leitura (calculado).
 */
export default async function PaginaProfissional({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/equipe");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const pesquisa = await searchParams;
  const feito =
    FEITO[
      String(
        Array.isArray(pesquisa.feito)
          ? pesquisa.feito[0]
          : (pesquisa.feito ?? ""),
      )
    ];

  let detalhe: DetalheProfissional | null = null;
  try {
    detalhe = await carregarProfissional(id);
  } catch {
    return (
      <>
        <CabecalhoTela titulo="Profissional" />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="O cadastro não abriu agora">
            Nada foi alterado. Recarregue a página; se continuar, avise a equipe
            técnica.
          </FaixaAlerta>
        </div>
      </>
    );
  }
  if (!detalhe) notFound();

  const { profissional: p, visao, linhaEscala, regioes } = detalhe;

  return (
    <>
      <CabecalhoTela
        titulo={p.nome}
        lateral={
          p.status ? (
            <SeloEstadoProfissional estado={p.status} />
          ) : (
            <Selo variante="neutro">Inativa</Selo>
          )
        }
        subtitulo={`${ROTULO_FUNCAO[p.funcao] ?? p.funcao}${p.conselhoNumero ? ` · COREN ${p.conselhoUf} ${p.conselhoNumero}` : ""}`}
      />
      <Link
        href="/equipe"
        className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Voltar para a equipe
      </Link>

      <div className="flex flex-col gap-6 pt-4">
        {feito ? <FaixaAlerta variante="sucesso" titulo={feito} /> : null}

        {p.atendeVisitas && linhaEscala ? (
          <Secao id="semana" titulo="Semana">
            <SemanaEquipe
              dias={linhaEscala.dias}
              hoje={visao.hoje}
              nome={p.nome}
            />
            <LegendaSemana />
            <p className="text-apoio text-texto-2">
              O estado vem das ofertas, das visitas e dos bloqueios. Ninguém
              precisa marcar nada à mão.
            </p>
          </Secao>
        ) : null}

        {p.familias.length > 0 ? (
          <Secao id="familias" titulo="Famílias em curso">
            <ul className="flex flex-col gap-2">
              {p.familias.map((f) => (
                <li
                  key={f.acompanhamentoId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3"
                >
                  <Link
                    href={`/familias/${f.familiaId}`}
                    className="text-corpo text-texto min-h-toque inline-flex items-center font-medium underline underline-offset-4"
                  >
                    {f.nomeExibicao}
                  </Link>
                  <span className="text-apoio text-texto-2 font-mono">
                    {f.papel === "backup" ? "backup · " : ""}
                    {f.diaAtual !== null
                      ? `D${f.diaAtual} de ${f.diasContratados}`
                      : f.dpp
                        ? `DPP ${formatarData(f.dpp)} (estimativa)`
                        : "aguardando"}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        <Secao id="documentos" titulo="Documentos">
          <SecaoDocumentos
            profissionalId={p.id}
            documentos={p.documentos}
            tiposSugeridos={visao.documentoTipos}
          />
        </Secao>

        <Secao id="bloqueios" titulo="Bloqueios de agenda">
          <SecaoBloqueios
            profissionalId={p.id}
            bloqueios={p.bloqueios}
            hoje={visao.hoje}
          />
        </Secao>

        <Secao id="cadastro" titulo="Cadastro">
          <FormularioProfissional profissional={p} regioes={regioes} />
        </Secao>
      </div>
    </>
  );
}
