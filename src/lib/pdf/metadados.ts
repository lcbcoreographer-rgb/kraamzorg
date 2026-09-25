/**
 * Nome de arquivo e metadados do PDF (PRD 9.5, "Formato do PDF"; CLAUDE.md,
 * "Nome de paciente nunca em nome de arquivo... nem metadado de PDF").
 * Nenhuma das duas funções recebe nome de paciente: o tipo de entrada já
 * não tem esse campo, então não há como vazar por engano.
 */

const ID_VALIDO = /^[0-9a-fA-F-]{8,64}$/;

export type TipoRelatorio = "puerperal" | "neonatal";

/** "{id}.pdf", nunca o nome da paciente ou do bebê (PRD 9.5). `id` é o identificador do relatório (ou, nesta trilha, do acompanhamento/bebê que o chamador escolher), sempre um uuid ou texto id-like. */
export function nomeArquivoEvolucao(id: string): string {
  if (!ID_VALIDO.test(id)) {
    throw new RangeError(
      `nomeArquivoEvolucao: id inválido para nome de arquivo ("${id}")`,
    );
  }
  return `${id}.pdf`;
}

export interface MetadadosDocumento {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  language: string;
}

const TITULO_POR_TIPO: Record<TipoRelatorio, string> = {
  puerperal: "Evolução de Enfermagem Puerperal",
  neonatal: "Evolução de Enfermagem Neonatal",
};

/**
 * Metadados controlados, em pt-BR, sem nome de paciente (PRD 9.5: "autor
 * Kraamzorg Brasil, idioma pt-BR"). O título e o assunto são genéricos por
 * tipo de documento, nunca por família: dois puerperais de famílias
 * diferentes têm o mesmo título de metadado, só o conteúdo muda.
 */
export function metadadosEvolucao(tipo: TipoRelatorio): MetadadosDocumento {
  return {
    title: TITULO_POR_TIPO[tipo],
    author: "Kraamzorg Brasil",
    subject: "Relatório assistencial de acompanhamento domiciliar pós-parto",
    keywords: "kraamzorg, evolução de enfermagem, relatório assistencial",
    creator: "Kraamzorg OS",
    producer: "Kraamzorg OS",
    language: "pt-BR",
  };
}
