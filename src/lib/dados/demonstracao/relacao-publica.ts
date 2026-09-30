import type { Json } from "@/lib/db/types";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  ContatoEquipePortal,
  DadosCandidatura,
  PortalFamilia,
  PortalFamiliaRepositorio,
  RelacaoPublicaRepositorio,
  TextosPortal,
} from "../tipos-relacao";
import {
  hojeDemonstracao,
  novoId,
  obterLojaRelacao,
  type LojaRelacao,
} from "./relacao-loja";
import { TEXTOS_RELACAO } from "./relacao-seed.gerado";

/**
 * Páginas abertas e portal da família no modo demonstração (P47, P49 e P51),
 * sobre a mesma loja em memória. Imita as seis funções public.* e a função
 * api.portal_familia da 0027_relacao.sql: limite de taxa, resposta igual para
 * e-mail desconhecido, portal só da própria pessoa e só o contato em
 * bloqueio_total. Sem e-mail de verdade: o link aparece na própria tela
 * (src/modules/familia).
 */

/** Textos de mensagem_modelo (canal site, para a família) por prefixo, sem o prefixo na chave. */
export function textosSite(
  prefixo: string,
  nome: string | null = null,
): TextosPortal {
  const saida: TextosPortal = {};
  for (const t of TEXTOS_RELACAO) {
    if (t.canal !== "site" || t.destinatario !== "familia") continue;
    if (!t.chave.startsWith(prefixo)) continue;
    saida[t.chave.slice(prefixo.length)] = t.texto
      .replaceAll("{nome}", nome ?? "")
      .replace(/,\s*\./, ".");
  }
  return saida;
}

function parametro(l: LojaRelacao, chave: string): Record<string, Json> {
  const v = l.parametros[chave];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};
}

/** Verdadeiro se a chave já fez o máximo de chamadas na janela; senão conta esta. */
function limitado(
  l: LojaRelacao,
  escopo: string,
  chave: string | null,
  maximo: unknown,
  janelaMinutos: unknown,
): boolean {
  if (typeof maximo !== "number" || typeof janelaMinutos !== "number")
    return false;
  const k = `${escopo}:${chave ?? "sem-origem"}`;
  const agora = Date.now();
  const recentes = (l.tentativas[k] ?? []).filter(
    (t) => agora - t < janelaMinutos * 60_000,
  );
  if (recentes.length >= maximo) {
    l.tentativas[k] = recentes;
    return true;
  }
  l.tentativas[k] = [...recentes, agora];
  return false;
}

const UTM_CHAVES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function limparUtm(
  utm: Record<string, string>,
  tamanhoMax = 80,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const chave of UTM_CHAVES) {
    const v = utm[chave];
    if (
      typeof v === "string" &&
      v.length >= 1 &&
      v.length <= tamanhoMax &&
      /^[A-Za-z0-9 _.,:+~%/-]+$/.test(v)
    ) {
      saida[chave] = v;
    }
  }
  return saida;
}

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function tokenVisita(): string {
  let saida = "";
  for (let i = 0; i < 6; i += 1)
    saida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return saida;
}

