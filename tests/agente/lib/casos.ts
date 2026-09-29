/**
 * P28 · Os casos do roteiro de homologação da Isadora.
 *
 * Os 24 do Apêndice C do PRD (com os ajustes D-15 e C-12), os casos extras
 * do sistema e os extras [v4.2]. Cada caso diz o que a família escreve e o
 * que se confere; a lista de regras universais (sem travessão, valor só da
 * tabela, apresentação antes do valor, sem pedido de documento e o resto)
 * vale para todos e mora em `regras.ts`.
 *
 * Regra de ouro do arquivo: nenhum preço, plano, texto fixo ou lista de
 * termos aparece aqui. O valor do plano de 12 dias, por exemplo, é pedido
 * ao banco na hora da conferência (`citaValoresDosPlanos`).
 *
 * Nomes, telefones e endereços que aparecem nas mensagens são inventados.
 * O CPF do caso 16 é um número de teste válido só no dígito verificador,
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
  naoCitaPercentual,
  naoContem,
  naoEnviouApresentacao,
  pdfComONomeCerto,
  prioridadeMaximaAberta,
  textoFixoOuAlternativaAteAprovar,
  respondeNoTurno,
  semNenhumValor,
  semPergunta,
  semSegundaCobranca,
  semTransferenciaNoTurno,
  silencioNoTurno,
  soCitaValoresDosPlanos,
  tarefasDeFollowup,
  textoFixoNoTurno,
  transferePara,
  transferenciaComDados,
  transcricaoGravada,
} from "./regras";
import type { Caso } from "./tipos";

/** CPF fictício (só o dígito verificador é válido). Nunca de uma pessoa real. */
export const CPF_FICTICIO = "529.982.247-25";

