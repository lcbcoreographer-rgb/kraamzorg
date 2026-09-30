import { calcularAssinatura } from "./assinatura";
import {
  regraDoBanco,
  avaliarCampo,
  avaliarRegistro,
  type LinhaRegraAlerta,
  type RegraAlerta,
  type ResultadoAlerta,
  type VisitaSerie,
} from "@/lib/regras-alerta";
import {
  blocoVisivel,
  paraDados,
  pendenciasParaConcluir,
  type BebeFormulario,
  type ContextoFormulario,
  type EnderecoCampo,
  type Pendencia,
  type RespostasFormulario,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import type {
  BebeChecklist,
  RegistroAnterior,
  RegistroParaEnvio,
} from "@/lib/dados/tipos-assistencial";

/**
 * Montagem, avaliação e conferência do registro do dia (DOC 2). Funções
 * puras: o mesmo código monta o registro no aparelho, avalia os alertas
 * (offline) e reavalia no servidor, na sincronização (PRD 9.3 e 15).
 */

/**
 * Chave reservada de `registro_atendimento.dados`. Guarda, por alerta, os
 * quatro campos do registro obrigatório do DOC 3 feitos durante a visita.
 * Não é campo do instrumento: o DOC 3 manda que "o registro e a
 * comunicação ficam no checklist diário" (PRD 9.3).
 */
export const CHAVE_ALERTAS = "_alertas";

type Objeto = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/** Os quatro campos do DOC 3 de um alerta, feitos durante a visita. */
export interface AcionamentoAlerta {
  regraId: string;
  bebeId: string | null;
  sinalIdentificado: string;
  /** Data e hora ISO 8601 com fuso. */
  acionadoEm: string;
  orientacaoMedica: string;
  condutaAdotada: string;
}

export function chaveAlerta(regraId: string, bebeId: string | null): string {
  return `${regraId}|${bebeId ?? ""}`;
}

export function bebesDoFormulario(bebes: BebeChecklist[]): BebeFormulario[] {
  const ordenados = [...bebes].sort((a, b) => a.ordem - b.ordem);
  return ordenados.map((bebe, indice) => ({
    id: bebe.id,
    rotulo: bebe.nome?.trim() ? bebe.nome : `Bebê ${indice + 1}`,
  }));
}

/** Blocos que aparecem para esta visita (o do último dia só no último). */
function definicaoVisivel(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  contexto: ContextoFormulario,
): DefinicaoInstrumento {
  const ambiente = { definicao, respostas, contexto };
  return {
    ...definicao,
    blocos: definicao.blocos.filter((b) => blocoVisivel(b, ambiente)),
  };
}

/**
 * `registro_atendimento.dados`: um objeto por bloco; bloco por bebê como
 * lista, um item por bebê, com `bebe_id` (PRD 6.5). Os quatro campos do
 * DOC 3 vão em `_alertas`. Só entram blocos que se aplicam à visita.
 */
export function montarDados(entrada: {
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  bebes: BebeFormulario[];
  ultimoDia: boolean;
  acionamentos?: AcionamentoAlerta[];
}): Record<string, unknown> {
  const contexto = { ultimo_dia: entrada.ultimoDia };
  const visivel = definicaoVisivel(
    entrada.definicao,
    entrada.respostas,
    contexto,
  );
  const dados: Record<string, unknown> = {
    ...paraDados(visivel, entrada.respostas, entrada.bebes),
  };
  const acionamentos = (entrada.acionamentos ?? []).filter(
    (a) =>
      a.sinalIdentificado.trim() !== "" ||
      a.orientacaoMedica.trim() !== "" ||
      a.condutaAdotada.trim() !== "" ||
      a.acionadoEm.trim() !== "",
  );
  if (acionamentos.length > 0) {
    dados[CHAVE_ALERTAS] = acionamentos.map((a) => ({
      regra_id: a.regraId,
      bebe_id: a.bebeId,
      sinal_identificado: a.sinalIdentificado.trim(),
      acionado_em: a.acionadoEm,
      orientacao_medica: a.orientacaoMedica.trim(),
      conduta_adotada: a.condutaAdotada.trim(),
    }));
  }
  return dados;
}

/**
 * O caminho de volta de `montarDados`: de `registro_atendimento.dados` para
 * as respostas do formulário, para mostrar o registro assinado (leitura) e
 * para conferir os obrigatórios no servidor de demonstração.
 */
export function dadosParaRespostas(
  definicao: DefinicaoInstrumento,
  dados: Record<string, unknown>,
): RespostasFormulario {
  const respostas: RespostasFormulario = { blocos: {}, por_bebe: {} };
  for (const bloco of definicao.blocos) {
    const valor = dados[bloco.id];
    if (bloco.repete_por_bebe && Array.isArray(valor)) {
      const porBebe: Record<string, Record<string, ValorCampo>> = {};
      for (const item of valor) {
        if (!ehObjeto(item) || typeof item.bebe_id !== "string") continue;
        const { bebe_id: bebeId, ...campos } = item;
        porBebe[bebeId] = campos as Record<string, ValorCampo>;
      }
      respostas.por_bebe[bloco.id] = porBebe;
    } else if (!bloco.repete_por_bebe && ehObjeto(valor)) {
      respostas.blocos[bloco.id] = { ...valor } as Record<string, ValorCampo>;
    }
  }
  return respostas;
}

// ---------------------------------------------------------------------------
// Leitura do registro (dias anteriores e avaliação)
// ---------------------------------------------------------------------------

/** Bloco de `dados` para este bebê (bloco repetido) ou o bloco comum. */
function blocoDoRegistro(
  dados: Objeto,
  bloco: string,
  bebeId?: string,
): Objeto | undefined {
  const valor = dados[bloco];
  if (Array.isArray(valor)) {
    if (bebeId === undefined) return undefined;
    const item = valor.find((i) => ehObjeto(i) && i.bebe_id === bebeId);
    return ehObjeto(item) ? item : undefined;
  }
  return ehObjeto(valor) ? valor : undefined;
}

/** Valor de um campo em `dados`, ou undefined. */
export function lerDoRegistro(dados: Objeto, endereco: EnderecoCampo): unknown {
  return blocoDoRegistro(dados, endereco.bloco, endereco.bebe)?.[
    endereco.campo
  ];
}

/** Resposta composta vira o valor que as regras comparam. */
function simplificar(valor: unknown): unknown {
  if (!ehObjeto(valor)) return valor;
  if ("resposta" in valor) return valor.resposta;
  if ("valor" in valor) return valor.valor;
  return valor;
}

/**
 * Registro no formato do motor de alertas (`{"2.1": {"temperatura": 38.2}}`):
 * blocos comuns como estão e, dos blocos por bebê, o item deste bebê.
 * Respostas compostas (sim ou não com texto, nota com classificação) viram
 * o valor principal.
 */
export function registroParaAvaliacao(
  dados: Objeto,
  bebeId?: string,
): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const bloco of Object.keys(dados)) {
    if (bloco === CHAVE_ALERTAS) continue;
    const deste = blocoDoRegistro(dados, bloco, bebeId);
    if (!deste) continue;
    const campos: Objeto = {};
    for (const [campo, valor] of Object.entries(deste)) {
      if (campo === "bebe_id") continue;
      campos[campo] = simplificar(valor);
    }
    saida[bloco] = campos;
  }
  return saida;
}

