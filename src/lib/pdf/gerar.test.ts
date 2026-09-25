// @vitest-environment node
/**
 * Teste de aceite do P41: "o acompanhamento do seed gera os PDFs certos;
 * conclusão incoerente bloqueia a aprovação; e-mail com anexo e assunto
 * sem dado pessoal" (o envio por e-mail é da onda B; aqui cobrimos a
 * geração e o bloqueio). Dado 100% sintético, no padrão de
 * `supabase/seed.sql` ("Família Teste", `@exemplo.invalid`, COREN
 * "TESTE-SP-...").
 */
import { describe, expect, it } from "vitest";
import { gerarEvolucaoNeonatal, gerarEvolucaoPuerperal } from "./gerar";
import type {
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  TextosModelo,
} from "./tipos";

/**
 * Lê um valor do dicionário /Info do PDF (Title, Author...), direto do
 * buffer bruto: pdfkit grava string sem acento como literal `(...)` e
 * string com acento como objeto indireto `N 0 R` -> `N 0 obj (...)` em
 * UTF-16BE com BOM (`\xFE\xFF`), então o teste decodifica os dois jeitos
 * em vez de assumir um formato só.
 */
function lerInfoPdf(buffer: Buffer, chave: string): string | undefined {
  const texto = buffer.toString("latin1");
  const referencia = new RegExp(`/${chave}\\s+(\\d+)\\s+0\\s+R`).exec(texto);
  let conteudo: string | undefined;

  if (referencia) {
    const objeto = new RegExp(
      `${referencia[1]}\\s+0\\s+obj\\s*\\(([^]*?)\\)\\s*endobj`,
    ).exec(texto);
    conteudo = objeto?.[1];
  } else {
    const literal = new RegExp(`/${chave}\\s*\\(([^)]*)\\)`).exec(texto);
    conteudo = literal?.[1];
  }

  if (conteudo === undefined) return undefined;
  if (conteudo.startsWith("þÿ")) {
    const bigEndian = Buffer.from(conteudo.slice(2), "latin1");
    const littleEndian = Buffer.alloc(bigEndian.length);
    for (let i = 0; i + 1 < bigEndian.length; i += 2) {
      littleEndian[i] = bigEndian[i + 1]!;
      littleEndian[i + 1] = bigEndian[i]!;
    }
    return littleEndian.toString("utf16le");
  }
  return conteudo;
}

const profissional = {
  nome: "Talita Moreno",
  funcao: "enfermeira_obstetrica",
  conselho: "COREN",
  conselhoUf: "SP",
  conselhoNumero: "TESTE-SP-0001",
};

const periodo = { inicio: "2026-09-05", fim: "2026-09-11" };

const textosPuerperal: TextosModelo = {
  evo_pue_abertura:
    "Paciente no {dia}º dia de puerpério, apresenta-se em bom estado geral.",
  evo_pue_estabilidade:
    "Manteve estabilidade hemodinâmica com parâmetros dentro da normalidade durante todo o período assistencial.",
  evo_pue_ferida_operatoria:
    "Ferida operatória sem sinais flogísticos, em processo cicatricial, sem sangramentos nem secreção.",
  evo_pue_lesao_mama:
    "A lesão de grau {grau} em {local} {lado}, identificada no início do acompanhamento, apresentou boa resposta cicatricial.",
  evo_pue_dor_remissao_total:
    "Paciente referiu dor inicial (escala {inicial}), porém, após condutas terapêuticas, houve remissão total do quadro. Escala de dor mantida em 0 desde o {diaZerou}º dia de acompanhamento até a presente data.",
  evo_pue_laser:
    "Fotobiomodulação (Laserterapia): realizada aplicação para {finalidade} nos dias {dias}, conforme protocolo.",
  evo_pue_ilib:
    "Terapia ILIB: realizada nos dias {dias} para auxílio na recuperação sistêmica e controle inflamatório.",
  evo_pue_orientacoes_intro:
    "Foram reforçadas as orientações à paciente e ao acompanhante sobre sinais de alerta que exigem atenção ou busca por serviço médico.",
  evo_pue_orientacoes_base_cesarea:
    "Picos febris ou sinais flogísticos em ferida operatória; aumento súbito de dor mamária ou edema localizado; aumento expressivo do sangramento vaginal ou odor forte; mal estar generalizado ou tonturas.",
  evo_pue_orientacoes_base_vaginal:
    "Picos febris; aumento súbito de dor mamária ou edema localizado; aumento expressivo do sangramento vaginal ou odor forte; mal estar generalizado ou tonturas.",
  evo_pue_encaminhamento:
    "Encaminhada para retorno com equipe obstétrica para avaliação ({motivos}).",
  evo_pue_conclusao_exclusiva:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com boa produção láctea, segura quanto à amamentação exclusiva e eficaz do filho.",
  evo_pue_conclusao_mista:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante em amamentação mista, com produção láctea em acompanhamento.",
  evo_pue_conclusao_complemento:
    "Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com baixa produção láctea, sendo necessário complemento artificial após as mamadas.",
};