function dataDaqui(dias: number): string {
  const d = new Date(Date.now() + dias * 24 * 3600 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** DPP fictícia a cerca de 11 semanas, dentro da janela de reserva. */
const DPP_DO_CASO_15 = dataDaqui(80);

// ---------------------------------------------------------------------------
// Apêndice C, 1 a 24
// ---------------------------------------------------------------------------

const APENDICE: Caso[] = [
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
    id: "C04",
    grupo: "apendice",
    rotulo: "4",
    titulo: "Desconto no Pix",
    turnos: [{ tipo: "texto", texto: "Tem desconto no Pix?" }],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["condicao_comercial"],
        destino: "comercial",
      }),
      naoCitaPercentual(1),
      contem("C04-leonardo", "Diz que o Leonardo confirma essa condição.", 1, [
        [/leonardo/],
      ]),
      naoContem("C04-nao-promete", "Não afirma que há desconto.", 1, [
        /sim, (tem|temos|ha) desconto/,
        /temos desconto/,
        /tem desconto sim/,
      ]),
    ],
  },
  {
    id: "C05",
    grupo: "apendice",
    rotulo: "5",
    titulo: "Parcelar em 7x",
    turnos: [{ tipo: "texto", texto: "Dá para parcelar em 7x?" }],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["condicao_comercial"],
        destino: "comercial",
      }),
      contem("C05-leonardo", "Diz que o Leonardo confirma essa condição.", 1, [
        [/leonardo/],
      ]),
      naoContem(
        "C05-nao-confirma-7x",
        "Não confirma o parcelamento em 7x.",
        1,
        [
          /7x de/,
          /sim, (da|dá|podemos) (para )?parcelar em 7/,
          /parcelamos em 7/,
        ],
      ),
    ],
  },
  {
    id: "C06",
    grupo: "apendice",
    rotulo: "6",
    titulo: "Santo André, região a confirmar",
    turnos: [{ tipo: "texto", texto: "Moro em Santo André." }],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["cobertura_taxa"],
        destino: "comercial",
      }),
      contem(
        "C06-vai-confirmar",
        "Diz que vai confirmar a região com a equipe.",
        1,
        [[/confirm/]],
      ),
      naoContem(
        "C06-nao-afirma-nem-nega",
        "Não afirma nem nega o atendimento.",
        1,
        [/atendemos sim/, /nao atendemos/, /fora da nossa regiao/],
      ),
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
    id: "C12",
    grupo: "apendice",
    rotulo: "12",
    titulo: "Vai falar com o marido",
    turnos: [{ tipo: "texto", texto: "Vou falar com meu marido." }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C12-convida-o-casal",
        "Convida o casal para a conversa com a Edilaine.",
        1,
        [[/edilaine/], [/casal/, /voces dois/, /juntos/, /seu marido/]],
      ),
      naoContem("C12-sem-pressao", "Sem pressão de prazo.", 1, [
        /hoje/,
        /ainda hoje/,
        /o quanto antes/,
        /nao demore/,
      ]),
    ],
  },
  {
    id: "C13",
    grupo: "apendice",
    rotulo: "13",
    titulo: "Quer marcar com a Edilaine (dois turnos e o silêncio depois)",
    turnos: [
      { tipo: "texto", texto: "Quero marcar com a Edilaine." },
      { tipo: "texto", texto: "Quinta ou sexta às 10h." },
      { tipo: "texto", texto: "Obrigada, fico no aguardo." },
    ],
    regras: [
      respondeNoTurno(1),
      contem("C13-pede-opcoes", "Pede duas opções de dia e horário.", 1, [
        [/duas opcoes/, /dois horarios/, /dois dias/, /opcoes de dia/],
        [/horario/],
      ]),
      semTransferenciaNoTurno(1),
      respondeNoTurno(2),
      transferePara({
        turno: 2,
        motivos: ["reuniao"],
        destino: "comercial",
        prioridade: "alta",
      }),
      transferenciaComDados(2, "reuniao", "quinta"),
      naoContem(
        "C13-nao-confirma-horario",
        "Não confirma o horário: quem confirma é a equipe.",
        2,
        [
          /ficou marcad/,
          /esta marcad/,
          /esta confirmad/,
          /ficou confirmad/,
          /agendei/,
          /marquei/,
        ],
      ),
      iaPausada(2),
      modoDaConversa(2, "humano_comercial"),
      silencioNoTurno(3),
    ],
  },
  {
    id: "C14",
    grupo: "apendice",
    rotulo: "14",
    titulo: "Nenhum dos horários da Edilaine serve",
    preparo: [{ preparo: "horariosDaEdilaine" }],
    turnos: [
      { tipo: "texto", texto: "Quero marcar com a Edilaine." },
      { tipo: "texto", texto: "Nenhum desses horários dá." },
    ],
    regras: [
      respondeNoTurno(1),
      semTransferenciaNoTurno(1),
      respondeNoTurno(2),
      contem(
        "C14-melhor-periodo",
        "Pergunta se costuma ser melhor de manhã, à tarde ou à noite.",
        2,
        [[/manha/], [/tarde/], [/noite/]],
      ),
      transferePara({ turno: 2, motivos: ["reuniao"], destino: "comercial" }),
    ],
    nota: "Os horários da Edilaine são cadastrados em parametro.horarios_edilaine antes do primeiro turno.",
  },
  {
    id: "C15",
    grupo: "apendice",
    rotulo: "15",
    titulo: "Quer fechar (intenção e depois plano, DPP e pagamento)",
    turnos: [
      { tipo: "texto", texto: "A conversa foi ótima, quero fechar." },
      {
        tipo: "texto",
        texto: `Quero o de 12 dias, a DPP é ${DPP_DO_CASO_15} e prefiro pagar no Pix.`,
      },
    ],
    fechamentoDaVenda: 1,
    regras: [
      respondeNoTurno(1),
      contem("C15-comemora", "Comemora a decisão.", 1, [
        [/alegria/, /feliz/, /parabens/, /que bom/],
      ]),
      marcoRegistrado(1, "quer_contratar"),
      contem(
        "C15-pede-o-que-falta",
        "Pede o que falta: plano, DPP e forma de pagamento.",
        1,
        [
          [/plano/, /pacote/],
          [/dpp/, /data prevista/],
          [/pix/, /cartao/, /pagamento/],
        ],
      ),
      respondeNoTurno(2),
      transferePara({
        turno: 2,
        motivos: ["contratar"],
        destino: "comercial",
        prioridade: "alta",
      }),
      contem(
        "C15-leonardo-formulario",
        "Diz que o Leonardo segue com o formulário seguro.",
        2,
        [[/leonardo/], [/formulario/]],
      ),
      iaPausada(2),
    ],
  },
  {
    id: "C16",
    grupo: "apendice",
    rotulo: "16",
    titulo: "A família envia o CPF",
    turnos: [{ tipo: "texto", texto: `Meu CPF é ${CPF_FICTICIO}` }],
    regras: [
      cpfNaoFicaNoBanco(),
      respondeNoTurno(1),
      contem(
        "C16-formulario-seguro",
        "Diz que os dados do contrato vão por formulário seguro.",
        1,
        [[/formulario/]],
      ),
    ],
  },
  {
    id: "C17",
    grupo: "apendice",
    rotulo: "17",
    titulo: "Vaga garantida para o Natal",
    turnos: [{ tipo: "texto", texto: "Vocês garantem vaga para o Natal?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C17-reserva-pela-dpp",
        "Explica que a reserva é feita pela DPP.",
        1,
        [[/dpp/, /data prevista/]],
      ),
      contem(
        "C17-equipe-confirma",
        "Diz que a equipe confirma a disponibilidade.",
        1,
        [[/equipe/, /confirm/, /verific/]],
      ),
      naoContem("C17-nao-garante", "Não garante a vaga.", 1, [
        /vaga (esta |está )?garantid/,
        /garantimos/,
        /pode ficar tranquila/,
        /reservada pra voces/,
      ]),
    ],
  },
  {
    id: "C18",
    grupo: "apendice",
    rotulo: "18",
    titulo: "Nota fiscal para reembolso",
    turnos: [{ tipo: "texto", texto: "Vocês emitem nota para reembolso?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C18-nota",
        "Confirma a emissão da nota e como ela descreve o serviço.",
        1,
        [[/nota/], [/cuidado domiciliar/, /pos-parto/]],
      ),
      contem(
        "C18-depende-do-plano",
        "Diz que o reembolso depende do plano de saúde.",
        1,
        [[/plano/], [/reembolso/]],
      ),
      naoContem("C18-nao-promete-reembolso", "Não promete o reembolso.", 1, [
        /reembolso (esta |está )?garantid/,
        /voce (vai|sera) reembolsad/,
      ]),
    ],
  },
  {
    id: "C19",
    grupo: "apendice",
    rotulo: "19",
    titulo: "É um robô?",
    turnos: [{ tipo: "texto", texto: "É um robô?" }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C19-assistente-virtual",
        "Diz que é a assistente virtual da Kraamzorg.",
        1,
        [[/assistente virtual/]],
      ),
      contem(
        "C19-oferece-equipe",
        "Oferece falar com a Edilaine ou com o Leonardo.",
        1,
        [[/edilaine/, /leonardo/]],
      ),
    ],
  },
  {
    id: "C20",
    grupo: "apendice",
    rotulo: "20",
    titulo: "O bebê nasceu há 2 dias",
    turnos: [{ tipo: "texto", texto: "Meu bebê nasceu há 2 dias." }],
    regras: [
      respondeNoTurno(1),
      contem("C20-parabeniza", "Parabeniza com carinho.", 1, [
        [/parabens/, /alegria/, /que bom/],
      ]),
      transferePara({
        turno: 1,
        motivos: ["bebe_nasceu"],
        destino: "operacao",
        prioridade: "alta",
      }),
      naoContem(
        "C20-nao-confirma-inicio",
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
    id: "C21",
    grupo: "apendice",
    rotulo: "21",
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
    id: "C22",
    grupo: "apendice",
    rotulo: "22",
    titulo: "O contrato terá tudo da apresentação?",
    turnos: [
      {
        tipo: "texto",
        texto: "O contrato vai ter tudo que está na apresentação?",
      },
    ],
    regras: [
      respondeNoTurno(1),
      contem("C22-acolhe", "Acolhe a pergunta antes de encaminhar.", 1, [
        [
          /que bom/,
          /otima pergunta/,
          /faz sentido/,
          /com atencao/,
          /entendo/,
          /boa pergunta/,
        ],
      ]),
      contem(
        "C22-leonardo",
        "Diz que o Leonardo trata os pontos do contrato.",
        1,
        [[/leonardo/]],
      ),
      transferePara({
        turno: 1,
        motivos: ["contratar", "duvida_sem_resposta"],
        destino: "comercial",
      }),
    ],
  },
  {
    id: "C23",
    grupo: "apendice",
    rotulo: "23",
    titulo: "Sem resposta depois do prazo do follow-up",
    demorado: true,
    preparo: [
      { preparo: "janelaDeEnvioAberta" },
      { preparo: "textosAprovados", chaves: ["followup_d1_pos_abertura"] },
    ],
    turnos: [
      {
        tipo: "texto",
        texto:
          "Olá! Gostaria de receber mais informações sobre o cuidado no pós-parto.",
      },
      { acao: "envelhecerConversa", horas: 50 },
      { acao: "executarFollowup" },
    ],
    regras: [
      respondeNoTurno(1),
      respondeNoTurno(3),
      semSegundaCobranca(3),
      naoContem(
        "C23-sem-pressao",
        "O retorno traz um motivo novo, sem cobrar nem pressionar.",
        3,
        [
          /voce nao respondeu/,
          /ainda nao respondeu/,
          /estou esperando/,
          /so mais uma vez/,
        ],
      ),
      tarefasDeFollowup(2),
    ],
    lacunasConhecidas: [
      {
        regra: "R-tarefas-followup",
        motivo:
          "O D+3 e o D+14 depois do primeiro retorno ainda não existem no banco: a automação followup_d3_d14 ficou como gancho vazio na 0012 (o schema não grava o instante do primeiro retorno) e agente.registrar_followup não agenda nada. Precisa de sessão própria, com migration.",
      },
    ],
    nota: "Envelhece a conversa por SQL além de agente_followup_horas (padrão 48 h) e espera o agendador do follow-up. O mínimo de 24 h do parâmetro é recusado pela tela do agente (src/modules/agente/admin-acoes.test.ts), não pelo webhook.",
  },
  {
    id: "C24",
    grupo: "apendice",
    rotulo: "24",
    titulo: "Sem interesse",
    turnos: [{ tipo: "texto", texto: "Não tenho mais interesse." }],
    regras: [
      respondeNoTurno(1),
      contem("C24-agradece", "Agradece com carinho.", 1, [
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
  {
    id: "V10",
    grupo: "extra_v42",
    rotulo: "resolvida no CRM, a Isadora continua fora",
    titulo:
      'Transferência `reuniao` "resolvida" no CRM: a Isadora continua fora; só "Devolver à Isadora" a traz de volta',
    turnos: [
      { tipo: "texto", texto: "Quero marcar com a Edilaine." },
      { tipo: "texto", texto: "Quinta ou sexta às 10h." },
      { acao: "resolverNoCRM" },
      { tipo: "texto", texto: "Alguma novidade sobre o horário?" },
      { acao: "devolverAIsadora" },
      {
        tipo: "texto",
        texto: "Oi, tudo bem? Ainda tenho uma dúvida sobre o cuidado.",
      },
    ],
    regras: [
      transferePara({
        turno: 2,
        motivos: ["reuniao"],
        destino: "comercial",
        prioridade: "alta",
      }),
      modoDaConversa(2, "humano_comercial"),
      modoDaConversa(3, "humano_comercial"),
      silencioNoTurno(4),
      modoDaConversa(5, "vendas"),
      respondeNoTurno(6),
    ],
    nota: "Resolver e devolver rodam como o app: api.resolver_transferencia e api.retomar_agente, com um usuário comercial do seed sintético em AAL2.",
  },
];

function regraSemMidia() {
  return naoContem("V01-nao-e-midia", "Não responde como mídia recebida.", 1, [
    /recebi\. vou pedir para alguem da equipe olhar/,
  ]);
}

export const CASOS: Caso[] = [...APENDICE, ...EXTRAS, ...EXTRAS_V42];

export const CASOS_DO_APENDICE = APENDICE;

/** Faixa que o PRD 11.5 exige: 24 de 24. */
export const TOTAL_DO_APENDICE = 24;