export function criarRelacaoPublicaDemonstracao(): RelacaoPublicaRepositorio {
  garantirDemonstracaoPermitida();
  const loja = () => obterLojaRelacao();

  return {
    async paginaCaptacao(canal) {
      const c = loja().canais.find(
        (x) => x.codigo === canal.trim().toUpperCase(),
      );
      return {
        situacao: c?.ativo ? "ok" : "indisponivel",
        textos: textosSite("captacao_"),
      };
    },

    async iniciarCaptacao(canal, utm, origem) {
      const l = loja();
      const cfg = parametro(l, "captacao");
      const textos = textosSite("captacao_");
      if (
        limitado(l, "captacao", origem, cfg.tentativas_max, cfg.janela_minutos)
      ) {
        return {
          situacao: "limite",
          minutos: cfg.janela_minutos as number,
          textos,
        };
      }
      const c = l.canais.find(
        (x) => x.codigo === canal.trim().toUpperCase() && x.ativo,
      );
      if (!c || typeof cfg.numero_whatsapp_e164 !== "string")
        return { situacao: "indisponivel", textos };
      c.visitas += 1;
      const tamanho =
        typeof cfg.utm_tamanho_max === "number" ? cfg.utm_tamanho_max : 80;
      void limparUtm(utm, tamanho);
      const codigo = `${cfg.prefixo as string}-${c.codigo}-${tokenVisita()}`;
      const modelo =
        TEXTOS_RELACAO.find((t) => t.chave === "captacao_whatsapp")?.texto ??
        "";
      return {
        situacao: "ok",
        numeroE164: cfg.numero_whatsapp_e164,
        codigo,
        texto: modelo.replaceAll("{codigo}", codigo),
        textos,
      };
    },

    async paginaEntradaPortal() {
      return {
        entrar: textosSite("portal_entrar_"),
        link: textosSite("portal_link_"),
      };
    },

    async localizarAcessoPortal(email, origem) {
      const l = loja();
      const cfg = parametro(l, "portal_familia");
      const e = email.trim().toLowerCase();
      if (
        limitado(
          l,
          "portal_link",
          origem,
          cfg.link_max_por_origem,
          cfg.link_janela_minutos,
        ) ||
        (e &&
          limitado(
            l,
            "portal_link",
            e,
            cfg.link_max_por_email,
            cfg.link_janela_minutos,
          ))
      ) {
        return {
          situacao: "limite",
          minutos: cfg.link_janela_minutos as number,
        };
      }
      if (!e || e.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
        return { situacao: "nao_encontrado" };
      const pessoa = l.pessoasPortal.find(
        (p) => p.email?.toLowerCase() === e && p.acesso?.ativo,
      );
      const familia = l.familiasPortal.find(
        (f) => f.familiaId === pessoa?.familiaId,
      );
      if (!pessoa || !familia) return { situacao: "nao_encontrado" };
      // Freio: família em estado sensível não recebe o link; mesma resposta de e-mail desconhecido.
      if (
        familia.estadoSensivel === "bloqueio_total" ||
        familia.estadoSensivel === "encerrado_sensivel"
      ) {
        return { situacao: "nao_encontrado" };
      }
      return { situacao: "ok" };
    },

    async vincularContaPortal(email, _usuarioId) {
      const e = email.trim().toLowerCase();
      const pessoa = loja().pessoasPortal.find(
        (p) => p.email?.toLowerCase() === e && p.acesso?.ativo,
      );
      return pessoa ? "ok" : "nao_encontrado";
    },

    async abrirCandidatura() {
      const cfg = parametro(loja(), "talentos_pagina_publica");
      return {
        situacao: cfg.ativa === true ? "ok" : "desligada",
        termoVersao:
          typeof cfg.termo_versao === "string" ? cfg.termo_versao : null,
        textos: textosSite("candidatura_"),
      };
    },

    async enviarCandidatura(dados: DadosCandidatura, origem) {
      const l = loja();
      const cfg = parametro(l, "talentos_pagina_publica");
      if (cfg.ativa !== true) return { situacao: "desligada" };
      if (
        limitado(
          l,
          "candidatura",
          origem,
          cfg.tentativas_max,
          cfg.janela_minutos,
        )
      ) {
        return { situacao: "limite", minutos: cfg.janela_minutos as number };
      }
      const erros: Record<string, string> = {};
      const nome = dados.nome.trim();
      const email = dados.email.trim();
      const digitos = dados.telefone.replace(/\D/g, "");
      if (nome.length < 3 || nome.length > 120) erros.nome = "invalido";
      if (dados.telefone.trim() && (digitos.length < 8 || digitos.length > 15))
        erros.telefone = "invalido";
      if (
        email &&
        (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200)
      )
        erros.email = "invalido";
      if (!digitos && !email) erros.contato = "obrigatorio";
      if (dados.cidade.trim().length > 80) erros.cidade = "muito_longo";
      if (dados.conselho.trim().length > 60) erros.conselho = "muito_longo";
      if (dados.apresentacao.trim().length > 1500)
        erros.apresentacao = "muito_longo";
      if (dados.consentimentoVersao !== cfg.termo_versao)
        erros.consentimento = "obrigatorio";
      if (Object.keys(erros).length) return { situacao: "corrigir", erros };

      const telefoneE164 = digitos
        ? digitos.length <= 11
          ? `+55${digitos}`
          : `+${digitos}`
        : null;
      const repetida = l.candidatas.some(
        (c) =>
          (telefoneE164 && c.telefoneE164 === telefoneE164) ||
          (email && c.email?.toLowerCase() === email.toLowerCase()),
      );
      if (!repetida) {
        l.candidatas.push({
          id: novoId(l, 12),
          nome,
          telefoneE164,
          email: email || null,
          cidade: dados.cidade.trim() || null,
          conselho: dados.conselho.trim() || null,
          apresentacao: dados.apresentacao.trim() || null,
          origem: "pagina_publica",
          estado: "nova",
          observacoes: null,
          criadoEm: new Date().toISOString(),
          avaliacoes: [],
        });
      }
      return { situacao: "recebido" };
    },
  };
}

function contatoDe(v: Json | undefined): ContatoEquipePortal {
  const c =
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, Json>)
      : {};
  const s = (x: Json | undefined) => (typeof x === "string" ? x : null);
  return {
    nome: s(c.nome),
    telefoneE164: s(c.telefone_e164),
    horario: s(c.horario),
    funcao: s(c.funcao),
  };
}