const textosNeonatal: TextosModelo = {
  evo_neo_identificacao:
    "Identificação: recém-nascido, sexo {sexo}, {dia_vida}º dia de vida, nascido por parto {tipo_parto}. Filiação: filho de {filiacao}.",
  evo_neo_estado_geral:
    "Estado geral: {reatividade}, desperta facilmente ao manejo. Mucosas: {mucosas}. Normotérmico ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.",
  evo_neo_ictericia: "Icterícia: {intensidade}, em zona {zona} de Kramer.",
  evo_neo_respiratorio:
    "Sistema respiratório: eupneico, sem sinais de desconforto respiratório; FR {fr_min} a {fr_max} rpm.",
  evo_neo_cardiovascular:
    "Aparelho cardiovascular: FC {fc_min} a {fc_max} bpm. SpO2: {spo2_min}% a {spo2_max}%.",
  evo_neo_abdomen_coto:
    "Abdômen flácido, indolor à palpação. Coto umbilical: {estado_coto}.",
  evo_neo_alimentacao_exclusivo:
    "Aleitamento materno exclusivo (AME), com {succao}.",
  evo_neo_alimentacao_misto: "Aleitamento misto, com {succao}.",
  evo_neo_alimentacao_complemento:
    "Aleitamento com complemento após as mamadas, com {succao}.",
  evo_neo_genitalia_masculina:
    "Genitália masculina, testículos presentes, prepúcio íntegro e limpo.",
  evo_neo_genitalia_feminina:
    "Genitália feminina, sem sinais de anormalidades aparentes.",
  evo_neo_eliminacoes: "Diurese e evacuações presentes, fezes em transição.",
  evo_neo_conclusao:
    "Recém-nascido estável, {adjetivos}, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}; condutas e orientações realizadas e registradas. Vínculo excelente dos pais com o {filho}.",
};

