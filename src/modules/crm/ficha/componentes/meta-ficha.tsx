import * as React from "react";
import { LinhaGestacao } from "@/components/ui/linha-gestacao";
import { Selo } from "@/components/ui/selo";
import type { DataChaveFamilia } from "@/components/ui/cabecalho-familia";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { formatarData, localidade } from "@/lib/formatacao";
import {
  calcularIdadeGestacional,
  hojeBrasilia,
} from "@/modules/crm/pipeline/idade-gestacional";
import type { FichaTela } from "../tipos";

/**
 * Perda ou intercorrência com o freio (DESIGN.md, 11.8): bloqueio total ou
 * encerrado sensível. Nesses estados a tela da família baixa o volume:
 * sai o estágio de venda, a IG, a linha da gestação e a promessa de datas.
 */
export function emModoSensivel(estado: EstadoSensivel): boolean {
  return estado === "bloqueio_total" || estado === "encerrado_sensivel";
}

/**
 * Linha de meta do cabeçalho da família (ficha e conversa usam a mesma):
 * selo do estágio, IG e bairro. Em modo sensível ficam só o lugar, porque
 * estágio de venda e semana da gestação não cabem ao lado de uma perda
 * (DESIGN.md, 11.8 e 11.9).
 */
export function MetaFicha({ ficha }: { ficha: FichaTela }) {
  const sensivel = emModoSensivel(ficha.estadoSensivel);
  const lugar = localidade(ficha.bairro, ficha.cidade);
  const dpp = ficha.datas.find((d) => d.rotulo === "DPP")?.valor ?? null;
  return (
    <>
      {!sensivel && ficha.estagioRotulo ? (
        <Selo variante="marinho">{ficha.estagioRotulo}</Selo>
      ) : null}
      {!sensivel && ficha.idadeGestacional ? (
        <span
          className="text-corpo font-mono"
          title={dpp ? `Calculada da DPP ${formatarData(dpp)}` : undefined}
        >
          {ficha.idadeGestacional}
        </span>
      ) : null}
      {lugar ? <span>{lugar}</span> : null}
    </>
  );
}

/**
 * Linha da gestação para o cabeçalho da ficha (proposta P2-1 da camada de
 * acolhimento): só enquanto a família está gestando, sem estado sensível e
 * com a DPP registrada. A semana sai de `ig(dpp, hoje)`, nunca gravada.
 */
export function linhaDaFicha(
  ficha: FichaTela,
  hoje: string = hojeBrasilia(),
): React.ReactNode {
  if (emModoSensivel(ficha.estadoSensivel)) return null;
  const dpp = ficha.datas.find((d) => d.rotulo === "DPP")?.valor ?? null;
  const nascimento =
    ficha.datas.find((d) => d.rotulo === "Nascimento")?.valor ?? null;
  if (!dpp || nascimento) return null;
  const ig = calcularIdadeGestacional(dpp, hoje);
  const dppTexto = formatarData(dpp);
  if (!ig || ig.semanas > 42 || !dppTexto) return null;
  return (
    <LinhaGestacao
      semanas={ig.semanas}
      dias={ig.dias}
      dpp={dppTexto}
      destacarAtual
      // A IG já está na linha de meta e a DPP nas quatro datas logo abaixo:
      // a linha mostra só os blocos (a frase inteira fica no aria-label).
      semLegenda
    />
  );
}

/** As quatro datas no formato do cabeçalho ("ainda não" quando ausente). */
export function datasDoCabecalho(ficha: FichaTela): DataChaveFamilia[] {
  return ficha.datas.map((d) => ({
    rotulo: d.rotulo,
    valor: d.valor ? (formatarData(d.valor) ?? "ainda não") : "ainda não",
    tipo: d.valor ? d.tipo : ("ausente" as const),
  }));
}
