import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { lerSessaoSupabase } from "./supabase-sessao";
import type {
  CodigoErroAuth,
  ProvedorAutenticacao,
  ResultadoAuth,
} from "./tipos";

/**
 * Autenticação real: Supabase Auth com e-mail e senha e MFA TOTP (PRD 5.1,
 * 13 e 21.2). A sessão vive nos cookies do @supabase/ssr; o proxy renova o
 * token a cada requisição. Sessão de 8 horas e o bloqueio por tentativas
 * são configuração do Supabase Auth (time-box de sessão e rate limit), não
 * número escrito aqui.
 */

interface ErroGoTrue {
  status?: number;
  code?: string;
  message?: string;
}

function traduzir(erro: ErroGoTrue | null | undefined): CodigoErroAuth {
  if (!erro) return "desconhecido";
  if (erro.status === 429 || erro.code === "over_request_rate_limit")
    return "limite_tentativas";
  if (erro.code === "weak_password") return "senha_fraca";
  if (erro.code === "invalid_credentials" || erro.status === 400)
    return "credenciais";
  if (
    erro.code === "mfa_verification_failed" ||
    erro.code === "mfa_challenge_expired"
  ) {
    return "codigo_invalido";
  }
  if (erro.code === "otp_expired" || erro.code === "flow_state_expired")
    return "link_invalido";
  if (erro.status === undefined || erro.status >= 500) return "indisponivel";
  return "desconhecido";
}

const ok: ResultadoAuth = { ok: true };
const falha = (erro: ErroGoTrue | null | undefined): ResultadoAuth => ({
  ok: false,
  erro: traduzir(erro),
});

export function criarAutenticacaoSupabase(): ProvedorAutenticacao {
  const cliente = () => criarClienteServidor();

  return {
    formaDeEntrada() {
      return { tipo: "senha" };
    },

    async obterSessao() {
      return lerSessaoSupabase(await cliente());
    },

    async entrarComSenha(email, senha) {
      const { error } = await (
        await cliente()
      ).auth.signInWithPassword({ email, password: senha });
      return error ? falha(error) : ok;
    },

    async entrarPorSeletor() {
      return { ok: false, erro: "indisponivel" };
    },

    async sair() {
      await (await cliente()).auth.signOut({ scope: "local" });
    },

    async iniciarCadastroMfa() {
      const supabase = await cliente();
      // Fator TOTP começado e não confirmado bloqueia um novo cadastro com o
      // mesmo nome: apaga os pendentes antes de começar de novo.
      const fatores = await supabase.auth.mfa.listFactors();
      for (const fator of fatores.data?.all ?? []) {
        if (fator.factor_type === "totp" && fator.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: fator.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Kraamzorg OS",
      });
      if (error || !data) return { erro: traduzir(error) };
      return {
        fatorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        segredo: data.totp.secret,
      };
    },

    async confirmarCadastroMfa(fatorId, codigo) {
      const { error } = await (
        await cliente()
      ).auth.mfa.challengeAndVerify({
        factorId: fatorId,
        code: codigo,
      });
      return error ? falha(error) : ok;
    },

    async verificarMfa(codigo) {
      const supabase = await cliente();
      const fatores = await supabase.auth.mfa.listFactors();
      const totp = fatores.data?.totp.find((f) => f.status === "verified");
      if (!totp) return { ok: false, erro: "codigo_invalido" };
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totp.id,
        code: codigo,
      });
      return error ? falha(error) : ok;
    },

    ajudaDesafioMfa() {
      return null;
    },

    async enviarRecuperacaoSenha(email, urlRetorno) {
      const { error } = await (
        await cliente()
      ).auth.resetPasswordForEmail(email, {
        redirectTo: urlRetorno,
      });
      // Não revela se o e-mail existe: só o limite de tentativas volta como erro.
      if (error && traduzir(error) === "limite_tentativas") return falha(error);
      return ok;
    },

    async definirSenha(novaSenha) {
      const { error } = await (
        await cliente()
      ).auth.updateUser({ password: novaSenha });
      return error ? falha(error) : ok;
    },

    async confirmarLinkEmail(tokenHash, tipo) {
      const { error } = await (
        await cliente()
      ).auth.verifyOtp({ token_hash: tokenHash, type: tipo });
      return error ? { ok: false, erro: "link_invalido" } : ok;
    },
  };
}