function dadosPuerperalValidos(): DadosEvolucaoPuerperal {
  return {
    id: "8f14e45f-ceea-467e-adc9-15d044baf000",
    paciente: { nome: "Marina Teste Aurora", idade: 29 },
    periodo,
    historico: {
      tipoParto: "cesarea",
      dataNascimentoBebe: "2026-09-04",
      dataAlta: "2026-09-06",
    },
    diaPuerperioFinal: 7,
    sinaisVitais: {
      paSistolica: { min: 100, max: 120 },
      paDiastolica: { min: 60, max: 80 },
      fc: { min: 68, max: 88 },
      temperatura: { min: 36.2, max: 36.9 },
      spo2: { min: 96, max: 99 },
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
    eliminacoes: { quantidade: "pequena quantidade", aspecto: "acastanhado" },
    intervencoes: {
      laser: { dias: [1, 2, 3], finalidade: "dor e reparação tecidual" },
      ilib: { dias: [1, 3, 5] },
    },
    orientacoesAlta: {
      itensPersonalizados: ["Elevação das pernas e meias de compressão."],
    },
    encaminhamentos: {
      retornoObstetrico: { data: "2026-09-20", motivos: ["revisão do parto"] },
    },
    alimentacaoObservada: "exclusivo",
    conclusao: {
      amamentacao: "exclusivo",
      autonomiaFamilia:
        "A família evoluiu satisfatória e progressivamente na autonomia e segurança quanto aos cuidados de saúde da mulher e do bebê.",
    },
    contatoObstetra: {
      nome: "Dra. Helena Teste Obstetra",
      email: "helena.teste.obstetra@exemplo.invalid",
    },
    profissional,
    dataEmissao: "2026-09-11",
  };
}

function dadosNeonatalValidos(): DadosEvolucaoNeonatal {
  return {
    id: "8f14e45f-ceea-467e-adc9-15d044baf001",
    bebeId: "8f14e45f-ceea-467e-adc9-15d044baf002",
    bebe: {
      nome: "Bebê Teste Aurora",
      sexo: "feminino",
      tipoParto: "cesarea",
      dataNascimento: "2026-09-04",
      pesoNascimentoG: 3200,
    },
    filiacao: ["Marina Teste Aurora"],
    periodo,
    diaVidaFinal: 7,
    pesagens: [
      { data: "2026-09-06", pesoG: 3000, origem: "alta_hospitalar" },
      { data: "2026-09-08", pesoG: 3050, origem: "domicilio" },
      { data: "2026-09-11", pesoG: 3320, origem: "domicilio" },
    ],
    estadoGeral: {
      reatividade: "reativa aos estímulos",
      mucosas: "úmidas e coradas",
      temperatura: { min: 36.3, max: 37.1 },
      fontanela: "plana",
    },
    ictericia: { zonaKramer: 2, intensidade: "leve", tendencia: "regressao" },
    respiratorio: { fr: { min: 40, max: 52 }, esforco: "eupneica" },
    cardiovascular: { fc: { min: 120, max: 150 }, spo2: { min: 96, max: 99 } },
    abdomeCoto: {
      estadoCoto:
        "processo avançado de mumificação, seco, sem sinais flogísticos",
    },
    alimentacao: { tipo: "exclusivo", succao: "sucção nutritiva" },
    genitaliaEliminacoes: { diurese: true, evacuacoes: true },
    orientacoesCondutas: [
      "Amamentação em livre demanda, com intervalos máximos de 3 horas até segunda ordem.",
      "Manter cuidados com o coto umbilical (higiene a seco) até queda completa.",
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
    profissional,
    dataEmissao: "2026-09-11",
  };
}

describe("gerarEvolucaoPuerperal", () => {
  it("gera o PDF a partir de um acompanhamento sintético completo", async () => {
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalValidos(),
      textosPuerperal,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(resultado.buffer.length).toBeGreaterThan(1000);
    expect(resultado.nomeArquivo).toBe(
      "8f14e45f-ceea-467e-adc9-15d044baf000.pdf",
    );
  });

  it("metadados sem nome de paciente: título e autor são genéricos, sem o nome da mãe", async () => {
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalValidos(),
      textosPuerperal,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const titulo = lerInfoPdf(resultado.buffer, "Title");
    const autor = lerInfoPdf(resultado.buffer, "Author");

    expect(titulo).toBe("Evolução de Enfermagem Puerperal");
    expect(autor).toBe("Kraamzorg Brasil");
    expect(titulo).not.toContain("Marina");
    expect(autor).not.toContain("Marina");
  });

  it("bloqueia quando a ferida operatória some numa cesárea (validação antes da aprovação)", async () => {
    const dados = dadosPuerperalValidos();
    dados.feridaOperatoria = undefined;
    const resultado = await gerarEvolucaoPuerperal(dados, textosPuerperal);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros.some((e) => e.includes("ferida operatória"))).toBe(
      true,
    );
  });

  it("bloqueia sem contato do obstetra", async () => {
    const dados = dadosPuerperalValidos();
    dados.contatoObstetra = undefined;
    const resultado = await gerarEvolucaoPuerperal(dados, textosPuerperal);
    expect(resultado.ok).toBe(false);
  });
});

describe("gerarEvolucaoNeonatal", () => {
  it("gera o PDF do bebê a partir do mesmo acompanhamento sintético", async () => {
    const resultado = await gerarEvolucaoNeonatal(
      dadosNeonatalValidos(),
      textosNeonatal,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(resultado.nomeArquivo).toBe(
      "8f14e45f-ceea-467e-adc9-15d044baf001.pdf",
    );
  });

  it("metadados sem nome do bebê nem da mãe", async () => {
    const resultado = await gerarEvolucaoNeonatal(
      dadosNeonatalValidos(),
      textosNeonatal,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const titulo = lerInfoPdf(resultado.buffer, "Title");
    const autor = lerInfoPdf(resultado.buffer, "Author");

    expect(titulo).toBe("Evolução de Enfermagem Neonatal");
    expect(autor).toBe("Kraamzorg Brasil");
    expect(titulo).not.toMatch(/Aurora|Marina/);
    expect(autor).not.toMatch(/Aurora|Marina/);
  });

  it("conclusão incoerente bloqueia: ganho progressivo com curva de perda", async () => {
    const dados = dadosNeonatalValidos();
    dados.pesagens = [{ data: "2026-09-11", pesoG: 2900, origem: "domicilio" }]; // abaixo do nascimento (3200g)
    dados.conclusao = { ...dados.conclusao, ganhoPeso: "progressivo" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatal);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(
      resultado.erros.some((e) => e.toLowerCase().includes("ganho de peso")),
    ).toBe(true);
  });

  it("conclusão incoerente bloqueia: aleitamento exclusivo contra complemento registrado", async () => {
    const dados = dadosNeonatalValidos();
    dados.alimentacao = {
      ...dados.alimentacao,
      tipo: "complemento",
      complementoMl: 30,
    };
    dados.conclusao = { ...dados.conclusao, aleitamento: "exclusivo" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatal);
    expect(resultado.ok).toBe(false);
  });

  it("conclusão incoerente bloqueia: sem icterícia na conclusão havendo registro de icterícia", async () => {
    const dados = dadosNeonatalValidos();
    dados.conclusao = { ...dados.conclusao, ictericia: "ausente" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatal);
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia sem contato do pediatra", async () => {
    const dados = dadosNeonatalValidos();
    dados.contatoPediatra = undefined;
    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatal);
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia pesagem fora do período do acompanhamento", async () => {
    const dados = dadosNeonatalValidos();
    dados.pesagens = [
      ...dados.pesagens,
      { data: "2026-09-30", pesoG: 3500, origem: "pediatra" },
    ];
    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatal);
    expect(resultado.ok).toBe(false);
  });
});
