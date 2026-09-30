import type {
  FormatoExtrato,
  LinhaExtratoEntrada,
} from "@/lib/dados/tipos-gestao";

/**
 * Leitura do arquivo de extrato do banco (P46 item 4): OFX ou CSV, lida no
 * servidor. Devolve só o que a conferência usa (data, valor em centavos com
 * sinal, descrição e documento). O conteúdo bruto não é guardado: o banco fica
 * com as linhas e o sha256 do arquivo (idempotência da importação). O extrato
 * nunca é gatilho de baixa (D-07).
 */

export type ResultadoLeitura =
  | { ok: true; formato: FormatoExtrato; linhas: LinhaExtratoEntrada[] }
  | {
      ok: false;
      erro:
        | "arquivo_vazio"
        | "formato_nao_reconhecido"
        | "sem_linhas"
        | "linha_invalida";
      /** Número da linha (ou do lançamento) com problema, a partir de 1. */
      linha?: number;
    };

const MAX_DESCRICAO = 200;
const MAX_DOCUMENTO = 80;

function limpar(texto: string, max: number): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * "1.234,56", "-126.67", "R$ 4.350,00", "(120,00)" e "120,00-" viram
 * centavos inteiros, sem passar por ponto flutuante. O separador decimal é o
 * último "," ou "." quando vem seguido de 1 ou 2 dígitos no fim; qualquer
 * outro separador é de milhar. Devolve null se não for um valor.
 */
export function valorParaCentavos(bruto: string): number | null {
  let t = bruto.trim().replace(/R\$/gi, "").replace(/\s+/g, "");
  if (t === "") return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith("-")) {
    negativo = true;
    t = t.slice(1);
  } else if (t.startsWith("+")) {
    t = t.slice(1);
  }
  if (t.endsWith("-")) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const decimal = /^(.*\d)[.,](\d{1,2})$/.exec(t);
  let inteiro: string;
  let fracao: string;
  if (decimal) {
    inteiro = (decimal[1] ?? "").replace(/[.,]/g, "");
    fracao = (decimal[2] ?? "").padEnd(2, "0");
  } else {
    inteiro = t.replace(/[.,]/g, "");
    fracao = "00";
  }
  if (inteiro === "" || inteiro.length > 12) return null;
  const centavos = Number(inteiro) * 100 + Number(fracao);
  if (!Number.isSafeInteger(centavos)) return null;
  return negativo ? -centavos : centavos;
}

