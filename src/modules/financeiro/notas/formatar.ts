import type { DadosEmissaoNota } from "@/lib/dados/tipos-nota";
import { formatarMoeda } from "@/lib/formatacao";
import type { DadosParaEmissaoManual } from "./estado-acoes";

/** CPF com pontuação para copiar no portal do provedor (11 dígitos; outro tamanho volta como veio). */
export function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** CEP com hífen; outro tamanho volta como veio. */
export function formatarCep(cep: string): string {
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8
    ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
    : cep;
}

/** Os dados que o financeiro copia para emitir a nota à mão, em texto pronto para a tela. */
export function dadosParaEmissaoManual(
  dados: DadosEmissaoNota,
): DadosParaEmissaoManual {
  const e = dados.tomador.endereco;
  return {
    tomadorNome: dados.tomador.nome,
    tomadorCpf: formatarCpf(dados.tomador.cpf),
    tomadorEmail: dados.tomador.email,
    endereco: e
      ? `${e.logradouro}, ${e.numero}, ${e.bairro}, CEP ${formatarCep(e.cep)}, ${e.uf} (município IBGE ${e.municipioCodigoIbge})`
      : null,
    valor: formatarMoeda(dados.valorCentavos),
    codigoServico: dados.codigoServico,
    descricaoServico: dados.descricaoServico,
  };
}
