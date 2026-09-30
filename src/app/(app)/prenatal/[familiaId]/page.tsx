import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { EntrevistaPrenatal } from "@/lib/dados/tipos-operacao";
import { formatarDataHora } from "@/lib/formatacao";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { fraseErroOperacao } from "@/modules/operacao/comum/mensagens";
import { AgendarConsulta } from "@/modules/operacao/prenatal/componentes/agendar-consulta";
import { ContextoFamilia } from "@/modules/operacao/prenatal/componentes/contexto-familia";
import { Entrevista } from "@/modules/operacao/prenatal/componentes/entrevista";
import { respostasEmTexto } from "@/modules/operacao/prenatal/respostas";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = {
  title: "Entrevista pré-natal · Kraamzorg OS",
};

/**
 * Entrevista pré-natal de uma família (P35, fluxo B). Marcar ou remarcar a
 * consulta, conduzir o DOC 1 em etapas com salvamento por campo e, depois de
 * concluída, ler as respostas. Abrir a entrevista é leitura assistencial:
 * o banco grava no log antes de devolver. Só coordenação e diretoria.
 */
export default async function PaginaEntrevista({
  params,
}: {
  params: Promise<{ familiaId: string }>;
}) {
  const { familiaId } = await params;
  if (!z.uuid().safeParse(familiaId).success) notFound();

  const sessao = await exigirSessao("/prenatal");

  let entrevista: EntrevistaPrenatal | null = null;
  let erro: string | null = null;
  try {
    const { operacao } = await obterRepositorios();
    entrevista = await operacao.abrirEntrevista(familiaId);
  } catch (e) {
    erro = fraseErroOperacao(e, "abrir a entrevista");
  }

  const voltar = (
    <Botao asChild variante="secundario" tamanho="compacto">
      <Link href="/prenatal">
        <ArrowLeft aria-hidden className="size-4" />
        Pré-natal
      </Link>
    </Botao>
  );

  if (!entrevista) {
    return (
      <>
        <CabecalhoTela titulo="Entrevista pré-natal" lateral={voltar} />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="A entrevista não abriu">
            {erro ?? "Confira a conexão e tente de novo."}
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const { consulta, familia } = entrevista;
  const realizada = consulta.status === "realizada";
  const semData = consulta.status === "pendente";
  const contexto = (
    <ContextoFamilia
      nome={familia.nome}
      dpp={familia.dpp}
      ig={familia.ig}
      cidade={familia.cidade}
      uf={familia.uf}
      urgente={consulta.urgente}
      gemelar={familia.gemelar}
    />
  );

  return (
    <>
      <CabecalhoTela
        titulo="Entrevista pré-natal"
        subtitulo={
          realizada
            ? "Entrevista concluída. As respostas ficam só para leitura."
            : semData
              ? "Marque o dia e o horário da consulta. A entrevista pode começar quando ela acontecer."
              : consulta.agendadaPara
                ? `Consulta marcada para ${formatarDataHora(consulta.agendadaPara) ?? ""}.`
                : undefined
        }
        lateral={voltar}
      />
      <div className="flex flex-col gap-6 pt-6">
        {!realizada ? (
          <Cartao className="flex flex-col gap-3">
            <h2 className="font-titulo text-2 text-texto font-medium">
              {semData ? "Marcar a consulta" : "Remarcar a consulta"}
            </h2>
            <AgendarConsulta
              familiaId={familiaId}
              remarcar={!semData}
              hoje={hojeBrasilia()}
            />
          </Cartao>
        ) : null}

        {realizada ? (
          <div className="tablet:grid-cols-[minmax(0,1fr)_20rem] grid grid-cols-1 gap-6">
            <div className="flex flex-col gap-4" data-entrevista-concluida>
              {respostasEmTexto(entrevista.definicao, entrevista.respostas).map(
                (bloco) => (
                  <Cartao key={bloco.bloco} className="flex flex-col gap-3">
                    <h2 className="font-titulo text-2 text-texto font-medium">
                      {bloco.titulo}
                    </h2>
                    <dl className="text-corpo grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                      {bloco.linhas.map((linha) => (
                        <div key={linha.campo} className="contents">
                          <dt className="text-texto-2">{linha.rotulo}</dt>
                          <dd className="text-texto">{linha.texto}</dd>
                        </div>
                      ))}
                    </dl>
                  </Cartao>
                ),
              )}
            </div>
            <aside>{contexto}</aside>
          </div>
        ) : (
          <Entrevista
            usuarioId={sessao.usuarioId}
            familiaId={familiaId}
            consultaId={consulta.id}
            versao={consulta.versao}
            definicao={entrevista.definicao}
            respostasServidor={entrevista.respostas}
            progresso={consulta.progresso}
            sugestoes={entrevista.sugestoes}
            coletador={entrevista.coletador}
            idadeGestacional={familia.ig}
            lateral={contexto}
          />
        )}
      </div>
    </>
  );
}