/** Portal de uma pessoa da família (a conta dela, identificada pelo cookie de demonstração). */
export function criarPortalFamiliaDemonstracao(
  pessoaId: string | null,
): PortalFamiliaRepositorio {
  garantirDemonstracaoPermitida();
  return {
    async obter(): Promise<PortalFamilia | null> {
      const l = obterLojaRelacao();
      const pessoa = l.pessoasPortal.find((p) => p.pessoaId === pessoaId);
      if (!pessoa?.acesso?.ativo) return null;
      const f = l.familiasPortal.find((x) => x.familiaId === pessoa.familiaId);
      if (!f) return null;
      pessoa.acesso.ultimoAcessoEm = new Date().toISOString();
      const cfg = parametro(l, "portal_familia");
      const primeiroNome = pessoa.nome.split(" ")[0] ?? pessoa.nome;

      if (
        f.estadoSensivel === "bloqueio_total" ||
        f.estadoSensivel === "encerrado_sensivel"
      ) {
        return {
          situacao: "contato",
          primeiroNome,
          contato: contatoDe(cfg.contato_sensivel),
          textos: textosSite("portal_sensivel_", primeiroNome),
        };
      }

      const prof = f.profissionalId
        ? l.profissionaisPortal.find(
            (p) => p.profissionalId === f.profissionalId,
          )
        : null;
      return {
        situacao: "ok",
        primeiroNome,
        nomeFamilia: f.nomeExibicao,
        gemelar: f.gemelar,
        datas: {
          dpp: f.dpp,
          dataNascimento: f.dataNascimento,
          dataAlta: f.dataAlta,
          dataInicioEfetivo: f.dataInicioEfetivo,
        },
        contratoAssinadoEm: f.contratoAssinadoEm,
        pagamentoConfirmadoEm: f.pagamentoConfirmadoEm,
        prenatal: f.prenatal ? { ...f.prenatal } : null,
        acompanhamento: f.acompanhamento ? { ...f.acompanhamento } : null,
        enfermeira: prof
          ? {
              nome: prof.autorizaNome ? prof.nome : null,
              fotoPath: prof.autorizaFoto ? prof.fotoPath : null,
            }
          : null,
        visitas: f.visitas.map((v) => ({ ...v })),
        pesquisa: f.pesquisa ? { ...f.pesquisa } : null,
        evolucoes: { ativo: cfg.evolucoes_ativo === true, itens: [] },
        contato: contatoDe(cfg.contato_equipe),
        textos: textosSite("portal_", primeiroNome),
      };
    },
  };
}

/** Pessoa da demonstração que tem acesso ativo com este e-mail (para o link mostrado na tela). */
export function pessoaDoEmailDemonstracao(email: string): string | null {
  const e = email.trim().toLowerCase();
  const p = obterLojaRelacao().pessoasPortal.find(
    (x) => x.email?.toLowerCase() === e && x.acesso?.ativo,
  );
  return p?.pessoaId ?? null;
}

/** A pessoa existe e ainda tem acesso ativo (o cookie de demonstração pode ter ficado velho). */
export function pessoaAtivaDemonstracao(pessoaId: string): boolean {
  return Boolean(
    obterLojaRelacao().pessoasPortal.find((x) => x.pessoaId === pessoaId)
      ?.acesso?.ativo,
  );
}

export { hojeDemonstracao };
