import "server-only";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import type { Json } from "@/lib/db/types";
import type { FormularioContratoRepositorio } from "../repositorios";
import type {
  AberturaFormulario,
  DadosFormularioContrato,
  ResultadoEnvioFormulario,
  TextosFormulario,
} from "../tipos-venda";
import { exigir } from "./comum";

/**
 * Formulário seguro público na real (P30 item 2). Sem usuário logado: o
 * servidor, depois de conferir o Turnstile, chama as duas funções
 * public.formulario_contrato_* (0018) com o cliente de serviço (motivo
 * formulario_contrato), único papel com execute nelas. As funções validam
 * o token de uso único, a validade e o limite de tentativas por dentro, e
 * nunca devolvem CPF, e-mail ou endereço.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}

function textos(valor: Json | undefined): TextosFormulario {
  const saida: Record<string, string> = {};
  for (const [chave, texto] of Object.entries(objeto(valor))) {
    if (typeof texto === "string") saida[chave] = texto;
  }
  return saida as TextosFormulario;
}

const numeroOuNulo = (v: Json | undefined) =>
  typeof v === "number" ? v : null;
const textoOuNulo = (v: Json | undefined) =>
  typeof v === "string" ? v : null;

export function aberturaDoBanco(valor: Json): AberturaFormulario {
  const r = objeto(valor);
  if (r.situacao === "limite") {
    return {
      situacao: "limite",
      minutos: numeroOuNulo(r.minutos),
      textos: textos(r.textos),
    };
  }
  if (r.situacao !== "valido") {
    return { situacao: "invalido", textos: textos(r.textos) };
  }
  return {
    situacao: "valido",
    expiraEm: String(r.expira_em),
    pedePagador: r.pede_pagador === true,
    nomeGestante: textoOuNulo(objeto(r.gestante).nome),
    nomePagador: textoOuNulo(objeto(r.pagador).nome),
    nomeTestemunha: textoOuNulo(objeto(r.testemunha).nome),
    termoVersao: textoOuNulo(r.termo_versao),
    textos: textos(r.textos),
  };
}

export function envioDoBanco(valor: Json): ResultadoEnvioFormulario {
  const r = objeto(valor);
  switch (r.situacao) {
    case "recebido":
      return { situacao: "recebido" };
    case "limite":
      return { situacao: "limite", minutos: numeroOuNulo(r.minutos) };
    case "corrigir": {
      const erros: Record<string, string> = {};
      for (const [campo, codigo] of Object.entries(objeto(r.erros))) {
        if (typeof codigo === "string") erros[campo] = codigo;
      }
      return { situacao: "corrigir", erros };
    }
    default:
      return { situacao: "invalido" };
  }
}

/** Formato que public.formulario_contrato_enviar lê (snake_case). */
export function dadosParaBanco(dados: DadosFormularioContrato): Json {
  const endereco = (e: DadosFormularioContrato["gestante"]["endereco"]) => ({
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    uf: e.uf,
  });
  return {
    gestante: {
      nome_completo: dados.gestante.nomeCompleto,
      cpf: dados.gestante.cpf,
      data_nascimento: dados.gestante.dataNascimento,
      email: dados.gestante.email,
      endereco: endereco(dados.gestante.endereco),
    },
    atendimento_no_mesmo_endereco: dados.atendimentoNoMesmoEndereco,
    endereco_atendimento: dados.enderecoAtendimento
      ? endereco(dados.enderecoAtendimento)
      : null,
    pagador: dados.pagador
      ? {
          nome_completo: dados.pagador.nomeCompleto,
          cpf: dados.pagador.cpf,
          email: dados.pagador.email,
          endereco: endereco(dados.pagador.endereco),
        }
      : null,
    testemunha: dados.testemunha
      ? {
          nome_completo: dados.testemunha.nomeCompleto,
          email: dados.testemunha.email,
        }
      : null,
    consentimento: {
      aceito: dados.consentimento.aceito,
      versao: dados.consentimento.versao,
    },
  };
}

export function criarFormularioSupabase(): FormularioContratoRepositorio {
  const cliente = () => criarClienteServico("formulario_contrato");
  return {
    async abrir(token, origem) {
      const resposta = await cliente().rpc("formulario_contrato_abrir", {
        token,
        origem: origem ?? undefined,
      });
      return aberturaDoBanco(exigir(resposta, "formulario_contrato_abrir"));
    },
    async enviar(token, dados, origem) {
      const resposta = await cliente().rpc("formulario_contrato_enviar", {
        token,
        dados: dadosParaBanco(dados),
        origem: origem ?? undefined,
      });
      return envioDoBanco(exigir(resposta, "formulario_contrato_enviar"));
    },
  };
}
