import "server-only";

/**
 * Ponto de entrada da geração de evoluções em PDF (PRD 9.5, P41). As duas
 * funções validam antes de renderizar: conclusão incoerente, ferida
 * operatória no parto errado, contato médico ausente ou conselho da
 * profissional incompleto bloqueiam a geração e devolvem a lista de erros
 * em vez do PDF (PRD 9.5, "o sistema valida... antes da aprovação").
 *
 * A tela de rascunho e aprovação e o envio por e-mail ficam para a onda B
 * (PROMPTS.md, P41): esta função só gera o PDF e diz se ele pode seguir
 * para aprovação.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { registrarFontesDocumento } from "./fontes";
import { nomeArquivoEvolucao } from "./metadados";
import { EvolucaoPuerperalDocumento } from "./evolucao-puerperal";
import { EvolucaoNeonatalDocumento } from "./evolucao-neonatal";
import type {
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  ResultadoGeracao,
  TextosModelo,
} from "./tipos";
import {
  validarEvolucaoNeonatal,
  validarEvolucaoPuerperal,
} from "./validacoes";

export async function gerarEvolucaoPuerperal(
  dados: DadosEvolucaoPuerperal,
  textos: TextosModelo,
): Promise<ResultadoGeracao> {
  const erros = validarEvolucaoPuerperal(dados);
  if (erros.length > 0) {
    return { ok: false, erros };
  }

  registrarFontesDocumento();
  const buffer = await renderToBuffer(
    EvolucaoPuerperalDocumento({ dados, textos }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  return { ok: true, buffer, nomeArquivo: nomeArquivoEvolucao(dados.id) };
}

export async function gerarEvolucaoNeonatal(
  dados: DadosEvolucaoNeonatal,
  textos: TextosModelo,
): Promise<ResultadoGeracao> {
  const erros = validarEvolucaoNeonatal(dados);
  if (erros.length > 0) {
    return { ok: false, erros };
  }

  registrarFontesDocumento();
  const buffer = await renderToBuffer(
    EvolucaoNeonatalDocumento({ dados, textos }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  return { ok: true, buffer, nomeArquivo: nomeArquivoEvolucao(dados.id) };
}
