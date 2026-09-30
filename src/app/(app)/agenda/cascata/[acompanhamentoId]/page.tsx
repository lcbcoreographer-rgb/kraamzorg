import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarSync } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FolhaLupa, MantaDobrada } from "@/components/ilustracoes";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import { PainelCascata } from "@/modules/operacao/equipe/componentes/painel-cascata";
import {
  carregarCascata,
  type DadosCascata,
} from "@/modules/operacao/equipe/dados";

export const metadata: Metadata = {
  title: "Reagendar as visitas · Kraamzorg OS",
};

/**
 * Reagendamento em cascata (P37 item 4): nascimento ou alta mudaram, as
 * visitas que faltam andam juntas, no mesmo horário e período.
 */
export default async function PaginaCascata({
  params,
}: {
  params: Promise<{ acompanhamentoId: string }>;
}) {
  await exigirSessao("/agenda");
  const { acompanhamentoId } = await params;
  if (!z.uuid().safeParse(acompanhamentoId).success) notFound();

  let dados: DadosCascata | null = null;
  let falhou = false;
  try {
    dados = await carregarCascata(acompanhamentoId);
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

  return (
    <>
      <CabecalhoTela
        titulo="Mudar todas as visitas"
        subtitulo={
          dados
            ? `${dados.nomeFamilia}. As visitas que ainda não começaram andam juntas.`
            : undefined
        }
      />
      {voltar}
      <div className="max-w-leitura pt-4">
        {falhou ? (
          <FaixaAlerta variante="erro" titulo="As visitas não abriram agora">
            Nada foi alterado. Recarregue a página; se continuar, avise a equipe
            técnica.
          </FaixaAlerta>
        ) : !dados ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<FolhaLupa tamanho={112} />}
            titulo="Não achamos visitas para esta família"
            texto="Elas podem estar fora dos dias que a agenda mostra. Volte à agenda e abra de novo."
          />
        ) : dados.primeiraDataPendente === null ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<MantaDobrada tamanho={112} />}
            titulo="Nenhuma visita pendente"
            texto="Todas as visitas desta família já começaram ou foram encerradas, então não há o que mudar de dia."
          />
        ) : (
          <Cartao className="flex flex-col gap-5">
            <TituloSecao
              icone={<CalendarSync />}
              tom="lavanda"
              titulo="O novo primeiro dia"
            />
            <PainelCascata
              acompanhamentoId={acompanhamentoId}
              primeiraDataPendente={dados.primeiraDataPendente}
              hoje={dados.hoje}
            />
          </Cartao>
        )}
      </div>
    </>
  );
}
