"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { hojeBrasilia } from "../pipeline/idade-gestacional";
import {
  dataValida,
  marcarNaoContatar,
  desmarcarNaoContatar,
  obterDadosContratoTela,
  prazoDesfazerSegundos,
  registrarDataFato,
  type CampoDataFato,
} from "./dados";
import type { EstadoAcaoFicha, EstadoDadosContrato } from "./estado-acoes";
import { ROTULO_ESTADO_SENSIVEL } from "./rotulos";

// Só funções assíncronas saem deste arquivo ("use server"); o estado
// inicial e os tipos de estado moram em `estado-acoes.ts`.

function mensagemErro(erro: unknown, contexto: string): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: confirme o papel e, se precisar, o código do aplicativo (MFA), e tente de novo.";
    }
    if (erro.codigo === "recusado") {
      return `Não deu para ${contexto}. Confira os dados e tente de novo.`;
    }
    if (erro.codigo === "nao_encontrado") {
      return "Essa família não está mais disponível. Atualize a tela.";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${contexto} agora. Tente de novo em instantes.`;
}

const idFamilia = z.object({ familiaId: z.uuid() });

/**
 * Freio em um toque (P16 item 2, PRD 8.3): sempre `bloqueio_total`, sem
 * pergunta antes. `fluxos.md` (seção D) e o protótipo `comercial-ficha.html`
 * mostram um botão só, que já vai direto ao estado mais protetor; a tela
 * nunca oferece escolher entre `atencao` e `bloqueio_total` no toque
 * (decisão registrada em `docs/sessoes/p16-ficha.md`). `acionarFreio`
 * continua aceitando o estado como parâmetro, para o dia em que outra
 * entrada (a coordenação, por exemplo) precisar acionar só `atencao`.
 */
export async function acaoAcionarFreio(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  await exigirSessao("/familias");
  const dados = idFamilia.safeParse({
    familiaId: formulario.get("familiaId"),
  });
  if (!dados.success) {
    return { erro: "Não deu para saber qual família. Atualize a tela." };
  }

  let desfazerSegundos = 0;
  try {
    const { ficha } = await obterRepositorios();
    const resultado = await ficha.acionarFreio(
      dados.data.familiaId,
      "bloqueio_total",
    );
    desfazerSegundos = await prazoDesfazerSegundos(resultado.resposta);
  } catch (erro) {
    return { erro: mensagemErro(erro, "acionar o freio") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return { sucesso: "Freio acionado.", desfazerSegundos };
}

/** "Desfazer" de quem acionou, dentro de `freio_desfazer_segundos`
 * (PRD 8.3, decisão do cliente item 4 em `fluxos.md`). */
export async function acaoDesfazerFreio(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  await exigirSessao("/familias");
  const dados = idFamilia.safeParse({
    familiaId: formulario.get("familiaId"),
  });
  if (!dados.success) {
    return { erro: "Não deu para saber qual família. Atualize a tela." };
  }

  try {
    const { ficha } = await obterRepositorios();
    await ficha.desfazerFreio(dados.data.familiaId);
  } catch (erro) {
    // O banco recusa o "Desfazer" fora do prazo, de outra pessoa ou depois
    // de outra mudança do freio (privado.desfazer_freio). Em qualquer um
    // desses casos o caminho agora é o mesmo.
    if (
      erro instanceof ErroRepositorio &&
      (erro.codigo === "sem_permissao" || erro.codigo === "recusado")
    ) {
      return {
        erro: "O prazo para desfazer passou. O freio continua ativo; a reversão agora é com a coordenação ou a diretoria.",
      };
    }
    return { erro: mensagemErro(erro, "desfazer o freio") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return { sucesso: "Freio desfeito." };
}

const esquemaJustificar = z.object({
  familiaId: z.uuid(),
  motivo: z.string().trim().min(1, "Escreva o motivo do freio."),
});

/** Justificativa depois do acionamento (PRD 8.3: "justificar depois é
 * aceitável; atrasar não é"). */
export async function acaoJustificarFreio(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  await exigirSessao("/familias");
  const dados = esquemaJustificar.safeParse({
    familiaId: formulario.get("familiaId"),
    motivo: formulario.get("motivo"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Escreva o motivo." };
  }

  try {
    const { ficha } = await obterRepositorios();
    await ficha.justificarFreio(dados.data.familiaId, dados.data.motivo);
  } catch (erro) {
    return { erro: mensagemErro(erro, "justificar o freio") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return { sucesso: "Justificativa registrada." };
}

const esquemaReverter = z.object({
  familiaId: z.uuid(),
  estado: z.enum(["normal", "atencao", "bloqueio_total", "encerrado_sensivel"]),
  justificativa: z.string().trim().min(1, "Escreva a justificativa."),
});

const ORDEM_ESTADO: readonly EstadoSensivel[] = [
  "normal",
  "atencao",
  "bloqueio_total",
  "encerrado_sensivel",
];

/** Reversão ou ajuste do freio, só coordenação ou diretoria com AAL2
 * (PRD 8.3, telas.md K7). A folha oferece os quatro estados, mas o banco
 * separa as duas portas: descer é `api.reverter_freio` (coordenação ou
 * diretoria, AAL2, justificativa) e subir, por exemplo de bloqueio total
 * para encerrado sensível, é `api.acionar_freio` com a justificativa como
 * motivo (assim não nasce tarefa de justificativa). Aqui só escolhe a porta
 * pelo estado atual; quem barra de verdade é o banco. */
export async function acaoReverterFreio(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  const sessao = await exigirSessao("/familias");
  const dados = esquemaReverter.safeParse({
    familiaId: formulario.get("familiaId"),
    estado: formulario.get("estado"),
    justificativa: formulario.get("justificativa"),
  });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ??
        "Escolha uma opção e escreva a justificativa antes de salvar.",
    };
  }
  if (
    !sessao.papeis.includes("coordenacao") &&
    !sessao.papeis.includes("diretoria")
  ) {
    return {
      erro: "Reverter ou ajustar o freio é com a coordenação ou a diretoria.",
    };
  }

  const { familiaId, justificativa } = dados.data;
  const estado = dados.data.estado as EstadoSensivel;
  try {
    const { ficha } = await obterRepositorios();
    const atual = await ficha.obterFicha(familiaId);
    if (!atual) {
      return {
        erro: "Essa família não está mais disponível. Atualize a tela.",
      };
    }
    const de = atual.familia.estadoSensivel;
    if (estado === de) {
      return {
        erro: `A família já está em ${ROTULO_ESTADO_SENSIVEL[estado].toLowerCase()}. Escolha outra opção.`,
      };
    }
    if (ORDEM_ESTADO.indexOf(estado) > ORDEM_ESTADO.indexOf(de)) {
      await ficha.acionarFreio(familiaId, estado, justificativa);
    } else {
      await ficha.reverterFreio(familiaId, estado, justificativa);
    }
  } catch (erro) {
    return { erro: mensagemErro(erro, "salvar a mudança do freio") };
  }

  revalidatePath(`/familias/${familiaId}`);
  return { sucesso: "Mudança salva." };
}

const esquemaNaoContatar = z.object({
  familiaId: z.uuid(),
  motivo: z.string().trim().min(1, "Escreva o motivo."),
});

/** Marcar "não contatar" com motivo (P16 item 3). */
export async function acaoMarcarNaoContatar(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  const dados = esquemaNaoContatar.safeParse({
    familiaId: formulario.get("familiaId"),
    motivo: formulario.get("motivo"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Escreva o motivo." };
  }

  try {
    await marcarNaoContatar(dados.data.familiaId, dados.data.motivo);
  } catch (erro) {
    return { erro: mensagemErro(erro, "marcar não contatar") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return { sucesso: "Família marcada para não ser contatada." };
}

export async function acaoDesmarcarNaoContatar(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  const dados = idFamilia.safeParse({
    familiaId: formulario.get("familiaId"),
  });
  if (!dados.success) {
    return { erro: "Não deu para saber qual família. Atualize a tela." };
  }

  try {
    await desmarcarNaoContatar(dados.data.familiaId);
  } catch (erro) {
    return { erro: mensagemErro(erro, "desmarcar não contatar") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return { sucesso: "Família volta a poder ser contatada." };
}

const esquemaDataFato = z.object({
  familiaId: z.uuid(),
  campo: z.enum(["data_nascimento", "data_alta"]),
  valor: z
    .string()
    .refine(dataValida, "Escolha uma data válida.")
    .refine(
      (valor) => valor <= hojeBrasilia(),
      "A data não pode ser depois de hoje. Nascimento e alta entram como fato, quando acontecem.",
    ),
});

/** Registro das datas de nascimento e alta (P16 item 4). */
export async function acaoRegistrarDataFato(
  _anterior: EstadoAcaoFicha,
  formulario: FormData,
): Promise<EstadoAcaoFicha> {
  const dados = esquemaDataFato.safeParse({
    familiaId: formulario.get("familiaId"),
    campo: formulario.get("campo"),
    valor: formulario.get("valor"),
  });
  if (!dados.success) {
    return {
      erro: dados.error.issues[0]?.message ?? "Escolha uma data válida.",
    };
  }

  try {
    await registrarDataFato(
      dados.data.familiaId,
      dados.data.campo as CampoDataFato,
      dados.data.valor,
    );
  } catch (erro) {
    return { erro: mensagemErro(erro, "registrar a data") };
  }

  revalidatePath(`/familias/${dados.data.familiaId}`);
  return {
    sucesso:
      dados.data.campo === "data_nascimento"
        ? "Nascimento registrado."
        : "Alta registrada.",
  };
}

const esquemaDadosContrato = z.object({ pessoaId: z.uuid() });

/** "Mostrar" dos dados de contrato: exige AAL2 e grava a leitura no log
 * (`api.dados_contrato`, P16 item 5). O banco recusa sem AAL2; a tela só
 * traduz a recusa. */
export async function acaoVerDadosContratoCompletos(
  _anterior: EstadoDadosContrato,
  formulario: FormData,
): Promise<EstadoDadosContrato> {
  const dados = esquemaDadosContrato.safeParse({
    pessoaId: formulario.get("pessoaId"),
  });
  if (!dados.success) {
    return { erro: "Não deu para saber de quem são os dados." };
  }

  try {
    const completos = await obterDadosContratoTela(dados.data.pessoaId, true);
    if (!completos) {
      return { erro: "Ainda não há dados de contrato para esta pessoa." };
    }
    return { dados: completos };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return {
        erro: "Ver os dados completos exige entrar com o código do aplicativo autenticador (MFA). Se o seu acesso ainda não tem MFA, peça à diretoria para ativar e entre de novo.",
      };
    }
    return { erro: mensagemErro(erro, "ver os dados completos") };
  }
}
