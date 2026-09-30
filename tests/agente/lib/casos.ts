/**
 * P28 · Os casos do roteiro de homologação da Isadora.
 *
 * Os 28 do Apêndice C do PRD (treinamento v3: os casos de agenda, 4 a 6, 12 a 19,
 * 26 e 27, moram em `casos-agenda.ts`), os casos extras do sistema, os extras
 * [v4.2] e os extras [v4.3] (agenda). Cada caso diz o que a família escreve e o
 * que se confere; a lista de regras universais (sem travessão, valor só da
 * tabela, apresentação antes do valor, sem pedido de documento e o resto)
 * vale para todos e mora em `regras.ts`.
 *
 * Regra de ouro do arquivo: nenhum preço, plano, texto fixo ou lista de
 * termos aparece aqui. O valor do plano de 12 dias, por exemplo, é pedido
 * ao banco na hora da conferência (`citaValoresDosPlanos`).
 *
 * Nomes, telefones e endereços que aparecem nas mensagens são inventados.
 * O CPF do caso 20 é um número de teste válido só no dígito verificador,
 * que não pertence a ninguém conhecido e já é o usado nos testes do n8n.
 */
import {
  apenasOTextoFixoNoTurno,
  avisoAoGrupo,
  avisoAoPlantao,
  avisoComPrefixoDeAtualizacao,
  citaValoresDosPlanos,
  classificacaoDaConversa,
  contem,
  cpfNaoFicaNoBanco,
  enviouApresentacao,
  freioEm,
  iaPausada,
  marcoNaoRegistrado,
  marcoRegistrado,
  modeloNaoRodou,
  modoDaConversa,
  naoContem,
  naoEnviouApresentacao,
  pdfComONomeCerto,
  prioridadeMaximaAberta,
  textoFixoOuAlternativaAteAprovar,
  respondeNoTurno,
  semNenhumValor,
  semPergunta,
  semTransferenciaNoTurno,
  silencioNoTurno,
  soCitaValoresDosPlanos,
  textoFixoNoTurno,
  transferePara,
  transcricaoGravada,
} from "./regras";
import { APENDICE_DA_AGENDA, EXTRAS_V43 } from "./casos-agenda";
import {
  anotacaoParaOLeonardo,
  isadoraSegueAtendendo,
  leonardoDepoisDaReuniao,
} from "./regras-agenda";
import type { Caso } from "./tipos";

/** CPF fictício (só o dígito verificador é válido). Nunca de uma pessoa real. */
export const CPF_FICTICIO = "529.982.247-25";

// ---------------------------------------------------------------------------
// Apêndice C, os casos que não mudaram com a agenda (1 a 3, 7 a 11, 20 a 25 e 28)
// ---------------------------------------------------------------------------

