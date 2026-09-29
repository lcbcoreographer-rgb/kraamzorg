import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
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
      <p className="text-3 text-texto max-w-leitura mt-3">
        {fraseAgenda(agenda, agora)}
      </p>

      <div
        className={cn(
          "grid grid-cols-1 gap-8 pt-6",
          pedidos.length > 0 && "lg:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-8">
          {agenda.pedemRegistro.length > 0 ? (
            <section
              aria-labelledby="pedem-registro"
              className="flex flex-col gap-3"
            >
              <h2
                id="pedem-registro"
                className="font-titulo text-2 text-texto font-medium"
              >
                Esperam o registro de como foi
              </h2>
              <ul className="flex flex-col gap-3">
                {agenda.pedemRegistro.map((s) => (
                  <li key={s.id}>
                    <CartaoSessao sessao={s} hoje={hoje} mostrarDia />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="proximas" className="flex flex-col gap-4">
            <h2
              id="proximas"
              className="font-titulo text-2 text-texto font-medium"
            >
              Próximas conversas
            </h2>
            {agenda.proximas.length === 0 ? (
              <EstadoVazio
                nivelTitulo="h3"
                titulo="Nenhuma conversa marcada"
                texto={
                  podeMarcar
                    ? "Quando a Isadora passar um pedido de conversa, ele aparece nesta tela com os horários que a família sugeriu, pronto para marcar."
                    : "Quando o comercial marcar uma conversa de orientação, ela aparece aqui com o dia, a hora e quem conduz."
                }
              />
            ) : (
              agenda.proximas.map((grupo) => (
                <div key={grupo.dia} className="flex flex-col gap-2">
                  <h3
                    className={cn(
                      "text-3 text-texto font-semibold",
                      grupo.dia === hoje && "border-dourado border-l-2 pl-3",
                    )}
                  >
                    {grupo.titulo}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {grupo.sessoes.map((s) => (
                      <li key={s.id}>
                        <CartaoSessao sessao={s} hoje={hoje} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {agenda.anteriores.length > 0 ? (
            <section
              aria-labelledby="anteriores"
              className="flex flex-col gap-3"
            >
              <h2
                id="anteriores"
                className="font-titulo text-2 text-texto font-medium"
              >
                Conversas anteriores
              </h2>
              <ul className="flex flex-col gap-3">
                {agenda.anteriores.map((s) => (
                  <li key={s.id}>
                    <CartaoSessao sessao={s} hoje={hoje} mostrarDia />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {pedidos.length > 0 ? (
          <aside
            aria-labelledby="pedidos"
            className="-order-1 flex flex-col gap-3 lg:order-none"
          >
            <h2
              id="pedidos"
              className="font-titulo text-2 text-texto font-medium"
            >
              Pedidos de conversa
            </h2>
            <ul className="flex flex-col gap-3">
              {pedidos.map((t) => (
                <li
                  key={t.id}
                  className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
                >
                  <p className="text-3 text-texto font-semibold">
                    {t.nomeFamilia ?? "Família sem nome no cadastro"}
                  </p>
                  <p className="text-corpo text-texto-2">{t.resumo}</p>
                  <Botao asChild tamanho="compacto" className="self-start">
                    <Link href={`/sessoes-venda/nova?transferencia=${t.id}`}>
                      Marcar a conversa
                    </Link>
                  </Botao>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </>
  );
}
