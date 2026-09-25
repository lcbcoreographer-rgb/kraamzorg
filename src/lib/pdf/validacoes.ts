/**
 * Validações da evolução antes da aprovação (PRD 9.5, "Fluxo"; PRD 22.3
 * item K-11 para o cálculo que sustenta a coerência do peso). As duas
 * funções de topo (`validarEvolucaoPuerperal`, `validarEvolucaoNeonatal`)
 * devolvem a lista de erros; lista vazia é aprovação liberada. Nenhuma
 * função aqui decide layout ou texto de tela: cada mensagem é o resumo do
 * problema, em português, sem travessão, para a enfermeira corrigir o dado
 * de origem.
 */
import { classificarEvolucaoPeso, calcularCurvaPeso } from "./curva-peso";
import type {
  ContatoMedico,
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  DadosProfissional,
  DataIso,
  PeriodoAcompanhamento,
} from "./tipos";

function dataMenorOuIgual(a: DataIso, b: DataIso): boolean {
  return a <= b;
}

/** Confere se cada data informada cai dentro de `[periodo.inicio, periodo.fim]`, inclusive. */
export function validarDatasNoPeriodo(
  periodo: PeriodoAcompanhamento,
  pontos: { rotulo: string; data: DataIso }[],
): string[] {
  const erros: string[] = [];

  if (!dataMenorOuIgual(periodo.inicio, periodo.fim)) {
    erros.push(
      `O período do acompanhamento está invertido: início ${periodo.inicio} é depois do fim ${periodo.fim}.`,
    );
  }

  for (const ponto of pontos) {
    if (
      !dataMenorOuIgual(periodo.inicio, ponto.data) ||
      !dataMenorOuIgual(ponto.data, periodo.fim)
    ) {
      erros.push(
        `${ponto.rotulo} (${ponto.data}) está fora do período do acompanhamento (${periodo.inicio} a ${periodo.fim}).`,
      );
    }
  }

  return erros;
}

export function validarConselhoProfissional(
  profissional: DadosProfissional,
): string[] {
  const erros: string[] = [];
  if (!profissional.conselho.trim()) {
    erros.push(
      "Falta o conselho de classe da profissional responsável (por exemplo COREN).",
    );
  }
  if (!/^[A-Za-z]{2}$/.test(profissional.conselhoUf.trim())) {
    erros.push(
      `A UF do conselho da profissional responsável é inválida ("${profissional.conselhoUf}").`,
    );
  }
  if (!profissional.conselhoNumero.trim()) {
    erros.push("Falta o número do conselho da profissional responsável.");
  }
  return erros;
}

export function validarContatoMedico(
  rotulo: string,
  contato: ContatoMedico | undefined,
): string[] {
  if (!contato) {
    return [`Falta o contato do ${rotulo} para enviar a evolução.`];
  }
  if (!contato.nome.trim()) {
    return [`O contato do ${rotulo} está sem nome.`];
  }
  if (!contato.email && !contato.telefoneE164) {
    return [
      `O contato do ${rotulo} (${contato.nome}) não tem e-mail nem telefone.`,
    ];
  }
  return [];
}

/** Alinha o rótulo de aleitamento com o que o próprio conjunto de dados registrou (mãe ou bebê, mesma regra nos dois documentos). */
export function validarAleitamentoCoerente(
  rotuloOrigem: string,
  observado: string,
  concluido: string,
): string[] {
  if (observado !== concluido) {
    return [
      `A conclusão descreve aleitamento "${concluido}", mas ${rotuloOrigem} registra "${observado}". Ajuste a conclusão ou confira o registro.`,
    ];
  }
  return [];
}

export function validarGanhoPesoCoerente(
  pesoNascimentoG: number,
  dataNascimento: DataIso,
  pesagens: DadosEvolucaoNeonatal["pesagens"],
  ganhoConcluido: DadosEvolucaoNeonatal["conclusao"]["ganhoPeso"],
): string[] {
  const curva = calcularCurvaPeso(pesoNascimentoG, dataNascimento, pesagens);
  const esperado = classificarEvolucaoPeso(curva);
  if (esperado !== ganhoConcluido) {
    return [
      `A conclusão descreve ganho de peso "${ganhoConcluido}", mas o peso final (${curva.pesoFinalG} g) contra o de nascimento (${curva.pesoNascimentoG} g) indica "${esperado}".`,
    ];
  }
  return [];
}

