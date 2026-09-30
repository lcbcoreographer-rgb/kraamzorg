import type { Json } from "@/lib/db/types";
import type { DadosKraamzorgContrato, ModeloContrato } from "./tipos-contrato";
import type { EnderecoFormulario } from "./tipos-venda";

/**
 * Leitura do jsonb do contrato (parametro.contrato_modelo,
 * parametro.contrato_kraamzorg e endereços) para os tipos da tela. Sem
 * dependência de servidor: a implementação real (supabase/contrato.ts) e a
 * demonstração leem o mesmo formato, o do banco.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

export function enderecoDoBanco(valor: Json | undefined): EnderecoFormulario {
  const e = objeto(valor);
  return {
    cep: texto(e.cep) ?? "",
    logradouro: texto(e.logradouro) ?? "",
    numero: texto(e.numero) ?? "",
    complemento: texto(e.complemento) ?? "",
    bairro: texto(e.bairro) ?? "",
    cidade: texto(e.cidade) ?? "",
    uf: texto(e.uf) ?? "",
  };
}

export function modeloDoBanco(valor: Json | undefined): ModeloContrato {
  const m = objeto(valor);
  const partes = objeto(m.partes);
  const v = objeto(m.valores);
  return {
    versao: texto(m.versao) ?? "",
    aprovado: m.aprovado === true,
    titulo: texto(m.titulo) ?? "",
    avisoRascunho: texto(m.aviso_rascunho),
    profissional: texto(m.profissional) ?? "",
    partes: {
      contratada: texto(partes.contratada) ?? "",
      contratante: texto(partes.contratante) ?? "",
      pagador: texto(partes.pagador) ?? "",
      testemunha: texto(partes.testemunha) ?? "",
    },
    frentes: lista(m.frentes).filter((i): i is string => typeof i === "string"),
    valores: {
      pacote: texto(v.pacote) ?? "",
      desconto: texto(v.desconto) ?? "",
      taxa: texto(v.taxa) ?? "",
      total: texto(v.total) ?? "",
      forma: texto(v.forma) ?? "",
      formaUmaVez: texto(v.forma_uma_vez) ?? "",
      formaParcelada: texto(v.forma_parcelada) ?? "",
    },
    clausulas: lista(m.clausulas).map((c) => {
      const x = objeto(c);
      return {
        titulo: texto(x.titulo) ?? "",
        texto: texto(x.texto) ?? "",
        comFrentes: x.com_frentes === true,
        valores: x.valores === true,
        somentePresente: x.somente_presente === true,
      };
    }),
    assinaturas: texto(m.assinaturas) ?? "",
  };
}

export function kraamzorgDoBanco(
  valor: Json | undefined,
): DadosKraamzorgContrato {
  const k = objeto(valor);
  return {
    signatarioNome: texto(k.signatario_nome) ?? "",
    signatarioEmail: texto(k.signatario_email) ?? "",
    razaoSocial: texto(k.razao_social) ?? "",
    documento: texto(k.documento) ?? "",
    endereco: texto(k.endereco) ?? "",
  };
}
