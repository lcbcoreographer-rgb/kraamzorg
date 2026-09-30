"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type OrigemLead,
} from "@/lib/dados/tipos-gestao";
import { lerExtrato, sha256Hex } from "@/lib/gestao/extrato";
import { reaisParaCentavos } from "../cobrancas/valor";
import type { EstadoAcaoGestao } from "./estado-acoes";
import { fraseErroGestao } from "./textos";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

const ORIGENS: readonly OrigemLead[] = [
  "instagram_organico",
  "meta_ads",
  "google",
  "site",
  "indicacao_medica",
  "indicacao_cliente",
  "indicacao_amigo",
  "presente",
  "evento",
  "outro",
  "desconhecida",
];

function revalidarFinanceiro() {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/despesas");
  revalidatePath("/financeiro/equipe");
  revalidatePath("/financeiro/extrato");
  revalidatePath("/painel");
}

function texto(dados: FormData, campo: string): string {
  const v = dados.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

/** Lança ou corrige uma despesa paga. O banco confere de novo tudo o que a tela confere. */
export async function acaoSalvarDespesa(
  _anterior: EstadoAcaoGestao,
  dados: FormData,
): Promise<EstadoAcaoGestao> {
  await exigirSessao("/financeiro");
  const campos: Record<string, string> = {};

  const id = texto(dados, "id");
  if (id && !z.uuid().safeParse(id).success) {
    return { erro: "Atualize a tela e tente de novo." };
  }
  const data = texto(dados, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    campos.data = "Escolha o dia em que a despesa foi paga.";
  const categoria = texto(dados, "categoria") as CategoriaDespesa;
  if (!CATEGORIAS_DESPESA.includes(categoria))
    campos.categoria = "Escolha a categoria da despesa.";
  const descricao = texto(dados, "descricao");
  if (descricao === "" || descricao.length > 200) {
    campos.descricao = "Escreva o que foi pago, com até 200 letras.";
  }
  const valor = reaisParaCentavos(texto(dados, "valor"));
  if (valor === null)
    campos.valor = "Escreva o valor em reais, por exemplo 1.250,00.";
  const canalBruto = texto(dados, "canal");
  const canal = canalBruto === "" ? null : (canalBruto as OrigemLead);
  if (canal !== null && !ORIGENS.includes(canal))
    campos.canal = "Escolha um canal da lista.";
  if (canal !== null && categoria !== "marketing_anuncios") {
    campos.canal = "O canal só vale para marketing e anúncios.";
  }
  if (Object.keys(campos).length > 0) {
    return { erro: "Falta alguma coisa para lançar a despesa.", campos };
  }

  try {
    const { gestao } = await obterRepositorios();
    await gestao.salvarDespesa({
      id: id || null,
      data,
      categoria,
      descricao,
      fornecedor: texto(dados, "fornecedor") || null,
      valorCentavos: valor as number,
      canal,
    });
  } catch (erro) {
    return { erro: fraseErroGestao(erro, "lançar a despesa") };
  }
  revalidarFinanceiro();
  return {
    sucesso: id
      ? "Despesa corrigida. O DRE do mês já usa o valor novo."
      : "Despesa lançada. O DRE do mês já conta com ela.",
  };
}

/** Tira a despesa do DRE com o motivo; a linha continua no banco. */
export async function acaoRemoverDespesa(
  _anterior: EstadoAcaoGestao,
  dados: FormData,
): Promise<EstadoAcaoGestao> {
  await exigirSessao("/financeiro");
  const id = z.uuid().safeParse(texto(dados, "despesaId"));
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  const motivo = texto(dados, "motivo");
  if (motivo.length < 10) {
    return {
      erro: "Falta o motivo.",
      campos: {
        motivo:
          "Escreva o motivo com pelo menos 10 letras. Ele fica registrado.",
      },
    };
  }
  try {
    const { gestao } = await obterRepositorios();
    await gestao.removerDespesa(id.data, motivo);
  } catch (erro) {
    return { erro: fraseErroGestao(erro, "remover a despesa") };
  }
  revalidarFinanceiro();
  return {
    sucesso: "Despesa removida do DRE. O registro e o motivo ficam guardados.",
  };
}

/** Registra o pagamento de uma profissional; só passa se estiver liberado. */
export async function acaoPagarEquipe(
  _anterior: EstadoAcaoGestao,
  dados: FormData,
): Promise<EstadoAcaoGestao> {
  await exigirSessao("/financeiro");
  const id = z.uuid().safeParse(texto(dados, "pagamentoId"));
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  const data = texto(dados, "data");
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return {
      erro: "Falta o dia do pagamento.",
      campos: { data: "Escolha o dia em que o pagamento foi feito." },
    };
  }
  try {
    const { gestao } = await obterRepositorios();
    await gestao.pagarEquipe(id.data, data || null);
  } catch (erro) {
    return { erro: fraseErroGestao(erro, "registrar o pagamento") };
  }
  revalidarFinanceiro();
  return {
    sucesso:
      "Pagamento registrado. Ele entrou nas despesas do mês como equipe assistencial.",
  };
}

function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const ERROS_LEITURA: Record<string, string> = {
  arquivo_vazio:
    "O arquivo está vazio. Baixe o extrato no banco e tente de novo.",
  formato_nao_reconhecido:
    "Não reconheci o formato. Use um arquivo OFX ou um CSV com as colunas de data, descrição e valor.",
  sem_linhas: "O arquivo não tem nenhum lançamento.",
};

/**
 * Lê o extrato no servidor (o conteúdo bruto não é guardado), manda as linhas
 * e o sha256 ao banco e leva a pessoa para a conferência. O extrato nunca dá
 * baixa em cobrança (D-07).
 */
export async function acaoImportarExtrato(
  _anterior: EstadoAcaoGestao,
  dados: FormData,
): Promise<EstadoAcaoGestao> {
  await exigirSessao("/financeiro");
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return {
      erro: "Falta o arquivo do extrato.",
      campos: { arquivo: "Escolha o arquivo OFX ou CSV baixado no banco." },
    };
  }
  const conteudo = decodificar(await arquivo.arrayBuffer());
  const leitura = lerExtrato(conteudo);
  if (!leitura.ok) {
    if (leitura.erro === "linha_invalida") {
      return {
        erro: `${leitura.linha ? `A linha ${leitura.linha}` : "Uma linha"} do arquivo está com data ou valor que não deu para ler. Confira o arquivo e tente de novo.`,
        campos: { arquivo: "Arquivo com linha ilegível." },
      };
    }
    return {
      erro: ERROS_LEITURA[leitura.erro] ?? "Não deu para ler o arquivo.",
      campos: { arquivo: "Arquivo não reconhecido." },
    };
  }

  let importacaoId: string;
  try {
    const { gestao } = await obterRepositorios();
    const r = await gestao.importarExtrato(
      await sha256Hex(conteudo),
      leitura.formato,
      leitura.linhas,
    );
    importacaoId = r.importacaoId;
  } catch (erro) {
    return { erro: fraseErroGestao(erro, "importar o extrato") };
  }
  revalidarFinanceiro();
  redirect(
    `/financeiro/extrato?importacao=${encodeURIComponent(importacaoId)}`,
  );
}

/** Refaz a conferência depois de uma baixa manual; não altera cobrança nem despesa. */
export async function acaoReconciliarExtrato(
  _anterior: EstadoAcaoGestao,
  dados: FormData,
): Promise<EstadoAcaoGestao> {
  await exigirSessao("/financeiro");
  const id = z.uuid().safeParse(texto(dados, "importacaoId"));
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { gestao } = await obterRepositorios();
    const r = await gestao.reconciliarExtrato(id.data);
    revalidarFinanceiro();
    return {
      sucesso:
        r.conferidas + r.sugeridas + r.semCorrespondencia === 0
          ? "Nada a conferir: todas as linhas já estavam conferidas."
          : `Conferência refeita: ${r.conferidas} conferidas, ${r.sugeridas} sugeridas e ${r.semCorrespondencia} sem correspondência.`,
    };
  } catch (erro) {
    return { erro: fraseErroGestao(erro, "refazer a conferência") };
  }
}
