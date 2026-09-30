// GERADO por scripts/gerar-seed-relacao.mjs a partir de
// supabase/dados/relacao_seed.sql. Não edite à mão: mude o seed e rode
// `node scripts/gerar-seed-relacao.mjs`. O teste relacao-seed.test.ts falha
// se os dados deste arquivo ficarem diferentes do seed.
import type { Json } from "@/lib/db/types";

export const PARAMETROS_RELACAO: Record<string, Json> = {
  captacao: {
    prefixo: "KZ",
    numero_whatsapp_e164: "+5511900000000",
    tentativas_max: 20,
    janela_minutos: 10,
    utm_tamanho_max: 80,
    exportar_max: 5000,
  },
  marketing: {
    ve_receita: false,
  },
  copiloto: {
    ativo: true,
    pergunta_max_caracteres: 500,
    orcamento_mensal_centavos: 5000,
    preco_entrada_centavos_por_milhao: 220,
    preco_saida_centavos_por_milhao: 880,
    termos_assistenciais: [
      "registro assistencial",
      "prontuario",
      "evolucao",
      "checklist",
      "peso do bebe",
      "alerta clinico",
      "ictericia",
      "amamentacao",
      "laserterapia",
      "sinais vitais",
      "pressao arterial",
      "temperatura",
      "saturacao",
      "loquios",
      "coto umbilical",
      "diagnostico",
      "medicacao",
      "sintoma",
      "adendo",
      "ficha de entrevista",
      "dados clinicos",
      "historico clinico",
      "intercorrencia",
      "ocorrencia clinica",
    ],
  },
  portal_familia: {
    endereco: "https://app.exemplo.invalid/familia",
    evolucoes_ativo: false,
    link_janela_minutos: 60,
    link_max_por_origem: 10,
    link_max_por_email: 3,
    contato_equipe: {
      nome: "Equipe de teste da Kraamzorg",
      telefone_e164: "+5511900000001",
      horario: "Segunda a sexta, das 9h às 18h",
    },
    contato_sensivel: {
      nome: "Contato de teste da coordenação",
      telefone_e164: "+5511900000002",
      funcao: "Coordenação de enfermagem",
    },
  },
  indicacoes: {
    relacionamento_dias: 60,
  },
  talentos_pagina_publica: {
    ativa: false,
    termo_versao: "T-1 provisório",
    tentativas_max: 5,
    janela_minutos: 60,
  },
  talentos_roteiro: {
    versao: "R-1 provisório",
    escala: {
      min: 1,
      max: 5,
    },
    blocos: [
      {
        id: "b1",
        nome: "Trajetória e perfil",
        perguntas: [
          {
            id: "p01",
            texto:
              "Conte sobre a sua formação e a sua experiência profissional.",
          },
          {
            id: "p02",
            texto: "Você tem especialização em saúde materno-infantil? Qual?",
          },
          {
            id: "p03",
            texto: "Há quanto tempo você atua na área?",
          },
          {
            id: "p04",
            texto:
              "Onde você já atuou: alojamento conjunto ou maternidade, unidade neonatal, banco de leite, como autônoma, em domicílio ou em centro de parto?",
          },
          {
            id: "p05",
            texto:
              "O que você pensa sobre a assistência domiciliar à mãe e ao bebê?",
          },
          {
            id: "p06",
            texto: "Como você se mantém atualizada?",
          },
          {
            id: "p07",
            texto:
              "Quais foram os últimos eventos científicos de que você participou?",
          },
          {
            id: "p08",
            texto: "Como você cuida do sigilo das informações das famílias?",
          },
          {
            id: "p09",
            texto:
              "Para você, o que é essencial num atendimento domiciliar de excelência?",
          },
        ],
      },
      {
        id: "b2",
        nome: "Neonatologia",
        perguntas: [
          {
            id: "p10",
            texto:
              "Como você faz a avaliação inicial de um recém-nascido em casa, no 3º ou 4º dia de vida?",
          },
          {
            id: "p11",
            texto:
              "Quais sinais de risco no recém-nascido pedem encaminhamento?",
          },
          {
            id: "p12",
            texto: "Como você avalia se a amamentação está sendo eficaz?",
          },
          {
            id: "p13",
            texto: "O que você orienta sobre engasgo e sono seguro?",
          },
          {
            id: "p14",
            texto:
              "Como você acompanha a evolução do peso do bebê nos primeiros 10 dias?",
          },
          {
            id: "p15",
            texto:
              "Como você reconhece os sinais precoces de icterícia, desidratação e infecção?",
          },
          {
            id: "p16",
            texto:
              "O que você orienta sobre higiene, banho e cuidado com o coto umbilical?",
          },
        ],
      },
      {
        id: "b3",
        nome: "Puerpério",
        perguntas: [
          {
            id: "p17",
            texto:
              "Como é a recuperação depois de um parto vaginal e depois de uma cesárea?",
          },
          {
            id: "p18",
            texto: "Quais sinais de alerta na mãe pedem encaminhamento médico?",
          },
          {
            id: "p19",
            texto:
              "Como você cuida de lesão mamilar, ingurgitamento e baixa produção de leite?",
          },
          {
            id: "p20",
            texto:
              "Como você identifica depressão ou sofrimento emocional no puerpério?",
          },
          {
            id: "p21",
            texto:
              "O que você faria diante de um bebê pouco ativo, mamando pouco e com fraldas quase secas?",
          },
        ],
      },
      {
        id: "b4",
        nome: "Relacionamento interpessoal",
        perguntas: [
          {
            id: "p22",
            texto:
              "Como você constrói vínculo com os pais sem ultrapassar os limites profissionais?",
          },
          {
            id: "p23",
            texto:
              "O que você faz quando a família insiste numa prática não recomendada, como chá, chupeta ou mamadeira na maternidade?",
          },
          {
            id: "p24",
            texto:
              "Como você organiza as orientações para que a família consiga segui-las?",
          },
        ],
      },
      {
        id: "b5",
        nome: "Finalização",
        perguntas: [
          {
            id: "p25",
            texto: "Quais são os seus maiores diferenciais?",
          },
          {
            id: "p26",
            texto: "Por que você deveria ser escolhida?",
          },
        ],
      },
    ],
    criterios: [
      {
        id: "c01",
        nome: "Conhecimento técnico",
      },
      {
        id: "c02",
        nome: "Experiência prática (neonatal e domicílio)",
      },
      {
        id: "c03",
        nome: "Segurança na tomada de decisão",
      },
      {
        id: "c04",
        nome: "Desenvoltura, comunicação e empatia",
      },
      {
        id: "c05",
        nome: "Relacionamento com famílias",
      },
      {
        id: "c06",
        nome: "Raciocínio clínico",
      },
      {
        id: "c07",
        nome: "Disponibilidade e comprometimento",
      },
      {
        id: "c08",
        nome: "Apresentação e postura",
      },
      {
        id: "c09",
        nome: "Identificação de situações de risco",
      },
      {
        id: "c10",
        nome: "Autonomia no domicílio",
      },
    ],
  },
};

