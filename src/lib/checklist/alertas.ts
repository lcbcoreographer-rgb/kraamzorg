import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import type { LinhaRegraAlerta, Severidade } from "@/lib/regras-alerta";
import { acionamentoCompleto, type AcionamentoAlerta } from "./registro";

/**
 * Apoio da tela de alertas clínicos (P40): seletor dos sinais do DOC 3 que
 * não têm campo, texto do achado na faixa e o que falta registrar antes de
 * fechar. Nenhum limite clínico fica aqui: as regras, condutas e
 * descrições vêm de `regra_alerta`.
 */

/** Caminhos "bloco.campo" que a definição do instrumento tem. */
export function caminhosDoInstrumento(
  definicao: DefinicaoInstrumento,
): Set<string> {
  const caminhos = new Set<string>();
  for (const bloco of [...(definicao.cabecalho ?? []), ...definicao.blocos]) {
    for (const campo of bloco.campos) caminhos.add(`${bloco.id}.${campo.id}`);
  }
  return caminhos;
}

export interface SinalDoSeletor {
  regraId: string;
  grupo: string;
  descricao: string;
  severidade: Severidade;
  conduta: string;
}

const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  imediato: 0,
  prioritario: 1,
  atencao: 2,
  informativo: 3,
};

export function ordemDaSeveridade(severidade: Severidade): number {
  return ORDEM_SEVERIDADE[severidade];
}

/**
 * Sinais do DOC 3 que não têm campo no checklist (PRD 9.3, K-07): regra
 * sem `campo`, ou com `campo` que a definição do DOC 2 não tem. A lista
 * vem de `regra_alerta`, nunca do código. Ordem: severidade e código.
 */
export function sinaisDoSeletor(
  regras: LinhaRegraAlerta[],
  definicao: DefinicaoInstrumento,
): SinalDoSeletor[] {
  const caminhos = caminhosDoInstrumento(definicao);
  return regras
    .filter((r) => r.campo === null || !caminhos.has(r.campo))
    .map((r) => ({
      regraId: r.id,
      grupo: r.grupo,
      descricao: r.descricao,
      severidade: r.severidade as Severidade,
      conduta: r.conduta,
    }))
    .sort(
      (a, b) =>
        ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
        a.regraId.localeCompare(b.regraId),
    );
}

/** Variante da faixa de alerta (componente FaixaAlerta). */
export type VarianteDaFaixa = "imediato" | "prioritario" | "sensivel" | "info";

/** Variante da faixa: imediato usa o token alerta; prioritário, aviso. */
export function varianteDaFaixa(
  severidade: Severidade,
  familiaSensivel: boolean,
): VarianteDaFaixa {
  // Família em luto ou intercorrência nunca leva o vermelho (DESIGN.md 11.3).
  if (familiaSensivel) return "sensivel";
  if (severidade === "imediato") return "imediato";
  if (severidade === "prioritario") return "prioritario";
  return "info";
}

/** O achado na faixa: descrição da regra e, quando há, o valor registrado. */
export function tituloDoAchado(
  descricao: string,
  valorLegivel: string | null,
): string {
  return valorLegivel ? `${descricao}. Registrado: ${valorLegivel}` : descricao;
}

export type CampoDoAcionamento =
  "sinalIdentificado" | "acionadoEm" | "orientacaoMedica" | "condutaAdotada";

/** O que falta dos quatro campos do DOC 3 antes de fechar o alerta. */
export function camposFaltandoDoAcionamento(
  a: Partial<AcionamentoAlerta> | undefined,
): CampoDoAcionamento[] {
  const faltando: CampoDoAcionamento[] = [];
  if (!a?.sinalIdentificado?.trim()) faltando.push("sinalIdentificado");
  if (!a?.acionadoEm?.trim() || Number.isNaN(Date.parse(a.acionadoEm)))
    faltando.push("acionadoEm");
  if (!a?.orientacaoMedica?.trim()) faltando.push("orientacaoMedica");
  if (!a?.condutaAdotada?.trim()) faltando.push("condutaAdotada");
  return faltando;
}

export { acionamentoCompleto };

/**
 * Link de telefone da supervisão (funciona sem dados): `tel:+55...`.
 * Nulo quando o parâmetro está vazio.
 */
export function linkDeLigacao(telefoneE164: string): string | null {
  const limpo = telefoneE164.trim();
  return /^\+\d{10,15}$/.test(limpo) ? `tel:${limpo}` : null;
}
