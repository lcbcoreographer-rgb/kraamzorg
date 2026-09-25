"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { proximoSeguro } from "@/lib/auth/acesso";
import { PAPEIS, type Papel } from "@/lib/auth/papeis";
import { exigirSessao, obterAutenticacao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { ERRO_AUTH } from "./mensagens";

/**
 * Server Actions das telas de acesso (P07 item 6). Cada uma valida a
 * entrada com zod, chama a autenticação pela fábrica (sem saber se é a
 * real ou a demonstração) e devolve uma frase pronta para a tela.
 */

export interface EstadoFormulario {
  erro?: string;
  errosCampo?: Record<string, string>;
  sucesso?: string;
}

const codigoMfa = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "O código tem 6 números. Confira no aplicativo e digite de novo.");

function destinoDepoisDoLogin(formulario: FormData): string {
  return proximoSeguro(formulario.get("proximo")?.toString()) ?? "/";
}

async function origem(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export async function entrarComSenha(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const dados = z
    .object({
      email: z.email("Digite um e-mail completo, como nome@exemplo.com.br."),
      senha: z.string().min(1, "Digite a sua senha."),
    })
    .safeParse({ email: formulario.get("email"), senha: formulario.get("senha") });
  if (!dados.success) {
    return {
      errosCampo: Object.fromEntries(
        dados.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const resultado = await obterAutenticacao().entrarComSenha(dados.data.email, dados.data.senha);
  if (!resultado.ok) return { erro: ERRO_AUTH[resultado.erro] };
  redirect(destinoDepoisDoLogin(formulario));
}

export async function entrarPorSeletor(formulario: FormData): Promise<void> {
  const usuarioId = z.string().min(1).safeParse(formulario.get("usuarioId"));
  if (!usuarioId.success) redirect("/entrar");
  const resultado = await obterAutenticacao().entrarPorSeletor(usuarioId.data);
  if (!resultado.ok) redirect("/entrar?aviso=sem-acesso");
  redirect(destinoDepoisDoLogin(formulario));
}

export async function verificarMfa(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const codigo = codigoMfa.safeParse(formulario.get("codigo"));
  if (!codigo.success) return { errosCampo: { codigo: codigo.error.issues[0]?.message ?? "" } };
  const resultado = await obterAutenticacao().verificarMfa(codigo.data);
  if (!resultado.ok) return { errosCampo: { codigo: ERRO_AUTH[resultado.erro] } };
  redirect(destinoDepoisDoLogin(formulario));
}

export async function confirmarCadastroMfa(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const fatorId = z.string().min(1).safeParse(formulario.get("fatorId"));
  const codigo = codigoMfa.safeParse(formulario.get("codigo"));
  if (!fatorId.success) return { erro: ERRO_AUTH.desconhecido };
  if (!codigo.success) return { errosCampo: { codigo: codigo.error.issues[0]?.message ?? "" } };
  const resultado = await obterAutenticacao().confirmarCadastroMfa(fatorId.data, codigo.data);
  if (!resultado.ok) return { errosCampo: { codigo: ERRO_AUTH[resultado.erro] } };
  redirect(destinoDepoisDoLogin(formulario));
}

export async function pedirRecuperacao(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const email = z
    .email("Digite um e-mail completo, como nome@exemplo.com.br.")
    .safeParse(formulario.get("email"));
  if (!email.success) return { errosCampo: { email: email.error.issues[0]?.message ?? "" } };
  const resultado = await obterAutenticacao().enviarRecuperacaoSenha(
    email.data,
    `${await origem()}/auth/confirmar`,
  );
  if (!resultado.ok) return { erro: ERRO_AUTH[resultado.erro] };
  return {
    sucesso:
      "Se este e-mail tiver acesso ao sistema, o link para criar uma senha nova chega em alguns minutos. Confira também a caixa de spam.",
  };
}

export async function definirSenha(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const senha = formulario.get("senha")?.toString() ?? "";
  const confirmacao = formulario.get("confirmacao")?.toString() ?? "";
  if (!senha) return { errosCampo: { senha: "Digite a senha nova." } };
  if (senha !== confirmacao) {
    return { errosCampo: { confirmacao: "As duas senhas não são iguais. Digite de novo." } };
  }
  const resultado = await obterAutenticacao().definirSenha(senha);
  if (!resultado.ok) {
    return resultado.erro === "senha_fraca"
      ? { errosCampo: { senha: ERRO_AUTH.senha_fraca } }
      : { erro: ERRO_AUTH[resultado.erro] };
  }
  redirect("/");
}

export async function convidarPessoa(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  if (!sessao.papeis.includes("diretoria")) return { erro: "Só a diretoria convida pessoas." };

  const dados = z
    .object({
      nome: z.string().trim().min(2, "Digite o nome completo da pessoa."),
      email: z.email("Digite um e-mail completo, como nome@exemplo.com.br."),
      papeis: z
        .array(z.enum(PAPEIS as [Papel, ...Papel[]]))
        .min(1, "Escolha pelo menos um papel."),
    })
    .safeParse({
      nome: formulario.get("nome"),
      email: formulario.get("email"),
      papeis: formulario.getAll("papeis"),
    });
  if (!dados.success) {
    return {
      errosCampo: Object.fromEntries(
        dados.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }

  const { usuarios } = await obterRepositorios();
  const resultado = await usuarios.convidarUsuario({
    ...dados.data,
    urlRetorno: `${await origem()}/definir-senha`,
  });
  if (!resultado.ok) {
    const frases = {
      email_em_uso: "Este e-mail já tem acesso. Confira a lista em Sessões e acessos.",
      sem_permissao: "Só a diretoria convida pessoas, com o código do aplicativo confirmado.",
      indisponivel: ERRO_AUTH.indisponivel,
    } as const;
    return { erro: frases[resultado.erro] };
  }
  return {
    sucesso: `Convite enviado para ${dados.data.email}. A pessoa recebe o link para criar a senha e, no primeiro acesso, cadastra o código do aplicativo.`,
  };
}
