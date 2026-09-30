import "server-only";
import { headers } from "next/headers";
import { exigeMfa } from "@/lib/auth/papeis";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  CanaisMarketing,
  FiltroPeriodo,
  RelatorioMarketing,
} from "@/lib/dados/tipos-relacao";

/**
 * Dados da tela de marketing (P47). Cada bloco pergunta ao banco com o
 * papel de quem abriu: marketing e diretoria veem os canais e os links;
 * marketing, diretoria e financeiro veem o relatório; financeiro e diretoria
 * lançam o custo. O que o papel não pode ver volta nulo, sem erro na tela.
 */
export type TelaMarketing =
  | { situacao: "mfa" }
  | {
      situacao: "ok";
      periodo: FiltroPeriodo;
      canais: CanaisMarketing | null;
      relatorio: RelatorioMarketing | null;
      podeLancarCusto: boolean;
      podeExportar: boolean;
      enderecoBase: string;
    };

async function enderecoDoApp(): Promise<string> {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const protocolo =
    cabecalhos.get("x-forwarded-proto") ??
    (host?.startsWith("127.0.0.1") || host?.startsWith("localhost")
      ? "http"
      : "https");
  return `${protocolo}://${host ?? "localhost"}`;
}

async function ouNulo<T>(chamada: () => Promise<T>): Promise<T | null> {
  try {
    return await chamada();
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return null;
    }
    throw erro;
  }
}

export async function obterTelaMarketing(
  usuario: SessaoUsuario,
  periodo: FiltroPeriodo,
): Promise<TelaMarketing> {
  if (exigeMfa(usuario.papeis) && usuario.aal !== "aal2") {
    return { situacao: "mfa" };
  }
  const { relacao } = await obterRepositorios();
  const [canais, relatorio] = await Promise.all([
    ouNulo(() => relacao.marketing.canais()),
    ouNulo(() => relacao.marketing.relatorio(periodo)),
  ]);
  return {
    situacao: "ok",
    periodo,
    canais,
    relatorio,
    podeLancarCusto:
      usuario.papeis.includes("financeiro") ||
      usuario.papeis.includes("diretoria"),
    podeExportar:
      usuario.papeis.includes("marketing") ||
      usuario.papeis.includes("diretoria"),
    enderecoBase: await enderecoDoApp(),
  };
}
