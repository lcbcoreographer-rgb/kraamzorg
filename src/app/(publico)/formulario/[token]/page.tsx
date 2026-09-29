import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { obterRepositorioFormulario } from "@/lib/dados/formulario";
import type { AberturaFormulario } from "@/lib/dados/tipos-venda";
import { configuracaoTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { FormularioContrato } from "@/modules/crm/formulario/componentes/formulario-contrato";
import { dividirPrimeiraFrase } from "@/modules/crm/formulario/frases";
import { origemAtual } from "@/modules/crm/formulario/origem";
import {
  FORMULARIO_SEM_TEXTOS,
  TITULO_PAGINA,
} from "@/modules/crm/formulario/textos";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";

// Título sem nome de família (DESIGN.md, microcopy 11); sem indexação e
// sem Referer (o token está no caminho; next.config.ts repete no cabeçalho).
export const metadata: Metadata = {
  title: TITULO_PAGINA,
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Formulário seguro do contrato (P30 item 2, PRD 21.3). Sem sessão: o
 * banco confere o token de uso único, a validade e o limite de tentativas
 * da origem, e devolve só o primeiro nome e os textos aprovados. Nada da
 * família vai para a URL além do token, que vale uma vez.
 */
export default async function PaginaFormularioContrato({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let abertura: AberturaFormulario | null = null;
  try {
    const repositorio = await obterRepositorioFormulario();
    abertura = await repositorio.abrir(token, await origemAtual());
  } catch {
    abertura = null;
  }

  if (!abertura) {
    return <Aviso texto={FORMULARIO_SEM_TEXTOS} />;
  }
  if (abertura.situacao === "invalido") {
    return (
      <Aviso texto={abertura.textos.link_invalido ?? FORMULARIO_SEM_TEXTOS} />
    );
  }
  if (abertura.situacao === "limite") {
    return <Aviso texto={abertura.textos.limite ?? FORMULARIO_SEM_TEXTOS} />;
  }
  if (!abertura.textos.abertura || !abertura.termoVersao) {
    return <Aviso texto={FORMULARIO_SEM_TEXTOS} />;
  }

  const chaveRascunho = createHash("sha256")
    .update(`rascunho:${token}`)
    .digest("hex")
    .slice(0, 24);

  return (
    <FormularioContrato
      token={token}
      chaveRascunho={chaveRascunho}
      textos={abertura.textos}
      pedePagador={abertura.pedePagador}
      nomeTestemunha={abertura.nomeTestemunha}
      siteKey={configuracaoTurnstile().siteKey}
      hoje={hojeBrasilia()}
    />
  );
}

function Aviso({ texto }: { texto: string }) {
  const { primeira, resto } = dividirPrimeiraFrase(texto);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-titulo text-1 text-texto font-normal">{primeira}</h1>
      {resto ? <p className="text-3 text-texto">{resto}</p> : null}
    </section>
  );
}
