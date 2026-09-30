import {
  chaveEndereco,
  comValor,
  estaRespondido,
  lerValor,
  type EnderecoCampo,
  type RespostasFormulario,
} from "@/lib/instrumentos/respostas";
import type { Campo } from "@/lib/instrumentos/schema";
import type { RegistroAnterior } from "@/lib/dados/tipos-assistencial";
import { formatarComUnidade } from "./formato";
import { lerDoRegistro } from "./registro";

/**
 * Nada vem de outro dia sem confirmação campo a campo (P39 item 1, reunião
 * de 24/09, critério de aceite de UX):
 *
 * - Campo numérico mostra o valor do dia anterior só como referência
 *   ("No D3 foi 36,9 °C"), nunca preenchido.
 * - Campo de texto que costuma se repetir oferece "Trazer o texto do D3".
 *   O texto trazido fica à parte, aguardando confirmação; enquanto não for
 *   confirmado, o campo não conta como respondido e não entra no registro
 *   assinado.
 * - Não existe "trazer tudo do D3".
 *
 * Funções puras: o estado do que foi trazido vive à parte das respostas.
 */

export interface ReferenciaDoDia {
  diaNumero: number;
  data: string;
  valor: unknown;
}

/** O valor mais recente deste campo nos dias anteriores, ou null. */
export function referenciaDoDiaAnterior(
  anteriores: RegistroAnterior[],
  endereco: EnderecoCampo,
): ReferenciaDoDia | null {
  const maisRecenteAntes = [...anteriores].sort(
    (a, b) => b.diaNumero - a.diaNumero,
  );
  for (const anterior of maisRecenteAntes) {
    const valor = lerDoRegistro(anterior.dados, endereco);
    if (valor === undefined || valor === null) continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    return { diaNumero: anterior.diaNumero, data: anterior.data, valor };
  }
  return null;
}

/** "36,9 °C" ou "120/80 mmHg" para mostrar como referência; null se não for número. */
export function referenciaNumerica(
  campo: Campo,
  valor: unknown,
): string | null {
  if (campo.tipo !== "numero") return null;
  if (typeof valor === "number") {
    return formatarComUnidade(valor, campo.unidade, campo.casas_decimais);
  }
  if (valor && typeof valor === "object" && "partes" in valor) {
    const partes = (valor as { partes: Record<string, unknown> }).partes;
    const ordem = campo.partes?.map((p) => p.id) ?? Object.keys(partes);
    const numeros = ordem
      .map((id) => partes[id])
      .filter((v): v is number => typeof v === "number");
    if (numeros.length === 0) return null;
    return `${numeros.join("/")}${campo.unidade ? ` ${campo.unidade}` : ""}`;
  }
  return null;
}

/** Campo de texto livre cujo texto do dia anterior pode ser trazido (com confirmação). */
export function ehCampoDeTextoRepetivel(campo: Campo): boolean {
  return campo.tipo === "texto" || campo.tipo === "texto_longo";
}

export interface TextoTrazido {
  texto: string;
  /** Dia do acompanhamento de onde veio (D3). */
  deDia: number;
}

export type TrazidosDoDia = Record<string, TextoTrazido>;

/** Traz o texto do dia anterior para conferir; ainda não conta como resposta. */
export function trazerTexto(
  trazidos: TrazidosDoDia,
  endereco: EnderecoCampo,
  referencia: ReferenciaDoDia,
): TrazidosDoDia {
  if (typeof referencia.valor !== "string" || referencia.valor.trim() === "") {
    return trazidos;
  }
  return {
    ...trazidos,
    [chaveEndereco(endereco)]: {
      texto: referencia.valor,
      deDia: referencia.diaNumero,
    },
  };
}

/** Descarta o texto trazido ("Apagar e escrever"). */
export function descartarTextoTrazido(
  trazidos: TrazidosDoDia,
  endereco: EnderecoCampo,
): TrazidosDoDia {
  const { [chaveEndereco(endereco)]: _descartado, ...resto } = trazidos;
  void _descartado;
  return resto;
}

/**
 * "Vale para hoje": só aqui o texto do dia anterior vira resposta de hoje.
 * `textoFinal` permite confirmar depois de uma edição.
 */
export function confirmarTextoTrazido(
  respostas: RespostasFormulario,
  trazidos: TrazidosDoDia,
  endereco: EnderecoCampo,
  textoFinal?: string,
): { respostas: RespostasFormulario; trazidos: TrazidosDoDia } {
  const trazido = trazidos[chaveEndereco(endereco)];
  if (!trazido) return { respostas, trazidos };
  const texto = (textoFinal ?? trazido.texto).trim();
  const restantes = descartarTextoTrazido(trazidos, endereco);
  if (texto === "") return { respostas, trazidos: restantes };
  return {
    respostas: comValor(respostas, endereco, texto),
    trazidos: restantes,
  };
}

/** Endereços dos textos trazidos que ainda esperam confirmação. */
export function textosAguardandoConfirmacao(
  trazidos: TrazidosDoDia,
  respostas: RespostasFormulario,
  campoDe: (endereco: EnderecoCampo) => Campo | undefined,
): EnderecoCampo[] {
  const aguardando: EnderecoCampo[] = [];
  for (const chave of Object.keys(trazidos)) {
    const [bloco, campo, bebe] = chave.split("|");
    if (!bloco || !campo) continue;
    const endereco: EnderecoCampo = bebe
      ? { bloco, campo, bebe }
      : { bloco, campo };
    const def = campoDe(endereco);
    // Já respondido de outro jeito: o texto trazido não conta mais.
    if (def && estaRespondido(def, lerValor(respostas, endereco))) continue;
    aguardando.push(endereco);
  }
  return aguardando;
}
