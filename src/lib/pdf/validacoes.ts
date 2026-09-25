/**
 * Validações da evolução antes da aprovação (PRD 9.5, "Fluxo": datas
 * dentro do período, conclusão coerente com os achados, gênero, contato
 * médico presente; PROMPTS.md P41 item 2: ferida operatória só em cesárea,
 * conselho e UF do cadastro da profissional). As duas funções de topo
 * devolvem a lista de erros; lista vazia é aprovação liberada. Cada
 * mensagem diz o que está errado e o que corrigir, em português, sem
 * travessão (CLAUDE.md, "Texto de interface").
 *
 * O gênero não tem regra aqui porque não tem como errar por construção:
 * `bebe.sexo` é obrigatório e todo trecho que descreve o bebê é escolhido
 * pelo sexo (`conteudo-neonatal.ts`).
 */
import {
  calcularCurvaPeso,
  calcularDiaDeVida,
  classificarEvolucaoPeso,
} from "./curva-peso";
import type {
  ContatoMedico,
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  DadosProfissional,
  DataIso,
  Faixa,
  PeriodoAcompanhamento,
} from "./tipos";

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "aaaa-mm-dd" que existe no calendário (recusa "2026-02-30"). */
export function dataValida(data: DataIso): boolean {
  if (!FORMATO_DATA.test(data)) return false;
  const tempo = Date.parse(`${data}T00:00:00Z`);
  return (
    !Number.isNaN(tempo) && new Date(tempo).toISOString().slice(0, 10) === data
  );
}

/** Confere o formato de todas as datas antes de qualquer conta: data inválida devolve erro em vez de derrubar a geração. */
export function validarFormatoDatas(
  pontos: { rotulo: string; data: DataIso | undefined }[],
): string[] {
  return pontos
    .filter((ponto) => ponto.data !== undefined && !dataValida(ponto.data))
    .map(
      (ponto) =>
        `${ponto.rotulo} ("${ponto.data}") não é uma data válida no formato aaaa-mm-dd.`,
    );
}

export function validarPeriodo(periodo: PeriodoAcompanhamento): string[] {
  if (periodo.inicio > periodo.fim) {
    return [
      `O período do acompanhamento está invertido: o início (${periodo.inicio}) é depois do fim (${periodo.fim}).`,
    ];
  }
  return [];
}

/** Confere se cada data informada cai dentro de `[inicio, fim]`, inclusive. `descricao` nomeia o intervalo na mensagem. */
export function validarDatasNoPeriodo(
  periodo: PeriodoAcompanhamento,
  pontos: { rotulo: string; data: DataIso }[],
  descricao = "do período do acompanhamento",
): string[] {
  return pontos
    .filter((ponto) => ponto.data < periodo.inicio || ponto.data > periodo.fim)
    .map(
      (ponto) =>
        `${ponto.rotulo} (${ponto.data}) está fora ${descricao} (${periodo.inicio} a ${periodo.fim}).`,
    );
}

/**
 * A evolução é emitida ao fim do acompanhamento, no mesmo dia ou no dia
 * útil seguinte (PRD 9.5, "Prazo"): a data do documento não pode ser
 * anterior ao último dia do período (erro visto nas evoluções reais,
 * docs/analise-evolucoes.md: "Data do documento anterior ao início do
 * período").
 */
export function validarDataEmissao(
  periodo: PeriodoAcompanhamento,
  dataEmissao: DataIso,
): string[] {
  if (dataEmissao < periodo.fim) {
    return [
      `A data do documento (${dataEmissao}) é anterior ao fim do acompanhamento (${periodo.fim}). A evolução é emitida depois do último dia.`,
    ];
  }
  return [];
}

/** Quantos dias (D1 a Dn) o período tem, contando o primeiro e o último. */
export function diasDoPeriodo(periodo: PeriodoAcompanhamento): number {
  return calcularDiaDeVida(periodo.inicio, periodo.fim) + 1;
}

/** Dias de acompanhamento (D) citados no documento precisam existir no período (laser, ILIB, lesão, dor). */
export function validarDiasD(
  periodo: PeriodoAcompanhamento,
  pontos: { rotulo: string; dia: number | undefined }[],
): string[] {
  const total = diasDoPeriodo(periodo);
  return pontos
    .filter(
      (ponto) =>
        ponto.dia !== undefined &&
        (!Number.isInteger(ponto.dia) || ponto.dia < 1 || ponto.dia > total),
    )
    .map(
      (ponto) =>
        `${ponto.rotulo} cita o dia D${ponto.dia}, mas o acompanhamento vai de D1 a D${total}.`,
    );
}

