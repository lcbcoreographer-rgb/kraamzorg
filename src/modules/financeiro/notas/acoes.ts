"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  caminhoNota,
  obterArmazenamento,
  tipoDoArquivoNota,
} from "@/lib/armazenamento";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { obterEmissorNfse } from "@/lib/integracoes/fabrica";
import {
  consultarNota,
  emitirNota,
  LIMITE_ARQUIVO_NOTA_BYTES,
} from "@/lib/integracoes/nfse/emissao";
import { dadosParaEmissaoManual } from "./formatar";
import type { EstadoAcaoNota } from "./estado-acoes";
import { FRASE_PROVEDOR_NAO_CONFIGURADO, fraseErroNota } from "./mensagens";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

const esquemaId = z.uuid();
const FRASE_TELA_VELHA = "Atualize a tela e tente de novo.";

function revalidar(notaId: string): void {
  revalidatePath("/notas");
  revalidatePath(`/notas/${notaId}`);
  revalidatePath("/cobrancas");
  revalidatePath("/tarefas");
  revalidatePath("/pipeline");
}

/**
 * Emite (ou reenvia) a nota pelo provedor. O provedor fica configurado antes
 * de qualquer mudança: sem configuração a nota não sai de "a emitir" e a tela
 * aponta a emissão manual. Depois, o banco marca "em processamento" (e recusa
 * emissão dupla), o adaptador emite com as novas tentativas dele, os arquivos
 * vão para o storage privado e o resultado volta ao banco. Erro do provedor
 * vira o motivo na tela e a nota fica em "com erro", pronta para reenviar.
 */
export async function acaoEmitirNota(notaId: string): Promise<EstadoAcaoNota> {
  await exigirSessao("/notas");
  const id = esquemaId.safeParse(notaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };

  let emissor;
  try {
    emissor = obterEmissorNfse();
  } catch {
    return { erro: FRASE_PROVEDOR_NAO_CONFIGURADO };
  }

  try {
    const { notas } = await obterRepositorios();
    const dados = await notas.dadosEmissao(id.data);
    await notas.iniciarEmissao(id.data);
    const resultado = await emitirNota(dados, {
      emissor,
      armazenamento: obterArmazenamento(),
      registrar: (registro) => notas.registrarResultado(id.data, registro),
    });
    revalidar(id.data);
    if (resultado.estado === "emitida") {
      return { sucesso: `Nota emitida, número ${resultado.numero}.` };
    }
    if (resultado.estado === "processando") {
      return {
        sucesso:
          "O provedor recebeu o pedido e ainda está processando. Consulte de novo em alguns minutos.",
      };
    }
    return {
      erro: `${resultado.erro ?? "O provedor recusou a nota."} A nota ficou com erro; corrija o que for preciso e toque em Reenviar.`,
    };
  } catch (erro) {
    return { erro: fraseErroNota(erro, "emitir a nota") };
  }
}

/** Pergunta ao provedor como está uma nota em processamento. */
export async function acaoConsultarNota(
  notaId: string,
): Promise<EstadoAcaoNota> {
  await exigirSessao("/notas");
  const id = esquemaId.safeParse(notaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };

  let emissor;
  try {
    emissor = obterEmissorNfse();
  } catch {
    return { erro: FRASE_PROVEDOR_NAO_CONFIGURADO };
  }

  try {
    const { notas } = await obterRepositorios();
    const nota = await notas.obter(id.data);
    if (!nota.providerRef) {
      return {
        erro: "Esta nota ainda não tem referência no provedor para consultar.",
      };
    }
    const resultado = await consultarNota(id.data, nota.providerRef, {
      emissor,
      armazenamento: obterArmazenamento(),
      registrar: (registro) => notas.registrarResultado(id.data, registro),
    });
    revalidar(id.data);
    if (resultado.estado === "emitida") {
      return { sucesso: `Nota emitida, número ${resultado.numero}.` };
    }
    if (resultado.estado === "erro") {
      return { erro: resultado.erro ?? "O provedor recusou a nota." };
    }
    return {
      sucesso:
        "O provedor ainda está processando. Consulte de novo em alguns minutos.",
    };
  } catch (erro) {
    return { erro: fraseErroNota(erro, "consultar a nota") };
  }
}

/**
 * Mostra ao financeiro os dados para emitir a nota à mão no portal do
 * provedor (emissão manual assistida, T-05): tomador com CPF, valor, código e
 * descrição do serviço. O CPF só vem sob pedido, e a leitura fica no log.
 */
export async function acaoVerDadosDaNota(
  notaId: string,
): Promise<EstadoAcaoNota> {
  await exigirSessao("/notas");
  const id = esquemaId.safeParse(notaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { notas } = await obterRepositorios();
    const dados = await notas.dadosEmissao(id.data);
    return { dados: dadosParaEmissaoManual(dados) };
  } catch (erro) {
    return { erro: fraseErroNota(erro, "abrir os dados da nota") };
  }
}

