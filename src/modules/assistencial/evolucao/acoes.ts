"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obterArmazenamento } from "@/lib/armazenamento";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { ConteudoSalvo } from "@/lib/dados/tipos-evolucao";
import { obterEmail } from "@/lib/integracoes/fabrica";
import { aplicarFormulario } from "./campos";
import { previaDoDocumento } from "./dados";
import { resolverDocumento } from "./documento";
import { enviarEvolucao } from "./envio";
import type { EstadoAcaoEvolucao } from "./estado-acoes";
import { fraseErroEvolucao } from "./mensagens";
import { montar } from "./montar";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

const esquemaId = z.uuid();
const esquemaSlug = z.string().regex(/^(puerperal|bebe-[1-9])$/);
const FRASE_TELA_VELHA = "Atualize a tela e tente de novo.";

function revalidar(): void {
  revalidatePath("/evolucoes", "layout");
  revalidatePath("/minhas-evolucoes", "layout");
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}

/** O e-mail só é criado na hora de enviar: sem credencial, o motivo volta como falha do envio. */
function emailSobDemanda() {
  return {
    ambienteDeTeste: modoDados() === "demonstracao",
    enviar: (entrada: Parameters<ReturnType<typeof obterEmail>["enviar"]>[0]) =>
      obterEmail().enviar(entrada),
  };
}

async function enviarPeloRepositorio(relatorioId: string) {
  const { evolucoes } = await obterRepositorios();
  return enviarEvolucao(relatorioId, {
    evolucoes,
    email: emailSobDemanda(),
    armazenamento: obterArmazenamento(),
  });
}

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

/**
 * Monta o rascunho de um documento com o que o checklist e os cadastros já
 * trazem, mais a conclusão sugerida pelo período (a enfermeira confirma ou
 * troca). O documento nasce com a lista do que ainda falta, se faltar algo.
 */
export async function acaoMontarEvolucao(
  acompanhamentoId: string,
  documento: string,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(acompanhamentoId);
  const slug = esquemaSlug.safeParse(documento);
  if (!id.success || !slug.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { evolucoes } = await obterRepositorios();
    const base = await evolucoes.base(id.data);
    const ref = resolverDocumento(slug.data, base.bebes);
    if (!ref) return { erro: FRASE_TELA_VELHA };
    if (
      base.relatorios.some(
        (r) => r.tipo === ref.tipo && r.bebeId === ref.bebeId,
      )
    ) {
      return {
        sucesso:
          "Este documento já tem rascunho. Abra e continue de onde parou.",
      };
    }
    const previa = previaDoDocumento(base, ref.tipo, ref.bebeId);
    const montagem = montar(ref.tipo, previa, base.textos);
    await evolucoes.salvar({
      acompanhamentoId: id.data,
      tipo: ref.tipo,
      bebeId: ref.bebeId,
      conteudo: {
        dados: montagem.dados,
        conteudo: montagem.conteudo,
      } as ConteudoSalvo,
      erros: montagem.erros,
    });
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "montar o rascunho") };
  }
  revalidar();
  return {
    sucesso:
      "Rascunho montado com o que o checklist trouxe. Complete os campos que faltam e salve.",
  };
}

/**
 * Salva o que a enfermeira ou a coordenação preencheu. A entrada passa de
 * novo pelas validações de `src/lib/pdf` (conclusão coerente com os achados,
 * datas dentro do período, contato do médico, conselho da profissional): o
 * que não passa fica na lista de pontos e impede a revisão e a aprovação.
 */
