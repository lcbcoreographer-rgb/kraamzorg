"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  caminhoComprovante,
  codigoAleatorio,
  obterArmazenamento,
  tipoDoArquivo,
} from "@/lib/armazenamento";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { obterCobrador } from "@/lib/integracoes/fabrica";
import { fraseErroContrato } from "@/modules/crm/contrato/mensagens";
import type { EstadoAcaoCobranca } from "./estado-acoes";
import { reaisParaCentavos } from "./valor";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

function revalidarCobranca(cobrancaId: string, familiaId?: string) {
  revalidatePath("/cobrancas");
  revalidatePath(`/cobrancas/${cobrancaId}`);
  revalidatePath("/tarefas");
  revalidatePath("/pipeline");
  if (familiaId) {
    revalidatePath(`/familias/${familiaId}/contrato`);
    revalidatePath(`/familias/${familiaId}`);
  }
}

async function origemDoApp(): Promise<string> {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const protocolo =
    cabecalhos.get("x-forwarded-proto") ??
    (host?.startsWith("127.0.0.1") || host?.startsWith("localhost")
      ? "http"
      : "https");
  return `${protocolo}://${host ?? "localhost"}`;
}

const esquemaId = z.uuid();

/**
 * Gera o link de pagamento de uma cobrança sem link (P32 item 1): o banco
 * entrega os dados (sem CPF, parcelas nunca acima do limite do pacote), a
 * InfinitePay devolve o link e o banco guarda e cria a tarefa
 * `link_pagamento`.
 */
export async function acaoGerarLinkPagamento(
  cobrancaId: string,
  familiaId: string,
): Promise<EstadoAcaoCobranca> {
  await exigirSessao("/cobrancas");
  const id = esquemaId.safeParse(cobrancaId);
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { cobrancas } = await obterRepositorios();
    const dados = await cobrancas.dadosLinkPagamento(id.data);
    const cobrador = obterCobrador(await origemDoApp());
    const link = await cobrador.criarLink(dados);
    await cobrancas.registrarLink(id.data, link.url, link.slug);
  } catch (erro) {
    if (erro instanceof Error && erro.name === "ErroIntegracaoNaoConfigurada") {
      return {
        erro: "A conexão com a InfinitePay ainda não foi configurada neste ambiente. Nenhum link foi criado.",
      };
    }
    const frase = fraseErroContrato(erro, "gerar o link de pagamento");
    return { erro: frase };
  }
  revalidarCobranca(id.data, familiaId);
  return {
    sucesso:
      "Link de pagamento gerado. A tarefa com o texto para a família já está com o comercial.",
  };
}

/** Cobrança do contrato assinado, para quando a automação foi freada ou está desligada. */
export async function acaoGerarCobranca(
  contratoId: string,
  familiaId: string,
): Promise<EstadoAcaoCobranca> {
  await exigirSessao("/cobrancas");
  const ids = z
    .object({ contratoId: z.uuid(), familiaId: z.uuid() })
    .safeParse({ contratoId, familiaId });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { cobrancas } = await obterRepositorios();
    await cobrancas.gerarDoContrato(ids.data.contratoId);
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "gerar a cobrança") };
  }
  revalidatePath("/cobrancas");
  revalidatePath(`/familias/${ids.data.familiaId}/contrato`);
  revalidatePath(`/familias/${ids.data.familiaId}`);
  return {
    sucesso: "Cobrança gerada. Abra a cobrança para gerar o link de pagamento.",
  };
}

/**
 * Baixa manual de Pix recebido fora do sistema (P32 item 4): comprovante,
 * motivo e valor. O arquivo vai para o storage privado com nome por id; o
 * banco confere o caminho, o motivo e o valor, e faz o mesmo que o webhook.
 */
export async function acaoBaixarManual(
  _anterior: EstadoAcaoCobranca,
  formulario: FormData,
): Promise<EstadoAcaoCobranca> {
  await exigirSessao("/cobrancas");
  const ids = z
    .object({ cobrancaId: z.uuid(), familiaId: z.uuid() })
    .safeParse({
      cobrancaId: formulario.get("cobrancaId"),
      familiaId: formulario.get("familiaId"),
    });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };

  const campos: NonNullable<EstadoAcaoCobranca["campos"]> = {};
  const valor = reaisParaCentavos(String(formulario.get("valor") ?? ""));
  if (valor === null) {
    campos.valor = "Escreva o valor recebido em reais, por exemplo 4.550,00.";
  }
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (motivo.replace(/[\r\n[\]{}]+/g, " ").trim().length < 10) {
    campos.motivo =
      "Escreva o motivo em pelo menos 10 letras. Ele fica registrado.";
  }
  const arquivo = formulario.get("comprovante");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    campos.comprovante = "Anexe o comprovante do pagamento (PDF, PNG ou JPG).";
  }
  if (Object.keys(campos).length > 0) {
    return { erro: "Falta alguma coisa para dar a baixa.", campos };
  }

  try {
    const { cobrancas } = await obterRepositorios();
    // A leitura confere papel e AAL2 e traz o limite de tamanho do parâmetro.
    const cobranca = await cobrancas.obter(ids.data.cobrancaId);
    if (!cobranca.podeBaixarManual) {
      return {
        erro: "Essa cobrança já foi paga ou cancelada. Atualize a tela.",
      };
    }
    const arquivoOk = arquivo as File;
    const limite = cobranca.comprovanteMaxBytes;
    if (limite !== null && arquivoOk.size > limite) {
      return {
        erro: "O comprovante é grande demais.",
        campos: {
          comprovante: `Use um arquivo de até ${Math.floor(limite / 1024 / 1024)} MB.`,
        },
      };
    }
    const bytes = new Uint8Array(await arquivoOk.arrayBuffer());
    const tipo = tipoDoArquivo(bytes);
    if (!tipo) {
      return {
        erro: "O comprovante não é um PDF, PNG ou JPG.",
        campos: { comprovante: "Anexe um PDF, PNG ou JPG." },
      };
    }
    const caminho = caminhoComprovante(
      cobranca.id,
      tipo.extensao,
      codigoAleatorio(),
    );
    await obterArmazenamento().salvar(caminho, bytes, tipo.contentType, false);
    await cobrancas.baixarManual({
      cobrancaId: cobranca.id,
      valorPagoCentavos: valor as number,
      comprovantePath: caminho,
      motivo,
    });
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "dar a baixa") };
  }
  revalidarCobranca(ids.data.cobrancaId, ids.data.familiaId);
  return {
    sucesso:
      "Baixa registrada. O pagamento está confirmado e a nota fiscal ficou pendente.",
  };
}

/**
 * Só na demonstração: faz o que o webhook da InfinitePay faria depois do
 * payment_check. Fora da demonstração não faz nada.
 */
export async function acaoSimularPagamento(
  cobrancaId: string,
  familiaId: string,
): Promise<EstadoAcaoCobranca> {
  await exigirSessao("/cobrancas");
  const id = esquemaId.safeParse(cobrancaId);
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  if (modoDados() !== "demonstracao") {
    return { erro: "Esta ação existe só na demonstração." };
  }
  try {
    const { cobrancas } = await obterRepositorios();
    await cobrancas.obter(id.data);
    const { simularPagamentoDemonstracao } =
      await import("@/lib/dados/demonstracao/contrato");
    simularPagamentoDemonstracao(id.data);
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "simular o pagamento") };
  }
  revalidarCobranca(id.data, familiaId);
  return { sucesso: "Pagamento simulado. A cobrança está paga." };
}