export function validarIctericiaCoerente(
  ictericia: DadosEvolucaoNeonatal["ictericia"],
  concluida: DadosEvolucaoNeonatal["conclusao"]["ictericia"],
): string[] {
  if (!ictericia && concluida !== "ausente") {
    return [
      `A conclusão descreve icterícia "${concluida}", mas não há registro de icterícia nos achados do período.`,
    ];
  }
  if (ictericia && concluida === "ausente") {
    return [
      `Há icterícia registrada nos achados (zona ${ictericia.zonaKramer} de Kramer), mas a conclusão diz "sem icterícia".`,
    ];
  }
  return [];
}

/**
 * Ferida operatória só existe em cesárea (PRD 9.5; achado de
 * `docs/analise-evolucoes.md`, "Item ferida operatória retirado da lista
 * de alertas num parto cesáreo"). A lista de orientações de alta em si não
 * entra aqui: o item de ferida operatória vem embutido no texto-padrão que
 * o código escolhe por `tipoParto` (`evo_pue_orientacoes_base_cesarea` x
 * `_vaginal`, `evolucao-puerperal.tsx`), não é dado que a enfermeira possa
 * esquecer de marcar.
 */
export function validarFeridaOperatoria(
  tipoParto: DadosEvolucaoPuerperal["historico"]["tipoParto"],
  feridaOperatoria: DadosEvolucaoPuerperal["feridaOperatoria"],
): string[] {
  if (tipoParto === "cesarea") {
    return feridaOperatoria
      ? []
      : ["Parto cesárea sem a seção de ferida operatória preenchida."];
  }
  return feridaOperatoria
    ? ["Parto vaginal não tem ferida operatória, mas a seção está preenchida."]
    : [];
}

export function validarEvolucaoPuerperal(
  dados: DadosEvolucaoPuerperal,
): string[] {
  const erros: string[] = [
    ...validarDatasNoPeriodo(dados.periodo, [
      { rotulo: "Data de emissão", data: dados.dataEmissao },
    ]),
    ...validarConselhoProfissional(dados.profissional),
    ...validarContatoMedico("obstetra", dados.contatoObstetra),
    ...validarFeridaOperatoria(
      dados.historico.tipoParto,
      dados.feridaOperatoria,
    ),
    ...validarAleitamentoCoerente(
      "o registro do período",
      dados.alimentacaoObservada,
      dados.conclusao.amamentacao,
    ),
  ];

  if (
    !dataMenorOuIgual(
      dados.historico.dataNascimentoBebe,
      dados.historico.dataAlta,
    )
  ) {
    erros.push(
      `A data de nascimento (${dados.historico.dataNascimentoBebe}) é depois da data de alta (${dados.historico.dataAlta}).`,
    );
  }
  if (!dataMenorOuIgual(dados.historico.dataAlta, dados.periodo.fim)) {
    erros.push(
      `A data de alta (${dados.historico.dataAlta}) é depois do fim do período do acompanhamento (${dados.periodo.fim}).`,
    );
  }

  return erros;
}

export function validarEvolucaoNeonatal(
  dados: DadosEvolucaoNeonatal,
): string[] {
  const datasPesagens = dados.pesagens.map((pesagem, indice) => ({
    rotulo: `Pesagem ${indice + 1}`,
    data: pesagem.data,
  }));
  const datasParaValidar = [
    { rotulo: "Data de emissão", data: dados.dataEmissao },
    ...datasPesagens,
  ];
  if (dados.abdomeCoto.dataQueda) {
    datasParaValidar.push({
      rotulo: "Data da queda do coto",
      data: dados.abdomeCoto.dataQueda,
    });
  }

  const erros: string[] = [
    ...validarDatasNoPeriodo(dados.periodo, datasParaValidar),
    ...validarConselhoProfissional(dados.profissional),
    ...validarContatoMedico("pediatra", dados.contatoPediatra),
    ...validarAleitamentoCoerente(
      "a alimentação do bebê",
      dados.alimentacao.tipo,
      dados.conclusao.aleitamento,
    ),
    ...validarGanhoPesoCoerente(
      dados.bebe.pesoNascimentoG,
      dados.bebe.dataNascimento,
      dados.pesagens,
      dados.conclusao.ganhoPeso,
    ),
    ...validarIctericiaCoerente(dados.ictericia, dados.conclusao.ictericia),
  ];

  if (!dataMenorOuIgual(dados.bebe.dataNascimento, dados.periodo.inicio)) {
    erros.push(
      `O nascimento (${dados.bebe.dataNascimento}) é depois do início do período do acompanhamento (${dados.periodo.inicio}).`,
    );
  }

  return erros;
}