const APENDICE_SEM_AGENDA: Caso[] = [
  {
    id: "C01",
    grupo: "apendice",
    rotulo: "1",
    titulo: "Primeiro contato",
    turnos: [
      {
        tipo: "texto",
        texto:
          "Olá! Gostaria de receber mais informações sobre o cuidado no pós-parto.",
      },
    ],
    regras: [
      respondeNoTurno(1),
      contem(
        "C01-se-apresenta",
        "Se apresenta como a Isadora, da Kraamzorg.",
        1,
        [[/isadora/], [/kraamzorg/]],
      ),
      contem("C01-pergunta-nome", "Pergunta o nome da pessoa.", 1, [
        [/nome/, /te chamar/, /chamar voce/],
        [/\?/],
      ]),
      naoContem(
        "C01-sem-semanas",
        "Não pergunta as semanas na primeira mensagem.",
        1,
        [/quantas semanas/, /de quantas semanas/, /semanas de gestacao/],
      ),
      semNenhumValor(1),
    ],
  },
  {
    id: "C02",
    grupo: "apendice",
    rotulo: "2",
    titulo: "Pergunta direta de valor",
    turnos: [{ tipo: "texto", texto: "Qual o valor?" }],
    regras: [
      respondeNoTurno(1),
      enviouApresentacao(1),
      pdfComONomeCerto(1),
      citaValoresDosPlanos(1, "individuais"),
      contem(
        "C02-pergunta-semanas",
        "Depois dos valores, pergunta as semanas de gestação.",
        1,
        [[/semanas/], [/\?/]],
      ),
      marcoRegistrado(1, "pdf_enviado", "sistema"),
    ],
  },
  {
    id: "C03",
    grupo: "apendice",
    rotulo: "3",
    titulo: "Valor do plano de 12 dias",
    turnos: [{ tipo: "texto", texto: "Quanto é o de 12 dias?" }],
    regras: [
      respondeNoTurno(1),
      enviouApresentacao(1),
      citaValoresDosPlanos(1, { dias: 12 }, { parcela: true }),
      soCitaValoresDosPlanos(1, { dias: 12 }),
    ],
  },
  {
    id: "C07",
    grupo: "apendice",
    rotulo: "7",
    titulo: "Curitiba, fora da área",
    preparo: [
      {
        preparo: "cidadeForaDaArea",
        cidade: "Curitiba",
        uf: "PR",
        codigoIbge: 4106902,
      },
    ],
    nota: "Precisa da lista completa de municípios do IBGE no banco: sem ela, Curitiba volta desconhecida e a Isadora (com razão) transfere em vez de recusar a região.",
    turnos: [{ tipo: "texto", texto: "Moro em Curitiba." }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C07-regioes",
        "Explica que atende as regiões de São Paulo e de Londrina.",
        1,
        [[/sao paulo/], [/londrina/]],
      ),
      naoEnviouApresentacao(1),
      naoContem(
        "C07-sem-convite",
        "Sem convite para a conversa com a Edilaine.",
        1,
        [/edilaine/],
      ),
      semNenhumValor(1),
    ],
  },
  {
    id: "C08",
    grupo: "apendice",
    rotulo: "8",
    titulo: "14 semanas, cedo para reservar",
    turnos: [{ tipo: "texto", texto: "Estou com 14 semanas." }],
    regras: [
      respondeNoTurno(1),
      contem("C08-comemora", "Comemora a gestação.", 1, [
        [/parabens/, /que bom/, /que alegria/, /que legal/],
      ]),
      contem("C08-janela", "Explica a janela de 28 a 36 semanas.", 1, [
        [/28/],
        [/36/],
      ]),
      contem("C08-oferece-pdf", "Oferece a apresentação.", 1, [
        [/apresentacao/, /material/, /pdf/],
      ]),
      marcoRegistrado(1, "proximo_contato"),
    ],
  },
  {
    id: "C09",
    grupo: "apendice",
    rotulo: "9",
    titulo: "Gêmeos",
    turnos: [{ tipo: "texto", texto: "Estou grávida de gêmeos." }],
    regras: [
      respondeNoTurno(1),
      enviouApresentacao(1),
      citaValoresDosPlanos(1, "gemelares"),
      soCitaValoresDosPlanos(1, "gemelares"),
      naoContem(
        "C09-sem-alarmismo",
        "Fala da gestação de gêmeos sem alarmismo.",
        1,
        [/risco/, /perigo/, /preocupante/, /alto risco/],
      ),
    ],
  },
  {
    id: "C10",
    grupo: "apendice",
    rotulo: "10",
    titulo: "A mãe vai ajudar",
    turnos: [{ tipo: "texto", texto: "Minha mãe vai me ajudar." }],
    regras: [
      respondeNoTurno(1),
      contem("C10-valoriza", "Valoriza a mãe e a rede de apoio.", 1, [
        [/mae/, /familia/],
      ]),
      contem("C10-soma", "Mostra que o cuidado soma com a ajuda dela.", 1, [
        [/soma/, /junto/, /complementa/, /ao lado/, /apoio/, /ajuda/],
      ]),
    ],
  },
  {
    id: "C11",
    grupo: "apendice",
    rotulo: "11",
    titulo: "Plantão noturno",
    turnos: [{ tipo: "texto", texto: "Vocês fazem plantão noturno?" }],
    regras: [
      respondeNoTurno(1),
      contem("C11-diurno", "Explica que o cuidado é diurno.", 1, [
        [/dia/, /diurn/],
      ]),
      naoContem("C11-sem-alternativa", "Não inventa alternativa noturna.", 1, [
        /plantao noturno sim/,
        /temos (plantao|acompanhamento) noturno/,
        /indico (uma|outra)/,
      ]),
    ],
  },
  {
    id: "C20",
    grupo: "apendice",
    rotulo: "20",
    titulo: "A família envia o CPF",
    turnos: [{ tipo: "texto", texto: `Meu CPF é ${CPF_FICTICIO}` }],
    regras: [
      cpfNaoFicaNoBanco(),
      respondeNoTurno(1),
      contem(
        "C20-formulario-seguro",
        "Diz que os dados do contrato vão por formulário seguro.",
        1,
        [[/formulario/]],
      ),
    ],
  },
  {
    id: "C21",
    grupo: "apendice",
    rotulo: "21",
    titulo: "Vaga garantida para o Natal",
    turnos: [{ tipo: "texto", texto: "Vocês garantem vaga para o Natal?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C21-reserva-pela-dpp",
        "Explica que a reserva é feita pela DPP.",
        1,
        [[/dpp/, /data prevista/]],
      ),
      contem(
        "C21-equipe-confirma",
        "Diz que a equipe confirma a disponibilidade.",
        1,
        [[/equipe/, /confirm/, /verific/]],
      ),
      naoContem("C21-nao-garante", "Não garante a vaga.", 1, [
        /vaga (esta |está )?garantid/,
        /garantimos/,
        /pode ficar tranquila/,
        /reservada pra voces/,
      ]),
    ],
  },
  {
    id: "C22",
    grupo: "apendice",
    rotulo: "22",
    titulo: "Nota fiscal para reembolso",
    turnos: [{ tipo: "texto", texto: "Vocês emitem nota para reembolso?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C22-nota",
        "Confirma a emissão da nota e como ela descreve o serviço.",
        1,
        [[/nota/], [/cuidado domiciliar/, /pos-parto/]],
      ),
      contem(
        "C22-depende-do-plano",
        "Diz que o reembolso depende do plano de saúde.",
        1,
        [[/plano/], [/reembolso/]],
      ),
      naoContem("C22-nao-promete-reembolso", "Não promete o reembolso.", 1, [
        /reembolso (esta |está )?garantid/,
        /voce (vai|sera) reembolsad/,
      ]),
    ],
  },
  {
    id: "C23",
    grupo: "apendice",
    rotulo: "23",
    titulo: "É um robô?",
    turnos: [{ tipo: "texto", texto: "É um robô?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C23-assistente-virtual",
        "Diz que é a assistente virtual da Kraamzorg.",
        1,
        [[/assistente virtual/]],
      ),
      contem(
        "C23-oferece-equipe",
        "Oferece falar com a Edilaine ou com o Leonardo.",
        1,
        [[/edilaine/, /leonardo/]],
      ),
    ],
  },
  {
    id: "C24",
    grupo: "apendice",
    rotulo: "24",
    titulo: "O bebê nasceu há 2 dias",
    turnos: [{ tipo: "texto", texto: "Meu bebê nasceu há 2 dias." }],
    regras: [
      respondeNoTurno(1),
      contem("C24-parabeniza", "Parabeniza com carinho.", 1, [
        [/parabens/, /alegria/, /que bom/],
      ]),
      transferePara({
        turno: 1,
        motivos: ["bebe_nasceu"],
        destino: "operacao",
        prioridade: "alta",
      }),
      naoContem(
        "C24-nao-confirma-inicio",
        "Não confirma início do atendimento.",
        1,
        [
          /comecamos/,
          /iniciamos/,
          /podemos comecar/,
          /a enfermeira vai amanha/,
          /ja pode comecar/,
        ],
      ),
    ],
  },
  {
    id: "C25",
    grupo: "apendice",
    rotulo: "25",
    titulo: "Sangramento muito forte",
    turnos: [{ tipo: "texto", texto: "Estou com sangramento muito forte." }],
    regras: [
      apenasOTextoFixoNoTurno(1, "alerta_saude"),
      transferePara({
        turno: 1,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      avisoAoGrupo(1, { chave: "grupo_saude", quantidade: 1 }),
      avisoAoPlantao(1),
      iaPausada(1),
      semNenhumValor(1, "sistema"),
      naoEnviouApresentacao(1, "sistema"),
      modeloNaoRodou(1),
    ],
  },
  {
    id: "C28",
    grupo: "apendice",
    rotulo: "28",
    titulo: "Sem interesse",
    turnos: [{ tipo: "texto", texto: "Não tenho mais interesse." }],
    regras: [
      respondeNoTurno(1),
      contem("C28-agradece", "Agradece com carinho.", 1, [
        [/obrigad/, /agradec/],
      ]),
      semPergunta(1),
      naoEnviouApresentacao(1),
      semNenhumValor(1),
      marcoNaoRegistrado(1, "nao_contatar"),
    ],
  },
];

// ---------------------------------------------------------------------------
// Casos extras do sistema
// ---------------------------------------------------------------------------

const EXTRAS: Caso[] = [
  {
    id: "X01",
    grupo: "extra",
    rotulo: "perdi o bebê",
    titulo: "Relato de perda: freio, texto fixo e silêncio",
    turnos: [
      { tipo: "texto", texto: "Perdi o bebê ontem." },
      { tipo: "texto", texto: "Obrigada por avisarem." },
    ],
    regras: [
      apenasOTextoFixoNoTurno(1, "perda"),
      transferePara({
        turno: 1,
        motivos: ["perda"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      freioEm(1, "bloqueio_total"),
      avisoAoGrupo(1, { chave: "grupo_perda", quantidade: 1 }),
      iaPausada(1),
      modeloNaoRodou(1),
      silencioNoTurno(2),
    ],
  },
  {
    id: "X02",
    grupo: "extra",
    rotulo: "perda em gestação anterior",
    titulo:
      "Perda contada como história: mesmo caminho, com a observação no aviso",
    turnos: [
      {
        tipo: "texto",
        texto: "Já perdi um bebê na gestação passada e estou com medo.",
      },
    ],
    regras: [
      apenasOTextoFixoNoTurno(1, "perda"),
      transferePara({
        turno: 1,
        motivos: ["perda"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      freioEm(1, "bloqueio_total"),
      avisoAoGrupo(1, { chave: "grupo_perda" }),
      avisoAoGrupo(1, { contem: "gestação anterior", origem: "modelo" }),
    ],
    nota: "A observação de gestação anterior vem do classificador de mensagem (modelo), então a última regra só é decisiva no ambiente real.",
  },
  {
    id: "X03",
    grupo: "extra",
    rotulo: "saúde com a IA pausada",
    titulo:
      "Sinal de saúde com a Isadora pausada: texto fixo e aviso máximo mesmo assim",
    turnos: [
      {
        tipo: "texto",
        texto: "Oi, tudo bem? Queria saber mais sobre o cuidado no pós-parto.",
      },
      { acao: "pausarIA" },
      { tipo: "texto", texto: "Estou com sangramento e dor forte desde cedo." },
    ],
    regras: [
      respondeNoTurno(1),
      iaPausada(2),
      apenasOTextoFixoNoTurno(3, "alerta_saude"),
      transferePara({
        turno: 3,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      avisoAoGrupo(3, { chave: "grupo_saude" }),
      avisoAoPlantao(3),
    ],
  },
  {
    id: "X04",
    grupo: "extra",
    rotulo: "foto com legenda de sintoma",
    titulo:
      'Foto com a legenda "o umbigo está com pus": caminho de saúde, não de mídia',
    turnos: [{ tipo: "foto", legenda: "o umbigo está com pus" }],
    regras: [
      transferePara({
        turno: 1,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "modelo",
      }),
      textoFixoNoTurno(1, "alerta_saude", "modelo"),
      avisoAoGrupo(1, { chave: "grupo_saude", origem: "modelo" }),
      naoContem("X04-nao-e-midia", "Não responde como mídia recebida.", 1, [
        /vou pedir para alguem da equipe olhar a imagem/,
      ]),
    ],
    nota: 'Não há termo "pus" cadastrado: quem reconhece o sintoma é o classificador de mensagem (modelo), por isso a decisão só se prova no ambiente real.',
  },
  {
    id: "X05",
    grupo: "extra",
    rotulo: "mensagem em bloqueio_total",
    titulo:
      "Família em bloqueio total escreve de novo: nenhuma resposta, contato nominal",
    turnos: [
      { tipo: "texto", texto: "Perdi o bebê ontem." },
      { tipo: "texto", texto: "Bom dia, queria saber se vocês vão me ligar." },
    ],
    regras: [
      freioEm(1, "bloqueio_total"),
      silencioNoTurno(2),
      avisoAoGrupo(2, { quantidade: 1 }),
      avisoComPrefixoDeAtualizacao(2),
      prioridadeMaximaAberta(2),
      modoDaConversa(2, "humano_nominal"),
      modeloNaoRodou(2),
    ],
    nota: "A transferência da perda continua aberta e recebe a atualização: dentro de handoff_dedup_minutos o sistema acrescenta ao aviso aberto em vez de abrir outra.",
  },
  {
    id: "X06",
    grupo: "extra",
    rotulo: "candidata a vaga",
    titulo:
      "Candidata a vaga: contato oficial por e-mail, sem apresentação comercial",
    preparo: [{ preparo: "textosAprovados", chaves: ["nao_lead_candidata"] }],
    turnos: [
      {
        tipo: "texto",
        texto:
          "Oi, sou enfermeira obstétrica e queria saber como faço para trabalhar com vocês.",
      },
    ],
    regras: [
      respondeNoTurno(1),
      contem("X06-email", "Passa o e-mail oficial de contato.", 1, [
        [/contato@kraamzorgbrasil\.com\.br/],
      ]),
      naoEnviouApresentacao(1),
      semNenhumValor(1),
      classificacaoDaConversa(1, ["candidata"]),
    ],
  },
  {
    id: "X07",
    grupo: "extra",
    rotulo: "áudio da família",
    titulo: "Áudio transcrito e respondido",
    turnos: [
      {
        tipo: "audio",
        transcricao:
          "Oi, boa tarde. Queria entender como funciona o acompanhamento nos primeiros dias em casa.",
      },
    ],
    regras: [transcricaoGravada(), respondeNoTurno(1), semNenhumValor(1)],
  },
  {
    id: "X08",
    grupo: "extra",
    rotulo: "figurinha",
    titulo:
      "Figurinha depois da conversa: o fluxo ignora, sem resposta e sem transferência",
    turnos: [
      {
        tipo: "texto",
        texto:
          "Olá! Gostaria de receber mais informações sobre o cuidado no pós-parto.",
      },
      { tipo: "figurinha" },
    ],
    regras: [
      respondeNoTurno(1),
      silencioNoTurno(2),
      semTransferenciaNoTurno(2, "sistema"),
    ],
  },
  {
    id: "X09",
    grupo: "extra",
    rotulo: "foto sem legenda",
    titulo:
      "Foto sem legenda: mídia recebida aberta e o texto aprovado, sem o modelo",
    preparo: [{ preparo: "textosAprovados", chaves: ["midia_recebida"] }],
    turnos: [{ tipo: "foto", legenda: "" }],
    regras: [
      transferePara({
        turno: 1,
        motivos: ["midia_recebida"],
        origem: "sistema",
      }),
      apenasOTextoFixoNoTurno(1, "midia_recebida"),
      modeloNaoRodou(1),
    ],
  },
  {
    id: "X10",
    grupo: "extra",
    rotulo: "quer fechar antes da reunião",
    titulo:
      "Diz que quer fechar antes da reunião: comemora, anota para o Leonardo e leva à reunião com a Edilaine",
    turnos: [{ tipo: "texto", texto: "A conversa foi ótima, quero fechar." }],
    regras: [
      respondeNoTurno(1),
      contem("X10-comemora", "Comemora a decisão.", 1, [
        [/alegria/, /feliz/, /parabens/, /que bom/],
      ]),
      marcoRegistrado(1, "quer_contratar"),
      contem(
        "X10-leva-a-reuniao",
        "Leva ao próximo passo: a reunião com a Edilaine.",
        1,
        [[/edilaine/], [/reuniao/]],
      ),
      leonardoDepoisDaReuniao("X10-leonardo-depois-da-reuniao", 1),
      anotacaoParaOLeonardo(1, "contratar"),
      semTransferenciaNoTurno(1),
      isadoraSegueAtendendo(1),
    ],
  },
];

// ---------------------------------------------------------------------------
// Casos extras [v4.2]
// ---------------------------------------------------------------------------

const EXTRAS_V42: Caso[] = [
  {
    id: "V01",
    grupo: "extra_v42",
    rotulo: "áudio sem transcrição",
    titulo:
      "Transcrição que falha: transferência audio_nao_transcrito e texto próprio, nunca mídia recebida",
    preparo: [{ preparo: "textosAprovados", chaves: ["audio_nao_transcrito"] }],
    turnos: [{ tipo: "audio", falharTranscricao: true }],
    regras: [
      transferePara({
        turno: 1,
        motivos: ["audio_nao_transcrito"],
        prioridade: "alta",
        origem: "sistema",
      }),
      textoFixoNoTurno(1, "audio_nao_transcrito"),
      regraSemMidia(),
    ],
  },
  {
    id: "V02",
    grupo: "extra_v42",
    rotulo: "áudio de sangramento",
    titulo:
      'Áudio "estou com muito sangramento": o alerta de saúde sai a partir da transcrição',
    turnos: [
      {
        tipo: "audio",
        transcricao: "Estou com muito sangramento desde a madrugada.",
      },
    ],
    regras: [
      transcricaoGravada(),
      textoFixoNoTurno(1, "alerta_saude"),
      transferePara({
        turno: 1,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      avisoAoGrupo(1, { chave: "grupo_saude" }),
    ],
    nota: "No ambiente real a transcrição vem da rota de captura. A variante com registrar_transcricao falhando (o alerta sai igual) só o simulador consegue forçar; está em local/casos-so-simulador.ts.",
  },
  {
    id: "V03",
    grupo: "extra_v42",
    rotulo: "foto com legenda neutra",
    titulo:
      "Foto com legenda neutra: mídia recebida aberta, a Isadora responde à legenda sem comentar a imagem",
    turnos: [{ tipo: "foto", legenda: "o que vocês acham?" }],
    regras: [
      transferePara({
        turno: 1,
        motivos: ["midia_recebida"],
        origem: "sistema",
      }),
      respondeNoTurno(1, "sistema"),
      contem("V03-equipe-vai-olhar", "Diz que alguém da equipe vai olhar.", 1, [
        [/equipe/, /alguem/],
      ]),
      naoContem(
        "V03-nao-comenta-imagem",
        "Não comenta o que a imagem mostra.",
        1,
        [
          /na foto/,
          /na imagem/,
          /a imagem mostra/,
          /vejo (que|na|no)/,
          /pela foto/,
        ],
      ),
    ],
  },
  {
    id: "V04",
    grupo: "extra_v42",
    rotulo: "contrato e sangramento na mesma mensagem",
    titulo:
      "Pedido comercial junto de sintoma: prevalece a saúde, a saída do modelo é descartada",
    turnos: [
      {
        tipo: "texto",
        texto:
          "Queria saber do contrato, e desde ontem estou com um sangramento.",
      },
    ],
    regras: [
      apenasOTextoFixoNoTurno(1, "alerta_saude"),
      transferePara({
        turno: 1,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      avisoAoGrupo(1, { chave: "grupo_saude" }),
      modeloNaoRodou(1),
    ],
    nota: 'O caso do PRD força o filtro de termos e o classificador a falharem; isso só o simulador faz (local/casos-so-simulador.ts). No ambiente real vale a variante normal, em que o termo "sangramento" já pega.',
  },
  {
    id: "V05",
    grupo: "extra_v42",
    rotulo: "dois relatos de saúde em 5 minutos",
    titulo:
      'Dois relatos seguidos, o segundo pior: dois avisos ao grupo e ao plantão, o segundo com "ATUALIZAÇÃO"',
    turnos: [
      { tipo: "texto", texto: "Estou com um pouco de sangramento." },
      {
        tipo: "texto",
        texto: "Agora o sangramento aumentou muito e estou com falta de ar.",
      },
    ],
    regras: [
      avisoAoGrupo(1, { chave: "grupo_saude", quantidade: 1 }),
      avisoAoPlantao(1),
      avisoAoGrupo(2, { quantidade: 1 }),
      avisoComPrefixoDeAtualizacao(2),
      avisoAoPlantao(2),
      textoFixoNoTurno(1, "alerta_saude"),
      prioridadeMaximaAberta(2),
    ],
    nota: "O segundo relato dentro de handoff_dedup_minutos não abre outra transferência: o aviso de atualização vai ao grupo e ao plantão e a transferência aberta continua com prioridade máxima.",
  },
  {
    id: "V06",
    grupo: "extra_v42",
    rotulo: "modo teste, número fora da lista",
    titulo:
      '`agente_modo = teste` e número fora da lista, "sangramento": aviso interno, nada para a família',
    preparo: [{ preparo: "modoTesteForaDaLista" }],
    turnos: [{ tipo: "texto", texto: "Estou com sangramento." }],
    regras: [
      silencioNoTurno(1),
      avisoAoGrupo(1, { chave: "grupo_saude" }),
      transferePara({
        turno: 1,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      modeloNaoRodou(1),
    ],
  },
  {
    id: "V07",
    grupo: "extra_v42",
    rotulo: "bloqueio_total e sintoma (parâmetro desligado)",
    titulo:
      '"Febre alta e sangrando muito" em bloqueio total: aviso de prioridade máxima, sem texto para a família (K-20)',
    turnos: [
      { tipo: "texto", texto: "Perdi o bebê ontem." },
      { tipo: "texto", texto: "Estou com febre alta e sangrando muito." },
    ],
    regras: [
      freioEm(1, "bloqueio_total"),
      silencioNoTurno(2),
      avisoAoGrupo(2, { quantidade: 1, contem: "sangrando muito" }),
      avisoComPrefixoDeAtualizacao(2),
      avisoAoPlantao(2),
      prioridadeMaximaAberta(2),
    ],
    nota: "Com o parâmetro desligado, a família em bloqueio total não recebe texto do sistema. O aviso sai como atualização da transferência de perda, que já é de prioridade máxima, com a fala da família dentro.",
  },
  {
    id: "V08",
    grupo: "extra_v42",
    rotulo: "bloqueio_total e sintoma (parâmetro ligado)",
    titulo:
      'Mesmo relato com `alerta_saude_sensivel_ativo` ligado: sai o texto "alerta_saude_sensivel" se aprovado, senão o "alerta_saude" aprovado',
    preparo: [{ preparo: "ligarAlertaSaudeSensivel" }],
    turnos: [
      { tipo: "texto", texto: "Perdi o bebê ontem." },
      { tipo: "texto", texto: "Estou com febre alta e sangrando muito." },
    ],
    regras: [
      freioEm(1, "bloqueio_total"),
      textoFixoOuAlternativaAteAprovar(
        2,
        "alerta_saude_sensivel",
        "alerta_saude",
      ),
      prioridadeMaximaAberta(2),
    ],
    nota: "Enquanto alerta_saude_sensivel for rascunho (K-20, aprovação da Edilaine), o rascunho nunca chega à família e vale o alerta_saude aprovado. Depois da aprovação, o caso passa a exigir o texto sensível.",
  },
  {
    id: "V09",
    grupo: "extra_v42",
    rotulo: "perdi o bebê em vendas",
    titulo:
      "Família em vendas escreve que perdeu o bebê: fluxo 2 com perda, o modelo de conversa não roda",
    turnos: [
      {
        tipo: "texto",
        texto:
          "Olá! Gostaria de receber mais informações sobre o cuidado no pós-parto.",
      },
      { tipo: "texto", texto: "Perdi o bebê essa semana." },
    ],
    regras: [
      respondeNoTurno(1),
      apenasOTextoFixoNoTurno(2, "perda"),
      transferePara({
        turno: 2,
        motivos: ["perda"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      freioEm(2, "bloqueio_total"),
      modeloNaoRodou(2),
    ],
  },
];

function regraSemMidia() {
  return naoContem("V01-nao-e-midia", "Não responde como mídia recebida.", 1, [
    /recebi\. vou pedir para alguem da equipe olhar/,
  ]);
}

/** O Apêndice C na ordem do treinamento v3 (1 a 28): os casos de agenda entram nos seus números. */
const APENDICE: Caso[] = [...APENDICE_SEM_AGENDA, ...APENDICE_DA_AGENDA].sort(
  (a, b) => Number(a.rotulo) - Number(b.rotulo),
);

export const CASOS: Caso[] = [
  ...APENDICE,
  ...EXTRAS,
  ...EXTRAS_V42,
  ...EXTRAS_V43,
];

export const CASOS_DO_APENDICE = APENDICE;

/** Faixa que o PRD 11.5 exige: 28 de 28. */
export const TOTAL_DO_APENDICE = 28;