export const TEXTOS_RELACAO: {
  chave: string;
  canal: string;
  destinatario: string;
  texto: string;
}[] = [
  {
    chave: "captacao_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Oi. Aqui é a Kraamzorg.",
  },
  {
    chave: "captacao_abertura",
    canal: "site",
    destinatario: "familia",
    texto:
      "Cuidamos de mãe e bebê em casa, nos primeiros dias depois do parto, com enfermeiras que acompanham a sua família com presença e orientação clara.",
  },
  {
    chave: "captacao_como_funciona",
    canal: "site",
    destinatario: "familia",
    texto:
      "Ao tocar no botão, o WhatsApp abre com uma mensagem pronta. É só enviar. A Isadora, assistente virtual da Kraamzorg, responde primeiro, e a nossa equipe entra na conversa quando for preciso.",
  },
  {
    chave: "captacao_privacidade",
    canal: "site",
    destinatario: "familia",
    texto:
      "Esta página não pede nenhum dado seu. Você conta o que quiser na conversa, no seu tempo.",
  },
  {
    chave: "captacao_botao",
    canal: "site",
    destinatario: "familia",
    texto: "Conversar pelo WhatsApp",
  },
  {
    chave: "captacao_verificando",
    canal: "site",
    destinatario: "familia",
    texto: "Só um instante. Estamos confirmando que você é uma pessoa.",
  },
  {
    chave: "captacao_verificacao_falhou",
    canal: "site",
    destinatario: "familia",
    texto:
      "Não deu para confirmar que você é uma pessoa. Recarregue a página e tente de novo.",
  },
  {
    chave: "captacao_indisponivel",
    canal: "site",
    destinatario: "familia",
    texto:
      "Este link não está mais ativo. Se você chegou aqui por engano ou o link é antigo, fale com a nossa equipe pelo contato que você recebeu.",
  },
  {
    chave: "captacao_limite",
    canal: "site",
    destinatario: "familia",
    texto:
      "Recebemos muitos acessos deste aparelho em pouco tempo. Aguarde alguns minutos e toque no botão de novo.",
  },
  {
    chave: "captacao_erro",
    canal: "site",
    destinatario: "familia",
    texto:
      "Não conseguimos abrir o WhatsApp agora. Nada foi enviado. Tente de novo em instantes.",
  },
  {
    chave: "captacao_whatsapp",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Olá, gostaria de saber mais sobre o cuidado da Kraamzorg depois do parto. ({codigo})",
  },
  {
    chave: "portal_entrar_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Entrar no portal da família",
  },
  {
    chave: "portal_entrar_apoio",
    canal: "site",
    destinatario: "familia",
    texto:
      "Digite o e-mail que você deu à Kraamzorg. Enviamos um link para você entrar, sem senha.",
  },
  {
    chave: "portal_entrar_enviado",
    canal: "site",
    destinatario: "familia",
    texto:
      "Se este e-mail estiver cadastrado, o link acabou de sair. Ele serve uma vez e vale por pouco tempo. Confira também a caixa de spam.",
  },
  {
    chave: "portal_entrar_erro",
    canal: "site",
    destinatario: "familia",
    texto:
      "Não conseguimos enviar o link agora. Nada foi alterado. Tente de novo em instantes.",
  },
  {
    chave: "portal_entrar_limite",
    canal: "site",
    destinatario: "familia",
    texto:
      "Recebemos muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.",
  },
  {
    chave: "portal_link_invalido",
    canal: "site",
    destinatario: "familia",
    texto: "Este link venceu ou já foi usado. Peça um novo com o seu e-mail.",
  },
  {
    chave: "portal_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Olá, {nome}.",
  },
  {
    chave: "portal_boas_vindas",
    canal: "site",
    destinatario: "familia",
    texto:
      "Este é o espaço da sua família na Kraamzorg. Aqui você acompanha os próximos passos e as datas, e encontra o contato da equipe.",
  },
  {
    chave: "portal_passos_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Seus próximos passos",
  },
  {
    chave: "portal_passo_contrato",
    canal: "site",
    destinatario: "familia",
    texto: "Contrato assinado",
  },
  {
    chave: "portal_passo_pagamento",
    canal: "site",
    destinatario: "familia",
    texto: "Pagamento confirmado",
  },
  {
    chave: "portal_passo_prenatal",
    canal: "site",
    destinatario: "familia",
    texto: "Consulta pré-natal online",
  },
  {
    chave: "portal_passo_enfermeira",
    canal: "site",
    destinatario: "familia",
    texto: "Enfermeira que vai acompanhar vocês",
  },
  {
    chave: "portal_passo_nascimento",
    canal: "site",
    destinatario: "familia",
    texto: "Nascimento do bebê",
  },
  {
    chave: "portal_passo_alta",
    canal: "site",
    destinatario: "familia",
    texto: "Alta da maternidade",
  },
  {
    chave: "portal_passo_visitas",
    canal: "site",
    destinatario: "familia",
    texto: "Visitas em casa",
  },
  {
    chave: "portal_agora_contrato",
    canal: "site",
    destinatario: "familia",
    texto: "Assim que o contrato for assinado, o próximo passo aparece aqui.",
  },
  {
    chave: "portal_agora_pagamento",
    canal: "site",
    destinatario: "familia",
    texto:
      "A equipe envia o link de pagamento. Depois da confirmação, seguimos para o agendamento.",
  },
  {
    chave: "portal_agora_prenatal",
    canal: "site",
    destinatario: "familia",
    texto:
      "A equipe combina com vocês o dia e o horário da consulta pré-natal online.",
  },
  {
    chave: "portal_agora_enfermeira",
    canal: "site",
    destinatario: "familia",
    texto:
      "A coordenação escolhe a enfermeira e avisa vocês assim que ela estiver definida.",
  },
  {
    chave: "portal_agora_nascimento",
    canal: "site",
    destinatario: "familia",
    texto:
      "Quando o bebê nascer, avisem a equipe. O nascimento e a alta são datas que vocês confirmam com a gente.",
  },
  {
    chave: "portal_agora_alta",
    canal: "site",
    destinatario: "familia",
    texto:
      "Assim que houver alta, contem para a equipe. É a partir dela que combinamos o início das visitas.",
  },
  {
    chave: "portal_agora_visitas",
    canal: "site",
    destinatario: "familia",
    texto:
      "As visitas aparecem aqui, com dia e horário, quando a coordenação confirmar com vocês.",
  },
  {
    chave: "portal_datas_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Datas",
  },
  {
    chave: "portal_dpp_nota",
    canal: "site",
    destinatario: "familia",
    texto:
      "A data provável do parto é uma estimativa. Nascimento, alta e início das visitas são datas que a equipe confirma com vocês.",
  },
  {
    chave: "portal_enfermeira_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Sua enfermeira",
  },
  {
    chave: "portal_enfermeira_sem_nome",
    canal: "site",
    destinatario: "familia",
    texto:
      "Uma enfermeira da equipe Kraamzorg vai acompanhar vocês. O nome dela aparece aqui quando ela autorizar.",
  },
  {
    chave: "portal_enfermeira_sem_designacao",
    canal: "site",
    destinatario: "familia",
    texto:
      "A enfermeira ainda está sendo escolhida. Vocês recebem o aviso da equipe assim que ela estiver definida.",
  },
  {
    chave: "portal_guia_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Guia de início",
  },
  {
    chave: "portal_guia_inicio",
    canal: "site",
    destinatario: "familia",
    texto:
      "O guia de início chega pela equipe antes do nascimento. Ele reúne o que preparar em casa e o que esperar dos primeiros dias.",
  },
  {
    chave: "portal_visitas_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Visitas em casa",
  },
  {
    chave: "portal_visitas_vazio",
    canal: "site",
    destinatario: "familia",
    texto:
      "As datas das visitas aparecem aqui assim que a coordenação confirmar com vocês.",
  },
  {
    chave: "portal_pesquisa_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Sua opinião",
  },
  {
    chave: "portal_pesquisa_espera",
    canal: "site",
    destinatario: "familia",
    texto:
      "Depois da última visita, a equipe envia uma pesquisa curta. Ela ajuda a cuidar melhor das próximas famílias.",
  },
  {
    chave: "portal_pesquisa_enviada",
    canal: "site",
    destinatario: "familia",
    texto:
      "A pesquisa já foi enviada para vocês. Se ainda não responderam, procurem a mensagem da equipe.",
  },
  {
    chave: "portal_pesquisa_respondida",
    canal: "site",
    destinatario: "familia",
    texto: "Recebemos a resposta de vocês. Agradecemos por contar como foi.",
  },
  {
    chave: "portal_evolucoes_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Evoluções de enfermagem",
  },
  {
    chave: "portal_evolucoes_vazio",
    canal: "site",
    destinatario: "familia",
    texto: "As evoluções aparecem aqui quando forem enviadas para vocês.",
  },
  {
    chave: "portal_contato_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Fale com a equipe",
  },
  {
    chave: "portal_contato_apoio",
    canal: "site",
    destinatario: "familia",
    texto:
      "Para qualquer dúvida, é só chamar. Este espaço não atende urgências: em caso de urgência com a mãe ou com o bebê, procurem o serviço de saúde mais próximo.",
  },
  {
    chave: "portal_sensivel_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Olá, {nome}.",
  },
  {
    chave: "portal_sensivel_texto",
    canal: "site",
    destinatario: "familia",
    texto:
      "A nossa equipe está por perto. Se quiser conversar, fale com esta pessoa, no seu tempo.",
  },
  {
    chave: "portal_sensivel_contato_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Quem está com vocês",
  },
  {
    chave: "portal_email_assunto",
    canal: "email",
    destinatario: "familia",
    texto: "Seu link para entrar no portal da Kraamzorg",
  },
  {
    chave: "portal_email_corpo",
    canal: "email",
    destinatario: "familia",
    texto:
      "Olá, {nome}.\n\nPara entrar no portal da sua família, use este link:\n{link}\n\nEle serve uma vez e vale por pouco tempo. Se não foi você quem pediu, pode ignorar esta mensagem.\n\nKraamzorg Brasil",
  },
  {
    chave: "portal_convite",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}. Preparamos o portal da sua família na Kraamzorg. Nele você acompanha os próximos passos e as datas. Para entrar, abra {endereco} e digite este e-mail: o link de acesso chega nele, sem senha.",
  },
  {
    chave: "candidatura_titulo",
    canal: "site",
    destinatario: "familia",
    texto: "Trabalhe com a Kraamzorg",
  },
  {
    chave: "candidatura_desligada",
    canal: "site",
    destinatario: "familia",
    texto:
      "No momento a Kraamzorg não está recebendo candidaturas. Quando abrirmos, o aviso aparece aqui.",
  },
  {
    chave: "candidatura_abertura",
    canal: "site",
    destinatario: "familia",
    texto:
      "Se você é enfermeira e quer conhecer o nosso trabalho de cuidado domiciliar, deixe seus dados. A coordenação entra em contato quando houver uma seleção.",
  },
  {
    chave: "candidatura_privacidade",
    canal: "site",
    destinatario: "familia",
    texto:
      "Usamos estes dados só para a seleção da equipe. Você pode pedir a exclusão a qualquer momento.",
  },
  {
    chave: "candidatura_consentimento",
    canal: "site",
    destinatario: "familia",
    texto:
      "Concordo que a Kraamzorg guarde os dados desta candidatura para avaliar minha participação em seleções.",
  },
  {
    chave: "candidatura_recebido",
    canal: "site",
    destinatario: "familia",
    texto:
      "Recebemos a sua candidatura. A coordenação entra em contato se houver uma seleção que combine com o seu perfil.",
  },
  {
    chave: "candidatura_limite",
    canal: "site",
    destinatario: "familia",
    texto:
      "Recebemos muitos envios deste aparelho em pouco tempo. Aguarde um pouco e tente de novo.",
  },
  {
    chave: "candidatura_erro",
    canal: "site",
    destinatario: "familia",
    texto:
      "Não conseguimos receber a candidatura agora. Nada foi enviado. Tente de novo em instantes.",
  },
  {
    chave: "parceiros_aviso_vedacao",
    canal: "site",
    destinatario: "equipe",
    texto:
      "Parceria com médicos é relacionamento institucional. A Kraamzorg não paga nem oferece comissão, desconto, brinde ou qualquer contrapartida financeira por indicação de paciente, porque a ética médica veda isso. Esta tela não tem campo de valor e não deve ganhar um. Texto a validar com o jurídico da Kraamzorg.",
  },
];
