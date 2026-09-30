import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/formatacao";
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
        <div className="rounded-3 bg-superficie-2 flex flex-col gap-1 p-5">
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

        {v.movivel ? (
          <PainelReagendar
            visitaId={v.visitaId}
            acompanhamentoId={v.acompanhamentoId}
            dataAtual={v.data}
            horaAtual={v.horaPrevista}
            profissionalAtualId={v.profissionalId}
            profissionais={profissionais}
            hoje={hoje}
          />
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
