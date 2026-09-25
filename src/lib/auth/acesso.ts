import { caminhoInicial, podeAbrir } from "@/lib/navegacao";
import { exigeMfa, PAPEIS_COM_MFA, type Papel } from "./papeis";
import type { SessaoBorda } from "./tipos";

/**
 * Decisão do proxy para cada requisição (PRD 13 e 21.2): quem não entrou
 * vai para /entrar; perfil com MFA obrigatório e sessão AAL1 vai para o
 * desafio do MFA (ou para o cadastro, se ainda não tem); rota fora da
 * navegação do papel volta para o início do papel. Função pura: o proxy
 * lê a sessão e aplica o resultado; o teste cobre cada caso sem Next.
 *
 * Isto é conforto de tela e primeira barreira. A defesa é o banco: as
 * políticas `exige_mfa_do_perfil` e as funções api recusam sessão AAL1 de
 * quem precisa de AAL2, mesmo que um dia o proxy falhe.
 */

/** Abertas sem sessão ("/sair" também: sair sem sessão só volta para entrar). */
const PUBLICAS = [
  "/entrar",
  "/esqueci-senha",
  "/auth/confirmar",
  "/design-system",
  "/sair",
];

/** Exigem sessão, mas não o AAL2 nem papel (o caminho até o MFA). */
const SO_SESSAO = ["/mfa/cadastro", "/mfa/desafio", "/definir-senha"];

/** Rotas fora da navegação que só alguns papéis abrem. */
const RESTRITAS: Record<string, readonly Papel[]> = {
  "/convidar": ["diretoria"],
  // Demonstração do motor offline (P12 item 5), só fora de produção (a
  // própria página recusa em produção). Abre para quem trabalha sempre em
  // AAL2, a mesma exigência de POST /api/sync, que recebe dado assistencial.
  "/dev/sync": PAPEIS_COM_MFA,
};

export type DecisaoAcesso =
  { tipo: "seguir" } | { tipo: "redirecionar"; para: string };

function casa(caminho: string, base: string): boolean {
  return caminho === base || caminho.startsWith(`${base}/`);
}

function comProximo(destino: string, caminho: string): string {
  if (caminho === "/" || caminho === destino) return destino;
  return `${destino}?proximo=${encodeURIComponent(caminho)}`;
}

/** Aceita só caminho interno do app como destino depois do login. */
export function proximoSeguro(
  proximo: string | null | undefined,
): string | null {
  if (
    !proximo ||
    !proximo.startsWith("/") ||
    proximo.startsWith("//") ||
    proximo.includes("\\")
  ) {
    return null;
  }
  return proximo;
}

export function decidirAcesso(
  caminho: string,
  sessao: SessaoBorda | null,
): DecisaoAcesso {
  const seguir: DecisaoAcesso = { tipo: "seguir" };
  const para = (destino: string): DecisaoAcesso => ({
    tipo: "redirecionar",
    para: destino,
  });

  if (PUBLICAS.some((base) => casa(caminho, base))) {
    // Quem já entrou e abre /entrar vai direto para o início (ou para o MFA).
    if (
      sessao &&
      caminho === "/entrar" &&
      sessao.ativo &&
      sessao.papeis.length > 0
    ) {
      return para(precisaMfa(sessao) ?? caminhoInicial(sessao.papeis));
    }
    return seguir;
  }

  if (!sessao) return para(comProximo("/entrar", caminho));

  if (!sessao.ativo || sessao.papeis.length === 0) {
    return para("/sair?motivo=sem-acesso");
  }

  const mfa = precisaMfa(sessao);
  if (SO_SESSAO.some((base) => casa(caminho, base))) {
    if (!mfa && casa(caminho, "/mfa")) {
      // Comercial ou marketing sem MFA cadastrado (não é obrigatório para
      // eles) pode cadastrar por vontade própria: é o caminho para ver os
      // dados completos de contrato, que exigem AAL2 (PRD 13; achado da
      // verificação do P16).
      if (
        sessao.aal === "aal1" &&
        sessao.aalPossivel === "aal1" &&
        casa(caminho, "/mfa/cadastro")
      )
        return seguir;
      // Já está em AAL2: desafio e cadastro não fazem mais sentido.
      return para(caminhoInicial(sessao.papeis));
    }
    // Tem MFA cadastrado e abriu o cadastro: vai para o desafio.
    if (mfa === "/mfa/desafio" && casa(caminho, "/mfa/cadastro"))
      return para(mfa);
    // Tem MFA cadastrado e chegou pelo link do e-mail (sessão AAL1): o
    // Supabase Auth só troca a senha de quem tem fator verificado em AAL2,
    // e o link do e-mail sozinho não pode bastar. Passa pelo desafio antes.
    if (mfa === "/mfa/desafio" && casa(caminho, "/definir-senha"))
      return para(comProximo(mfa, caminho));
    return seguir;
  }

  if (mfa) return para(comProximo(mfa, caminho));

  if (caminho === "/") return para(caminhoInicial(sessao.papeis));

  const restrita = Object.entries(RESTRITAS).find(([base]) =>
    casa(caminho, base),
  );
  if (restrita) {
    return restrita[1].some((papel) => sessao.papeis.includes(papel))
      ? seguir
      : para(caminhoInicial(sessao.papeis));
  }

  // Nega por padrão: caminho fora do registro da navegação (podeAbrir
  // devolve null), com maiúscula trocada ou com letra codificada
  // (/%66inanceiro) volta para o início do papel, em vez de seguir. Rota
  // nova só abre depois de entrar em src/lib/navegacao (ou em PUBLICAS,
  // SO_SESSAO e RESTRITAS, aqui).
  if (podeAbrir(sessao.papeis, caminho) !== true)
    return para(caminhoInicial(sessao.papeis));

  return seguir;
}

/**
 * Para onde a sessão precisa ir antes de qualquer tela, ou null se já pode
 * seguir. Quem tem MFA cadastrado sempre passa pelo desafio (mesmo o
 * comercial, que não é obrigado a ter); quem é obrigado e ainda não tem,
 * vai para o cadastro.
 */
export function precisaMfa(
  sessao: SessaoBorda,
): "/mfa/desafio" | "/mfa/cadastro" | null {
  if (sessao.aal === "aal2") return null;
  if (sessao.aalPossivel === "aal2") return "/mfa/desafio";
  if (exigeMfa(sessao.papeis)) return "/mfa/cadastro";
  return null;
}
