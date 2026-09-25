/**
 * Acompanhamento sintético para os testes da biblioteca de evoluções (P41).
 * Nomes no padrão de `supabase/seed.sql` ("Teste", `@exemplo.invalid`,
 * COREN "TESTE-SP-..."). Os textos-padrão abaixo são sintéticos, no mesmo
 * formato das chaves `evo_*` de `mensagem_modelo`, inspirados nos
 * textos-padrão já anonimizados de `docs/analise-evolucoes.md` (seção 3),
 * nunca no "1 Evolução MODELO.docx" (PRD 22.4, L-02). Não são o seed: o
 * texto real passa pela revisão da Edilaine.
 */
import type {
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  DadosProfissional,
  TextosModelo,
} from "../tipos";

export const profissionalTeste: DadosProfissional = {
  nome: "Talita Teste Moreno",
  funcao: "enfermeira_obstetrica",
  especialidade: "Enfermeira obstetra",
  conselho: "COREN",
  conselhoUf: "SP",
  conselhoNumero: "TESTE-SP-0001",
};

/** 05/09 a 11/09: sete dias, D1 a D7. Bebê nasceu em 04/09, alta em 04/09. */
export const periodoTeste = { inicio: "2026-09-05", fim: "2026-09-11" };

export const textosPuerperalTeste: TextosModelo = {
  evo_pue_abertura:
    "Paciente no {dia}º dia de puerpério, apresenta-se em bom estado geral.",
  evo_pue_estabilidade:
    "Manteve estabilidade hemodinâmica com parâmetros dentro da normalidade durante todo o período assistencial.",
  evo_pue_ferida_operatoria:
    "Ferida operatória sem sinais flogísticos, em processo cicatricial, sem sangramentos nem secreção.",
  evo_pue_lesao_mama:
    "A lesão de grau {grau} em {local_lado}, identificada no D{dia_surgimento}, apresentou boa resposta cicatricial, com grau final {grau_final}.",
  evo_pue_dor_remissao_total:
    "Paciente referiu dor inicial (escala {inicial}), porém, após condutas terapêuticas, houve remissão total do quadro. Escala de dor mantida em 0 desde o D{dia_zerou} até a presente data.",
  evo_pue_dor_remissao_parcial:
    "Paciente referiu dor inicial (escala {inicial}), com remissão parcial após as condutas. Escala de dor {final} na presente data.",
  evo_pue_laser:
    "Fotobiomodulação (laserterapia): realizada aplicação para {finalidade} nos dias {dias}, conforme protocolo.",
  evo_pue_ilib:
    "Terapia ILIB: realizada nos dias {dias} para auxílio na recuperação sistêmica e controle inflamatório.",
  evo_pue_orientacoes_intro:
    "Foram reforçadas as orientações à paciente e ao acompanhante sobre sinais de alerta que exigem atenção ou busca por serviço médico:",
  evo_pue_orientacoes_base_cesarea:
    "Picos febris; sinais flogísticos em ferida operatória.\nAumento súbito de dor mamária ou edema e rubor localizado.\nAumento expressivo do sangramento vaginal ou odor forte.\nMal-estar generalizado ou tonturas.",
  evo_pue_orientacoes_base_vaginal:
    "Picos febris.\nAumento súbito de dor mamária ou edema e rubor localizado.\nAumento expressivo do sangramento vaginal ou odor forte.\nMal-estar generalizado ou tonturas.",
  evo_pue_encaminhamento:
    "Encaminhada para retorno com equipe obstétrica para avaliação ({motivos}).",
  evo_pue_encaminhamento_medicacoes:
    "Orientada a manter as medicações de uso contínuo.",
  evo_pue_encaminhamento_saude_mental:
    "Orientada a programar retorno com a equipe de saúde mental que a acompanha.",
  evo_pue_encaminhamento_nutricao:
    "Orientada a programar retorno com a equipe de nutrição.",
  evo_pue_conclusao_exclusivo:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com boa produção láctea, segura quanto à amamentação exclusiva.",
  evo_pue_conclusao_misto:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante segura quanto à amamentação mista.",
  evo_pue_conclusao_complemento:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com baixa produção láctea, sendo necessário complemento após as mamadas.",
};

