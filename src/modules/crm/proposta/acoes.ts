"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { aplicarTexto, primeiroNome } from "@/lib/messaging/aplicar-texto";
import { obterTarefaAberta } from "@/modules/mensageria/tarefas/dados";
import { prepararEnvioTarefa } from "@/modules/mensageria/tarefas/enviar-tarefa";
import { registrarEnvioTarefa } from "@/modules/mensageria/tarefas/registrar-envio";
import type {
  EstadoAcaoProposta,
  ResultadoLinkFormulario,
} from "./estado-acoes";
import { fraseErroProposta } from "./mensagens";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

/** O que entra no histórico da conversa no lugar do link (uso único). */
const LINK_OCULTO = "link do formulário seguro (uso único, não guardado)";

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function revalidarProposta(familiaId: string) {
  revalidatePath(`/familias/${familiaId}/proposta`);
  revalidatePath(`/familias/${familiaId}`);
  revalidatePath("/pipeline");
  revalidatePath("/tarefas");
}

const esquemaProposta = z.object({
  familiaId: z.uuid(),
  oportunidadeId: z.uuid(),
  pacoteVersaoId: z.uuid("Escolha o pacote."),
  parcelas: z.coerce.number().int().min(1, "Escolha em quantas parcelas."),
  condicaoId: z.uuid().nullable(),
  paraQuem: z.enum(["propria", "presente", "outro"]),
  pagadorPessoaId: z.uuid().nullable(),
  pagadorNome: z.string().max(160).nullable(),
  descontoPct: z.coerce
    .number()
    .min(0, "O desconto vai de 0 a 100%.")
    .max(100, "O desconto vai de 0 a 100%."),
  descontoMotivo: z.string().max(300).nullable(),
});

/**
 * Salva a proposta (P30 item 1). Nenhum valor sai do navegador: o banco
 * lê o pacote vigente, a taxa da cidade e a condição da tabela, faz a
 * conta e move o P2 para "Proposta enviada" na primeira vez.
 */
export async function acaoSalvarProposta(
  _anterior: EstadoAcaoProposta,
  formulario: FormData,
): Promise<EstadoAcaoProposta> {
  await exigirSessao("/familias");
  const dados = esquemaProposta.safeParse({
    familiaId: texto(formulario, "familiaId"),
    oportunidadeId: texto(formulario, "oportunidadeId"),
    pacoteVersaoId: texto(formulario, "pacoteVersaoId"),
    parcelas: texto(formulario, "parcelas") || "0",
    condicaoId: texto(formulario, "condicaoId") || null,
    paraQuem: texto(formulario, "paraQuem") || "propria",
    pagadorPessoaId: texto(formulario, "pagadorPessoaId") || null,
    pagadorNome: texto(formulario, "pagadorNome") || null,
    descontoPct: texto(formulario, "descontoPct").replace(",", ".") || "0",
    descontoMotivo: texto(formulario, "descontoMotivo") || null,
  });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ?? "Confira a proposta e tente de novo.",
    };
  }

  let precisaAprovacao = false;
  let aprovado = false;
  try {
    const { venda } = await obterRepositorios();
    const resultado = await venda.salvarProposta({
      oportunidadeId: dados.data.oportunidadeId,
      pacoteVersaoId: dados.data.pacoteVersaoId,
      parcelas: dados.data.parcelas,
      condicaoId: dados.data.condicaoId,
      paraQuem: dados.data.paraQuem,
      pagadorPessoaId:
        dados.data.paraQuem === "presente" ? dados.data.pagadorPessoaId : null,
      pagadorNome:
        dados.data.paraQuem === "presente" && !dados.data.pagadorPessoaId
          ? dados.data.pagadorNome
          : null,
      descontoPct: dados.data.descontoPct,
      descontoMotivo: dados.data.descontoMotivo,
    });
    precisaAprovacao = resultado.precisaAprovacao;
    aprovado = resultado.descontoAprovado;
  } catch (erro) {
    return { erro: fraseErroProposta(erro, "salvar a proposta") };
  }

  revalidarProposta(dados.data.familiaId);
  return {
    sucesso:
      precisaAprovacao && !aprovado
        ? "Proposta salva. A condição escolhida espera a aprovação da diretoria antes do link do formulário."
        : "Proposta salva. O próximo passo é gerar o link do formulário para a família.",
  };
}

const esquemaIds = z.object({
  familiaId: z.uuid(),
  oportunidadeId: z.uuid(),
});

