"use server";

import { redirect } from "next/navigation";
import {
  abrirSessaoDemonstracao,
  encerrarSessaoDaFamilia,
  pedirLinkMagicoDaFamilia,
  verificarLinkDaFamilia,
} from "@/lib/auth/familia";
import { modoDados } from "@/lib/dados/modo";
import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import { verificarTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { origemAtual } from "@/modules/crm/formulario/origem";
import type {
  EstadoConfirmacao,
  PedidoLinkPortal,
  ResultadoPedidoLink,
} from "./tipos";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Pedido do link mágico (P49). Sem sessão: confere o Turnstile, o limite de
 * taxa (por origem e por e-mail, no banco) e se há acesso liberado para o
 * e-mail. A resposta é a mesma para e-mail desconhecido, sem acesso ou
 * família em estado sensível: quem digita não descobre quem é cliente. O
 * e-mail com o link é do Supabase Auth; o app não envia e-mail direto.
 */
export async function acaoPedirLinkPortal(
  pedido: PedidoLinkPortal,
): Promise<ResultadoPedidoLink> {
  const email =
    typeof pedido?.email === "string" ? pedido.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 200) return { situacao: "invalido" };
  try {
    const origem = await origemAtual();
    const verificacao = await verificarTurnstile(
      typeof pedido.verificacao === "string" ? pedido.verificacao : null,
      origem,
    );
    if (!verificacao.ok) return { situacao: "verificacao" };

    const publico = await obterRelacaoPublica();
    const busca = await publico.localizarAcessoPortal(email, origem);
    if (busca.situacao === "limite") return { situacao: "limite" };
    if (busca.situacao !== "ok") return { situacao: "enviado" };

    if (modoDados() === "demonstracao") {
      const { pessoaDoEmailDemonstracao } =
        await import("@/lib/dados/demonstracao/relacao-publica");
      const pessoaId = pessoaDoEmailDemonstracao(email);
      return pessoaId
        ? {
            situacao: "enviado",
            linkDemonstracao: `/familia/confirmar?demo=${pessoaId}`,
          }
        : { situacao: "enviado" };
    }
    const enviado = await pedirLinkMagicoDaFamilia(email);
    return enviado ? { situacao: "enviado" } : { situacao: "erro" };
  } catch {
    // Nada do que a pessoa digitou vai para log, erro ou resposta.
    return { situacao: "erro" };
  }
}

const ERRO_LINK =
  "Este link venceu ou já foi usado. Peça um novo com o seu e-mail.";

/**
 * Abre a sessão da família com o link do e-mail (P49). Vem de um botão na
 * página de confirmação, e não direto do GET do link, para que antivírus e
 * pré-visualização de e-mail não gastem o link antes da pessoa.
 */
export async function acaoConfirmarLinkPortal(
  _anterior: EstadoConfirmacao,
  dados: FormData,
): Promise<EstadoConfirmacao> {
  const demo = String(dados.get("demo") ?? "");
  const tokenHash = String(dados.get("token_hash") ?? "");

  if (modoDados() === "demonstracao") {
    const { pessoaAtivaDemonstracao } =
      await import("@/lib/dados/demonstracao/relacao-publica");
    if (!demo || !pessoaAtivaDemonstracao(demo)) return { erro: ERRO_LINK };
    await abrirSessaoDemonstracao(demo);
    redirect("/familia");
  }

  if (!tokenHash || tokenHash.length > 300) return { erro: ERRO_LINK };
  const verificado = await verificarLinkDaFamilia(tokenHash);
  if (!verificado.ok) return { erro: ERRO_LINK };
  const vinculo = await (
    await obterRelacaoPublica()
  ).vincularContaPortal(verificado.email, verificado.usuarioId);
  if (vinculo !== "ok") {
    await encerrarSessaoDaFamilia();
    return { erro: ERRO_LINK };
  }
  redirect("/familia");
}

/** Sai do portal. */
export async function acaoSairDoPortal(): Promise<void> {
  await encerrarSessaoDaFamilia();
  redirect("/familia/entrar");
}
