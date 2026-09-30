/**
 * Microcopy do checklist e dos alertas (docs/design/voz.md, seção 4:
 * enfermeira no plantão, curto e clínico; seção 6: momentos sensíveis).
 * Só texto de interface; nenhum texto clínico mora aqui: rótulos, opções e
 * ajudas vêm da definição do instrumento aprovado, e código, achado e
 * conduta dos alertas vêm de `regra_alerta`. Sem travessão, sem meia-risca,
 * sem exclamação.
 */
export const textos = {
  paginaTitulo: (dia: number) => `Checklist do D${dia}`,
  voltarParaHoje: "Voltar para Hoje",
  diaDeTotal: (dia: number, total: number) => `D${dia} de ${total}`,
  etapa: (atual: number, total: number) => `Etapa ${atual} de ${total}`,
  verEtapas: (atual: number, total: number) =>
    `Etapa ${atual} de ${total}. Ver todas as etapas`,
  etapas: "Etapas",
  etapasAjuda:
    "Toque numa etapa para ir direto a ela. Dá para avançar com pendências; o que falta aparece na última etapa.",
  estadoDaEtapa: {
    completa: "Completa",
    com_pendencia: "Com pendência",
    com_alerta: "Com alerta",
    nao_iniciada: "Não iniciada",
  },
  voltar: "Voltar",
  proximaEtapa: "Próxima etapa",
  registrarOutroSinal: "Registrar outro sinal de alerta",
  carregando:
    "Abrindo o checklist. O que você já respondeu neste aparelho volta sozinho.",

  semInstrumentoTitulo: "O checklist ainda não foi aprovado",
  semInstrumentoTexto:
    "A coordenação clínica precisa aprovar a versão do checklist antes de usá-lo nas visitas. Avise a coordenação.",
  visitaNaoIniciadaTitulo: "A visita ainda não foi iniciada",
  visitaNaoIniciadaTexto:
    "Inicie a visita em Hoje para abrir o checklist. Os dados de data e horário vêm do check-in.",

  sincronizacao: {
    local: "Salvo no aparelho",
    enviando: (n: number) =>
      n === 1 ? "Enviando 1 item" : `Enviando ${n} itens`,
    sincronizado: (hora: string) =>
      hora ? `Sincronizado ${hora}` : "Sincronizado",
    erro: "Não enviou. Tudo continua salvo no aparelho.",
    tentarAgora: "Tentar agora",
    abrirFila: "Ver o que espera para subir",
  },
  semSinalTitulo: "Sem sinal agora",
  semSinalTexto:
    "O registro está salvo no aparelho e sobe sozinho quando a conexão voltar.",

  freio: "Freio",
  freioRotulo:
    "Acionar freio: pausa toda mensagem automática para esta família",
  freioAcionado: (nome: string) =>
    `Freio acionado. Nenhuma mensagem automática sai para ${nome}.`,
  freioAtivo:
    "Freio ativo. O registro clínico continua liberado; nenhuma mensagem automática sai para esta família.",
  freioFalhou:
    "Não foi possível acionar o freio agora. Tente de novo ou avise a coordenação.",

  referencia: (dia: number, valor: string) => `No D${dia} foi ${valor}.`,
  trazerTexto: (dia: number) => `Trazer o texto do D${dia}`,
  textoTrazidoTitulo: (dia: number, familia: string) =>
    `Texto do D${dia} desta família (${familia})`,
  textoTrazidoAjuda:
    "Confirme que continua valendo hoje antes de salvar. Enquanto não confirmar, este campo não conta como respondido nem entra no registro.",
  valeParaHoje: "Vale para hoje",
  apagarEEscrever: "Apagar e escrever",
  textoColadoOutraFamilia: (nome: string) =>
    `O texto colado cita a ${nome}, que não é esta família. Confira antes de salvar.`,
  digitacaoUmDigitoAMenos: (valor: string, unidade: string) =>
    `${valor} ${unidade} parece um dígito a menos. Confira e digite de novo.`,

  abaBebe: (rotulo: string) => rotulo,
  abasBebes: "Bebês",
  semBebeTitulo: "Nenhum bebê cadastrado nesta família",
  semBebeTexto:
    "As perguntas do recém-nascido aparecem quando o nascimento estiver registrado. Avise a coordenação para atualizar o cadastro.",

  curva: {
    titulo: "Curva de peso",
    menorPeso: "Menor peso",
    perda: "Perda desde o nascimento",
    ganho: "Ganho desde o menor peso",
    ganhoDiario: "Ganho médio por dia",
    ultimo: "Último peso",
    semDados: "Registre o peso de hoje para ver a curva.",
    semValor: "Ainda sem dado",
    ajuda: "Calculada a partir do menor peso registrado, em gramas por dia.",
    gramas: (g: number) => `${g.toLocaleString("pt-BR")} g`,
    percentual: (p: number) =>
      `${p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    porDia: (g: number) =>
      `${g.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g por dia`,
  },

  apoio: {
    consultar: "Consultar",
    latchTitulo: "Tabela LATCH",
    latchAjuda:
      "Marque cada item da tabela. A soma é uma sugestão de nota e você decide se usa no campo.",
    latchSoma: (n: number, maximo: number) => `Soma: ${n} de ${maximo}`,
    latchUsar: (n: number) => `Usar ${n} no campo LATCH`,
    latchEscolha: "Marque os cinco itens",
    ntsTitulo: "Escala de trauma mamilar (NTS)",
    ntsUsar: (n: number) => `Usar ${n} no campo NTS`,
    ntsEscolha: "Escolha um grau",
    laserTitulo: "Protocolos de laserterapia",
    fechar: "Fechar",
    rotuloFechar: "Fechar a janela de apoio",
  },

  alerta: {
    ligar: "Ligar para a supervisão",
    ligarSemNumero: "Ligue para a supervisão médica",
    registrar: "Registrar acionamento",
    registrarCurto: "Registrar",
    antesDeFechar:
      "Antes de fechar: sinal identificado, horário do acionamento, orientação médica recebida e conduta adotada.",
    semSinalMeta:
      "Sem sinal: a coordenação recebe o alerta quando a conexão voltar. Se for urgente agora, ligue.",
    ocorrenciaPrivada: "Ocorrência privada. Registre o acionamento.",
    registrado: "Registro do acionamento feito",
    faltam: (n: number) =>
      n === 1 ? "Falta 1 campo do registro" : `Faltam ${n} campos do registro`,
    umaSemRegistro: "1 alerta sem registro",
    variasSemRegistro: (n: number) => `${n} alertas sem registro`,
    verLista: "Ver a lista",
    listaTitulo: "Alertas desta visita",
    bebe: (rotulo: string) => `Bebê: ${rotulo}`,
    fecharJanela: "Fechar",
  },

  folhaAcionamento: {
    titulo: "Registrar acionamento",
    sinal: "Sinal",
    sinalIdentificado: "Sinal identificado",
    horario: "Horário do acionamento",
    horarioAjuda: "Hoje, no horário de Brasília.",
    orientacao: "Orientação médica recebida",
    conduta: "Conduta adotada",
    agoraNao: "Agora não",
    salvar: "Salvar registro",
    faltamCampos: "Ainda falta preencher para poder fechar o alerta:",
    salvoParcial:
      "Registro salvo. O alerta só fecha com os quatro campos; a coordenação completa o que faltar.",
    horaInvalida: "Digite o horário como 10:14.",
    horaNoFuturo: "O horário do acionamento não pode estar no futuro.",
    campoDe: {
      sinalIdentificado: "sinal identificado",
      acionadoEm: "horário do acionamento",
      orientacaoMedica: "orientação médica recebida",
      condutaAdotada: "conduta adotada",
    },
  },

  seletor: {
    titulo: "Registrar outro sinal de alerta",
    ajuda:
      "Sinais do protocolo que não têm campo no checklist. Escolha o que você observou; a conduta aprovada aparece em seguida.",
    desligadoTitulo: "A lista de sinais ainda espera a validação clínica",
    desligadoTexto:
      "A coordenação clínica precisa validar a lista antes de ela aparecer aqui. Se houver qualquer sinal de alerta agora, ligue para a supervisão médica.",
    grupos: {
      puerpera: "Puérpera",
      saude_mental: "Saúde mental",
      recem_nascido: "Recém-nascido",
      amamentacao: "Amamentação e mamas",
    } as Record<string, string>,
    bebe: "De qual bebê?",
    observacao: "O que você observou (opcional)",
    registrar: "Registrar sinal",
    jaRegistrado: "Este sinal já está registrado nesta visita.",
    registrado:
      "Sinal registrado. A coordenação foi avisada assim que houver sinal.",
    escolha: "Escolha um sinal da lista.",
  },

  resumo: {
    titulo: "Resumo e assinatura",
    faltaParaAssinar: "Falta para assinar",
    tudoRespondido: "Tudo o que é obrigatório está respondido.",
    irPara: (rotulo: string) => `Ir para ${rotulo}`,
    textoAguardando: (rotulo: string) =>
      `${rotulo}: confirme ou apague o texto trazido do dia anterior`,
    semBebe:
      "Sem bebê cadastrado, o registro não conclui. Avise a coordenação.",
    alertaSemRegistro: (codigo: string) =>
      `${codigo}: falta registrar o acionamento (não impede assinar)`,
    assinar: (dia: number) => `Assinar registro do D${dia}`,
    assinarDesabilitado: "Falta responder para assinar",
    naoConsegui: "Não consegui, justificar",
    voltarAoContato: "Informar o contato",
    justificativa: "Justificativa da ausência do contato",
    contatoAjuda:
      "Sem contato, a visita encerra, a coordenação recebe a tarefa de obter o contato e a evolução fica bloqueada até existir pelo menos um.",
  },

  assinatura: {
    titulo: (dia: number) => `Assinar o registro do D${dia}?`,
    aviso:
      "Depois de assinado, o registro não muda. Se precisar corrigir, você faz um adendo com o motivo.",
    revisar: "Revisar",
    assinarAgora: "Assinar agora",
    assinando: "Assinando",
    assinadoAs: (hora: string) => `Assinado às ${hora}.`,
    sobeQuandoHouverSinal: "Sobe quando houver sinal.",
    servidorRecebeu: "O servidor recebeu o registro.",
    falhou:
      "Não foi possível assinar agora. O que você respondeu continua salvo no aparelho. Tente de novo.",
    recusado:
      "O servidor não aceitou o registro. Nada foi gravado e o que você respondeu continua no aparelho.",
    proximaVisita: "Voltar para Hoje",
  },

  leitura: {
    titulo: "Registro assinado",
    assinadoPor: (nome: string, quando: string) =>
      `Assinado por ${nome} em ${quando}.`,
    naoMuda: "O registro não muda. Para corrigir, faça um adendo com o motivo.",
    fazerAdendo: "Fazer adendo",
    adendos: "Adendos",
    semAdendos: "Nenhum adendo neste registro.",
    adendoTitulo: "Adendo ao registro",
    adendoMotivo: "Motivo do adendo",
    adendoTexto: "O que corrigir ou acrescentar",
    adendoSalvar: "Salvar adendo",
    adendoAjuda:
      "O registro original fica como foi assinado. O adendo mostra o motivo, quem fez e quando.",
    adendoSemSinal:
      "Adendo salvo no aparelho. Sobe sozinho quando a conexão voltar.",
    adendoSalvo: "Adendo registrado.",
    adendoVazio: "Escreva o motivo e o texto do adendo.",
    aguardandoEnvio: "Assinado no aparelho, esperando para subir.",
    referenciaDoDia: "Registro do dia",
    resumoDescritivo: "Resumo descritivo",
    bebePorAba: "Bebê",
  },

  audio: {
    titulo: "Áudio do resumo",
    ajuda:
      "Grave ou anexe um áudio com o resumo. Ele fica no armazenamento privado da Kraamzorg e só quem tem acesso à família ouve.",
    gravar: "Gravar áudio",
    parar: "Parar gravação",
    anexar: "Anexar áudio",
    gravando: (s: number) => `Gravando, ${s}s`,
    enviando: "Enviando o áudio",
    salvoNoAparelho:
      "Sem sinal agora. O áudio está salvo no aparelho e sobe sozinho quando a conexão voltar.",
    enviado: "Áudio anexado à visita.",
    ouvir: "Ouvir",
    semTranscricao:
      "Sem transcrição por enquanto. O áudio fica anexado à visita.",
    naoTemMicrofone:
      "Este aparelho não liberou o microfone. Você pode anexar um áudio já gravado.",
    grande:
      "O áudio passa do tamanho ou do tempo máximo. Grave um trecho mais curto.",
    tipoNaoAceito: "Esse tipo de arquivo não é aceito. Use um áudio.",
    falhou:
      "Não foi possível anexar o áudio agora. Tente de novo em instantes.",
    urlExpira: (s: number) => `O link para ouvir vale ${s} segundos.`,
    lista: "Áudios anexados",
    duracao: (s: number) =>
      `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
  },

  fila: {
    titulo: "Fila do aparelho",
    vazia:
      "Nada espera para subir. Tudo o que você fez neste aparelho já chegou ao servidor.",
    comItens: (n: number) =>
      n === 1
        ? "1 item espera no aparelho e sobe sozinho quando a conexão voltar, na ordem em que foi salvo."
        : `${n} itens esperam no aparelho e sobem sozinhos quando a conexão voltar, na ordem em que foram salvos.`,
    itemRegistro: (dia: number) => `Registro assinado do D${dia}`,
    itemAlerta: (codigo: string) => `Alerta ${codigo} para a coordenação`,
    itemAdendo: "Adendo ao registro",
    itemOutro: "Atualização da visita",
    tentar: "Tentar agora",
    fechar: "Fechar",
  },
} as const;
