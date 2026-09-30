import type { CartaoOportunidade, ResumoFamilia } from "@/lib/dados/tipos";
import { formatarData } from "@/lib/formatacao";
import {
  calcularIdadeGestacional,
  textoIdadeGestacional,
} from "../pipeline/idade-gestacional";
import { rotuloEstagio } from "../pipeline/estagios";
import { faseDaFamilia } from "./lista-familias";
import type {
  FamiliaListaTela,
  ProximoPassoTela,
  TempoFamiliaTela,
} from "./tipos";

/**
 * Monta a linha da lista de famílias a partir do resumo da família e da
 * oportunidade dela (quando o papel vê o pipeline). Puro: `hoje` e o id de
 * quem está logado vêm de fora, para o teste fixar.
 */

function diaMes(data: string | null): string | null {
  return data ? (formatarData(data)?.slice(0, 5) ?? null) : null;
}

/** O ponto no tempo: IG em semanas, o nascimento, a alta ou o início. */
export function tempoDaFamilia(
  familia: Pick<
    ResumoFamilia,
    "dpp" | "dataNascimento" | "dataAlta" | "dataInicioEfetivo"
  >,
  fase: FamiliaListaTela["fase"],
  hoje: string,
): TempoFamiliaTela | null {
  // Freio em bloqueio ou perda: sem semana e sem data futura (11.8).
  if (fase === "freio") return null;
  if (fase === "atendimento") {
    const inicio = diaMes(familia.dataInicioEfetivo);
    return inicio ? { frase: "Início em", medida: inicio } : null;
  }
  if (fase === "nasceu") {
    const alta = diaMes(familia.dataAlta);
    if (alta) return { frase: "Alta em", medida: alta };
    const nascimento = diaMes(familia.dataNascimento);
    return nascimento ? { frase: "Nasceu em", medida: nascimento } : null;
  }
  if (fase === "gestando") {
    const ig = calcularIdadeGestacional(familia.dpp, hoje);
    if (ig && ig.semanas <= 42) {
      return { frase: null, medida: textoIdadeGestacional(familia.dpp, hoje)! };
    }
    const texto = textoIdadeGestacional(familia.dpp, hoje);
    // "DPP passou há 3 dias": a frase e a medida separadas, a medida em mono.
    const passou = texto ? /^(DPP passou há) (.+)$/.exec(texto) : null;
    if (passou) return { frase: passou[1]!, medida: passou[2]! };
    return texto ? { frase: null, medida: texto } : null;
  }
  return null;
}

/** A oportunidade que representa a família: a atualizada por último. */
export function oportunidadeDaFamilia(
  cartoes: readonly CartaoOportunidade[],
): CartaoOportunidade | null {
  return (
    [...cartoes].sort((a, b) =>
      b.atualizadoEm.localeCompare(a.atualizadoEm),
    )[0] ?? null
  );
}

export function proximoPassoDa(
  cartao: CartaoOportunidade,
  usuarioId: string | null,
): ProximoPassoTela {
  if (cartao.transferenciaAberta) {
    return { tipo: "transferencia", frase: "Transferência esperando" };
  }
  const retorno = diaMes(cartao.proximoContatoEm);
  if (retorno) return { tipo: "retorno", frase: "Retorno em", data: retorno };
  if (!cartao.responsavelId) {
    return { tipo: "sem_responsavel", frase: "Sem responsável" };
  }
  if (usuarioId && cartao.responsavelId === usuarioId) {
    return { tipo: "voce", frase: "Com você" };
  }
  return { tipo: "equipe", frase: "Com outra pessoa" };
}

export function linhaDaFamilia(
  familia: ResumoFamilia,
  cartao: CartaoOportunidade | null,
  contexto: { hoje: string; usuarioId: string | null },
): FamiliaListaTela {
  const fase = faseDaFamilia(familia);
  const estagio = cartao
    ? cartao.pipeline === 1
      ? cartao.estagioP1
      : cartao.estagioP2
    : null;
  return {
    id: familia.id,
    nome: familia.nome,
    bairro: familia.bairro,
    cidade: familia.cidade,
    uf: familia.uf,
    dpp: familia.dpp,
    dataNascimento: familia.dataNascimento,
    dataAlta: familia.dataAlta,
    dataInicioEfetivo: familia.dataInicioEfetivo,
    estadoSensivel: familia.estadoSensivel,
    naoContatar: familia.naoContatar,
    idadeGestacional: textoIdadeGestacional(
      familia.dpp,
      contexto.hoje,
      familia.dataNascimento,
    ),
    fase,
    tempo: tempoDaFamilia(familia, fase, contexto.hoje),
    estagio: cartao && estagio ? rotuloEstagio(cartao.pipeline, estagio) : null,
    proximoPasso: cartao ? proximoPassoDa(cartao, contexto.usuarioId) : null,
  };
}
