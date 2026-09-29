import type { EtapaPlano } from "@/components/instrumentos";

/**
 * Sequência da entrevista pré-natal (DOC 1) na ordem da conversa, e não na
 * do papel impresso (docs/design/fluxos.md, fluxo B, P35 item 2). Oito
 * etapas. Cada etapa reúne campos que já existem na definição aprovada;
 * nenhum campo é criado, removido ou renomeado (CLAUDE.md, "Clínico"), e o
 * endereço gravado de cada campo continua sendo o do bloco de origem
 * ("B.percentil"), então a ficha e a migração de dados não mudam.
 *
 * O título de cada etapa é texto de interface (o que a pessoa vê na lista);
 * rótulos, opções e ajudas dos campos vêm só da definição. Campo que uma
 * versão futura do instrumento acrescentar e este plano não citar aparece
 * na última etapa (montarEtapas no gerador de formulário), então nada se
 * perde por falta de atualização aqui.
 */
export const PLANO_ENTREVISTA_PRENATAL: EtapaPlano[] = [
  {
    id: "1",
    titulo: "Abertura",
    ajuda:
      "Registra o encontro. A hora de início é preenchida ao abrir e o coletador vem do seu login.",
    itens: [
      {
        bloco: "B",
        campos: ["data_da_entrevista", "hora_de_inicio", "coletador"],
      },
      { bloco: "A" },
    ],
  },
  {
    id: "2",
    titulo: "Quem é a família",
    itens: [{ bloco: "C" }],
  },
  {
    id: "3",
    titulo: "Esta gestação",
    ajuda:
      "A idade gestacional é calculada da data provável do parto e nunca é gravada.",
    itens: [
      {
        bloco: "B",
        campos: [
          "data_provavel_do_parto",
          "local_maternidade",
          "idade_gestacional_atual",
          "percentil",
          "ganho_de_peso",
          "tipo_de_parto_esperado",
          "data_do_parto_agendado",
          "ila",
        ],
      },
    ],
  },
  {
    id: "4",
    titulo: "Gestações anteriores",
    itens: [{ bloco: "D" }],
  },
  {
    id: "5",
    titulo: "Amamentação antes",
    itens: [{ bloco: "E" }],
  },
  {
    id: "6",
    titulo: "Expectativas",
    itens: [{ bloco: "F" }],
  },
  {
    id: "7",
    titulo: "Temas conversados",
    itens: [{ bloco: "G" }],
  },
  {
    id: "8",
    titulo: "Médicos, preferências e plano",
    ajuda:
      "Fecha com a hora de término, preenchida ao concluir. O plano de cuidado e o período preferido seguem para a designação.",
    itens: [{ bloco: "H" }, { bloco: "B", campos: ["hora_de_termino"] }],
  },
];

/** "B.percentil" nas duas partes do endereço; nulo se não tiver ponto. */
export function enderecoDoProgresso(
  campo: string | null | undefined,
): { bloco: string; campo: string } | undefined {
  if (!campo) return undefined;
  const ponto = campo.indexOf(".");
  if (ponto <= 0 || ponto === campo.length - 1) return undefined;
  return { bloco: campo.slice(0, ponto), campo: campo.slice(ponto + 1) };
}

/**
 * Onde reabrir: a etapa em que a pessoa parou (1 a N, como o banco guarda) e,
 * se o último campo gravado pertence a essa etapa, o campo. Etapa fora do
 * plano vira a primeira; campo de outra etapa é ignorado (o foco vai ao
 * título).
 */
export function pontoDeRetomada(
  progresso: { etapa: number; campo: string | null } | null,
  plano: EtapaPlano[] = PLANO_ENTREVISTA_PRENATAL,
): {
  etapaInicial: number;
  campoInicial: { bloco: string; campo: string } | undefined;
} {
  if (!progresso) return { etapaInicial: 0, campoInicial: undefined };
  const indice = Math.min(Math.max(progresso.etapa - 1, 0), plano.length - 1);
  const endereco = enderecoDoProgresso(progresso.campo);
  const etapa = plano[indice];
  const daEtapa =
    endereco &&
    etapa?.itens.some(
      (i) =>
        i.bloco === endereco.bloco &&
        (i.campos === undefined || i.campos.includes(endereco.campo)),
    );
  return { etapaInicial: indice, campoInicial: daEtapa ? endereco : undefined };
}