async function lerArquivo(
  formulario: FormData,
  nome: "pdf" | "xml",
): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: true; bytes: null }
  | { ok: false; frase: string }
> {
  const arquivo = formulario.get(nome);
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: true, bytes: null };
  }
  if (arquivo.size > LIMITE_ARQUIVO_NOTA_BYTES) {
    return {
      ok: false,
      frase: `Use um arquivo de até ${LIMITE_ARQUIVO_NOTA_BYTES / 1024 / 1024} MB.`,
    };
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDoArquivoNota(bytes);
  if (!tipo || tipo.extensao !== nome) {
    return {
      ok: false,
      frase:
        nome === "pdf"
          ? "Esse arquivo não é um PDF. Anexe o PDF da nota."
          : "Esse arquivo não é um XML. Anexe o XML da nota.",
    };
  }
  return { ok: true, bytes, contentType: tipo.contentType };
}

/**
 * Registra uma nota emitida à mão no portal do provedor: número, data e, se
 * houver, o PDF e o XML. Os arquivos vão para o storage privado com nome por
 * id (notas/<id>.pdf); o banco confere o número, a data e o estado da nota.
 */
export async function acaoRegistrarNotaManual(
  _anterior: EstadoAcaoNota,
  formulario: FormData,
): Promise<EstadoAcaoNota> {
  await exigirSessao("/notas");
  const id = esquemaId.safeParse(formulario.get("notaId"));
  if (!id.success) return { erro: FRASE_TELA_VELHA };

  const campos: NonNullable<EstadoAcaoNota["campos"]> = {};
  const numero = String(formulario.get("numero") ?? "").trim();
  if (numero === "" || numero.length > 60) {
    campos.numero =
      "Escreva o número da nota, como aparece no portal do provedor.";
  }
  const emitidaEm = String(formulario.get("emitidaEm") ?? "").trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(emitidaEm) ||
    Number.isNaN(Date.parse(emitidaEm))
  ) {
    campos.emitidaEm = "Escolha a data em que a nota foi emitida.";
  }
  const provedor = String(formulario.get("provedor") ?? "")
    .trim()
    .slice(0, 60);

  const pdf = await lerArquivo(formulario, "pdf");
  if (!pdf.ok) campos.pdf = pdf.frase;
  const xml = await lerArquivo(formulario, "xml");
  if (!xml.ok) campos.xml = xml.frase;
  if (Object.keys(campos).length > 0) {
    return { erro: "Falta alguma coisa para registrar a nota.", campos };
  }

  try {
    const { notas } = await obterRepositorios();
    // A leitura confere papel e AAL2 e o estado da nota antes de guardar arquivo.
    const nota = await notas.obter(id.data);
    if (!nota.podeEmitir) {
      return {
        erro: "Esta nota já foi emitida ou está em processamento. Atualize a tela.",
      };
    }
    const armazenamento = obterArmazenamento();
    let pdfPath: string | null = null;
    let xmlPath: string | null = null;
    if (pdf.ok && pdf.bytes) {
      pdfPath = caminhoNota(id.data, "pdf");
      await armazenamento.salvar(pdfPath, pdf.bytes, "application/pdf", true);
    }
    if (xml.ok && xml.bytes) {
      xmlPath = caminhoNota(id.data, "xml");
      await armazenamento.salvar(xmlPath, xml.bytes, "application/xml", true);
    }
    await notas.registrarManual({
      notaId: id.data,
      numero,
      emitidaEm,
      provider: provedor || null,
      pdfPath,
      xmlPath,
    });
  } catch (erro) {
    return { erro: fraseErroNota(erro, "registrar a nota") };
  }
  revalidar(id.data);
  return {
    sucesso: "Nota registrada. A cobrança e o pipeline já mostram o número.",
  };
}

/**
 * Só na demonstração: liga ou desliga a emissão automática e combina uma
 * falha do provedor na próxima emissão, para ver o motivo e o reenvio.
 * Fora da demonstração não faz nada.
 */
export async function acaoAjustarDemonstracaoNota(
  notaId: string,
  ajuste: "automatica_ligada" | "automatica_desligada" | "falha_proxima",
): Promise<EstadoAcaoNota> {
  await exigirSessao("/notas");
  const id = esquemaId.safeParse(notaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  if (modoDados() !== "demonstracao") {
    return { erro: "Esta ação existe só na demonstração." };
  }
  const { notas } = await obterRepositorios();
  await notas.obter(id.data);
  const demo = await import("@/lib/dados/demonstracao/nota");
  if (ajuste === "falha_proxima") {
    demo.definirFalhaProvedorDemo(true);
    revalidar(id.data);
    return { sucesso: "A próxima emissão vai voltar com erro do provedor." };
  }
  demo.definirEmissaoAutomaticaDemo(ajuste === "automatica_ligada");
  revalidar(id.data);
  return {
    sucesso:
      ajuste === "automatica_ligada"
        ? "Emissão automática ligada na demonstração."
        : "Emissão automática desligada na demonstração.",
  };
}
