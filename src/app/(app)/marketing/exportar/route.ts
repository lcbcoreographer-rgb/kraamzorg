import { obterSessao } from "@/lib/auth/sessao";
import { decidirAcesso } from "@/lib/auth/acesso";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { csvDaExportacao } from "@/modules/marketing/csv";
import { periodoDaBusca } from "@/modules/marketing/periodo";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";

/**
 * Exportação de marketing em CSV (P47 item 3). Só famílias de
 * familia_elegivel_marketing, por api.marketing_exportar (marketing e
 * diretoria); o banco grava a exportação no log com a contagem e o período.
 * O nome do arquivo leva só a data, nunca nome de família.
 */
export async function GET(requisicao: Request) {
  const sessao = await obterSessao();
  if (!sessao || decidirAcesso("/marketing", sessao).tipo !== "seguir") {
    return new Response("Entre com a sua conta para baixar o arquivo.", {
      status: 401,
    });
  }
  const url = new URL(requisicao.url);
  const periodo = periodoDaBusca({
    desde: url.searchParams.get("desde") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
  });
  try {
    const { relacao } = await obterRepositorios();
    const exportacao = await relacao.marketing.exportar(periodo);
    return new Response(csvDaExportacao(exportacao.linhas), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="familias-marketing-${hojeBrasilia()}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return new Response("Seu perfil não exporta famílias.", { status: 403 });
    }
    return new Response(
      "Não deu para gerar o arquivo agora. Tente de novo em instantes.",
      { status: 500 },
    );
  }
}
