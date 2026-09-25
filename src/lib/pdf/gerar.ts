import "server-only";

/**
 * Ponto de entrada da geração de evoluções em PDF (PRD 9.5, P41). Três
 * passos, na ordem:
 *
 * 1. `validar*`: conclusão incoerente, datas fora do período, ferida
 *    operatória no parto errado, contato médico ausente ou conselho da
 *    profissional incompleto bloqueiam (PRD 9.5, "o sistema valida... antes
 *    da aprovação").
 * 2. `montarConteudo*`: monta o texto a partir dos dados e dos modelos
 *    aprovados; texto que falta em `mensagem_modelo`, variável sem
 *    preencher ou travessão também bloqueiam, com a causa.
 * 3. `renderizarEvolucao`: imprime o conteúdo em PDF A4.
 *
 * A onda B usa os passos soltos (montar o rascunho, deixar a enfermeira
 * editar, aprovar e só então renderizar); `gerarEvolucao*` junta os três
 * para o caso sem edição e para o teste de aceite.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { auditarConteudo, type ConteudoEvolucao } from "./conteudo";
import { montarConteudoNeonatal } from "./conteudo-neonatal";
import { montarConteudoPuerperal } from "./conteudo-puerperal";
import { DocumentoEvolucao } from "./documento";
import { registrarFontesDocumento } from "./fontes";
import { nomeArquivoEvolucao } from "./metadados";
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

/** Imprime um conteúdo já montado (e, na onda B, editado e aprovado). Recusa conteúdo com travessão ou variável sem preencher. */
export async function renderizarEvolucao(
  id: string,
  conteudo: ConteudoEvolucao,
): Promise<ResultadoGeracao> {
  const problemas = auditarConteudo(conteudo);
  if (problemas.length > 0) return { ok: false, erros: problemas };

  const nomeArquivo = nomeArquivoEvolucao(id);
  registrarFontesDocumento();
  const buffer = await renderToBuffer(
    DocumentoEvolucao({ conteudo }) as Parameters<typeof renderToBuffer>[0],
  );
  return { ok: true, buffer, nomeArquivo };
}

type ResultadoConteudo =
  { ok: true; conteudo: ConteudoEvolucao } | { ok: false; erros: string[] };

function montarComSeguranca(montar: () => ConteudoEvolucao): ResultadoConteudo {
  try {
    return { ok: true, conteudo: montar() };
  } catch (erro) {
    // Falta de texto aprovado ou de variável: erro de configuração que a
    // coordenação resolve no cadastro de mensagens, não queda da rota.
    return {
      ok: false,
      erros: [erro instanceof Error ? erro.message : String(erro)],
    };
  }
}

/** Rascunho da evolução puerperal: valida e monta, sem imprimir. */
export function rascunhoEvolucaoPuerperal(
  dados: DadosEvolucaoPuerperal,
  textos: TextosModelo,
): ResultadoConteudo {
  const erros = validarEvolucaoPuerperal(dados);
  if (erros.length > 0) return { ok: false, erros };
  return montarComSeguranca(() => montarConteudoPuerperal(dados, textos));
}

/** Rascunho da evolução neonatal (uma por bebê): valida e monta, sem imprimir. */
export function rascunhoEvolucaoNeonatal(
  dados: DadosEvolucaoNeonatal,
  textos: TextosModelo,
): ResultadoConteudo {
  const erros = validarEvolucaoNeonatal(dados);
  if (erros.length > 0) return { ok: false, erros };
  return montarComSeguranca(() => montarConteudoNeonatal(dados, textos));
}

export async function gerarEvolucaoPuerperal(
  dados: DadosEvolucaoPuerperal,
  textos: TextosModelo,
): Promise<ResultadoGeracao> {
  const rascunho = rascunhoEvolucaoPuerperal(dados, textos);
  if (!rascunho.ok) return rascunho;
  return renderizarEvolucao(dados.id, rascunho.conteudo);
}

export async function gerarEvolucaoNeonatal(
  dados: DadosEvolucaoNeonatal,
  textos: TextosModelo,
): Promise<ResultadoGeracao> {
  const rascunho = rascunhoEvolucaoNeonatal(dados, textos);
  if (!rascunho.ok) return rascunho;
  return renderizarEvolucao(dados.id, rascunho.conteudo);
}
