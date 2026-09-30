import "server-only";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import type { Json } from "@/lib/db/types";
import type {
  AberturaCandidatura,
  DadosCandidatura,
  InicioCaptacao,
  PaginaCaptacao,
  RelacaoPublicaRepositorio,
  ResultadoCandidatura,
  SituacaoPedidoLink,
} from "../tipos-relacao";
import { exigir } from "./comum";
import { numeroOuNulo, objeto, texto } from "./equipe";

/**
 * Páginas abertas do relacionamento na real (P47, P49 e P51). Sem usuário
 * logado: o servidor, depois de conferir o Turnstile, chama só as seis
 * funções public.* da 0027_relacao.sql com o cliente de serviço (motivo
 * paginas_abertas_relacao), único papel com execute nelas. As funções
 * limitam a taxa por dentro (origem em HMAC) e nunca devolvem dado pessoal.
 */

function textos(v: Json | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(objeto(v))) {
    if (typeof valor === "string") saida[chave] = valor;
  }
  return saida;
}

export function paginaCaptacaoDoBanco(valor: Json): PaginaCaptacao {
  const r = objeto(valor);
  return {
    situacao: r.situacao === "ok" ? "ok" : "indisponivel",
    textos: textos(r.textos),
  };
}

export function inicioCaptacaoDoBanco(valor: Json): InicioCaptacao {
  const r = objeto(valor);
  if (r.situacao === "ok") {
    return {
      situacao: "ok",
      numeroE164: texto(r.numero_e164) ?? undefined,
      codigo: texto(r.codigo) ?? undefined,
      texto: texto(r.texto) ?? undefined,
      textos: textos(r.textos),
    };
  }
  if (r.situacao === "limite") {
    return { situacao: "limite", minutos: numeroOuNulo(r.minutos), textos: textos(r.textos) };
  }
  return { situacao: "indisponivel", textos: textos(r.textos) };
}

export function aberturaCandidaturaDoBanco(valor: Json): AberturaCandidatura {
  const r = objeto(valor);
  return {
    situacao: r.situacao === "ok" ? "ok" : "desligada",
    termoVersao: texto(r.termo_versao),
    textos: textos(r.textos),
  };
}

export function resultadoCandidaturaDoBanco(valor: Json): ResultadoCandidatura {
  const r = objeto(valor);
  switch (r.situacao) {
    case "recebido":
      return { situacao: "recebido" };
    case "limite":
      return { situacao: "limite", minutos: numeroOuNulo(r.minutos) };
    case "corrigir":
      return { situacao: "corrigir", erros: textos(r.erros) };
    default:
      return { situacao: "desligada" };
  }
}

export function criarRelacaoPublicaSupabase(): RelacaoPublicaRepositorio {
  const chamar = async (funcao: string, args: Record<string, unknown>): Promise<Json> => {
    const cliente = criarClienteServico("paginas_abertas_relacao");
    const resposta = await (
      cliente as unknown as {
        rpc(
          nome: string,
          parametros: Record<string, unknown>,
        ): PromiseLike<{ data: Json | null; error: { code?: string; message?: string } | null }>;
      }
    ).rpc(funcao, args);
    return exigir(resposta, `public.${funcao}`);
  };

  return {
    async paginaCaptacao(canal) {
      return paginaCaptacaoDoBanco(await chamar("captacao_pagina", { canal }));
    },
    async iniciarCaptacao(canal, utm, origem) {
      return inicioCaptacaoDoBanco(await chamar("captacao_iniciar", { canal, utm, origem }));
    },
    async paginaEntradaPortal() {
      const r = objeto(await chamar("portal_familia_pagina", {}));
      return { entrar: textos(r.entrar), link: textos(r.link) };
    },
    async localizarAcessoPortal(email, origem) {
      const r = objeto(await chamar("portal_familia_localizar", { email, origem }));
      const situacao: SituacaoPedidoLink =
        r.situacao === "ok" || r.situacao === "limite" ? r.situacao : "nao_encontrado";
      return { situacao, minutos: numeroOuNulo(r.minutos) };
    },
    async vincularContaPortal(email, usuarioId) {
      const r = objeto(
        await chamar("portal_familia_vincular", { email, usuario_id: usuarioId }),
      );
      return r.situacao === "ok" || r.situacao === "conflito" ? r.situacao : "nao_encontrado";
    },
    async abrirCandidatura() {
      return aberturaCandidaturaDoBanco(await chamar("candidatura_abrir", {}));
    },
    async enviarCandidatura(dados: DadosCandidatura, origem) {
      return resultadoCandidaturaDoBanco(
        await chamar("candidatura_enviar", {
          dados: {
            nome: dados.nome,
            telefone: dados.telefone,
            email: dados.email,
            cidade: dados.cidade,
            conselho: dados.conselho,
            apresentacao: dados.apresentacao,
            consentimento: { aceito: true, versao: dados.consentimentoVersao },
          },
          origem,
        }),
      );
    },
  };
}
