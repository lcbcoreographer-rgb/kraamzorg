import type { CodigoErroAuth } from "@/lib/auth/tipos";

/**
 * Frases das telas de acesso (PRD 20.3; DESIGN.md, seção 7): dizem o que
 * aconteceu e o que fazer, sem travessão, sem jargão para quem lê.
 */
export const ERRO_AUTH: Record<CodigoErroAuth, string> = {
  credenciais: "E-mail ou senha não conferem. Confira e tente de novo.",
  codigo_invalido:
    "Esse código não confere. Espere o próximo aparecer no aplicativo e digite de novo.",
  sem_sessao: "Sua sessão terminou. Entre de novo para continuar.",
  sem_perfil:
    "Este acesso ainda não tem papel no sistema. Peça à diretoria para conferir o seu convite.",
  senha_fraca:
    "Essa senha é curta ou fácil de adivinhar. Use uma frase longa, com letras e números.",
  link_invalido:
    "Este link já foi usado ou venceu. Peça um novo em Esqueci a senha ou à diretoria.",
  limite_tentativas:
    "Foram muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  indisponivel:
    "Não foi possível falar com o servidor agora. Confira a conexão e tente de novo em instantes.",
  desconhecido:
    "Algo não saiu como esperado. Tente de novo; se continuar, avise a diretoria.",
};

/** Avisos que chegam por ?aviso= na tela de entrar. */
export const AVISO_ENTRAR: Record<string, string> = {
  "sessao-encerrada": "Sua sessão terminou. Por segurança, entre de novo.",
  "sem-acesso":
    "Este acesso está sem papel ou foi desativado. Se isso não era esperado, fale com a diretoria.",
  "senha-definida": "Senha salva. Entre com o seu e-mail e a senha nova.",
  "link-invalido": ERRO_AUTH.link_invalido,
  saiu: "Você saiu. Até a próxima.",
};

/**
 * Sem conexão no envio (telas.md, C7, estado offline): entrar e o código
 * são conferidos no servidor, então não há fila offline aqui.
 */
export const SEM_SINAL_ENTRAR =
  "Sem sinal agora. Para entrar é preciso conexão, porque a senha e o código são conferidos no servidor. Quando o sinal voltar, toque em Entrar de novo.";

export const SEM_SINAL_ACESSO =
  "Sem sinal agora. Para continuar é preciso conexão, porque a senha e o código são conferidos no servidor. Quando o sinal voltar, tente de novo.";

export const TEXTO_LGPD =
  "Aqui há dados de saúde de gestantes e bebês, e todo acesso fica registrado.";