/** "10/05/2026", "10-05-2026" ou "2026-05-10" viram "2026-05-10". */
export function dataParaIso(bruto: string): string | null {
  const t = bruto.trim();
  const br = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const [ano, mes, dia] = br
    ? [br[3], br[2], br[1]]
    : iso
      ? [iso[1], iso[2], iso[3]]
      : [undefined, undefined, undefined];
  if (!ano || !mes || !dia) return null;
  const d = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    d.getUTCFullYear() !== Number(ano) ||
    d.getUTCMonth() !== Number(mes) - 1 ||
    d.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

function etiqueta(bloco: string, nome: string): string | null {
  const achado = new RegExp(`<${nome}>\\s*([^<\\r\\n]*)`, "i").exec(bloco);
  return achado?.[1]?.trim() ?? null;
}

function lerOfx(texto: string): ResultadoLeitura {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  if (blocos.length === 0) return { ok: false, erro: "sem_linhas" };
  const linhas: LinhaExtratoEntrada[] = [];
  for (const [i, bloco] of blocos.entries()) {
    const dt = etiqueta(bloco, "DTPOSTED");
    const valor = etiqueta(bloco, "TRNAMT");
    const data = dt
      ? dataParaIso(`${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`)
      : null;
    const centavos = valor === null ? null : valorParaCentavos(valor);
    if (!data || centavos === null || centavos === 0) {
      return { ok: false, erro: "linha_invalida", linha: i + 1 };
    }
    const memo = etiqueta(bloco, "MEMO") ?? etiqueta(bloco, "NAME") ?? "";
    const fitid = etiqueta(bloco, "FITID");
    linhas.push({
      data,
      valorCentavos: centavos,
      descricao: limpar(memo, MAX_DESCRICAO) || "Sem descrição",
      documento: fitid ? limpar(fitid, MAX_DOCUMENTO) : null,
    });
  }
  return { ok: true, formato: "ofx", linhas };
}

function semAcento(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Divide uma linha de CSV respeitando aspas. */
function dividirCsv(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i] as string;
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

const COLUNAS = {
  data: [
    "data",
    "date",
    "dt",
    "data lancamento",
    "data do lancamento",
    "data movimento",
  ],
  descricao: [
    "descricao",
    "historico",
    "memo",
    "lancamento",
    "description",
    "detalhes",
  ],
  valor: ["valor", "amount", "value", "valor (r$)", "valor r$"],
  credito: ["credito", "creditos", "entrada", "entradas"],
  debito: ["debito", "debitos", "saida", "saidas"],
  documento: [
    "documento",
    "doc",
    "id",
    "fitid",
    "numero",
    "nº documento",
    "n documento",
  ],
} as const;

function acharColuna(cabecalho: string[], nomes: readonly string[]): number {
  return cabecalho.findIndex((c) => nomes.includes(semAcento(c)));
}

function lerCsv(texto: string): ResultadoLeitura {
  const linhasBrutas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const primeira = linhasBrutas[0];
  if (!primeira) return { ok: false, erro: "arquivo_vazio" };
  const sep =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const cab = dividirCsv(primeira, sep);
  const iData = acharColuna(cab, COLUNAS.data);
  const iDesc = acharColuna(cab, COLUNAS.descricao);
  const iValor = acharColuna(cab, COLUNAS.valor);
  const iCred = acharColuna(cab, COLUNAS.credito);
  const iDeb = acharColuna(cab, COLUNAS.debito);
  const iDoc = acharColuna(cab, COLUNAS.documento);
  if (iData < 0 || (iValor < 0 && iCred < 0 && iDeb < 0)) {
    return { ok: false, erro: "formato_nao_reconhecido" };
  }
  const linhas: LinhaExtratoEntrada[] = [];
  for (const [i, bruta] of linhasBrutas.slice(1).entries()) {
    const c = dividirCsv(bruta, sep);
    const data = dataParaIso(c[iData] ?? "");
    let centavos: number | null = null;
    if (iValor >= 0) {
      centavos = valorParaCentavos(c[iValor] ?? "");
    } else {
      const cred = (c[iCred] ?? "").trim()
        ? valorParaCentavos(c[iCred] ?? "")
        : null;
      const deb = (c[iDeb] ?? "").trim()
        ? valorParaCentavos(c[iDeb] ?? "")
        : null;
      centavos =
        cred !== null ? Math.abs(cred) : deb !== null ? -Math.abs(deb) : null;
    }
    if (!data || centavos === null || centavos === 0) {
      return { ok: false, erro: "linha_invalida", linha: i + 2 };
    }
    const doc = iDoc >= 0 ? limpar(c[iDoc] ?? "", MAX_DOCUMENTO) : "";
    linhas.push({
      data,
      valorCentavos: centavos,
      descricao:
        (iDesc >= 0 ? limpar(c[iDesc] ?? "", MAX_DESCRICAO) : "") ||
        "Sem descrição",
      documento: doc || null,
    });
  }
  if (linhas.length === 0) return { ok: false, erro: "sem_linhas" };
  return { ok: true, formato: "csv", linhas };
}

/** Lê o texto do arquivo: OFX (tem `<STMTTRN>`) ou CSV com cabeçalho. */
export function lerExtrato(texto: string): ResultadoLeitura {
  if (texto.trim() === "") return { ok: false, erro: "arquivo_vazio" };
  if (/<STMTTRN>/i.test(texto) || /<OFX>/i.test(texto)) return lerOfx(texto);
  return lerCsv(texto);
}

/** sha256 em hexadecimal do conteúdo do arquivo (idempotência da importação). */
export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const resumo = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(resumo)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
