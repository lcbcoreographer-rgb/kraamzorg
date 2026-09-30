import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarSync } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FolhaLupa } from "@/components/ilustracoes";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/formatacao";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import { PainelReagendar } from "@/modules/operacao/equipe/componentes/painel-reagendar";
import {
  carregarVisita,
  type DadosVisita,
} from "@/modules/operacao/equipe/dados";
import {
  ROTULO_ESTADO_VISITA,
  ROTULO_TURNO,
} from "@/modules/operacao/equipe/textos";

export const metadata: Metadata = { title: "Reagendar visita · Kraamzorg OS" };

/**
 * Reagendar uma visita (P37 itens 3 e 4): a tela pergunta ao banco, a cada
 * mudança, quais conflitos haveria e mostra os avisos antes de salvar.
 */
export default async function PaginaReagendarVisita({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSessao("/agenda");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  let dados: DadosVisita | null = null;
  let falhou = false;
  try {
    dados = await carregarVisita(id);
  } catch {
    falhou = true;
  }

  const voltar = (
    <Link
      href="/agenda"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Voltar para a agenda
    </Link>
  );

  if (falhou) {
    return (
      <>
        <CabecalhoTela titulo="Reagendar visita" />
        {voltar}
        <div className="pt-4">
          <FaixaAlerta variante="erro" titulo="A visita não abriu agora">
            Nada foi alterado. Recarregue a página; se continuar, avise a equipe
            técnica.
          </FaixaAlerta>
        </div>
      </>
    );
  }
  if (!dados) {
    return (
      <>
        <CabecalhoTela titulo="Reagendar visita" />
        {voltar}
        <div className="pt-4">
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<FolhaLupa tamanho={112} />}
            titulo="Não achamos esta visita"
            texto="Ela pode ter sido apagada ou estar fora dos dias que a agenda mostra. Volte à agenda e abra de novo."
          />
        </div>
      </>
    );
  }

  const { visita: v, profissionais, hoje } = dados;
  return (
    <>
      <CabecalhoTela
        titulo="Reagendar visita"
        subtitulo={`${v.nomeExibicao}, dia ${v.diaNumero} de ${v.diasContratados}.`}
      />
      {voltar}
      <div className="max-w-leitura flex flex-col gap-5 pt-4">
        <section
          aria-label="Como está marcada"
          className="rounded-3 bg-lavanda-clara flex items-start gap-4 p-5"
        >
          <TileIcone tom="lavanda" forma="quadrado">
            <CalendarDays />
          </TileIcone>
          <div className="flex flex-col gap-2">
            <p className="text-corpo text-texto">
              Está marcada para{" "}
              <span className="font-mono font-semibold">
                {formatarData(v.data)}
              </span>
              {v.horaPrevista ? (
                <>
                  {" "}
                  às{" "}
                  <span className="font-mono font-semibold">
                    {v.horaPrevista}
                  </span>
                </>
              ) : null}
              {v.turno ? `, de ${ROTULO_TURNO[v.turno]}` : ""}, com{" "}
              {v.profissionalNome}.
            </p>
            <p className="text-apoio text-texto-2">
              <Selo variante="neutro">{ROTULO_ESTADO_VISITA[v.estado]}</Selo>
            </p>
          </div>
        </section>

        {v.movivel ? (
          <Cartao className="flex flex-col gap-5">
            <TituloSecao
              icone={<CalendarSync />}
              tom="dourado"
              titulo="Para quando vai"
              texto="A agenda confere os conflitos a cada mudança, antes de salvar."
            />
            <PainelReagendar
              visitaId={v.visitaId}
              acompanhamentoId={v.acompanhamentoId}
              dataAtual={v.data}
              horaAtual={v.horaPrevista}
              profissionalAtualId={v.profissionalId}
              profissionais={profissionais}
              hoje={hoje}
            />
          </Cartao>
        ) : (
          <FaixaAlerta
            variante="info"
            titulo="Esta visita não muda mais de dia"
          >
            Ela já começou ou foi encerrada. Para ajustar, fale com a
            coordenação clínica.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