/** Dias anteriores no formato da série do motor (mais recente primeiro). */
export function serieDosDiasAnteriores(
  anteriores: RegistroAnterior[],
  bebeId?: string,
): VisitaSerie[] {
  return [...anteriores]
    .sort((a, b) => b.diaNumero - a.diaNumero)
    .map((anterior) => ({
      visitaId: anterior.visitaId,
      dataVisita: anterior.data,
      registro: registroParaAvaliacao(anterior.dados, bebeId),
    }));
}

/** Dias de vida do bebê na data da visita (nascimento = dia 0). */
export function diaDeVida(
  dataNascimento: string | null,
  dataVisita: string,
): number | undefined {
  if (!dataNascimento) return undefined;
  const a = Date.parse(`${dataNascimento.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${dataVisita.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return Math.round((b - a) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export interface AlertaAvaliado extends ResultadoAlerta {
  /** Bebê do alerta (regra do recém-nascido); nulo nas demais. */
  bebeId: string | null;
}

/** Linhas de `regra_alerta` do cache viram regras; a linha quebrada não derruba o checklist. */
export function catalogoDasLinhas(linhas: LinhaRegraAlerta[]): {
  catalogo: RegraAlerta[];
  descartadas: string[];
} {
  const catalogo: RegraAlerta[] = [];
  const descartadas: string[] = [];
  for (const linha of linhas) {
    try {
      catalogo.push(regraDoBanco(linha));
    } catch {
      descartadas.push(linha.id);
    }
  }
  return { catalogo, descartadas };
}

export interface ContextoAvaliacao {
  catalogo: RegraAlerta[];
  bebes: BebeChecklist[];
  anteriores: RegistroAnterior[];
  dataVisita: string;
}

function contextoDoBebe(bebe: BebeChecklist, dataVisita: string) {
  return {
    pesoNascimentoGramas: bebe.pesoNascimentoG ?? undefined,
    diaVidaAtual: diaDeVida(bebe.dataNascimento, dataVisita),
  };
}

/**
 * Reavaliação completa do registro (na assinatura e, no servidor, na
 * sincronização): regras da puérpera, da saúde mental e da amamentação uma
 * vez; regras do recém-nascido uma vez por bebê, com o registro do bebê.
 */
export function avaliarAlertasDoRegistro(
  dados: Objeto,
  contexto: ContextoAvaliacao,
): AlertaAvaliado[] {
  const doBebe = contexto.catalogo.filter((r) => r.grupo === "recem_nascido");
  const comuns = contexto.catalogo.filter((r) => r.grupo !== "recem_nascido");
  const resultado: AlertaAvaliado[] = avaliarRegistro({
    registro: registroParaAvaliacao(dados),
    serieAnterior: serieDosDiasAnteriores(contexto.anteriores),
    catalogo: comuns,
  }).map((r) => ({ ...r, bebeId: null }));

  for (const bebe of contexto.bebes) {
    resultado.push(
      ...avaliarRegistro({
        registro: registroParaAvaliacao(dados, bebe.id),
        serieAnterior: serieDosDiasAnteriores(contexto.anteriores, bebe.id),
        contexto: contextoDoBebe(bebe, contexto.dataVisita),
        catalogo: doBebe,
      }).map((r) => ({ ...r, bebeId: bebe.id })),
    );
  }
  return resultado;
}

/**
 * Avaliação no momento em que um campo é salvo (PRD 9.3), mesmo sem
 * sinal. Só olha as regras ligadas ao campo.
 */
export function avaliarAlertasDoCampo(
  endereco: EnderecoCampo,
  dados: Objeto,
  contexto: ContextoAvaliacao,
): AlertaAvaliado[] {
  const caminho = `${endereco.bloco}.${endereco.campo}`;
  const bebe = endereco.bebe
    ? contexto.bebes.find((b) => b.id === endereco.bebe)
    : undefined;
  if (endereco.bebe && !bebe) return [];
  const doBebe = contexto.catalogo.filter((r) => r.grupo === "recem_nascido");
  const comuns = contexto.catalogo.filter((r) => r.grupo !== "recem_nascido");

  if (bebe) {
    return avaliarCampo({
      campo: caminho,
      registro: registroParaAvaliacao(dados, bebe.id),
      serieAnterior: serieDosDiasAnteriores(contexto.anteriores, bebe.id),
      contexto: contextoDoBebe(bebe, contexto.dataVisita),
      catalogo: doBebe,
    }).map((r) => ({ ...r, bebeId: bebe.id }));
  }
  return avaliarCampo({
    campo: caminho,
    registro: registroParaAvaliacao(dados),
    serieAnterior: serieDosDiasAnteriores(contexto.anteriores),
    catalogo: comuns,
  }).map((r) => ({ ...r, bebeId: null }));
}

// ---------------------------------------------------------------------------
// Pendências para assinar e assinatura
// ---------------------------------------------------------------------------

/** Campos obrigatórios sem resposta (PRD 9.2 v4.2), inclusive por bebê e no último dia. */
export function pendenciasDoRegistro(entrada: {
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  bebes: BebeFormulario[];
  ultimoDia: boolean;
}): Pendencia[] {
  return pendenciasParaConcluir(entrada.definicao, entrada.respostas, {
    bebes: entrada.bebes,
    contexto: { ultimo_dia: entrada.ultimoDia },
  });
}

/** O resumo descritivo do dia, do campo `resumo.resumo_descritivo` da definição. */
export function resumoDoDia(respostas: RespostasFormulario): string {
  const valor = respostas.blocos["resumo"]?.["resumo_descritivo"];
  return typeof valor === "string" ? valor.trim() : "";
}

/** Os quatro campos do DOC 3 estão todos preenchidos? */
export function acionamentoCompleto(a: AcionamentoAlerta | undefined): boolean {
  if (!a) return false;
  return (
    a.sinalIdentificado.trim() !== "" &&
    a.acionadoEm.trim() !== "" &&
    !Number.isNaN(Date.parse(a.acionadoEm)) &&
    a.orientacaoMedica.trim() !== "" &&
    a.condutaAdotada.trim() !== ""
  );
}

/**
 * Registro assinado como o aparelho o envia: assinatura calculada aqui, na
 * hora de assinar (P39 item 3). O servidor recalcula e confere.
 */
export async function assinarRegistro(entrada: {
  visitaId: string;
  profissionalId: string;
  instrumentoVersao: string;
  dados: Record<string, unknown>;
  resumo: string;
  agora?: Date;
}): Promise<RegistroParaEnvio> {
  const assinadoEmMs = (entrada.agora ?? new Date()).getTime();
  const assinatura = await calcularAssinatura({
    dados: entrada.dados,
    resumo: entrada.resumo,
    profissionalId: entrada.profissionalId,
    assinadoEmMs,
  });
  return {
    visitaId: entrada.visitaId,
    profissionalId: entrada.profissionalId,
    instrumentoVersao: entrada.instrumentoVersao,
    dados: entrada.dados,
    resumoDescritivo: entrada.resumo,
    assinadoEmMs,
    assinatura,
  };
}
