/**
 * Textos padrão da evolução (PRD 9.5) como a migration 0024 os grava em `mensagem_modelo`
 * (destinatário `medico`, rascunho até a revisão da Edilaine). O modo demonstração usa esta
 * cópia; `textos-padrao-evolucao.test.ts` falha se ela divergir da migration.
 */
export const TEXTOS_PADRAO_EVOLUCAO: Record<string, string> = {
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
  evo_neo_identificacao_masculino:
    "RN, sexo {sexo}, {dia_vida}º dia de vida; nascido por parto {tipo_parto}. Filiação: filho de {filiacao}.",
  evo_neo_identificacao_feminino:
    "RN, sexo {sexo}, {dia_vida}º dia de vida; nascida por parto {tipo_parto}. Filiação: filha de {filiacao}.",
  evo_neo_estado_geral_masculino:
    "Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmico ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.",
  evo_neo_estado_geral_feminino:
    "Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmica ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.",
  evo_neo_ictericia: "Icterícia em zona {zona} de Kramer, {tendencia}.",
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
  evo_padrao_turgencia: "túrgidas",
  evo_padrao_producao: "adequada para a demanda neonatal",
  evo_padrao_loquios_quantidade: "pequena quantidade",
  evo_padrao_laser_finalidade: "dor e reparação tecidual",
  evo_padrao_reatividade_masculino:
    "reativo aos estímulos, desperta facilmente ao manejo",
  evo_padrao_reatividade_feminino:
    "reativa aos estímulos, desperta facilmente ao manejo",
  evo_padrao_mucosas: "úmidas e coradas",
  evo_padrao_fontanela: "plana",
  evo_padrao_esforco: "sem sinais de desconforto respiratório",
  evo_padrao_succao: "sucção nutritiva",
  evo_padrao_coto: "seco, sem sinais flogísticos",
};
