import "server-only";

/**
 * Geração do PDF do contrato (P31 item 1): monta o conteúdo a partir do
 * modelo e dos dados (`contrato-conteudo.ts`) e imprime em A4. Recusa,
 * sem PDF, modelo sem cláusula, variável sem valor e travessão. O resumo
 * sha256 vai para o log de auditoria (`api.registrar_contrato_gerado`),
 * nunca o conteúdo.
 */
import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DadosParaContrato } from "@/lib/dados/tipos-contrato";
import { montarConteudoContrato } from "./contrato-conteudo";
import { DocumentoContrato, nomeArquivoContrato } from "./contrato-documento";
import { registrarFontesDocumento } from "./fontes";

export type ResultadoContratoPdf =
  | { ok: true; buffer: Buffer; sha256: string; nomeArquivo: string }
  | { ok: false; erros: string[] };

export async function gerarPdfContrato(
  dados: DadosParaContrato,
  agora: Date = new Date(),
): Promise<ResultadoContratoPdf> {
  const montado = montarConteudoContrato(dados, agora);
  if (!montado.ok) return montado;

  const nomeArquivo = nomeArquivoContrato(dados.contrato.id);
  registrarFontesDocumento();
  const buffer = await renderToBuffer(
    DocumentoContrato({ conteudo: montado.conteudo }) as Parameters<
      typeof renderToBuffer
    >[0],
  );
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { ok: true, buffer, sha256, nomeArquivo };
}