/** Faixa com mínimo acima do máximo é erro de agregação, não achado clínico. */
export function validarFaixas(
  faixas: { rotulo: string; faixa: Faixa | undefined }[],
): string[] {
  return faixas
    .filter(
      (item) => item.faixa !== undefined && item.faixa.min > item.faixa.max,
    )
    .map(
      (item) =>
        `${item.rotulo}: o mínimo (${item.faixa!.min}) está acima do máximo (${item.faixa!.max}).`,
    );
}

/** Conselho e UF vêm do cadastro da profissional (`profissional.conselho`, `conselho_uf`, `conselho_numero`, PRD 6.5). */
export function validarConselhoProfissional(
  profissional: DadosProfissional,
): string[] {
  const erros: string[] = [];
  if (!profissional.nome.trim()) {
    erros.push("Falta o nome da profissional responsável.");
  }
  if (!profissional.especialidade.trim()) {
    erros.push("Falta a especialidade da profissional responsável.");
  }
  if (!profissional.conselho.trim()) {
    erros.push(
      "Falta o conselho de classe da profissional responsável (por exemplo, COREN). Complete o cadastro da profissional.",
    );
  }
  if (!/^[A-Z]{2}$/.test(profissional.conselhoUf.trim())) {
    erros.push(
      `A UF do conselho da profissional responsável é inválida ("${profissional.conselhoUf}"). Complete o cadastro com a sigla do estado, por exemplo SP.`,
    );
  }
  if (!profissional.conselhoNumero.trim()) {
    erros.push(
      "Falta o número do conselho da profissional responsável. Complete o cadastro da profissional.",
    );
  }
  return erros;
}

/** O envio é por e-mail ao obstetra e ao pediatra (PRD 9.5, "Fluxo"): sem e-mail, a evolução não tem para onde ir. */
export function validarContatoMedico(
  rotulo: string,
  contato: ContatoMedico | undefined,
): string[] {
  if (!contato) {
    return [
      `Falta o contato do ${rotulo}. Cadastre o médico na ficha da família antes de aprovar.`,
    ];
  }
  if (!contato.nome.trim()) {
    return [`O contato do ${rotulo} está sem nome.`];
  }
  if (!contato.email?.trim()) {
    return [
      `O contato do ${rotulo} (${contato.nome}) não tem e-mail, e a evolução é enviada por e-mail.`,
    ];
  }
  return [];
}

/** Aleitamento da conclusão contra o registrado no período ("aleitamento exclusivo contra complemento", PRD 9.5). */
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

/** Complemento registrado em ml não combina com aleitamento exclusivo. */
export function validarComplementoCoerente(
  alimentacao: DadosEvolucaoNeonatal["alimentacao"],
): string[] {
  if (
    alimentacao.tipo === "exclusivo" &&
    alimentacao.complementoMl !== undefined &&
    alimentacao.complementoMl > 0
  ) {
    return [
      `A alimentação está como aleitamento exclusivo, mas há complemento registrado (${alimentacao.complementoMl} ml).`,
    ];
  }
  return [];
}

/** Ganho contra perda de peso (PRD 9.5), pela curva calculada com a base do K-11 (`classificarEvolucaoPeso`). */
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
      `A conclusão descreve o peso como "${ganhoConcluido}", mas a curva indica "${esperado}" (menor peso ${curva.menorPesoG} g, última pesagem ${curva.pesoFinalG} g).`,
    ];
  }
  return [];
}

/** Icterícia da conclusão contra o registro: presença e, quando a conclusão fala em regressão, a tendência registrada. */
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
  if (
    ictericia &&
    concluida === "regressao" &&
    ictericia.tendencia !== "regressao"
  ) {
    return [
      `A conclusão diz icterícia em regressão, mas a tendência registrada é "${ictericia.tendencia ?? "não informada"}".`,
    ];
  }
  if (
    ictericia?.zonaMaxima !== undefined &&
    ictericia.zonaMaxima < ictericia.zonaKramer
  ) {
    return [
      `A zona máxima de Kramer (${ictericia.zonaMaxima}) é menor que a zona final (${ictericia.zonaKramer}).`,
    ];
  }
  return [];
}

/**
 * Ferida operatória só existe em cesárea (PRD 9.5; docs/analise-evolucoes.md,
 * "item ferida operatória retirado da lista de alertas num parto cesáreo").
 * O item da lista de alertas vem embutido no texto-padrão escolhido pelo
 * tipo de parto (`conteudo-puerperal.ts`); aqui se confere a seção
 * descritiva, que não pode faltar na cesárea nem aparecer no parto vaginal,
 * e nem sair com a frase "sem sinais flogísticos" sobre um achado com
 * sinais.
 */
