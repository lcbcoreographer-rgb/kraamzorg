/**
 * Microcopy da lista de alertas clínicos (P40). Frases completas, sem
 * exclamação, sem travessão. A conduta e a descrição de cada alerta vêm de
 * `regra_alerta`; aqui só o que a tela diz em volta.
 */
export const textosAlertas = {
  enfermeira: {
    titulo: "Alertas",
    subtitulo:
      "Os alertas das famílias que você acompanha. Registre o acionamento assim que falar com a supervisão médica.",
  },
  coordenacao: {
    titulo: "Alertas clínicos",
    subtitulo:
      "Complete o registro do acionamento e feche o alerta quando os quatro campos estiverem preenchidos.",
  },
  diretoria: {
    titulo: "Alertas clínicos",
    subtitulo:
      "Acompanhe os alertas abertos e o que já foi registrado em cada um.",
  },
  abas: {
    rotulo: "Situação dos alertas",
    abertos: "Abertos",
    fechados: "Fechados",
  },
  vazioAbertos: {
    titulo: "Nenhum alerta aberto",
    texto:
      "Quando um alerta clínico for identificado numa visita, ele aparece aqui com a conduta aprovada e o que falta registrar.",
  },
  vazioFechados: {
    titulo: "Nenhum alerta fechado ainda",
    texto:
      "Os alertas com o registro completo aparecem aqui depois de fechados.",
  },
  familia: (nome: string) => nome,
  dia: (n: number) => `Dia ${n}`,
  abrirVisita: "Abrir a visita",
  registrar: "Registrar acionamento",
  completar: "Completar o registro",
  fechar: "Fechar o alerta",
  fechando: "Fechando",
  fechadoEm: (data: string) => `Fechado em ${data}`,
  aberto: "Aberto",
  ocorrenciaPrivada: "Ocorrência privada. Registre o acionamento.",
  registro: {
    titulo: "Registro do acionamento",
    sinal: "Sinal identificado",
    horario: "Horário do acionamento",
    orientacao: "Orientação médica recebida",
    conduta: "Conduta adotada",
    naoRegistrado: "Ainda não registrado",
  },
  faltamParaFechar: (nomes: string[]) =>
    `Para fechar falta: ${nomes.join(", ")}.`,
  podeFechar: "Os quatro campos estão preenchidos. O alerta pode ser fechado.",
  soLeitura: "Você acompanha este alerta em leitura.",
  falhaAtualizar:
    "Não foi possível atualizar agora. Nada foi perdido. Atualize a tela e tente de novo.",
  salvo: "Registro salvo.",
  fechadoAviso: "Alerta fechado.",
} as const;
