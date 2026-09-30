import "server-only";
import { obterArmazenamento, SEGUNDOS_URL_ASSINADA } from "@/lib/armazenamento";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { renderizarEvolucao, type ConteudoEvolucao } from "@/lib/pdf";
import { z } from "zod";
import { resolverDocumento } from "./documento";

/**
 * Abre o PDF de uma evolução (P41). O documento enviado sai do storage
 * privado por URL assinada de 60 segundos (na demonstração, os bytes saem
 * daqui). Antes do envio, "prévia" imprime o conteúdo salvo na hora, sem
 * guardar nada. A permissão vem do banco (`api.evolucao`, `api.pdf_evolucao`):
 * a enfermeira só abre o dos acompanhamentos dela. Nunca em cache; o nome do
 * arquivo é o id do documento.
 */
const CABECALHOS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

function resposta(texto: string, status: number): Response {
  return new Response(texto, { status, headers: CABECALHOS });
}

export async function abrirPdfEvolucao(
  acompanhamentoId: string,
  documento: string,
  previa: boolean,
): Promise<Response> {
  if (
    !z.uuid().safeParse(acompanhamentoId).success ||
    !/^(puerperal|bebe-[1-9])$/.test(documento)
  ) {
    return resposta("Não encontrado.", 404);
  }
  const sessao = await obterSessao();
  if (!sessao) return resposta("Entre para abrir o documento.", 401);
  if (sessao.aal !== "aal2") {
    return resposta(
      "Confirme o código do aplicativo para abrir o documento.",
      403,
    );
  }

  try {
    const { evolucoes } = await obterRepositorios();
    const base = await evolucoes.base(acompanhamentoId);
    const ref = resolverDocumento(documento, base.bebes);
    const existente = ref
      ? base.relatorios.find(
          (r) => r.tipo === ref.tipo && r.bebeId === ref.bebeId,
        )
      : undefined;
    if (!existente)
      return resposta("Este documento ainda não foi montado.", 404);
    const detalhe = await evolucoes.obter(existente.id);

    if (!previa && detalhe.temPdf) {
      const caminho = await evolucoes.caminhoPdf(existente.id);
      const arquivo = await obterArmazenamento().abrir(
        caminho,
        SEGUNDOS_URL_ASSINADA,
      );
      if (!arquivo) return resposta("O arquivo não foi encontrado.", 404);
      if (arquivo.tipo === "url") {
        return new Response(null, {
          status: 302,
          headers: { ...CABECALHOS, Location: arquivo.url },
        });
      }
      return new Response(new Uint8Array(arquivo.bytes), {
        status: 200,
        headers: {
          ...CABECALHOS,
          "Content-Type": arquivo.contentType,
          "Content-Disposition": `inline; filename="${existente.id}.pdf"`,
        },
      });
    }

    const conteudo = detalhe.conteudo.conteudo as ConteudoEvolucao | null;
    if (!conteudo) {
      return resposta(
        "O documento ainda tem pontos a corrigir e não pode virar PDF.",
        409,
      );
    }
    const gerado = await renderizarEvolucao(existente.id, conteudo);
    if (!gerado.ok) {
      return resposta("O PDF não pôde ser gerado com este conteúdo.", 409);
    }
    return new Response(new Uint8Array(gerado.buffer), {
      status: 200,
      headers: {
        ...CABECALHOS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${gerado.nomeArquivo}"`,
      },
    });
  } catch {
    return resposta("Sem permissão para abrir este documento.", 403);
  }
}