export const textosNeonatalTeste: TextosModelo = {
  evo_neo_identificacao_masculino:
    "RN, sexo {sexo}, {dia_vida}º dia de vida; nascido por parto {tipo_parto}. Filiação: filho de {filiacao}.",
  evo_neo_identificacao_feminino:
    "RN, sexo {sexo}, {dia_vida}º dia de vida; nascida por parto {tipo_parto}. Filiação: filha de {filiacao}.",
  evo_neo_estado_geral_masculino:
    "Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmico ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.",
  evo_neo_estado_geral_feminino:
    "Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmica ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.",
  evo_neo_ictericia:
    "Icterícia {intensidade} em zona {zona} de Kramer, {tendencia}.",
  evo_neo_respiratorio_masculino:
    "Eupneico, {esforco}; FR {fr_min} a {fr_max} rpm.",
  evo_neo_respiratorio_feminino:
    "Eupneica, {esforco}; FR {fr_min} a {fr_max} rpm.",
  evo_neo_cardiovascular: "FC {fc_min} a {fc_max} bpm.",
  evo_neo_abdomen_coto:
    "Abdômen flácido, indolor à palpação. Coto umbilical: {estado_coto}.",
  evo_neo_alimentacao_exclusivo: "Aleitamento materno exclusivo, com {succao}.",
  evo_neo_alimentacao_misto: "Aleitamento materno misto, com {succao}.",
  evo_neo_alimentacao_complemento:
    "Aleitamento com complemento de {complemento_ml} ml após as mamadas, com {succao}.",
  evo_neo_genitalia_masculino:
    "Genitália masculina, testículos presentes, prepúcio íntegro e limpo.",
  evo_neo_genitalia_feminino:
    "Genitália feminina, sem sinais de anormalidades aparentes.",
  evo_neo_eliminacoes: "Diurese e evacuações presentes, fezes em transição.",
  evo_neo_conclusao_masculino:
    "RN estável, calmo, ativo e reativo, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}. Vínculo dos pais com o filho em evolução progressiva.",
  evo_neo_conclusao_feminino:
    "RN estável, calma, ativa e reativa, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}. Vínculo dos pais com a filha em evolução progressiva.",
  evo_neo_conclusao_aleitamento_exclusivo: "em aleitamento materno exclusivo",
  evo_neo_conclusao_aleitamento_misto: "em aleitamento materno misto",
  evo_neo_conclusao_aleitamento_complemento: "em aleitamento com complemento",
  evo_neo_conclusao_peso_progressivo: "ganho de peso progressivo",
  evo_neo_conclusao_peso_estavel: "peso estável",
  evo_neo_conclusao_peso_perda: "perda de peso em acompanhamento",
  evo_neo_conclusao_ictericia_ausente: "sem icterícia",
  evo_neo_conclusao_ictericia_regressao: "com icterícia em regressão",
  evo_neo_conclusao_ictericia_presente: "com icterícia em acompanhamento",
};

