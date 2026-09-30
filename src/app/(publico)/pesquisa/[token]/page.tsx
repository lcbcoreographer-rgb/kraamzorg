import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { obterRepositorioPesquisa } from "@/lib/dados/pesquisa";
import type { AberturaPesquisa } from "@/lib/dados/tipos-ocorrencia";
import { configuracaoTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { dividirPrimeiraFrase } from "@/modules/crm/formulario/frases";
import { origemAtual } from "@/modules/crm/formulario/origem";
import { FormularioPesquisa } from "@/modules/operacao/pesquisa/componentes/formulario-pesquisa";
import {
  PESQUISA_SEM_TEXTOS,
  TITULO_PAGINA_PESQUISA,
} from "@/modules/operacao/pesquisa/textos";

// Título sem nome de família (DESIGN.md, microcopy 11); sem indexação e sem
// Referer (o token está no caminho; next.config.ts repete no cabeçalho).
export const metadata: Metadata = {
  title: TITULO_PAGINA_PESQUISA,
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Pesquisa de satisfação da família (P42, PRD 7.4). Sem sessão: o banco confere
 * o token de uso único, a validade, o freio (família em estado sensível não
 * recebe pesquisa) e o limite de tentativas da origem, e devolve só o
 * primeiro nome e os textos aprovados. Nada da família vai para a URL além do
 * token, que vale uma resposta.
 */
export default async function PaginaPesquisa({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let abertura: AberturaPesquisa | null = null;
  try {
    const repositorio = await obterRepositorioPesquisa();
    abertura = await repositorio.abrir(token, await origemAtual());
  } catch {
    abertura = null;
  }

  if (!abertura) return <Aviso texto={PESQUISA_SEM_TEXTOS} />;
  if (abertura.situacao === "invalido") {
    return (
      <Aviso texto={abertura.textos.link_invalido ?? PESQUISA_SEM_TEXTOS} />
    );
  }
  if (abertura.situacao === "limite") {
    return <Aviso texto={abertura.textos.limite ?? PESQUISA_SEM_TEXTOS} />;
  }
  if (abertura.perguntas.length === 0 || !abertura.textos.abertura) {
    return <Aviso texto={PESQUISA_SEM_TEXTOS} />;
  }

  const chaveRascunho = createHash("sha256")
    .update(`pesquisa:${token}`)
    .digest("hex")
    .slice(0, 24);

  return (
    <FormularioPesquisa
      token={token}
      chaveRascunho={chaveRascunho}
      nome={abertura.nome}
      perguntas={abertura.perguntas}
      textos={abertura.textos}
      siteKey={configuracaoTurnstile().siteKey}
    />
  );
}

function Aviso({ texto }: { texto: string }) {
  const { primeira, resto } = dividirPrimeiraFrase(texto);
  return (
    <section className="rounded-3 bg-superficie border-linha flex flex-col gap-4 border p-5">
      <h1 className="font-titulo text-1 text-texto font-normal">{primeira}</h1>
      {resto ? <p className="text-3 text-texto">{resto}</p> : null}
    </section>
  );
}
