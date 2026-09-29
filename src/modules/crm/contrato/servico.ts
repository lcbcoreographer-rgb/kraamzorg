import "server-only";
import { caminhoContrato, obterArmazenamento } from "@/lib/armazenamento";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { ErroApiAutentique } from "@/lib/integracoes/autentique/cliente";
import { obterAssinatura } from "@/lib/integracoes/fabrica";
import { gerarPdfContrato } from "@/lib/pdf/gerar-contrato";

/**
 * Gerar o PDF do contrato e enviá-lo à Autentique (P31 itens 2 e 3). O
 * banco decide tudo o que é regra (formulário recebido, freio, envio em
 * três passos); aqui ficam o PDF, o armazenamento e a chamada de fora.
 *
 * Erros de fora do banco viram `ErroServicoContrato`, com um código que a
 * tela troca por uma frase que diz o que aconteceu e o que fazer.
 */
export type CodigoErroServicoContrato =
  | "modelo_invalido"
  | "pdf_nao_encontrado"
  | "modelo_nao_aprovado"
  | "integracao_nao_configurada"
  | "autentique_recusou"
  | "autentique_incerto"
  | "armazenamento";

export class ErroServicoContrato extends Error {
  readonly codigo: CodigoErroServicoContrato;
  /** Problemas do modelo (texto de configuração, sem dado de pessoa). */
  readonly detalhes: string[];
  /** Id do documento na Autentique, quando o envio saiu e o registro não. */
  readonly documentoId: string | null;

  constructor(
    codigo: CodigoErroServicoContrato,
    detalhes: string[] = [],
    documentoId: string | null = null,
  ) {
    super(`contrato: ${codigo}`);
    this.name = "ErroServicoContrato";
    this.codigo = codigo;
    this.detalhes = detalhes;
    this.documentoId = documentoId;
  }
}

/** Gera (ou gera de novo, antes do envio) o PDF, guarda no storage e registra no banco. */
export async function gerarContrato(
  contratoId: string,
): Promise<{ sha256: string }> {
  const { contratos } = await obterRepositorios();
  const dados = await contratos.dadosParaContrato(contratoId);
  const pdf = await gerarPdfContrato(dados);
  if (!pdf.ok) throw new ErroServicoContrato("modelo_invalido", pdf.erros);

  const caminho = caminhoContrato(contratoId, false);
  try {
    await obterArmazenamento().salvar(
      caminho,
      new Uint8Array(pdf.buffer),
      "application/pdf",
      true,
    );
  } catch {
    throw new ErroServicoContrato("armazenamento");
  }
  await contratos.registrarGerado(contratoId, caminho, pdf.sha256);
  return { sha256: pdf.sha256 };
}

/**
 * Envia à Autentique em três passos: reserva no banco, cria o documento,
 * conclui no banco. A reserva só é desfeita quando a Autentique recusou de
 * vez (erro 4xx ou de validação); falha de rede ou 5xx pode ter criado o
 * documento, e refazer o envio criaria um segundo, então a reserva fica e a
 * tela pede para conferir o painel da Autentique.
 */
export async function enviarContratoParaAssinatura(
  contratoId: string,
): Promise<{ documentoId: string }> {
  const { contratos } = await obterRepositorios();
  const reserva = await contratos.reservarEnvio(contratoId);

  const liberar = async () => {
    try {
      await contratos.liberarEnvio(contratoId);
    } catch {
      // A tela mostra "Liberar o envio" se a reserva ficou.
    }
  };

  try {
    const assinatura = obterAssinatura();
    // Modelo provisório só vai para o sandbox da Autentique (documento sem
    // validade jurídica) ou para a demonstração.
    if (!reserva.modeloAprovado && !assinatura.ambienteDeTeste) {
      await liberar();
      throw new ErroServicoContrato("modelo_nao_aprovado");
    }

    const pdf = await obterArmazenamento().ler(reserva.pdfPath);
    if (!pdf) {
      await liberar();
      throw new ErroServicoContrato("pdf_nao_encontrado");
    }

    let documentoId: string;
    try {
      const criado = await assinatura.criarDocumento({
        nomeDocumento: reserva.nomeDocumento,
        pdf,
        gestante: {
          nome: reserva.gestante.nome,
          email: reserva.gestante.email ?? undefined,
          telefone: reserva.gestante.email
            ? undefined
            : (reserva.gestante.telefone ?? undefined),
          papel: "assinar",
        },
        kraamzorg: {
          nome: reserva.kraamzorg.nome,
          email: reserva.kraamzorg.email,
          papel: "assinar",
        },
        testemunha: reserva.testemunha
          ? {
              nome: reserva.testemunha.nome,
              email: reserva.testemunha.email ?? undefined,
              telefone: reserva.testemunha.email
                ? undefined
                : (reserva.testemunha.telefone ?? undefined),
              papel: "testemunha",
            }
          : undefined,
      });
      documentoId = criado.documentoId;
    } catch (erro) {
      if (erro instanceof ErroApiAutentique && erro.definitivo) {
        await liberar();
        throw new ErroServicoContrato("autentique_recusou");
      }
      throw new ErroServicoContrato("autentique_incerto");
    }

    try {
      await contratos.concluirEnvio(contratoId, documentoId);
    } catch {
      // O documento existe na Autentique e o banco não registrou: o id vai
      // no erro para a equipe técnica reconciliar (não é dado de pessoa).
      throw new ErroServicoContrato("autentique_incerto", [], documentoId);
    }
    return { documentoId };
  } catch (erro) {
    if (erro instanceof ErroServicoContrato) throw erro;
    if (erro instanceof Error && erro.name === "ErroIntegracaoNaoConfigurada") {
      await liberar();
      throw new ErroServicoContrato("integracao_nao_configurada");
    }
    throw erro;
  }
}