export function dadosPuerperalTeste(): DadosEvolucaoPuerperal {
  return {
    id: "8f14e45f-ceea-467e-adc9-15d044baf000",
    paciente: { nome: "Marina Teste Aurora", idade: 29 },
    periodo: { ...periodoTeste },
    historico: {
      tipoParto: "cesarea",
      dataNascimentoBebe: "2026-09-04",
      dataAlta: "2026-09-04",
    },
    sinaisVitais: {
      paSistolica: { min: 100, max: 120 },
      paDiastolica: { min: 60, max: 80 },
      fc: { min: 68, max: 88 },
      temperatura: { min: 36.2, max: 36.9 },
    },
    estabilidadeHemodinamica: true,
    feridaOperatoria: { semSinaisFlogisticos: true },
    mamas: {
      turgencia: "túrgidas",
      producao: "adequada para a demanda neonatal",
      lesao: {
        grau: "II",
        lado: "esquerda",
        local: "mamilo",
        diaSurgimento: 2,
        grauFinal: "I",
      },
    },
    dor: {
      escalaInicial: 6,
      escalaMaxima: 6,
      escalaFinal: 0,
      diaZerou: 3,
      remissao: "total",
    },
    eliminacoes: { quantidade: "pequena quantidade" },
    intervencoes: {
      laser: { dias: [1, 2, 3], finalidade: "dor e reparação tecidual" },
      ilib: { dias: [1, 3, 5] },
    },
    orientacoesAlta: {
      itensPersonalizados: ["Elevação das pernas e meias de compressão."],
    },
    encaminhamentos: {
      retornoObstetrico: { data: "2026-09-20", motivos: ["revisão do parto"] },
      saudeMental: true,
    },
    alimentacaoObservada: "exclusivo",
    conclusao: {
      amamentacao: "exclusivo",
      autonomiaFamilia:
        "A família evoluiu de forma progressiva na autonomia e na segurança dos cuidados.",
    },
    contatoObstetra: {
      nome: "Dra. Helena Teste Obstetra",
      email: "helena.teste.obstetra@exemplo.invalid",
    },
    profissional: { ...profissionalTeste },
    dataEmissao: "2026-09-12",
  };
}

/** Menina que perdeu peso até a alta e voltou a ganhar, ainda abaixo do peso de nascimento no último dia (caso comum que a regra do K-11 precisa aceitar como ganho). */
export function dadosNeonatalTeste(): DadosEvolucaoNeonatal {
  return {
    id: "8f14e45f-ceea-467e-adc9-15d044baf001",
    bebeId: "8f14e45f-ceea-467e-adc9-15d044baf002",
    bebe: {
      nome: "Bebê Teste Aurora",
      sexo: "feminino",
      tipoParto: "cesarea",
      dataNascimento: "2026-09-04",
      pesoNascimentoG: 3400,
    },
    filiacao: ["Marina Teste Aurora"],
    periodo: { ...periodoTeste },
    pesagens: [
      { data: "2026-09-04", pesoG: 3250, origem: "alta_hospitalar" },
      { data: "2026-09-06", pesoG: 3150, origem: "domicilio" },
      { data: "2026-09-11", pesoG: 3380, origem: "domicilio" },
    ],
    estadoGeral: {
      reatividade: "reativa aos estímulos, desperta facilmente ao manejo",
      mucosas: "úmidas e coradas",
      temperatura: { min: 36.3, max: 37.1 },
      fontanela: "plana",
    },
    ictericia: {
      zonaKramer: 1,
      zonaMaxima: 2,
      intensidade: "leve",
      tendencia: "regressao",
    },
    respiratorio: {
      fr: { min: 40, max: 52 },
      esforco: "sem sinais de desconforto respiratório",
    },
    cardiovascular: { fc: { min: 120, max: 150 } },
    abdomeCoto: {
      estadoCoto:
        "processo avançado de mumificação, seco, sem sinais flogísticos",
    },
    alimentacao: { tipo: "exclusivo", succao: "sucção nutritiva" },
    genitaliaEliminacoes: { diurese: true, evacuacoes: true },
    orientacoesCondutas: [
      "Amamentação em livre demanda.",
      "Manter cuidados com o coto umbilical (higiene a seco) até a queda completa.",
      "Manobras de desengasgo.",
    ],
    conclusao: {
      aleitamento: "exclusivo",
      ganhoPeso: "progressivo",
      ictericia: "regressao",
    },
    contatoPediatra: {
      nome: "Dr. Rodrigo Teste Pediatra",
      email: "rodrigo.teste.pediatra@exemplo.invalid",
    },
    profissional: { ...profissionalTeste },
    dataEmissao: "2026-09-12",
  };
}
