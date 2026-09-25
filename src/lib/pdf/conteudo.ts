/**
 * Conteúdo montado de uma evolução, antes de virar PDF. É o formato do
 * rascunho (PRD 6.5, `relatorio_medico.conteudo`: "seções calculadas +
 * textos editáveis"): a onda B guarda este objeto, deixa a enfermeira
 * editar os parágrafos de julgamento clínico e a Edilaine aprovar, e só
 * então `renderizarEvolucao` (`documento.tsx`) imprime. Separar o conteúdo
 * do layout também deixa o teste ler o texto que vai para o médico sem
 * precisar extrair texto de dentro do PDF.
 */
import type { TipoRelatorio } from "./metadados";
import { semTravessaoOuMeiaRisca } from "./textos";

export type Bloco =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "campo"; rotulo: string; valor: string }
  | { tipo: "lista"; itens: string[] };

export interface SecaoConteudo {
  titulo: string;
  blocos: Bloco[];
}

export interface AssinaturaConteudo {
  nome: string;
  especialidade: string;
  conselho: string;
  conselhoUf: string;
  conselhoNumero: string;
}

export interface ConteudoEvolucao {
  tipo: TipoRelatorio;
  secoes: SecaoConteudo[];
  assinatura: AssinaturaConteudo;
}

export function paragrafo(texto: string): Bloco {
  return { tipo: "paragrafo", texto };
}

export function campo(rotulo: string, valor: string): Bloco {
  return { tipo: "campo", rotulo, valor };
}

export function lista(itens: string[]): Bloco {
  return { tipo: "lista", itens };
}

/** Todo texto que o documento vai imprimir, na ordem, para auditoria e teste. */
export function textosDoConteudo(conteudo: ConteudoEvolucao): string[] {
  const textos: string[] = [];
  for (const secao of conteudo.secoes) {
    textos.push(secao.titulo);
    for (const bloco of secao.blocos) {
      if (bloco.tipo === "paragrafo") textos.push(bloco.texto);
      else if (bloco.tipo === "campo") textos.push(bloco.rotulo, bloco.valor);
      else textos.push(...bloco.itens);
    }
  }
  const { nome, especialidade, conselho, conselhoUf, conselhoNumero } =
    conteudo.assinatura;
  textos.push(nome, especialidade, conselho, conselhoUf, conselhoNumero);
  return textos;
}

/**
 * Confere o documento montado contra as regras de texto do CLAUDE.md que
 * valem para PDF: sem travessão nem meia-risca e sem `{variavel}` que
 * escapou do preenchimento. Devolve a lista de problemas, vazia quando
 * pode imprimir.
 */
export function auditarConteudo(conteudo: ConteudoEvolucao): string[] {
  const problemas: string[] = [];
  for (const texto of textosDoConteudo(conteudo)) {
    if (!semTravessaoOuMeiaRisca(texto)) {
      problemas.push(
        `O documento tem travessão ou meia-risca, que não pode sair em PDF: "${texto}". Troque por vírgula, dois-pontos ou ponto.`,
      );
    }
    if (/\{\w+\}/.test(texto)) {
      problemas.push(
        `O documento ficou com uma variável sem preencher: "${texto}".`,
      );
    }
  }
  return problemas;
}
