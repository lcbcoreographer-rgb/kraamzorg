/**
 * Leitor mínimo de texto de PDF, só para teste: o que o pdfkit (por baixo
 * do @react-pdf/renderer) grava é regular o bastante para decodificar sem
 * dependência nova. Cada página tem `/Contents` (stream FlateDecode) e
 * `/Resources` com `/Font << /F1 n 0 R >>`; cada fonte Type0 tem um
 * `/ToUnicode` com `beginbfrange <ini> <fim> [<u1> <u2> ...]`; o texto sai
 * em `[<hex> ...] TJ` ou `<hex> Tj` depois de `/F1 tam Tf`.
 *
 * Existe para o teste provar o que chega ao médico dentro do PDF (rodapé
 * com aviso LGPD e paginação em toda página, concordância de gênero), e
 * não só o que a biblioteca montou antes de imprimir.
 */
import zlib from "node:zlib";

function objetos(bruto: string): Map<string, { dict: string; inicio: number }> {
  const mapa = new Map<string, { dict: string; inicio: number }>();
  const padrao = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*(?=stream|endobj)/g;
  let achado: RegExpExecArray | null;
  while ((achado = padrao.exec(bruto))) {
    mapa.set(achado[1]!, {
      dict: achado[2]!,
      inicio: achado.index + achado[0].length,
    });
  }
  return mapa;
}

function stream(
  buffer: Buffer,
  bruto: string,
  objeto: { dict: string; inicio: number },
): string {
  const inicio = bruto.indexOf("stream", objeto.inicio);
  const inicioDados =
    inicio + "stream".length + (bruto[inicio + 6] === "\r" ? 2 : 1);
  const fim = bruto.indexOf("endstream", inicioDados);
  const dados = buffer.subarray(inicioDados, fim);
  return /FlateDecode/.test(objeto.dict)
    ? zlib.inflateSync(dados).toString("latin1")
    : dados.toString("latin1");
}

function hexParaUnicode(hex: string): string {
  let texto = "";
  for (let i = 0; i + 3 < hex.length; i += 4) {
    texto += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return texto;
}

function lerToUnicode(cmap: string): Map<number, string> {
  const mapa = new Map<number, string>();
  const faixas = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g;
  let faixa: RegExpExecArray | null;
  while ((faixa = faixas.exec(cmap))) {
    const inicio = parseInt(faixa[1]!, 16);
    const valores = [...faixa[3]!.matchAll(/<([0-9a-fA-F]+)>/g)];
    valores.forEach((valor, deslocamento) => {
      mapa.set(inicio + deslocamento, hexParaUnicode(valor[1]!));
    });
  }
  return mapa;
}

type Matriz = [number, number, number, number, number, number];

const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0];

/** `m` aplicada antes de `n` (regra de composição do PDF: CTM nova = m x CTM). */
function multiplicar(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

export interface TrechoPdf {
  texto: string;
  /** Origem do trecho no espaço da página, em pontos, com y medido de baixo para cima (padrão do PDF). */
  x: number;
  y: number;
}

export interface PaginaPdf {
  largura: number;
  altura: number;
  trechos: TrechoPdf[];
  /** Os trechos colados sem separador: a quebra de linha do PDF já guarda o espaço no fim da linha, e um mesmo parágrafo pode sair em vários operadores. */
  texto: string;
}

/** Páginas com o texto e a posição de cada trecho, para o teste provar o que aparece e onde (um trecho desenhado fora da página não conta como impresso). */
export function lerPaginas(buffer: Buffer): PaginaPdf[] {
  const bruto = buffer.toString("latin1");
  const todos = objetos(bruto);
  const paginas: PaginaPdf[] = [];

  for (const [, objeto] of todos) {
    if (!/\/Type \/Page\b/.test(objeto.dict)) continue;
    const idConteudo = /\/Contents (\d+) 0 R/.exec(objeto.dict)?.[1];
    const idRecursos = /\/Resources (\d+) 0 R/.exec(objeto.dict)?.[1];
    const caixa = /\/MediaBox \[([^\]]*)\]/
      .exec(objeto.dict)?.[1]
      ?.trim()
      .split(/\s+/)
      .map(Number);
    if (!idConteudo || !idRecursos || !caixa) continue;

    const recursos = todos.get(idRecursos)!.dict;
    const blocoFontes = /\/Font <<([^>]*)>>/.exec(recursos)?.[1] ?? "";
    const fontes = new Map<string, Map<number, string>>();
    for (const [, nome, id] of blocoFontes.matchAll(/\/(\w+) (\d+) 0 R/g)) {
      const fonte = todos.get(id!)!;
      const idCmap = /\/ToUnicode (\d+) 0 R/.exec(fonte.dict)?.[1];
      if (!idCmap) continue;
      fontes.set(
        nome!,
        lerToUnicode(stream(buffer, bruto, todos.get(idCmap)!)),
      );
    }

    const conteudo = stream(buffer, bruto, todos.get(idConteudo)!);
    const trechos: TrechoPdf[] = [];
    let fonteAtual = new Map<number, string>();
    let ctm: Matriz = IDENTIDADE;
    let tm: Matriz = IDENTIDADE;
    const pilha: Matriz[] = [];
    let operandos: string[] = [];

    const decodificar = (hexes: string[]) => {
      let texto = "";
      for (const hex of hexes) {
        for (let i = 0; i + 3 < hex.length; i += 4) {
          texto += fonteAtual.get(parseInt(hex.slice(i, i + 4), 16)) ?? "";
        }
      }
      return texto;
    };
    const registrar = (texto: string) => {
      const [, , , , x, y] = multiplicar(tm, ctm);
      trechos.push({ texto, x, y });
    };

    const fichas =
      /\[(?:<[0-9a-fA-F]*>|[-\d.\s])*\]|<[0-9a-fA-F]*>|\/\w+|-?\d*\.?\d+|[A-Za-z*'"]+/g;
    for (const [ficha] of conteudo.matchAll(fichas)) {
      if (!/^[A-Za-z*'"]+$/.test(ficha)) {
        operandos.push(ficha);
        continue;
      }
      const numeros = operandos.map(Number);
      switch (ficha) {
        case "q":
          pilha.push(ctm);
          break;
        case "Q":
          ctm = pilha.pop() ?? IDENTIDADE;
          break;
        case "cm":
          ctm = multiplicar(numeros.slice(-6) as Matriz, ctm);
          break;
        case "BT":
          tm = IDENTIDADE;
          break;
        case "Tm":
          tm = numeros.slice(-6) as Matriz;
          break;
        case "Td":
          tm = multiplicar([1, 0, 0, 1, numeros.at(-2)!, numeros.at(-1)!], tm);
          break;
        case "Tf":
          fonteAtual = fontes.get(operandos.at(-2)!.slice(1)) ?? new Map();
          break;
        case "TJ":
          registrar(
            decodificar(
              [...operandos.at(-1)!.matchAll(/<([0-9a-fA-F]*)>/g)].map(
                (h) => h[1]!,
              ),
            ),
          );
          break;
        case "Tj":
          registrar(decodificar([operandos.at(-1)!.slice(1, -1)]));
          break;
      }
      operandos = [];
    }

    paginas.push({
      largura: caixa[2]! - caixa[0]!,
      altura: caixa[3]! - caixa[1]!,
      trechos,
      texto: trechos.map((t) => t.texto).join(""),
    });
  }

  return paginas;
}

/** Só o texto de cada página. */
export function textoDasPaginas(buffer: Buffer): string[] {
  return lerPaginas(buffer).map((pagina) => pagina.texto);
}
