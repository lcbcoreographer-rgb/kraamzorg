/**
 * Preenchimento dos textos-padrão de `mensagem_modelo` (destinatário
 * `medico`, chaves `evo_*`, PRD 6.7 e 9.5). A biblioteca não guarda texto
 * de negócio: os modelos chegam de fora (`TextosModelo`, `tipos.ts`) e só
 * são preenchidos aqui, variável por variável.
 *
 * Concordância de gênero (PRD 9.5) sem texto clínico no código: um trecho
 * que descreve o bebê é procurado primeiro na chave com o sufixo do sexo
 * (`evo_neo_conclusao_feminino`, `evo_neo_conclusao_masculino`) e só na
 * falta dela na chave neutra (`evo_neo_conclusao`), que serve para texto
 * sem marca de gênero ("Icterícia: zona II de Kramer."). Quem escreve as
 * duas formas é a Edilaine, na revisão do seed; o código só escolhe.
 */
import type { Sexo, TextosModelo } from "./tipos";

const PLACEHOLDER = /\{(\w+)\}/g;

export type Variaveis = Record<string, string | number>;

/**
 * Troca `{variavel}` pelo valor correspondente. Lança erro quando falta
 * variável do modelo: um texto médico com `{chave}` literal impressa é pior
 * que travar a geração e mostrar a causa (mesmo espírito de
 * `formatarIdadeGestacional`, que recusa em vez de formatar em silêncio).
 */
export function preencherTexto(
  chave: string,
  textos: TextosModelo,
  variaveis: Variaveis,
): string {
  const modelo = textos[chave];
  if (modelo === undefined) {
    throw new Error(
      `Não há texto aprovado para a chave "${chave}" em mensagem_modelo.`,
    );
  }

  return modelo.replace(PLACEHOLDER, (_match, nomeVariavel: string) => {
    if (!(nomeVariavel in variaveis)) {
      throw new Error(
        `O texto "${chave}" usa a variável {${nomeVariavel}}, que não foi informada.`,
      );
    }
    return String(variaveis[nomeVariavel]);
  });
}

/** Preenche só se a chave existir no mapa; devolve `undefined` quando o texto ainda não foi aprovado. */
export function preencherTextoOpcional(
  chave: string,
  textos: TextosModelo,
  variaveis: Variaveis,
): string | undefined {
  if (textos[chave] === undefined) return undefined;
  return preencherTexto(chave, textos, variaveis);
}

/** Chave efetiva de um trecho que concorda com o sexo do bebê: `{chave}_{sexo}` quando existe, senão a chave neutra. */
export function chavePorSexo(
  chave: string,
  textos: TextosModelo,
  sexo: Sexo,
): string {
  const chaveComSexo = `${chave}_${sexo}`;
  return textos[chaveComSexo] !== undefined ? chaveComSexo : chave;
}

/** `preencherTexto` com a concordância de gênero de `chavePorSexo`. */
export function preencherTextoPorSexo(
  chave: string,
  textos: TextosModelo,
  sexo: Sexo,
  variaveis: Variaveis,
): string {
  return preencherTexto(chavePorSexo(chave, textos, sexo), textos, variaveis);
}

/** Travessão (U+2014) e meia-risca (U+2013), escritos por código para o próprio arquivo não carregar o caractere. */
const TRAVESSAO_OU_MEIA_RISCA = /[\u2013\u2014]/;

/** Nenhum texto de interface, e-mail ou PDF leva travessão nem meia-risca (CLAUDE.md). Os modelos chegam de `mensagem_modelo` e os trechos livres da enfermeira, mas a biblioteca confere o documento montado antes de imprimir. */
export function semTravessaoOuMeiaRisca(texto: string): boolean {
  return !TRAVESSAO_OU_MEIA_RISCA.test(texto);
}
