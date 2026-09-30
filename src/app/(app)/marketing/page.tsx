import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { obterTelaMarketing } from "@/modules/marketing/dados";
import { periodoDaBusca } from "@/modules/marketing/periodo";
import { FormularioCusto } from "@/modules/marketing/componentes/form-custo";
import { GeradorLinks } from "@/modules/marketing/componentes/gerador-links";
import { RelatorioMarketingTela } from "@/modules/marketing/componentes/relatorio-marketing";

export const metadata: Metadata = { title: "Marketing · Kraamzorg OS" };

/**
 * Marketing, atribuição e página de captação (P47): os links por canal com o
 * código de origem, o relatório de leads, receita e custo por origem e por
 * canal, o custo do mês (vindo do financeiro) e a exportação de famílias
 * elegíveis. Cada bloco aparece conforme o papel (PRD 13).
 */
export default async function PaginaMarketing({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; ate?: string }>;
}) {
  const usuario = await exigirSessao("/marketing");
  const periodo = periodoDaBusca(await searchParams);

  let tela: Awaited<ReturnType<typeof obterTelaMarketing>> | null = null;
  try {
    tela = await obterTelaMarketing(usuario, periodo);
  } catch {
    tela = null;
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Marketing
        </h1>
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          De onde as famílias chegam, quanto cada canal custou e o que virou
          contrato.
        </p>
      </div>

      {!tela ? (
        <FaixaAlerta variante="erro" titulo="O marketing não abriu agora">
          Confira a conexão e recarregue a página. Nada foi alterado.
        </FaixaAlerta>
      ) : tela.situacao === "mfa" ? (
        <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
          <p className="text-corpo text-texto flex items-start gap-3">
            <LockKeyhole
              className="text-texto-2 mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            O marketing mostra receita e custo, por isso pede o código do
            aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/marketing")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : (
        <>
          {tela.relatorio ? (
            <section
              aria-labelledby="relatorio"
              className="flex flex-col gap-4"
            >
              <h2
                id="relatorio"
                className="font-titulo text-1 text-texto font-normal"
              >
                Leads, receita e custo
              </h2>
              <RelatorioMarketingTela
                relatorio={tela.relatorio}
                periodo={tela.periodo}
              />
            </section>
          ) : null}

          {tela.canais ? (
            <section aria-labelledby="links" className="flex flex-col gap-4">
              <h2
                id="links"
                className="font-titulo text-1 text-texto font-normal"
              >
                Links por canal
              </h2>
              <p className="text-corpo text-texto-2 max-w-[64ch]">
                Cada canal tem um código que vai no texto da primeira mensagem.
                Quando a família escreve, a origem já entra certa no cadastro.
              </p>
              <GeradorLinks
                canais={tela.canais}
                enderecoBase={tela.enderecoBase}
              />
            </section>
          ) : null}

          {tela.podeLancarCusto && tela.relatorio ? (
            <section aria-labelledby="custo" className="flex flex-col gap-4">
              <h2
                id="custo"
                className="font-titulo text-1 text-texto font-normal"
              >
                Custo por canal
              </h2>
              <FormularioCusto
                canais={tela.relatorio.porCanal.map((c) => ({
                  id: c.canalId,
                  rotulo: `${c.nome} (${c.codigo})`,
                }))}
                mesAtual={hojeBrasilia().slice(0, 7)}
              />
            </section>
          ) : null}

          {tela.podeExportar ? (
            <section aria-labelledby="exportar" className="flex flex-col gap-3">
              <h2
                id="exportar"
                className="font-titulo text-1 text-texto font-normal"
              >
                Exportar famílias
              </h2>
              <p className="text-corpo text-texto-2 max-w-[64ch]">
                O arquivo traz só famílias que podem receber contato de
                marketing: sem estado sensível e sem quem pediu para não ser
                contatada. Nunca leva endereço nem histórico de saúde.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <a
                  href={`/marketing/exportar${tela.periodo.desde || tela.periodo.ate ? `?desde=${tela.periodo.desde ?? ""}&ate=${tela.periodo.ate ?? ""}` : ""}`}
                >
                  Baixar arquivo CSV
                </a>
              </Botao>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
