"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { BebeNascimento } from "@/lib/dados/tipos-operacao";
import type { EstadoAcaoOperacao } from "../comum/estado-acoes";
import {
  camposComErro,
  dataValida,
  inteiroDoCampo,
  textoDoCampo,
} from "../comum/formulario";
import { fraseErroOperacao } from "../comum/mensagens";

// Só funções assíncronas saem daqui ("use server"); estado em
// ../comum/estado-acoes.ts.

function revalidarRadar(familiaId: string) {
  revalidatePath("/radar");
  revalidatePath(`/radar/${familiaId}`);
  revalidatePath(`/familias/${familiaId}`);
  revalidatePath("/prenatal");
  revalidatePath("/tarefas");
  revalidatePath("/pipeline");
}

const papel = z.enum(["titular", "backup"], {
  error: "Escolha titular ou backup.",
});
const uuid = z.uuid("Escolha uma enfermeira da lista.");

const esquemaOferecer = z.object({
  familiaId: z.uuid(),
  profissionalId: uuid,
  papel,
});

/**
 * Oferece o papel de titular ou backup a uma enfermeira (P36 item 1). Ela
 * tem o prazo do parâmetro `designacao_prazo_resposta_horas` para aceitar ou
 * recusar; a recusa aciona o backup e avisa a coordenação (no banco).
 */
export async function acaoOferecerDesignacao(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/radar");
  const dados = esquemaOferecer.safeParse({
    familiaId: textoDoCampo(formulario, "familiaId"),
    profissionalId: textoDoCampo(formulario, "profissionalId"),
    papel: textoDoCampo(formulario, "papel"),
  });
  if (!dados.success) {
    return {
      erro: "Escolha a enfermeira e o papel para fazer a oferta.",
      campos: camposComErro(dados.error),
    };
  }
  try {
    const { operacao } = await obterRepositorios();
    await operacao.oferecer(dados.data);
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "fazer a oferta") };
  }
  revalidarRadar(dados.data.familiaId);
  return { sucesso: "Oferta enviada. A enfermeira responde dentro do prazo." };
}

const esquemaAtribuir = esquemaOferecer.extend({
  motivo: z.string().min(3, "Escreva o motivo da atribuição direta."),
});

/** Atribuição direta pela coordenação em urgência (P36 item 1): exige motivo, que vai para o histórico. */
export async function acaoAtribuirDesignacao(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/radar");
  const dados = esquemaAtribuir.safeParse({
    familiaId: textoDoCampo(formulario, "familiaId"),
    profissionalId: textoDoCampo(formulario, "profissionalId"),
    papel: textoDoCampo(formulario, "papel"),
    motivo: textoDoCampo(formulario, "motivo"),
  });
  if (!dados.success) {
    return {
      erro: "Falta um dado para atribuir.",
      campos: camposComErro(dados.error),
    };
  }
  try {
    const { operacao } = await obterRepositorios();
    await operacao.atribuir(dados.data);
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "atribuir a enfermeira") };
  }
  revalidarRadar(dados.data.familiaId);
  return { sucesso: "Enfermeira atribuída. O motivo ficou no histórico." };
}

const SEXOS = ["feminino", "masculino", "nao_informado"] as const;
const PARTOS = ["vaginal", "cesarea", "nao_informado"] as const;

function lerBebe(
  formulario: FormData,
  n: number,
  campos: Record<string, string>,
): BebeNascimento {
  const peso = textoDoCampo(formulario, `peso${n}`);
  const sexo = textoDoCampo(formulario, `sexo${n}`);
  const parto = textoDoCampo(formulario, `parto${n}`);
  const bebe: BebeNascimento = {};
  const nome = textoDoCampo(formulario, `nome${n}`);
  if (nome) bebe.nome = nome;
  if (peso) {
    const gramas = inteiroDoCampo(peso);
    if (gramas === null || gramas < 300 || gramas > 9999) {
      campos[`peso${n}`] = "Informe o peso em gramas, por exemplo 3200.";
    } else {
      bebe.pesoNascimentoG = gramas;
    }
  }
  if (sexo) {
    if ((SEXOS as readonly string[]).includes(sexo)) {
      bebe.sexo = sexo as (typeof SEXOS)[number];
    } else {
      campos[`sexo${n}`] = "Escolha uma das opções.";
    }
  }
  if (parto) {
    if ((PARTOS as readonly string[]).includes(parto)) {
      bebe.tipoParto = parto as (typeof PARTOS)[number];
    } else {
      campos[`parto${n}`] = "Escolha uma das opções.";
    }
  }
  return bebe;
}

