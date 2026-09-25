import "server-only";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { obterLoja } from "@/lib/dados/demonstracao/loja";
import { garantirDemonstracaoPermitida } from "@/lib/dados/modo";
import {
  CODIGO_MFA_DEMONSTRACAO,
  codificarCookieDemonstracao,
  COOKIE_DEMONSTRACAO,
  lerCookieDemonstracao,
  OPCOES_COOKIE_DEMONSTRACAO,
  type CookieDemonstracao,
} from "./demonstracao-cookie";
import { sessaoDemonstracaoDoCookie } from "./demonstracao-sessao";
import type { ProvedorAutenticacao, SessaoUsuario } from "./tipos";

/**
 * Autenticação do modo demonstração: a tela de entrar vira um seletor das
 * pessoas fictícias do seed, o MFA aceita o código do protótipo e a
 * revogação de sessões da diretoria derruba o cookie. Lança erro fora de
 * desenvolvimento (garantirDemonstracaoPermitida).
 */
export function criarAutenticacaoDemonstracao(): ProvedorAutenticacao {
  garantirDemonstracaoPermitida();

  async function gravar(dados: CookieDemonstracao) {
    const loja = await cookies();
    loja.set(
      COOKIE_DEMONSTRACAO,
      codificarCookieDemonstracao(dados),
      OPCOES_COOKIE_DEMONSTRACAO,
    );
  }

  async function sessaoAtual(): Promise<SessaoUsuario | null> {
    const loja = await cookies();
    return sessaoDemonstracaoDoCookie(loja.get(COOKIE_DEMONSTRACAO)?.value);
  }

  async function subirParaAal2(usuarioId: string) {
    const loja = await cookies();
    const atual = lerCookieDemonstracao(loja.get(COOKIE_DEMONSTRACAO)?.value);
    await gravar({ u: usuarioId, aal: "aal2", em: atual?.em ?? Date.now() });
  }

  return {
    formaDeEntrada() {
      return {
        tipo: "seletor",
        opcoes: obterLoja()
          .usuarios.filter((u) => u.ativo)
          .map((u) => ({
            usuarioId: u.id,
            nome: u.nome,
            papeis: [...u.papeis],
          })),
      };
    },

    obterSessao: sessaoAtual,

    async entrarComSenha() {
      return { ok: false, erro: "indisponivel" };
    },

    async entrarPorSeletor(usuarioId) {
      const usuario = obterLoja().usuarios.find(
        (u) => u.id === usuarioId && u.ativo,
      );
      if (!usuario) return { ok: false, erro: "credenciais" };
      await gravar({ u: usuario.id, aal: "aal1", em: Date.now() });
      return { ok: true };
    },

    async sair() {
      const loja = await cookies();
      loja.delete(COOKIE_DEMONSTRACAO);
    },

    async iniciarCadastroMfa() {
      const sessao = await sessaoAtual();
      if (!sessao) return { erro: "sem_sessao" };
      const segredo = "KZDEMONSTRACAOTOTP";
      const uri = `otpauth://totp/${encodeURIComponent(`Kraamzorg OS:${sessao.email}`)}?secret=${segredo}&issuer=${encodeURIComponent("Kraamzorg OS")}`;
      const svg = await QRCode.toString(uri, { type: "svg", margin: 1 });
      return {
        fatorId: "fator-demonstracao",
        qrCodeSvg: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
        segredo,
      };
    },

    async confirmarCadastroMfa(_fatorId, codigo) {
      const sessao = await sessaoAtual();
      if (!sessao) return { ok: false, erro: "sem_sessao" };
      if (codigo !== CODIGO_MFA_DEMONSTRACAO)
        return { ok: false, erro: "codigo_invalido" };
      const usuario = obterLoja().usuarios.find(
        (u) => u.id === sessao.usuarioId,
      );
      if (usuario) usuario.mfaCadastrado = true;
      await subirParaAal2(sessao.usuarioId);
      return { ok: true };
    },

    async verificarMfa(codigo) {
      const sessao = await sessaoAtual();
      if (!sessao) return { ok: false, erro: "sem_sessao" };
      if (sessao.aalPossivel !== "aal2" || codigo !== CODIGO_MFA_DEMONSTRACAO) {
        return { ok: false, erro: "codigo_invalido" };
      }
      await subirParaAal2(sessao.usuarioId);
      return { ok: true };
    },

    ajudaDesafioMfa() {
      return `Modo demonstração: o código é ${CODIGO_MFA_DEMONSTRACAO}.`;
    },

    async enviarRecuperacaoSenha() {
      return { ok: true };
    },

    async definirSenha(novaSenha) {
      const sessao = await sessaoAtual();
      if (!sessao) return { ok: false, erro: "sem_sessao" };
      return novaSenha.length >= 12
        ? { ok: true }
        : { ok: false, erro: "senha_fraca" };
    },

    async confirmarLinkEmail() {
      return { ok: false, erro: "link_invalido" };
    },
  };
}