export async function acaoSalvarEvolucao(
  _anterior: EstadoAcaoEvolucao,
  formulario: FormData,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(formulario.get("relatorioId"));
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  const versaoBruta = Number(formulario.get("versao"));
  const versaoBase =
    Number.isInteger(versaoBruta) && versaoBruta > 0 ? versaoBruta : null;

  try {
    const { evolucoes } = await obterRepositorios();
    const atual = await evolucoes.obter(id.data);
    if (!atual.podeEditar) {
      return {
        erro: "Este documento não pode ser editado agora. Atualize a tela para ver o estado atual.",
      };
    }
    const base = await evolucoes.base(atual.acompanhamentoId);
    const { dados, erros: errosDoFormulario } = aplicarFormulario(
      atual.tipo,
      atual.conteudo.dados,
      formulario,
    );
    if (errosDoFormulario.length > 0) {
      return {
        erro: "Alguns campos não foram lidos. Corrija os marcados e salve de novo.",
        pontos: errosDoFormulario,
      };
    }
    const montagem = montar(atual.tipo, dados, base.textos);
    const resultado = await evolucoes.salvar({
      acompanhamentoId: atual.acompanhamentoId,
      tipo: atual.tipo,
      bebeId: atual.bebeId,
      conteudo: {
        dados: montagem.dados,
        conteudo: montagem.conteudo,
      } as ConteudoSalvo,
      erros: montagem.erros,
      versaoBase,
    });
    revalidar();
    return montagem.erros.length === 0
      ? {
          sucesso: "Salvo. Nenhum ponto a corrigir neste documento.",
          versao: resultado.versao,
        }
      : {
          sucesso:
            "Salvo. Ainda há pontos a corrigir, listados acima do formulário.",
          pontos: montagem.erros,
          versao: resultado.versao,
        };
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "salvar o documento") };
  }
}

export async function acaoEnviarParaRevisao(
  relatorioId: string,
  versao: number,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(relatorioId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { evolucoes } = await obterRepositorios();
    await evolucoes.enviarParaRevisao(id.data, versao);
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "enviar para a revisão") };
  }
  revalidar();
  return {
    sucesso:
      "Enviado para a revisão da coordenação. Se ela devolver, o recado chega para você aqui.",
  };
}

export async function acaoDevolverEvolucao(
  _anterior: EstadoAcaoEvolucao,
  formulario: FormData,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(formulario.get("relatorioId"));
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (motivo.length < 5) {
    return {
      erro: "Escreva o recado para a enfermeira em pelo menos 5 letras, para ela saber o que ajustar.",
    };
  }
  try {
    const { evolucoes } = await obterRepositorios();
    await evolucoes.devolver(id.data, motivo);
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "devolver o documento") };
  }
  revalidar();
  return {
    sucesso:
      "Devolvido para a enfermeira, com o seu recado. Ela ajusta e manda de novo.",
  };
}

/**
 * Aprova e envia aos médicos na mesma ação. A aprovação exige documento sem
 * pontos a corrigir e o e-mail do médico da especialidade certa (o banco
 * confere). Se o e-mail falhar, a aprovação fica e o documento passa a
 * "Envio com erro", com o motivo, para reenviar.
 */
export async function acaoAprovarEEnviar(
  relatorioId: string,
  versao: number,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(relatorioId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { evolucoes } = await obterRepositorios();
    await evolucoes.aprovar(id.data, versao);
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "aprovar o documento") };
  }
  let resultado;
  try {
    resultado = await enviarPeloRepositorio(id.data);
  } catch (erro) {
    revalidar();
    return {
      erro: `Aprovado, mas o envio não terminou. ${fraseErroEvolucao(erro, "enviar o e-mail")}`,
    };
  }
  revalidar();
  if (!resultado.ok) {
    return { erro: `Aprovado, mas o e-mail não saiu. ${resultado.motivo}` };
  }
  return {
    sucesso: `Aprovado e enviado a ${resultado.enviados} ${plural(resultado.enviados, "médico", "médicos")}. A tarefa de mandar a evolução para a família já está com a coordenação.`,
  };
}

export async function acaoReenviarEvolucao(
  relatorioId: string,
): Promise<EstadoAcaoEvolucao> {
  await exigirSessao();
  const id = esquemaId.safeParse(relatorioId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  let resultado;
  try {
    resultado = await enviarPeloRepositorio(id.data);
  } catch (erro) {
    return { erro: fraseErroEvolucao(erro, "reenviar o e-mail") };
  }
  revalidar();
  if (!resultado.ok) return { erro: resultado.motivo };
  return {
    sucesso: `Reenviado a ${resultado.enviados} ${plural(resultado.enviados, "médico", "médicos")}.`,
  };
}
