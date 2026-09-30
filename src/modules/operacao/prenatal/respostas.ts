import { formatarData } from "@/lib/formatacao";
import type {
  RespostasFormulario,
  ValorCampo,
} from "@/lib/instrumentos/respostas";
import type { Campo, DefinicaoInstrumento } from "@/lib/instrumentos/schema";

/**
 * A entrevista concluída em texto para leitura: bloco por bloco, só o que
 * foi respondido, com o rótulo e as opções da definição aprovada (nenhum
 * texto clínico mora aqui). Função pura, testada sem tela.
 */
export interface LinhaResposta {
  campo: string;
  rotulo: string;
  texto: string;
}

export interface BlocoResposta {
  bloco: string;
  titulo: string;
  linhas: LinhaResposta[];
}

function rotuloDaOpcao(campo: Campo, valor: string): string {
  if ("opcoes" in campo && Array.isArray(campo.opcoes)) {
    return campo.opcoes.find((o) => o.valor === valor)?.rotulo ?? valor;
  }
  return valor;
}

export function textoDoValor(campo: Campo, valor: ValorCampo): string {
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") {
    return campo.tipo === "numero" && campo.unidade
      ? `${String(valor).replace(".", ",")} ${campo.unidade}`
      : String(valor).replace(".", ",");
  }
  if (typeof valor === "string") {
    if (campo.tipo === "data") return formatarData(valor) ?? valor;
    return rotuloDaOpcao(campo, valor);
  }
  if (Array.isArray(valor)) {
    return valor.map((v) => rotuloDaOpcao(campo, v)).join(", ");
  }
  if ("resposta" in valor) {
    const base = valor.resposta ? "Sim" : "Não";
    return valor.texto ? `${base}, ${valor.texto}` : base;
  }
  if ("ausente" in valor) return `Sem informação: ${valor.justificativa}`;
  if ("partes" in valor) {
    return Object.values(valor.partes)
      .filter((v): v is number => typeof v === "number")
      .join("/");
  }
  if ("valor" in valor && typeof valor.valor === "number") {
    return valor.complemento
      ? `${valor.valor}, ${valor.complemento}`
      : String(valor.valor);
  }
  return "";
}

export function respostasEmTexto(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
): BlocoResposta[] {
  const saida: BlocoResposta[] = [];
  for (const bloco of definicao.blocos) {
    const doBloco = respostas.blocos[bloco.id] ?? {};
    const linhas: LinhaResposta[] = [];
    for (const campo of bloco.campos) {
      const valor = doBloco[campo.id];
      if (valor === undefined) continue;
      const texto = textoDoValor(campo, valor);
      if (texto.trim() === "") continue;
      linhas.push({ campo: campo.id, rotulo: campo.rotulo, texto });
    }
    if (linhas.length > 0) {
      saida.push({ bloco: bloco.id, titulo: bloco.titulo, linhas });
    }
  }
  return saida;
}
