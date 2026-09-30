import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  OctagonPause,
} from "lucide-react";
import { z } from "zod";
import { FolhaLupa } from "@/components/ilustracoes";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import { exigirSessao } from "@/lib/auth/sessao";
import { cn } from "@/lib/utils";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { quandoEmFrase } from "@/modules/crm/sessao-venda/agenda";
import { FormularioAgendar } from "@/modules/crm/sessao-venda/componentes/formulario-agendar";
import {
  obterDadosAgendar,
  podeConduzirAgenda,
  type DadosAgendar,
} from "@/modules/crm/sessao-venda/dados";

export const metadata: Metadata = {
  title: "Marcar conversa de orientação · Kraamzorg OS",
};

type Pesquisa = Record<string, string | string[] | undefined>;

function um(valor: string | string[] | undefined): string | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && z.uuid().safeParse(texto).success ? texto : null;
}

/**
 * Marcar a conversa de orientação (P29 item 1), a partir da transferência
 * "reuniao" (com as opções que a família passou) ou da ficha da família.
 * Mostra o estágio do pipeline de agora e o que muda ao marcar.
 */
export default async function PaginaNovaSessao({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  const sessao = await exigirSessao("/sessoes-venda");
  if (!podeConduzirAgenda(sessao)) redirect("/sessoes-venda");
  const pesquisa = await searchParams;
  const transferenciaId = um(pesquisa.transferencia);
  const familiaId = um(pesquisa.familia);

  let dados: DadosAgendar | null = null;
  let falhou = false;
  try {
    dados = await obterDadosAgendar({ transferenciaId, familiaId });
  } catch {
    falhou = true;
  }

  const voltar = (
    <Link
      href="/sessoes-venda"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Sessões de venda
    </Link>
  );

  if (falhou || !dados) {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Marcar conversa
          </h1>
          {falhou ? (
            <FaixaAlerta
              variante="erro"
              titulo="Os dados da família não abriram agora"
            >
              Confira a conexão e recarregue a página. Nada foi marcado.
            </FaixaAlerta>
          ) : (
            <EstadoVazio
              nivelTitulo="h2"
              ilustracao={<FolhaLupa tamanho={104} />}
              titulo="Escolha a família primeiro"
              texto="A conversa é marcada a partir de um pedido de conversa da Isadora, na agenda, ou do botão Marcar conversa na ficha da família."
              acao={
                <Botao asChild variante="secundario" tamanho="compacto">
                  <Link href="/sessoes-venda">Ver os pedidos de conversa</Link>
                </Botao>
              }
            />
          )}
        </div>
      </>
    );
  }

  const { familia, transferencia, condutores, marcada } = dados;
  const sensivel =
    familia.estadoSensivel === "bloqueio_total" ||
    familia.estadoSensivel === "encerrado_sensivel";
  const opcoes = transferencia?.opcoes ?? [];

  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        {/* A família num bloco macio (direção "Colo"); com o freio, branco
            e sem tom (DESIGN.md, 11.8). */}
        <header
          className={cn(
            "rounded-3 flex flex-col gap-3 p-5 lg:px-8 lg:py-6",
            sensivel ? "bg-superficie border-linha border" : "bg-superficie-2",
          )}
        >
          <h1 className="font-titulo text-1 text-texto font-normal">
            Conversa de orientação com a {familia.nome}
          </h1>
          <div className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {familia.estagioRotulo && !sensivel ? (
              <Selo variante="marinho">{familia.estagioRotulo}</Selo>
            ) : null}
            {familia.idadeGestacional && !sensivel ? (
              <span className="text-corpo text-texto font-mono">
                {familia.idadeGestacional}
              </span>
            ) : null}
          </div>
          {opcoes.length > 0 && !sensivel ? (
            <p className="rounded-2 bg-lavanda-clara text-corpo text-texto max-w-leitura flex items-start gap-3 p-3 pr-4">
              <CalendarDays
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
                strokeWidth={1.75}
              />
              <span>A família sugeriu à Isadora: {opcoes.join(" ou ")}.</span>
            </p>
          ) : null}
        </header>

        {sensivel ? (
          <FaixaAlerta
            variante="sensivel"
            titulo="Esta família está com o freio acionado"
          >
            Nenhuma conversa de venda é marcada enquanto o freio estiver ativo.
            O contato é da coordenação, pelo nome.
          </FaixaAlerta>
        ) : familia.naoContatar ? (
          <FaixaAlerta
            variante="prioritario"
            titulo="A família pediu para não ser contatada"
          >
            Nenhuma conversa é marcada para ela.
          </FaixaAlerta>
        ) : marcada?.agendadaPara ? (
          <FaixaAlerta
            variante="info"
            titulo={`Esta família já tem conversa marcada ${quandoEmFrase(marcada.agendadaPara)}`}
            acoes={
              <Botao asChild variante="secundario" tamanho="compacto">
                <Link href={`/sessoes-venda/${marcada.id}`}>
                  Abrir a conversa marcada
                </Link>
              </Botao>
            }
          >
            Para mudar o dia ou o horário, abra a conversa e use Remarcar.
          </FaixaAlerta>
        ) : (
          <section
            aria-labelledby="marcar"
            className="rounded-3 bg-superficie shadow-1 flex max-w-[680px] flex-col gap-4 p-5 lg:p-6"
          >
            <h2
              id="marcar"
              className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
            >
              <TileIcone tom="lavanda" forma="quadrado">
                <CalendarClock />
              </TileIcone>
              Quando e com quem
            </h2>
            {familia.pipeline === 1 && familia.estagioRotulo ? (
              <p className="text-corpo text-texto-2">
                Ao marcar, a família passa para Sessão agendada no pipeline e o
                lembrete da véspera entra nas tarefas, com o link da reunião.
              </p>
            ) : null}
            <FormularioAgendar
              modo="marcar"
              familiaId={familia.familiaId}
              transferenciaId={transferencia?.id ?? null}
              opcoes={opcoes.length > 0 ? opcoes.join(" ou ") : null}
              condutores={condutores}
              hoje={hojeBrasilia()}
            />
          </section>
        )}
        {sensivel ? (
          <p className="text-corpo text-texto-2 flex items-center gap-2">
            <OctagonPause
              className="text-sensivel size-4"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            Nenhuma mensagem automática sai para esta família.
          </p>
        ) : null}
      </div>
    </>
  );
}
