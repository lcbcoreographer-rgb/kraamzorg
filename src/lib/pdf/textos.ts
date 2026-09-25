/**
 * Preenchimento dos textos-padrão de `mensagem_modelo` (destinatário
 * `medico`, chaves `evo_*`, PRD 6.7 e 9.5). A biblioteca não guarda texto
 * de negócio: os modelos chegam de fora (`TextosModelo`, `tipos.ts`) e só
 * são preenchidos aqui, variável por variável, com concordância de gênero
 * explícita (PRD 9.5, "com concordância de gênero").
 */
import type { Sexo, TextosModelo } from "./tipos";

/** Escolhe a forma certa para o sexo do bebê. Único ponto de concordância de gênero da biblioteca; quem monta as variáveis de um texto usa isto em vez de escrever "o"/"a" a mão. */
export function concordar(
  sexo: Sexo,
  masculino: string,
  feminino: string,
): string {
  return sexo === "feminino" ? feminino : masculino;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Troca `{variavel}` pelo valor correspondente. Lança erro quando falta
 * variável do modelo: um texto médico com `{chave}` literal impressa é pior
 * que travar a geração e mostrar a causa (mesmo espírito de
 * `formatarIdadeGestacional`, que recusa em vez de formatar em silêncio).
 */
export function preencherTexto(
  chave: string,
  textos: TextosModelo,
  variaveis: Record<string, string | number>,
): string {
  const modelo = textos[chave];
  if (modelo === undefined) {
    throw new Error(
      `preencherTexto: não há texto para a chave "${chave}" em mensagem_modelo`,
    );
  }

  return modelo.replace(PLACEHOLDER, (match, nomeVariavel: string) => {
    if (!(nomeVariavel in variaveis)) {
      throw new Error(
        `preencherTexto: a chave "${chave}" usa a variável "{${nomeVariavel}}", que não foi informada`,
      );
    }
    return String(variaveis[nomeVariavel]);
  });
}

/** Preenche só se a chave existir no mapa; devolve `undefined` quando o texto ainda não foi aprovado. Usa-se nas seções opcionais (laser, ILIB, encaminhamento), que nem toda evolução tem. */
export function preencherTextoOpcional(
  chave: string,
  textos: TextosModelo,
  variaveis: Record<string, string | number>,
): string | undefined {
  if (textos[chave] === undefined) return undefined;
  return preencherTexto(chave, textos, variaveis);
}

const TRAVESSAO_OU_MEIA_RISCA = /[–—]/; // – e —

/** Nenhum texto de interface, e-mail ou PDF leva travessão nem meia-risca (CLAUDE.md). Os modelos chegam prontos de `mensagem_modelo`, mas a biblioteca confere antes de imprimir: um caractere errado num texto aprovado não deve virar PDF assim mesmo. */
export function semTravessaoOuMeiaRisca(texto: string): boolean {
  return !TRAVESSAO_OU_MEIA_RISCA.test(texto);
}