/**
 * Registra o nascimento (P36 item 4): data, um bebê ou gêmeos, peso e tipo
 * de parto. Recalcula a agenda, avisa a operação e leva o P2 adiante. A
 * data é fato, nunca depois de hoje.
 */
export async function acaoRegistrarNascimento(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/radar");
  const familiaId = textoDoCampo(formulario, "familiaId");
  const data = textoDoCampo(formulario, "dataNascimento");
  const previsao = textoDoCampo(formulario, "previsaoAlta");
  const gemelar = textoDoCampo(formulario, "gemelar") === "sim";
  const campos: Record<string, string> = {};

  if (!z.uuid().safeParse(familiaId).success) {
    return { erro: "Não achei essa família. Atualize a tela." };
  }
  if (!dataValida(data))
    campos.dataNascimento = "Informe a data do nascimento.";
  if (previsao && !dataValida(previsao)) {
    campos.previsaoAlta = "Confira a data prevista da alta.";
  }
  const bebes = [lerBebe(formulario, 1, campos)];
  if (gemelar) bebes.push(lerBebe(formulario, 2, campos));
  if (Object.keys(campos).length > 0) {
    return { erro: "Confira os campos marcados.", campos };
  }

  try {
    const { operacao } = await obterRepositorios();
    await operacao.registrarNascimento({
      familiaId,
      dataNascimento: data,
      bebes,
      previsaoAlta: previsao || null,
    });
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "registrar o nascimento") };
  }
  revalidarRadar(familiaId);
  return {
    sucesso:
      "Nascimento registrado. A agenda foi recalculada e a operação foi avisada.",
  };
}

/** Previsão de alta: estimativa; a alta de fato é outro registro. */
export async function acaoRegistrarPrevisaoAlta(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/radar");
  const familiaId = textoDoCampo(formulario, "familiaId");
  const previsao = textoDoCampo(formulario, "previsaoAlta");
  if (!z.uuid().safeParse(familiaId).success) {
    return { erro: "Não achei essa família. Atualize a tela." };
  }
  if (!dataValida(previsao)) {
    return {
      erro: "Falta a data prevista da alta.",
      campos: { previsaoAlta: "Informe a data prevista." },
    };
  }
  try {
    const { operacao } = await obterRepositorios();
    await operacao.registrarPrevisaoAlta(familiaId, previsao);
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "guardar a previsão de alta") };
  }
  revalidarRadar(familiaId);
  return { sucesso: "Previsão de alta guardada." };
}

/**
 * Registra a alta (P36 item 4): ativa o acompanhamento, gera as visitas de
 * D1 a D6 ou D12 no mesmo período, cria a tarefa do guia e avisa a
 * profissional. D1 é o dia seguinte à alta, a menos que a coordenação
 * escolha outro primeiro dia.
 */
export async function acaoRegistrarAlta(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/radar");
  const familiaId = textoDoCampo(formulario, "familiaId");
  const dataAlta = textoDoCampo(formulario, "dataAlta");
  const primeira = textoDoCampo(formulario, "primeiraVisita");
  const periodo = textoDoCampo(formulario, "periodo");
  const campos: Record<string, string> = {};
  if (!z.uuid().safeParse(familiaId).success) {
    return { erro: "Não achei essa família. Atualize a tela." };
  }
  if (!dataValida(dataAlta)) campos.dataAlta = "Informe a data da alta.";
  if (primeira && !dataValida(primeira)) {
    campos.primeiraVisita = "Confira o primeiro dia das visitas.";
  }
  if (periodo && periodo !== "manha" && periodo !== "tarde") {
    campos.periodo = "Escolha manhã ou tarde.";
  }
  if (Object.keys(campos).length > 0) {
    return { erro: "Confira os campos marcados.", campos };
  }
  try {
    const { operacao } = await obterRepositorios();
    const r = await operacao.registrarAlta({
      familiaId,
      dataAlta,
      primeiraVisita: primeira || null,
      periodo: periodo === "manha" || periodo === "tarde" ? periodo : null,
    });
    revalidarRadar(familiaId);
    return {
      sucesso: `Alta registrada. ${r.visitas} ${r.visitas === 1 ? "visita marcada" : "visitas marcadas"} no mesmo período.`,
    };
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "registrar a alta") };
  }
}
