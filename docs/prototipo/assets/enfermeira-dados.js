/*
  Kraamzorg OS · dados fictícios do portal da enfermeira (protótipo).
  Famílias "Família Teste", telefones +55 11 90000-00xx, profissionais inventados (docs/design/telas.md).
  "respostas" são o que a enfermeira respondeu hoje, por etapa. Nenhum valor de outro dia entra como
  resposta: o dia anterior aparece só em "anterior" (referência) e "textosAnteriores" (trazer e confirmar).
*/
(function () {
  'use strict';
  var KZ = window.KZ = window.KZ || {};
  function sims(ids) { var o = {}; ids.forEach(function (i) { o[i] = 'sim'; }); return o; }
  function juntar() { return Object.assign.apply(null, [{}].concat([].slice.call(arguments))); }
  KZ.juntar = juntar;

  var noAparelho = ['Família Teste Aurora', 'Família Teste Cedro', 'Família Teste Horizonte', 'Lívia Teste', 'Paula Teste', 'Bento Teste', 'Lia Teste', 'Nina Teste', 'Fernanda Teste'];

  KZ.DADOS = {
    aurora: {
      familia: 'Família Teste Aurora', dia: 4, de: 6,
      checkin: { data: '24/09/2026', hora: '08:03' },
      bebes: [{ id: 'nina', nome: 'Nina', completo: 'Nina Teste', nascer: 3240 }],
      anterior: { 'pu-temp': '36,9', 'pu-pa': '116/74', 'pu-fc': '84', 'rn-nina-temp': '36,7', 'rn-nina-fc': '140', 'rn-nina-fr': '46', 'rn-nina-peso': '3.080' },
      textosAnteriores: {
        'pu-med': 'Dipirona 1 g se dor, até de 6 em 6 horas. Sulfato ferroso, 1 comprimido ao dia.',
        'am-interv': 'Correção da pega e compressa fria depois da mamada.',
        'am-quem': 'Caio, o parceiro, e a irmã de Lívia'
      },
      outrasFamilias: noAparelho.filter(function (n) { return ['Família Teste Aurora', 'Lívia Teste', 'Nina Teste'].indexOf(n) < 0; }),
      porEtapa: {
        1: sims(['ch-acomp', 'ch-pont', 'ch-maos', 'ch-acolh', 'ch-relato']),
        2: juntar(sims(['pu-bem', 'pu-dor', 'pu-loq', 'pu-ces', 'pu-fer-or']), { 'pu-dor-int': 3, 'pu-epi': 'na' }),
        '2b': juntar(sims(['pu-hig', 'pu-alim', 'pu-elim']), { 'pu-sono': 'nao' }),
        3: { 'pu-temp': '38,2', 'pu-pa': ['118', '76'], 'pu-fc': '88' },
        4: juntar(sims(['am-turg', 'am-dor', 'am-interr']), { 'am-flac': 'nao', 'am-ingu': 'nao', 'am-evn': 4, 'am-lesao': 'Direita', 'am-nts': 1, 'am-latch': 7 }),
        '4b': juntar({ 'am-lingua': 'Normal', 'am-fbm': ['Analgesia'], 'am-bico': 'nao', 'am-forro': 'sim', 'am-bomba': 'nao', 'am-succ': '8 ou mais', 'am-prod': 'Normal', 'am-apoio': 8 }),
        5: juntar(sims(['rn-nina-resp', 'rn-nina-choro', 'rn-nina-ativ', 'rn-nina-fralda', 'rn-nina-banho', 'rn-nina-coto', 'rn-nina-vest']),
          { 'rn-nina-ict': 'Zona I', 'rn-nina-temp': '36,8', 'rn-nina-fc': '142', 'rn-nina-fr': '44', 'rn-nina-peso': '3.110', 'rn-nina-diurese': 'Há menos de 4 h', 'rn-nina-coto-est': ['Limpo e seco'] }),
        6: juntar(sims(['or-massa', 'or-pega', 'or-livre', 'or-postura', 'or-fome', 'or-desengasgo', 'or-sono', 'or-janelas', 'or-rotina', 'or-parceiro', 'or-duvidas']), { 'or-colica': 'nao' }),
        7: juntar(sims(['em-escuta', 'en-amb', 'en-alinh', 'co-med']), { 'em-sofr': 'nao' })
      },
      textosDia: {
        'ch-acomp-quem': 'Caio, parceiro',
        'pu-dor-local': 'Incisão',
        'pu-med': 'Dipirona 1 g se dor, até de 6 em 6 horas. Sulfato ferroso, 1 comprimido ao dia.',
        'am-interv': 'Correção da pega na mama direita e compressa fria depois da mamada.',
        'am-quem': 'Caio, o parceiro',
        'co-motivo': 'Febre de 38,2 °C na puérpera. Liguei para a supervisão às 10:14 e segui a orientação.'
      },
      acionamento: { 'PU-01': { hora: '10:14', orientacao: 'Observação em casa, com nova medida de temperatura em 2 horas. Se passar de 38 °C de novo, procurar atendimento de emergência.', conduta: 'Antitérmico conforme prescrição, hidratação e nova medida às 12:15, combinada com a família.' } }
    },

    cedro: {
      familia: 'Família Teste Cedro', dia: 7, de: 12,
      checkin: { data: '24/09/2026', hora: '14:02' },
      bebes: [
        { id: 'bento', nome: 'Bento', completo: 'Bento Teste', nascer: 2880 },
        { id: 'lia', nome: 'Lia', completo: 'Lia Teste', nascer: 2710 }
      ],
      anterior: {
        'pu-temp': '36,5', 'pu-pa': '110/70', 'pu-fc': '78',
        'rn-bento-temp': '36,7', 'rn-bento-fc': '136', 'rn-bento-fr': '42', 'rn-bento-peso': '2.790',
        'rn-lia-temp': '36,6', 'rn-lia-fc': '144', 'rn-lia-fr': '48', 'rn-lia-peso': '2.640'
      },
      textosAnteriores: { 'pu-med': 'Sulfato ferroso, 1 comprimido ao dia.', 'am-quem': 'A mãe de Paula, que dorme na casa' },
      outrasFamilias: noAparelho.filter(function (n) { return ['Família Teste Cedro', 'Paula Teste', 'Bento Teste', 'Lia Teste'].indexOf(n) < 0; }),
      porEtapa: {
        1: juntar(sims(['ch-pont', 'ch-maos', 'ch-acolh', 'ch-relato']), { 'ch-acomp': 'nao' }),
        2: juntar(sims(['pu-bem', 'pu-loq', 'pu-ces', 'pu-fer-or', 'pu-hig', 'pu-alim', 'pu-elim']), { 'pu-dor': 'nao', 'pu-epi': 'na', 'pu-sono': 'nao' }),
        3: { 'pu-temp': '36,6', 'pu-pa': ['112', '70'], 'pu-fc': '80' },
        4: juntar(sims(['am-turg', 'am-bomba']), { 'am-flac': 'nao', 'am-ingu': 'nao', 'am-dor': 'nao', 'am-lesao': 'Não', 'am-latch': 9, 'am-lingua': 'Normal', 'am-fbm': ['Não aplicada'], 'am-bico': 'nao', 'am-forro': 'nao', 'am-succ': '8 ou mais', 'am-prod': 'Normal', 'am-apoio': 8 }),
        bento: juntar(sims(['rn-bento-resp', 'rn-bento-choro', 'rn-bento-ativ', 'rn-bento-fralda', 'rn-bento-banho', 'rn-bento-coto', 'rn-bento-vest']),
          { 'rn-bento-ict': 'Zona II', 'rn-bento-temp': '36,8', 'rn-bento-fc': '138', 'rn-bento-fr': '44', 'rn-bento-peso': '2.815', 'rn-bento-diurese': 'Há menos de 4 h', 'rn-bento-coto-est': ['Limpo e seco'] }),
        lia: juntar(sims(['rn-lia-resp', 'rn-lia-choro', 'rn-lia-ativ', 'rn-lia-banho']), { 'rn-lia-ict': 'Zona I', 'rn-lia-temp': '36,6', 'rn-lia-fc': '142', 'rn-lia-fr': '46' })
      },
      textosDia: { 'pu-med': 'Sulfato ferroso, 1 comprimido ao dia.', 'am-quem': 'A mãe de Paula, que dorme na casa' }
    }
  };
})();