/** Aprovação registrada da diretoria (C-04, C-05; D-16). */
export async function acaoAprovarDesconto(
  _anterior: EstadoAcaoProposta,
  formulario: FormData,
): Promise<EstadoAcaoProposta> {
  await exigirSessao("/familias");
  const dados = esquemaIds.safeParse({
    familiaId: texto(formulario, "familiaId"),
    oportunidadeId: texto(formulario, "oportunidadeId"),
  });
  if (!dados.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { venda } = await obterRepositorios();
    await venda.aprovarDesconto(dados.data.oportunidadeId);
  } catch (erro) {
    return { erro: fraseErroProposta(erro, "aprovar a condição") };
  }
  revalidarProposta(dados.data.familiaId);
  return {
    sucesso:
      "Condição aprovada. O comercial já pode gerar o link do formulário.",
  };
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

/**
 * Gera o link de uso único do formulário (P30 itens 2 e 3). O banco move o
 * P2 até "Ganho", guarda só o hash do token e cria (ou reaproveita) a
 * tarefa "Enviar o formulário do contrato". O texto sai de
 * mensagem_modelo formulario_contrato e o wa.me passa pelo adaptador de
 * mensageria, que confere o freio antes de existir link.
 */
export async function acaoGerarLinkFormulario(
  oportunidadeId: string,
  familiaId: string,
): Promise<ResultadoLinkFormulario> {
  await exigirSessao("/familias");
  const ids = esquemaIds.safeParse({ oportunidadeId, familiaId });
  if (!ids.success)
    return { ok: false, erro: "Atualize a tela e tente de novo." };

  try {
    const { venda, configuracoes } = await obterRepositorios();
    const link = await venda.gerarLinkFormulario(oportunidadeId);
    const [proposta, modelo, tarefa] = await Promise.all([
      venda.obterProposta(oportunidadeId),
      configuracoes.obterMensagemModelo("formulario_contrato"),
      link.tarefaId ? obterTarefaAberta(link.tarefaId) : Promise.resolve(null),
    ]);
    revalidarProposta(familiaId);

    const url = `${await origemDoApp()}/formulario/${link.token}`;
    const contato =
      proposta.pessoas.find((p) => p.contatoPrincipal) ?? proposta.pessoas[0];
    const nome = primeiroNome(contato?.nome);
    const mensagem = modelo
      ? aplicarTexto(modelo.texto, nome, { link: url })
      : url;

    const telefone = tarefa?.mensagem.telefoneE164 ?? null;
    let whatsapp: string | null = null;
    let motivoSemWhatsapp: string | null = null;
    if (telefone) {
      const envio = await prepararEnvioTarefa({
        familiaId,
        telefoneE164: telefone,
        texto: mensagem,
        categoria: "operacional",
      });
      if (envio.ok) whatsapp = envio.link ?? null;
      else motivoSemWhatsapp = envio.motivo;
    } else {
      motivoSemWhatsapp =
        "A família não tem telefone de WhatsApp no cadastro. Copie o texto e envie pelo canal que ela usa.";
    }

    return {
      ok: true,
      tarefaId: link.tarefaId,
      expiraEm: link.expiraEm,
      texto: mensagem,
      whatsapp,
      motivoSemWhatsapp,
    };
  } catch (erro) {
    return { ok: false, erro: fraseErroProposta(erro, "gerar o link") };
  }
}

/**
 * "Enviei" do formulário: grava a mensagem na conversa da família com o
 * link trocado por uma marca (o link vale uma vez e não fica em histórico,
 * log nem banco) e conclui a tarefa.
 */
export async function acaoRegistrarEnvioFormulario(
  tarefaId: string,
  familiaId: string,
): Promise<EstadoAcaoProposta> {
  await exigirSessao("/familias");
  if (
    !z.uuid().safeParse(tarefaId).success ||
    !z.uuid().safeParse(familiaId).success
  ) {
    return { erro: "Atualize a tela e tente de novo." };
  }
  try {
    const { configuracoes } = await obterRepositorios();
    const [modelo, tarefa] = await Promise.all([
      configuracoes.obterMensagemModelo("formulario_contrato"),
      obterTarefaAberta(tarefaId),
    ]);
    if (!tarefa) {
      return {
        erro: "Essa tarefa já foi concluída ou não é sua. Atualize a tela.",
      };
    }
    const semLink = modelo
      ? aplicarTexto(modelo.texto, null, { link: LINK_OCULTO })
      : LINK_OCULTO;
    await registrarEnvioTarefa({ tarefaId, familiaId, textoEnviado: semLink });
  } catch (erro) {
    return { erro: fraseErroProposta(erro, "registrar o envio") };
  }
  revalidarProposta(familiaId);
  return {
    sucesso:
      "Envio registrado. Quando a família mandar os dados, chega um aviso e a proposta mostra que foram recebidos.",
  };
}