export function validarFeridaOperatoria(
  tipoParto: DadosEvolucaoPuerperal["historico"]["tipoParto"],
  feridaOperatoria: DadosEvolucaoPuerperal["feridaOperatoria"],
): string[] {
  if (tipoParto === "vaginal") {
    return feridaOperatoria
      ? [
          "Parto vaginal não tem ferida operatória, mas a seção está preenchida.",
        ]
      : [];
  }
  if (!feridaOperatoria) {
    return ["Parto cesárea sem a seção de ferida operatória preenchida."];
  }
  if (
    !feridaOperatoria.semSinaisFlogisticos &&
    !feridaOperatoria.textoLivre?.trim()
  ) {
    return [
      "A ferida operatória está marcada com sinais flogísticos, mas o achado não foi descrito. Descreva o achado para não sair a frase-padrão de ferida sem sinais.",
    ];
  }
  return [];
}

/** Escala de 0 a 10 (PRD 9.2, campo 2.6) e remissão coerente com a escala final. */
export function validarDor(dor: DadosEvolucaoPuerperal["dor"]): string[] {
  const erros: string[] = [];
  const escalas = [dor.escalaInicial, dor.escalaMaxima, dor.escalaFinal];
  if (
    escalas.some((valor) => !Number.isInteger(valor) || valor < 0 || valor > 10)
  ) {
    erros.push("A escala de dor vai de 0 a 10, em números inteiros.");
  }
  if (
    dor.escalaMaxima < dor.escalaInicial ||
    dor.escalaMaxima < dor.escalaFinal
  ) {
    erros.push(
      "A dor máxima do período é menor que a dor inicial ou a final. Confira o agregado da escala.",
    );
  }
  if (
    dor.remissao === "total" &&
    (dor.escalaFinal !== 0 || dor.diaZerou === undefined)
  ) {
    erros.push(
      "A dor está como remissão total, mas a escala final não é 0 ou falta o dia em que zerou.",
    );
  }
  if (
    dor.remissao !== "total" &&
    dor.escalaFinal === 0 &&
    dor.escalaInicial > 0
  ) {
    erros.push(
      "A escala final de dor é 0, mas a remissão não está como total.",
    );
  }
  return erros;
}

export function validarEvolucaoPuerperal(
  dados: DadosEvolucaoPuerperal,
): string[] {
  const errosFormato = validarFormatoDatas([
    { rotulo: "Início do período", data: dados.periodo.inicio },
    { rotulo: "Fim do período", data: dados.periodo.fim },
    { rotulo: "Data de nascimento", data: dados.historico.dataNascimentoBebe },
    { rotulo: "Data de alta", data: dados.historico.dataAlta },
    { rotulo: "Data do documento", data: dados.dataEmissao },
    {
      rotulo: "Data do retorno obstétrico",
      data: dados.encaminhamentos?.retornoObstetrico?.data,
    },
  ]);
  if (errosFormato.length > 0) return errosFormato;

  const erros: string[] = [
    ...validarPeriodo(dados.periodo),
    ...validarDataEmissao(dados.periodo, dados.dataEmissao),
    ...validarDiasD(dados.periodo, [
      ...(dados.intervencoes.laser?.dias ?? []).map((dia) => ({
        rotulo: "A laserterapia",
        dia,
      })),
      ...(dados.intervencoes.ilib?.dias ?? []).map((dia) => ({
        rotulo: "A terapia ILIB",
        dia,
      })),
      { rotulo: "A lesão mamária", dia: dados.mamas.lesao?.diaSurgimento },
      { rotulo: "A remissão da dor", dia: dados.dor.diaZerou },
    ]),
    ...validarFaixas([
      { rotulo: "PA sistólica", faixa: dados.sinaisVitais.paSistolica },
      { rotulo: "PA diastólica", faixa: dados.sinaisVitais.paDiastolica },
      { rotulo: "FC", faixa: dados.sinaisVitais.fc },
      { rotulo: "Temperatura", faixa: dados.sinaisVitais.temperatura },
      { rotulo: "SpO2", faixa: dados.sinaisVitais.spo2 },
    ]),
    ...validarConselhoProfissional(dados.profissional),
    ...validarContatoMedico("obstetra", dados.contatoObstetra),
    ...validarFeridaOperatoria(
      dados.historico.tipoParto,
      dados.feridaOperatoria,
    ),
    ...validarDor(dados.dor),
    ...validarAleitamentoCoerente(
      "o registro do período",
      dados.alimentacaoObservada,
      dados.conclusao.amamentacao,
    ),
  ];

  const { dataNascimentoBebe, dataAlta } = dados.historico;
  if (dataNascimentoBebe > dataAlta) {
    erros.push(
      `A data de nascimento (${dataNascimentoBebe}) é depois da data de alta (${dataAlta}).`,
    );
  }
  if (dataAlta > dados.periodo.fim) {
    erros.push(
      `A data de alta (${dataAlta}) é depois do fim do período do acompanhamento (${dados.periodo.fim}).`,
    );
  }
  if (dataNascimentoBebe > dados.periodo.inicio) {
    erros.push(
      `O nascimento (${dataNascimentoBebe}) é depois do início do período do acompanhamento (${dados.periodo.inicio}).`,
    );
  }

  return erros;
}

