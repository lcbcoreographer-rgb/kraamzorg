import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardPen,
  History,
  MessageCircle,
} from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { JanelaManha } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
import { exigirSessao } from "@/lib/auth/sessao";
import type { Transferencia } from "@/lib/dados/tipos";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";
import { cn } from "@/lib/utils";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { fraseAgenda, separarAgenda } from "@/modules/crm/sessao-venda/agenda";
import { CartaoSessao } from "@/modules/crm/sessao-venda/componentes/cartao-sessao";
import {
  listarPedidosDeConversa,
  listarSessoesTela,
  podeConduzirAgenda,
} from "@/modules/crm/sessao-venda/dados";

export const metadata: Metadata = { title: "Sessões de venda · Kraamzorg OS" };

/**
 * Agenda das conversas de orientação (P29 item 4): comercial, coordenação
 * e diretoria veem a agenda; quem marca é o comercial ou a diretoria, a
 * partir dos pedidos de conversa que a Isadora passou (transferência
 * "reuniao", D-15). Dono: P29.
 */
export default async function PaginaSessoesVenda() {
  const sessao = await exigirSessao("/sessoes-venda");
  const podeMarcar = podeConduzirAgenda(sessao);

  let sessoes: SessaoVenda[] | null = null;
  let pedidos: Transferencia[] = [];
  try {
    [sessoes, pedidos] = await Promise.all([
      listarSessoesTela(),
      podeMarcar ? listarPedidosDeConversa().catch(() => []) : [],
    ]);
  } catch {
    sessoes = null;
  }

  if (!sessoes) {
    return (
      <>
        <CabecalhoTela titulo="Sessões de venda" />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="A agenda não abriu agora">
            Confira a conexão e recarregue a página. Nenhuma conversa foi
            alterada.
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const agora = new Date();
  const hoje = hojeBrasilia(agora);
  const agenda = separarAgenda(sessoes, agora);

  return (
    <>
      <CabecalhoTela titulo="Sessões de venda" />
      {/* A frase da agenda num bloco de tempo (DESIGN.md, 2.5: lavanda é a
          agenda), com o calendário num tile: é a primeira coisa que a
          pessoa lê ao abrir a tela. */}
      <div className="rounded-3 bg-lavanda-media mt-3 flex items-start gap-4 p-5 lg:p-6">
        <TileIcone tom="branco" forma="quadrado" tamanho="g">
          <CalendarDays />
        </TileIcone>
        <p className="text-3 text-texto max-w-leitura self-center">
          {fraseAgenda(agenda, agora)}
        </p>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-10 pt-8",
          pedidos.length > 0 && "lg:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-10">
          {agenda.pedemRegistro.length > 0 ? (
            <SecaoBloco
              idTitulo="pedem-registro"
              titulo="Esperam o registro de como foi"
              icone={<ClipboardPen />}
              tom="dourado"
              contagem={agenda.pedemRegistro.length}
            >
              <ul className="flex flex-col gap-2">
                {agenda.pedemRegistro.map((s) => (
                  <li key={s.id}>
                    <CartaoSessao sessao={s} hoje={hoje} mostrarDia />
                  </li>
                ))}
              </ul>
            </SecaoBloco>
          ) : null}

          <SecaoBloco
            idTitulo="proximas"
            titulo="Próximas conversas"
            icone={<CalendarDays />}
            tom="lavanda"
          >
            {agenda.proximas.length === 0 ? (
              <EstadoVazio
                nivelTitulo="h3"
                ilustracao={<JanelaManha tamanho={104} />}
                titulo="Nenhuma conversa marcada"
                texto={
                  podeMarcar
                    ? "Quando a Isadora passar um pedido de conversa, ele aparece nesta tela com os horários que a família sugeriu, pronto para marcar."
                    : "Quando o comercial marcar uma conversa de orientação, ela aparece aqui com o dia, a hora e quem conduz."
                }
              />
            ) : (
              <div className="flex flex-col gap-6">
                {agenda.proximas.map((grupo) => (
                  <div key={grupo.dia} className="flex flex-col gap-2">
                    {/* O dia de hoje ganha a pílula dourada (o agora);
                        os outros dias ficam só no título. */}
                    <h3
                      className={cn(
                        "text-3 text-texto w-fit font-semibold",
                        grupo.dia === hoje &&
                          "rounded-pilula bg-dourado-claro px-3.5 py-1",
                      )}
                    >
                      {grupo.titulo}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {grupo.sessoes.map((s) => (
                        <li key={s.id}>
                          <CartaoSessao sessao={s} hoje={hoje} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </SecaoBloco>

          {agenda.anteriores.length > 0 ? (
            <SecaoBloco
              idTitulo="anteriores"
              titulo="Conversas anteriores"
              icone={<History />}
              tom="areia"
              contagem={agenda.anteriores.length}
            >
              <ul className="flex flex-col gap-2">
                {agenda.anteriores.map((s) => (
                  <li key={s.id}>
                    <CartaoSessao
                      sessao={s}
                      hoje={hoje}
                      mostrarDia
                      fundo="tom"
                    />
                  </li>
                ))}
              </ul>
            </SecaoBloco>
          ) : null}
        </div>

        {pedidos.length > 0 ? (
          <aside className="-order-1 lg:order-none">
            <SecaoBloco
              idTitulo="pedidos"
              titulo="Pedidos de conversa"
              icone={<MessageCircle />}
              tom="argila"
              contagem={pedidos.length}
            >
              <ul className="flex flex-col gap-2">
                {pedidos.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-3 bg-argila-clara flex flex-col gap-3 p-5"
                  >
                    <p className="text-3 text-texto font-semibold">
                      {t.nomeFamilia ?? "Família sem nome no cadastro"}
                    </p>
                    <p className="text-corpo text-texto">{t.resumo}</p>
                    <Botao asChild tamanho="compacto" className="self-start">
                      <Link href={`/sessoes-venda/nova?transferencia=${t.id}`}>
                        Marcar a conversa
                      </Link>
                    </Botao>
                  </li>
                ))}
              </ul>
            </SecaoBloco>
          </aside>
        ) : null}
      </div>
    </>
  );
}
