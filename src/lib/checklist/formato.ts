/**
 * Formatação de valores do checklist para a tela (formato brasileiro:
 * vírgula decimal, unidade com espaço). Funções puras.
 */

import type { Campo } from "@/lib/instrumentos/schema";

/** 38.2 vira "38,2"; 3240 vira "3.240". */
export function formatarNumero(numero: number, casas?: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas ?? 0,
    maximumFractionDigits: casas ?? 3,
  }).format(numero);
}

/** "36,9 °C", "78 bpm", "3.240 g". Sem unidade, só o número. */
export function formatarComUnidade(
  numero: number,
  unidade?: string,
  casas?: number,
): string {
  const texto = formatarNumero(numero, casas);
  if (!unidade) return texto;
  return `${texto} ${unidade}`;
}

/**
 * Valor de um campo do registro como a enfermeira o lê ("36,9 °C",
 * "120/80 mmHg", "Sim"). Devolve null quando não há o que mostrar.
 */
export function valorLegivel(
  campo: Campo | undefined,
  valor: unknown,
): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "number") {
    return formatarComUnidade(
      valor,
      campo?.tipo === "numero" ? campo.unidade : undefined,
      campo?.tipo === "numero" ? campo.casas_decimais : undefined,
    );
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string") return valor.trim() === "" ? null : valor;
  if (Array.isArray(valor)) return valor.map(String).join(", ");
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    if (objeto.partes && typeof objeto.partes === "object") {
      const partes = objeto.partes as Record<string, unknown>;
      const ordem =
        campo?.tipo === "numero" && campo.partes
          ? campo.partes.map((p) => p.id)
          : Object.keys(partes);
      const numeros = ordem
        .map((id) => partes[id])
        .filter((v): v is number => typeof v === "number");
      if (numeros.length === 0) return null;
      const unidade = campo?.tipo === "numero" ? campo.unidade : undefined;
      return `${numeros.join("/")}${unidade ? ` ${unidade}` : ""}`;
    }
    if ("resposta" in objeto) return objeto.resposta ? "Sim" : "Não";
    if ("valor" in objeto && typeof objeto.valor === "number")
      return String(objeto.valor);
  }
  return null;
}

/**
 * Valor observado que vai para `alerta_clinico.valor_observado` (texto):
 * "38,2" para número, "Sim" ou "Não" para resposta, texto como veio.
 */
export function valorObservadoEmTexto(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "number") return formatarNumero(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string") return valor.trim() === "" ? null : valor;
  return null;
}

/** "29/09/2026" a partir de "2026-09-29" (sem passar por fuso). */
export function dataCurta(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

/** "29/09" a partir de "2026-09-29". */
export function diaEMes(data: string): string {
  const [, mes, dia] = data.slice(0, 10).split("-");
  return mes && dia ? `${dia}/${mes}` : data;
}

/**
 * Resposta como a enfermeira a relê (registro assinado, resumo): opção pelo
 * rótulo, "Sim. Quem: avó", nota com classificação ("9 · Ótimo"), ausência
 * justificada. Nulo quando não há o que mostrar.
 */
export function respostaParaLeitura(
  campo: Campo,
  valor: unknown,
): string | null {
  if (valor === undefined || valor === null) return null;
  const rotuloDa = (v: string) => {
    if (campo.tipo === "opcao_unica" || campo.tipo === "multipla") {
      return campo.opcoes.find((o) => o.valor === v)?.rotulo ?? v;
    }
    return v;
  };
  if (typeof valor === "string") {
    if (valor.trim() === "") return null;
    if (campo.tipo === "data" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
      return dataCurta(valor);
    }
    return rotuloDa(valor);
  }
  if (Array.isArray(valor)) {
    return valor.length === 0
      ? null
      : valor.map((v) => rotuloDa(String(v))).join(", ");
  }
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    if ("ausente" in objeto) {
      return `Não informado. ${String(objeto.justificativa ?? "").trim()}`.trim();
    }
    if ("resposta" in objeto) {
      const base = objeto.resposta ? "Sim" : "Não";
      const rotulo =
        campo.tipo === "sim_nao_texto"
          ? (campo.rotulo_texto ?? "Detalhe")
          : "Detalhe";
      const texto = typeof objeto.texto === "string" ? objeto.texto.trim() : "";
      return texto ? `${base}. ${rotulo}: ${texto}` : base;
    }
    if ("valor" in objeto && typeof objeto.valor === "number") {
      const complemento =
        campo.tipo === "escala" &&
        campo.complemento &&
        typeof objeto.complemento === "string"
          ? campo.complemento.opcoes.find((o) => o.valor === objeto.complemento)
              ?.rotulo
          : null;
      return complemento
        ? `${objeto.valor} · ${complemento}`
        : String(objeto.valor);
    }
  }
  return valorLegivel(campo, valor);
}