export function validarEvolucaoNeonatal(
  dados: DadosEvolucaoNeonatal,
): string[] {
  const errosFormato = validarFormatoDatas([
    { rotulo: "Início do período", data: dados.periodo.inicio },
    { rotulo: "Fim do período", data: dados.periodo.fim },
    { rotulo: "Data de nascimento", data: dados.bebe.dataNascimento },
    { rotulo: "Data do documento", data: dados.dataEmissao },
    { rotulo: "Data da queda do coto", data: dados.abdomeCoto.dataQueda },
    ...dados.pesagens.map((pesagem, indice) => ({
      rotulo: `Pesagem ${indice + 1}`,
      data: pesagem.data,
    })),
  ]);
  if (errosFormato.length > 0) return errosFormato;

  const pesosInvalidos = [
    dados.bebe.pesoNascimentoG,
    ...dados.pesagens.map((pesagem) => pesagem.pesoG),
  ].some((peso) => !Number.isFinite(peso) || peso <= 0);
  if (pesosInvalidos) {
    return ["Há peso vazio, zero ou negativo na curva de peso."];
  }

  // Pesagem feita em casa pela enfermeira é do período; a da alta e a do
  // pediatra podem ser de antes do primeiro dia, mas nunca antes do
  // nascimento nem depois do fim. A queda do coto pode ter sido relatada
  // pela família de antes do início.
  const nascimento = dados.bebe.dataNascimento;
  const periodoDesdeNascimento = { inicio: nascimento, fim: dados.periodo.fim };
  const erros: string[] = [
    ...validarPeriodo(dados.periodo),
    ...validarDatasNoPeriodo(
      dados.periodo,
      dados.pesagens
        .map((pesagem, indice) => ({ pesagem, indice }))
        .filter(({ pesagem }) => pesagem.origem === "domicilio")
        .map(({ pesagem, indice }) => ({
          rotulo: `Pesagem ${indice + 1} (domicílio)`,
          data: pesagem.data,
        })),
    ),
    ...validarDatasNoPeriodo(
      periodoDesdeNascimento,
      [
        ...dados.pesagens
          .map((pesagem, indice) => ({ pesagem, indice }))
          .filter(({ pesagem }) => pesagem.origem !== "domicilio")
          .map(({ pesagem, indice }) => ({
            rotulo: `Pesagem ${indice + 1}`,
            data: pesagem.data,
          })),
        ...(dados.abdomeCoto.dataQueda
          ? [{ rotulo: "A queda do coto", data: dados.abdomeCoto.dataQueda }]
          : []),
      ],
      "do intervalo entre o nascimento e o fim do acompanhamento",
    ),
    ...validarDataEmissao(dados.periodo, dados.dataEmissao),
    ...validarFaixas([
      { rotulo: "Temperatura", faixa: dados.estadoGeral.temperatura },
      { rotulo: "FR", faixa: dados.respiratorio.fr },
      { rotulo: "FC", faixa: dados.cardiovascular.fc },
      { rotulo: "SpO2", faixa: dados.cardiovascular.spo2 },
    ]),
    ...validarConselhoProfissional(dados.profissional),
    ...validarContatoMedico("pediatra", dados.contatoPediatra),
    ...validarComplementoCoerente(dados.alimentacao),
    ...validarAleitamentoCoerente(
      "a alimentação do bebê",
      dados.alimentacao.tipo,
      dados.conclusao.aleitamento,
    ),
    ...validarGanhoPesoCoerente(
      dados.bebe.pesoNascimentoG,
      nascimento,
      dados.pesagens,
      dados.conclusao.ganhoPeso,
    ),
    ...validarIctericiaCoerente(dados.ictericia, dados.conclusao.ictericia),
  ];

  if (nascimento > dados.periodo.inicio) {
    erros.push(
      `O nascimento (${nascimento}) é depois do início do período do acompanhamento (${dados.periodo.inicio}).`,
    );
  }
  if (dados.filiacao.every((nome) => !nome.trim())) {
    erros.push("Falta a filiação do bebê.");
  }

  return erros;
}
