/*
  Kraamzorg OS · portal da enfermeira (protótipo). JavaScript puro, sem biblioteca.
  1) relógio do protótipo e sinal (online, offline; ?sinal=0 começa sem sinal)
  2) fila do aparelho e indicador de sincronização nos três estados do PRD 15
  3) folha inferior, aviso efêmero e freio em um toque
  4) motor do checklist diário: DOC 2 (PRD 9.2) em oito etapas (fluxos.md, fluxo A),
     regras do DOC 3 avaliadas no aparelho (PRD Apêndice B), acionamento, cópia confirmada
     campo a campo, colagem vigiada, resumo e assinatura.
  Nada aqui guarda dado de verdade: tudo vive na memória da página.
*/
(function () {
  'use strict';
  var KZ = window.KZ = window.KZ || {};
  var params = new URLSearchParams(location.search);
  var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pad(n) { return String(n).padStart(2, '0'); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(n, cls) { return '<svg class="icone' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  KZ.ic = ic; KZ.esc = esc;

  /* ---------- 1. Relógio e sinal ---------- */
  var t0 = Date.now();
  var base = (document.body.dataset.hora || '10:00').split(':').map(Number);
  KZ.agora = function () {
    var m = base[0] * 60 + base[1] + Math.floor((Date.now() - t0) / 60000);
    return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  };
  var online = params.get('sinal') !== '0' && navigator.onLine !== false;
  KZ.online = function () { return online; };
  function aplicarSinal() {
    $$('[data-sem-sinal]').forEach(function (el) { el.hidden = online; });
    $$('[data-com-sinal]').forEach(function (el) { el.hidden = !online; });
    document.documentElement.dataset.sinal = online ? 'sim' : 'nao';
    renderSinc();
    document.dispatchEvent(new CustomEvent('kz:sinal'));
  }
  window.addEventListener('online', function () { online = true; aplicarSinal(); agendar(); });
  window.addEventListener('offline', function () { online = false; aplicarSinal(); });

  /* ---------- 2. Fila do aparelho e indicador ---------- */
  var fila = [];
  var estado = document.body.dataset.sincInicial || 'sincronizado';
  var ultima = document.body.dataset.sincHora || KZ.agora();
  var tEnvio = null;
  var vivo = document.createElement('p');
  vivo.className = 'sr'; vivo.setAttribute('aria-live', 'polite');
  document.body.appendChild(vivo);

  KZ.salvar = function (texto, opts) {
    opts = opts || {};
    fila.push({ hora: KZ.agora(), texto: texto, alerta: !!opts.alerta });
    estado = 'local';
    renderSinc(); renderFila(); agendar();
  };
  KZ.semearFila = function (itens) {
    itens.forEach(function (i) { fila.push({ hora: i.hora, texto: i.texto, alerta: !!i.alerta }); });
    if (fila.length) estado = 'local';
    renderSinc();
  };
  function agendar() {
    clearTimeout(tEnvio);
    if (!online || !fila.length) return;
    tEnvio = setTimeout(function () {
      estado = 'enviando'; renderSinc();
      tEnvio = setTimeout(function () {
        fila.length = 0; ultima = KZ.agora(); estado = 'sincronizado';
        renderSinc(); renderFila();
        vivo.textContent = 'Sincronizado às ' + ultima + '.';
        document.dispatchEvent(new CustomEvent('kz:sincronizado'));
      }, 1400);
    }, 1100);
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function renderSinc() {
    var n = fila.length;
    $$('[data-sinc]').forEach(function (el) {
      el.dataset.estado = estado;
      var icone, txt;
      if (estado === 'local') {
        icone = 'smartphone';
        txt = 'Salvo no aparelho';
        if (!online && n) txt += ', <span class="sinc__n">' + n + '</span> na fila';
      } else if (estado === 'enviando') {
        icone = 'cloud-upload'; txt = 'Enviando ' + plural(n, 'resposta', 'respostas');
      } else {
        icone = 'cloud-check'; txt = 'Sincronizado <span class="sinc__n">' + ultima + '</span>';
      }
      el.innerHTML = ic(icone) + '<span>' + txt + '</span>';
      if (el.tagName === 'BUTTON') el.setAttribute('aria-label', el.textContent + '. Ver a fila do aparelho');
    });
  }
  KZ.renderSinc = renderSinc;

  function garantirFolhaFila() {
    var f = document.getElementById('folha-fila');
    if (f) return f;
    f = document.createElement('div');
    f.className = 'folha'; f.id = 'folha-fila'; f.hidden = true;
    f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'folha-fila-t');
    f.innerHTML =
      '<div class="folha__topo"><h2 class="t-2" id="folha-fila-t" tabindex="-1">Fila do aparelho</h2>' +
      '<button class="botao botao--icone botao--terciario" type="button" data-fecha-folha aria-label="Fechar a fila">' + ic('x') + '</button></div>' +
      '<div class="folha__corpo"><p class="corpo" data-fila-resumo></p><ol class="fila-sinc" data-fila-lista></ol>' +
      '<p class="apoio" data-fila-msg hidden></p>' +
      '<div class="folha__acoes"><button class="botao botao--bloco" type="button" data-tentar>' + ic('refresh-cw') + 'Tentar agora</button></div></div>';
    document.body.appendChild(f);
    return f;
  }
  function renderFila() {
    var f = document.getElementById('folha-fila');
    if (!f) return;
    var res = $('[data-fila-resumo]', f), lista = $('[data-fila-lista]', f), tentar = $('[data-tentar]', f);
    if (!fila.length) {
      res.textContent = 'Nada esperando para subir. Tudo o que você registrou já chegou à coordenação, com a última confirmação às ' + ultima + '.';
      lista.innerHTML = ''; tentar.hidden = true; return;
    }
    tentar.hidden = false;
    res.textContent = online
      ? plural(fila.length, 'registro subindo agora', 'registros subindo agora') + ', na ordem em que foram salvos.'
      : 'Sem sinal agora. ' + plural(fila.length, 'registro espera', 'registros esperam') + ' no aparelho e ' + (fila.length === 1 ? 'sobe' : 'sobem') + ' sozinho' + (fila.length === 1 ? '' : 's') + ' quando a conexão voltar, na ordem em que ' + (fila.length === 1 ? 'foi salvo' : 'foram salvos') + '. Nada sai da fila antes de o servidor confirmar.';
    lista.innerHTML = fila.map(function (i) {
      return '<li><span class="fila-sinc__hora">' + esc(i.hora) + '</span><span class="fila-sinc__corpo"><span>' + esc(i.texto) + '</span>' +
        (i.alerta
          ? '<span class="selo selo--alerta" style="align-self:flex-start">' + ic('siren') + 'Alerta para a coordenação</span>' +
            (online ? '' : '<span class="apoio">Se for urgente agora, ligue: <a href="tel:+5511900000001">+55 11 90000-0001</a>.</span>')
          : '<span class="mini">' + (online ? 'Enviando' : 'No aparelho') + '</span>') +
        '</span></li>';
    }).join('');
  }
  KZ.abrirFila = function () { var f = garantirFolhaFila(); renderFila(); $('[data-fila-msg]', f).hidden = true; KZ.abrirFolha(f); };

  /* ---------- 3. Folha, aviso efêmero, freio ---------- */
  var fundo = null, pilhaFoco = [];
  KZ.abrirFolha = function (f) {
    if (!f) return;
    if (!fundo) {
      fundo = document.createElement('div'); fundo.className = 'folha-fundo'; fundo.hidden = true;
      fundo.addEventListener('click', function () { var a = folhasAbertas(); if (a.length) KZ.fecharFolha(a[a.length - 1]); });
      document.body.appendChild(fundo);
    }
    pilhaFoco.push(document.activeElement);
    fundo.hidden = false; f.hidden = false;
    var alvo = $('[tabindex="-1"]', f) || $('h2, h3', f) || f;
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
  };
  function folhasAbertas() { return $$('.folha:not(.folha--estatica)').filter(function (f) { return !f.hidden; }); }
  KZ.fecharFolha = function (f) {
    if (!f) return;
    f.hidden = true;
    if (!folhasAbertas().length && fundo) fundo.hidden = true;
    var volta = pilhaFoco.pop();
    if (volta && volta.focus && document.contains(volta)) volta.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var a = folhasAbertas(); if (a.length) KZ.fecharFolha(a[a.length - 1]);
  });

  KZ.aviso = function (texto, opts) {
    opts = opts || {};
    $$('.aviso-efemero[data-js]').forEach(function (e) { e.remove(); });
    var el = document.createElement('div');
    el.className = 'aviso-efemero'; el.dataset.js = ''; el.setAttribute('role', 'status');
    el.innerHTML = ic(opts.icone || 'circle-check') + '<span>' + esc(texto) + '</span>' +
      (opts.desfazer ? '<button class="botao botao--compacto empurra" type="button">Desfazer</button>' : '');
    document.body.appendChild(el);
    var t = setTimeout(function () { el.remove(); }, opts.ms || 6000);
    if (opts.desfazer) $('button', el).addEventListener('click', function () { clearTimeout(t); el.remove(); opts.desfazer(); });
  };

  function acionarFreio(botao) {
    var cab = botao.closest('[data-familia-cab]');
    if (!cab) return;
    var familia = cab.dataset.familia || 'esta família';
    var hora = KZ.agora();
    cab.dataset.freio = 'ativo';
    var marca = document.createElement('span');
    marca.className = 'freio-ativo'; marca.tabIndex = -1;
    marca.innerHTML = ic('octagon-pause') + 'Freio ativo';
    botao.replaceWith(marca);
    marca.focus({ preventScroll: true });
    var txt = $('[data-freio-texto]', cab);
    if (txt) { txt.textContent = 'Freio em bloqueio total desde 24/09/2026, ' + hora + '. Só contato humano e nominal. O registro clínico continua liberado.'; txt.hidden = false; }
    KZ.salvar('Freio acionado na ' + familia);
    KZ.aviso('Freio acionado. Nenhuma mensagem automática sai para a ' + familia + '.', {
      icone: 'octagon-pause', ms: 10000,
      desfazer: function () {
        cab.removeAttribute('data-freio'); marca.replaceWith(botao); if (txt) txt.hidden = true; botao.focus();
        KZ.salvar('Freio desfeito na ' + familia);
        KZ.aviso('Freio desfeito. As mensagens automáticas voltam a valer para a ' + familia + '.');
      }
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-abre-folha],[data-fecha-folha],[data-abre-fila],[data-freio-botao],[data-tentar]');
    if (!t) return;
    if (t.hasAttribute('data-abre-folha')) { e.preventDefault(); KZ.abrirFolha(document.getElementById(t.dataset.abreFolha)); }
    else if (t.hasAttribute('data-fecha-folha')) { e.preventDefault(); KZ.fecharFolha(t.closest('.folha')); }
    else if (t.hasAttribute('data-abre-fila')) { e.preventDefault(); KZ.abrirFila(); }
    else if (t.hasAttribute('data-freio-botao')) { e.preventDefault(); acionarFreio(t); }
    else if (t.hasAttribute('data-tentar')) {
      var msg = $('[data-fila-msg]', t.closest('.folha'));
      if (navigator.onLine !== false) {
        online = true; aplicarSinal(); agendar();
        if (msg) { msg.hidden = false; msg.textContent = 'Sinal de volta. Enviando na ordem em que foi salvo.'; }
      } else if (msg) { msg.hidden = false; msg.textContent = 'Ainda sem sinal. Tentamos de novo em 30 s.'; }
    }
  });

  document.addEventListener('DOMContentLoaded', function () { aplicarSinal(); });
  if (document.readyState !== 'loading') aplicarSinal();

  /* ---------- 4. Checklist diário (DOC 2) ---------- */
  var SUPERVISAO = { tel: 'tel:+5511900000001', rot: 'Ligar para a supervisão' };
  var IMEDIATO_PU = 'Acione a supervisão médica agora e oriente a família a procurar atendimento de emergência.';
  var IMEDIATO_RN = 'Acione a supervisão médica agora e oriente a família a procurar emergência pediátrica.';
  var IMEDIATO_AM = 'Suspenda procedimentos eletivos, como o laser, e acione a supervisão médica agora.';
  var IMEDIATO_SM = 'Não deixe a puérpera sozinha. Acione a supervisão médica agora e oriente a busca de atendimento de emergência.';
  var PRIORITARIO = 'Comunique a supervisão médica ainda hoje e siga a orientação.';
  var PRIORITARIO_AM = 'Comunique a supervisão médica ainda hoje e avalie consultoria especializada.';
  var REGISTRO = 'Antes de fechar: sinal, horário do acionamento, orientação médica recebida e conduta adotada.';

  /* Sinais do DOC 3 sem campo próprio no checklist: seletor "Registrar outro sinal de alerta" */
  var SELETOR = [
    { grupo: 'Puérpera', itens: [
      ['PU-02', 'imediato', 'Sangramento vaginal intenso (encharca 1 absorvente em menos de 1 hora)'],
      ['PU-05', 'imediato', 'Cefaleia intensa com alteração visual'],
      ['PU-06', 'imediato', 'Falta de ar ou dor torácica'],
      ['PU-07', 'imediato', 'Mal-estar importante ou prostração'],
      ['PU-09', 'prioritario', 'Dor moderada não controlada'],
      ['PU-10', 'prioritario', 'Aumento progressivo dos lóquios (1 absorvente saturado em 3 h)'],
      ['PU-12', 'prioritario', 'Fissuras mamilares graves ou com sinais inflamatórios']] },
    { grupo: 'Recém-nascido', bebe: true, itens: [
      ['RN-02', 'imediato', 'Cianose ou palidez acentuada'],
      ['RN-05', 'imediato', 'Sangue nas fezes'],
      ['RN-06', 'imediato', 'Convulsão'],
      ['RN-09', 'imediato', 'Recusa alimentar completa'],
      ['RN-11', 'prioritario', 'Oligúria concentrada'],
      ['RN-12', 'prioritario', 'Vômitos frequentes']] },
    { grupo: 'Amamentação e mamas', itens: [
      ['AM-01', 'imediato', 'Mastite com sinais sistêmicos'],
      ['AM-02', 'imediato', 'Dor intensa associada a febre'],
      ['AM-03', 'imediato', 'Abscesso suspeito']] }
  ];
  var SM = [
    ['SM-01', 'imediato', 'Ideação suicida ou autoagressiva'],
    ['SM-02', 'imediato', 'Comportamento desorganizado'],
    ['SM-03', 'imediato', 'Desconexão importante com o bebê'],
    ['SM-04', 'prioritario', 'Tristeza intensa e persistente'],
    ['SM-05', 'prioritario', 'Ansiedade incapacitante'],
    ['SM-06', 'prioritario', 'Choro frequente sem alívio'],
    ['SM-07', 'prioritario', 'Relato de incapacidade de cuidar do bebê']
  ];
  function condutaDe(cod, sev) {
    var p = cod.slice(0, 2);
    if (sev === 'imediato') return p === 'RN' ? IMEDIATO_RN : p === 'AM' ? IMEDIATO_AM : p === 'SM' ? IMEDIATO_SM : IMEDIATO_PU;
    if (p === 'AM') return PRIORITARIO_AM;
    if (p === 'SM') return 'Comunique a supervisão médica ainda hoje e registre.';
    return PRIORITARIO;
  }

  function num(v) {
    if (v == null || v === '') return NaN;
    var s = String(v).trim();
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s.replace(',', '.'));
  }
  function fmt1(n) { return n.toFixed(1).replace('.', ','); }
  function fmtG(n) { return Math.round(n).toLocaleString('pt-BR'); }

  function definirEtapas(cfg) {
    var sn = function (id, texto, o) { return Object.assign({ tipo: 'sn', id: id, texto: texto }, o || {}); };
    var etapas = [
      { n: 1, curto: 'Chegada', titulo: 'Chegada e preparo', grupos: [
        { cod: '1', campos: [
          { tipo: 'fatos', id: 'ch' },
          sn('ch-acomp', 'Acompanhante presente', { abre: { quando: 'sim', campos: [{ tipo: 'texto', id: 'ch-acomp-quem', rotulo: 'Quem', curto: true, exemplo: 'Ex.: Caio, parceiro' }] } }),
          sn('ch-pont', 'Pontualidade confirmada'),
          sn('ch-maos', 'Higienização das mãos'),
          sn('ch-acolh', 'Apresentação e acolhimento da família'),
          sn('ch-relato', 'Relato desde a última visita coletado')
        ] }] },
      { n: 2, curto: 'Puérpera', titulo: 'Puérpera', grupos: [
        { titulo: 'Estado geral', cod: '2', campos: [
          sn('pu-bem', 'Bem-estar geral preservado'),
          sn('pu-dor', 'Queixa de dor', { abre: { quando: 'sim', campos: [
            { tipo: 'escala', id: 'pu-dor-int', rotulo: 'Dor, intensidade de 0 a 10', max: 10, extremos: ['0 · sem dor', '10 · pior dor possível'],
              regra: function (v) { return v >= 7 ? { cod: 'PU-03', sev: 'imediato', titulo: 'Dor intensa na puérpera (' + v + ' de 10)' } : null; } },
            { tipo: 'texto', id: 'pu-dor-local', rotulo: 'Local da dor', curto: true, exemplo: 'Ex.: incisão' }] } }),
          sn('pu-loq', 'Sangramento (lóquios) esperado', { alertaSe: 'nao', abre: { quando: 'nao', campos: [
            { tipo: 'opcoes', id: 'pu-loq-int', rotulo: 'Como está o sangramento', opcoes: ['Encharca 1 absorvente em menos de 1 hora', 'Satura 1 absorvente em 3 h e está aumentando', 'Outro, vou descrever no resumo'],
              regra: function (v) {
                if (v === 'Encharca 1 absorvente em menos de 1 hora') return { cod: 'PU-02', sev: 'imediato', titulo: 'Sangramento vaginal intenso' };
                if (v === 'Satura 1 absorvente em 3 h e está aumentando') return { cod: 'PU-10', sev: 'prioritario', titulo: 'Aumento progressivo dos lóquios' };
                return null; } }] } })
        ] },
        { titulo: 'Ferida operatória', cod: '2.2', campos: [
          sn('pu-ces', 'Cesárea sem sinais de infecção', { tres: true, alertaSe: 'nao', regra: function (v) { return v === 'nao' ? { cod: 'PU-04', sev: 'imediato', titulo: 'Sinais de infecção na ferida da cesárea' } : null; } }),
          sn('pu-epi', 'Episiotomia ou laceração sem alterações', { tres: true, alertaSe: 'nao', regra: function (v) { return v === 'nao' ? { cod: 'PU-04', sev: 'imediato', titulo: 'Alteração na episiotomia ou laceração' } : null; } }),
          sn('pu-fer-or', 'Orientações de cuidado reforçadas')
        ] },
        { titulo: 'Medicações', cod: '2.3', campos: [{ tipo: 'texto', id: 'pu-med', rotulo: 'Medicações em uso', trazer: true, exemplo: 'Nome, dose e horário' }] },
        { titulo: 'Autocuidado', cod: '2.4', campos: [
          sn('pu-hig', 'Higiene íntima orientada'), sn('pu-sono', 'Sono e repouso adequados'),
          sn('pu-alim', 'Alimentação e hidratação adequadas'), sn('pu-elim', 'Eliminações e evacuação presentes')] }
      ] },
      { n: 3, curto: 'Sinais vitais', titulo: 'Sinais vitais da puérpera', grupos: [
        { cod: '2.1', campos: [
          { tipo: 'num', id: 'pu-temp', rotulo: 'Temperatura', unidade: '°C', decimal: true, exemplo: '36,5',
            validar: function (n, s) { if (n > 45) return { e: 'erro', t: s + ' °C não é possível. Faltou a vírgula? Confira e digite de novo.' }; if (n < 30) return { e: 'erro', t: s + ' °C parece baixo demais. Confira e digite de novo.' }; },
            regra: function (n) { return n >= 38 ? { cod: 'PU-01', sev: 'imediato', titulo: 'Febre de ' + fmt1(n) + ' °C na puérpera' } : null; } },
          { tipo: 'pa', id: 'pu-pa', rotulo: 'Pressão arterial' },
          { tipo: 'num', id: 'pu-fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', exemplo: '80',
            validar: function (n, s) { if (n < 30) return { e: 'erro', t: s + ' bpm parece um dígito a menos. Confira e digite de novo.' }; if (n > 220) return { e: 'erro', t: s + ' bpm parece um dígito a mais. Confira e digite de novo.' }; } }
        ] }] },
      { n: 4, curto: 'Mamas e amamentação', titulo: 'Mamas e amamentação', grupos: [
        { titulo: 'Mamas', cod: '2.5', campos: [
          sn('am-turg', 'Túrgidas ou secretantes'), sn('am-flac', 'Flácidas'),
          sn('am-ingu', 'Ingurgitadas', { alertaSe: 'sim', regra: function (v) { return v === 'sim' ? { cod: 'PU-11', sev: 'prioritario', titulo: 'Mamas ingurgitadas', conduta: 'Se não melhorar com o manejo, comunique a supervisão médica ainda hoje e siga a orientação.' } : null; } })] },
        { titulo: 'Amamentação e dor', cod: '2.6', campos: [
          sn('am-dor', 'Dor nos mamilos para amamentar', { abre: { quando: 'sim', campos: [
            { tipo: 'escala', id: 'am-evn', rotulo: 'EVN, dor ao amamentar de 0 a 10', max: 10, extremos: ['0 · sem dor', '10 · pior dor possível'],
              regra: function (v) { return v >= 7 ? { cod: 'AM-05', sev: 'prioritario', titulo: 'Dor persistente ao amamentar (EVN ' + v + ')' } : null; } },
            { tipo: 'texto', id: 'am-interv', rotulo: 'Intervenções realizadas para dor', trazer: true, exemplo: 'O que foi feito hoje' }] } })] },
        { titulo: 'Lesão mamilar', cod: '2.7', campos: [
          { tipo: 'opcoes', id: 'am-lesao', rotulo: 'Apresenta lesão mamilar', opcoes: ['Não', 'Direita', 'Esquerda', 'Ambas'], abre: { quando: '!Não', campos: [
            { tipo: 'escala', id: 'am-nts', rotulo: 'Escore de trauma mamilar (NTS)', max: 5, curta: true, extremos: ['0 · normal', '5 · severo'], folha: ['folha-nts', 'Ver escala NTS'],
              regra: function (v) { return v >= 4 ? { cod: 'AM-04', sev: 'prioritario', titulo: 'Fissura profunda no mamilo (NTS ' + v + ')', meta: 'Vale também como PU-12.' } : null; } },
            sn('am-interr', 'Interrupção adequada da sucção')] } }] },
        { titulo: 'Técnica', cod: '2.8', campos: [
          { tipo: 'escala', id: 'am-latch', rotulo: 'LATCH, de 0 a 10', max: 10, extremos: ['0 a 7 · apoio necessário', '8 a 10 · eficaz'], folha: ['folha-latch', 'Ver tabela LATCH'],
            dica: function (v) { return v <= 5 ? 'LATCH ' + v + ': apoio necessário. Fica marcado para a coordenação.' : v <= 7 ? 'LATCH ' + v + ': apoio necessário (DOC 4).' : 'LATCH ' + v + ': amamentação eficaz (DOC 4).'; } },
          { tipo: 'opcoes', id: 'am-lingua', rotulo: 'Teste da linguinha', opcoes: ['Normal', 'Alterado', 'Não fez'] }] },
        { titulo: 'Laserterapia', cod: '2.9', campos: [
          { tipo: 'multi', id: 'am-fbm', rotulo: 'FBM aplicada', opcoes: ['Analgesia', 'Reparação', 'ILIB', 'Não aplicada'], exclusiva: 'Não aplicada' }] },
        { titulo: 'Hábitos', cod: '2.10', campos: [
          sn('am-bico', 'Uso de bicos artificiais'), sn('am-forro', 'Uso de forros e conchas'), sn('am-bomba', 'Uso de bomba de extração')] },
        { titulo: 'Frequência e produção', cod: '2.11 e 2.12', campos: [
          { tipo: 'opcoes', id: 'am-succ', rotulo: 'Sucções por dia', opcoes: ['Menos de 8', '8 ou mais'], dica: function (v) { return v === 'Menos de 8' ? 'Menos de 8 sucções por dia fica marcado para a coordenação.' : null; } },
          { tipo: 'opcoes', id: 'am-prod', rotulo: 'Produção de leite', opcoes: ['Alta', 'Normal', 'Baixa'], regra: function (v) { return v === 'Baixa' ? { cod: 'AM-06', sev: 'prioritario', titulo: 'Baixa produção de leite percebida' } : null; } }] },
        { titulo: 'Apoio', cod: '2.13', campos: [
          { tipo: 'escala', id: 'am-apoio', rotulo: 'Sente-se apoiada ao amamentar, de 0 a 10', max: 10, extremos: ['0 · nada apoiada', '10 · muito apoiada'], dica: function (v) { return v <= 3 ? 'Apoio ' + v + ' de 10 fica marcado para a coordenação.' : null; } },
          { tipo: 'texto', id: 'am-quem', rotulo: 'Quem mais apoia', curto: true, trazer: true, exemplo: 'Ex.: o parceiro' }] }
      ] },
      { n: 5, curto: 'Bebê', titulo: cfg.bebes.length > 1 ? 'Bebês' : 'Bebê', bebes: true, grupos: [
        { titulo: 'Avaliação', cod: '3', campos: [
          { tipo: 'opcoes', id: 'rn-X-ict', rotulo: 'Cor da pele ictérica', opcoes: ['Ausente', 'Zona I', 'Zona II', 'Zona III', 'Zona IV', 'Zona V'],
            regra: function (v, b) { var z = ['Zona III', 'Zona IV', 'Zona V'].indexOf(v); return z >= 0 ? { cod: 'RN-10', sev: 'prioritario', titulo: 'Icterícia em ' + v.toLowerCase() + ' em ' + b.nome, conduta: 'Comunique a supervisão médica ainda hoje. Pode indicar fototerapia.' } : null; } },
          sn('rn-X-resp', 'Respiração sem sinais de esforço', { alertaSe: 'nao', regra: function (v, b) { return v === 'nao' ? { cod: 'RN-01', sev: 'imediato', titulo: 'Dificuldade respiratória em ' + b.nome } : null; } }),
          sn('rn-X-choro', 'Choro habitual'),
          sn('rn-X-ativ', 'Atividade e responsividade preservadas', { alertaSe: 'nao', regra: function (v, b) { return v === 'nao' ? { cod: 'RN-03', sev: 'imediato', titulo: 'Letargia importante em ' + b.nome } : null; } })] },
        { titulo: 'Sinais vitais', cod: '3.1', campos: [
          { tipo: 'num', id: 'rn-X-temp', rotulo: 'Temperatura', unidade: '°C', decimal: true, exemplo: '36,7',
            validar: function (n, s) { if (n > 45) return { e: 'erro', t: s + ' °C não é possível. Faltou a vírgula? Confira e digite de novo.' }; if (n < 30) return { e: 'erro', t: s + ' °C parece baixo demais. Confira e digite de novo.' }; },
            regra: function (n, b) { return n > 38 ? { cod: 'RN-08', sev: 'imediato', titulo: 'Febre de ' + fmt1(n) + ' °C em ' + b.nome } : n < 36 ? { cod: 'RN-08', sev: 'imediato', titulo: 'Hipotermia de ' + fmt1(n) + ' °C em ' + b.nome } : null; } },
          { tipo: 'num', id: 'rn-X-fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', exemplo: '140',
            validar: function (n, s) { if (n < 40) return { e: 'erro', t: s + ' bpm parece um dígito a menos. Confira e digite de novo.' }; if (n > 260) return { e: 'erro', t: s + ' bpm parece um dígito a mais. Confira e digite de novo.' }; } },
          { tipo: 'num', id: 'rn-X-fr', rotulo: 'Frequência respiratória', unidade: 'rpm', exemplo: '45',
            validar: function (n, s) { if (n < 10) return { e: 'erro', t: s + ' rpm parece um dígito a menos. Confira e digite de novo.' }; if (n > 120) return { e: 'erro', t: s + ' rpm parece um dígito a mais. Confira e digite de novo.' }; } },
          { tipo: 'num', id: 'rn-X-peso', rotulo: 'Peso', unidade: 'g', peso: true, exemplo: '3.100' }] },
        { titulo: 'Cuidados', cod: '3.2', campos: [
          sn('rn-X-fralda', 'Troca de fraldas e avaliação de diurese', { abre: { quando: 'sim', campos: [
            { tipo: 'opcoes', id: 'rn-X-diurese', rotulo: 'Última diurese', opcoes: ['Há menos de 4 h', 'Há 4 h ou mais'],
              regra: function (v, b) { return v === 'Há 4 h ou mais' ? { cod: 'RN-04', sev: 'imediato', titulo: 'Sem diurese há 4 horas ou mais em ' + b.nome } : null; } }] } }),
          sn('rn-X-banho', 'Banho orientado ou realizado'),
          sn('rn-X-coto', 'Coto umbilical avaliado e cuidado', { abre: { quando: 'sim', campos: [
            { tipo: 'multi', id: 'rn-X-coto-est', rotulo: 'Estado do coto', opcoes: ['Limpo e seco', 'Hiperemia', 'Secreção purulenta', 'Odor fétido'], exclusiva: 'Limpo e seco',
              regra: function (v, b) { var s = (v || []).filter(function (x) { return x !== 'Limpo e seco'; }); return s.length ? { cod: 'RN-07', sev: 'imediato', titulo: 'Sinal flogístico no coto umbilical de ' + b.nome } : null; } }] } }),
          sn('rn-X-vest', 'Vestimenta adequada ao clima')] }
      ] },
      { n: 6, curto: 'Orientações', titulo: 'Orientações do dia', intro: 'Marque sim no que foi orientado hoje e não no que ficou para outro dia.', grupos: [
        { titulo: 'Orientações adicionais', cod: '4', campos: [
          sn('or-massa', 'Massagem e extração de leite'), sn('or-pega', 'Correção de pega e posição'), sn('or-livre', 'Livre demanda reforçada'),
          sn('or-colica', 'Cólica e disquesia'), sn('or-postura', 'Posturas de conforto'), sn('or-fome', 'Sinais de fome'), sn('or-desengasgo', 'Manobra de desengasgo')] },
        { titulo: 'Sono e rotina', cod: '5', campos: [
          sn('or-sono', 'Sono seguro orientado'), sn('or-janelas', 'Sinais e janelas de sono explicados'), sn('or-rotina', 'Organização em acordo com a rotina familiar')] },
        { titulo: 'Educação da família', cod: '6', campos: [
          sn('or-parceiro', 'Orientações ao parceiro ou parceira'), sn('or-duvidas', 'Dúvidas esclarecidas')] }
      ] },
      { n: 7, curto: 'Emocional e encerramento', titulo: 'Emocional, encerramento e comunicação', grupos: [
        { titulo: 'Apoio emocional', cod: '7', campos: [
          sn('em-escuta', 'Escuta ativa e emoções validadas'),
          sn('em-sofr', 'Sinais de sofrimento emocional', { alertaSe: 'sim', abre: { quando: 'sim', campos: [
            { tipo: 'multi', id: 'em-sm', rotulo: 'O que você observou', opcoes: SM.map(function (s) { return s[0] + ' ' + s[2]; }), sm: true },
            { tipo: 'texto', id: 'em-sm-txt', rotulo: 'Descreva o que viu e ouviu', exemplo: 'Fica como ocorrência privada' }] } })] },
        { titulo: 'Encerramento', cod: '8', campos: [sn('en-amb', 'Ambiente organizado'), sn('en-alinh', 'Alinhamento para o dia seguinte')] },
        { titulo: 'Comunicação', cod: '9', campos: [
          sn('co-med', 'Contato com médico necessário', { abre: { quando: 'sim', campos: [{ tipo: 'texto', id: 'co-motivo', rotulo: 'Motivo do contato realizado', exemplo: 'O que foi conversado e com quem' }] } })] }
      ] },
      { n: 8, curto: 'Resumo e assinatura', titulo: 'Resumo e assinatura', final: true, grupos: [] }
    ];
    return etapas;
  }

  KZ.checklist = function (cfg) {
    var raiz = document.getElementById('cl-etapas');
    if (!raiz) return;
    cfg.bebes = cfg.bebes || [];
    cfg.anterior = cfg.anterior || {};
    cfg.textosAnteriores = cfg.textosAnteriores || {};
    cfg.outrasFamilias = cfg.outrasFamilias || [];
    var DIA = 'D' + cfg.dia;
    var DIA_ANT = 'D' + (cfg.dia - 1);
    var ETAPAS = definirEtapas(cfg);
    var R = {};              // respostas do dia
    var OK = {};             // campo numérico válido
    var COPIA = {};          // texto trazido do dia anterior, ainda sem confirmação
    var A = {};              // alertas do DOC 3 por chave
    var SPEC = {};           // id do campo -> { c, bebe, etapa }
    var atual = 1, assinado = false, montando = true, ponteiro = false, bebeAtual = cfg.bebes[0] && cfg.bebes[0].id;

    /* Render de campos */
    function idDe(c, b) { return b ? c.id.replace('X', b.id) : c.id; }
    function campoHTML(c, b, n) {
      var id = idDe(c, b);
      SPEC[id] = { c: c, bebe: b, etapa: n };
      var h = '';
      if (c.tipo === 'sn') {
        var ops = c.tres ? [['sim', 'Sim'], ['nao', 'Não'], ['na', 'Não se aplica']] : [['sim', 'Sim'], ['nao', 'Não']];
        h += '<fieldset class="pergunta' + (c.tres ? ' pergunta--tres' : '') + '" data-campo="' + id + '"><legend class="pergunta__texto">' + esc(c.texto) + '</legend><div class="sim-nao">' +
          ops.map(function (o) { return '<input type="radio" id="' + id + '-' + o[0] + '" name="' + id + '" value="' + o[0] + '"><label for="' + id + '-' + o[0] + '">' + ic('check') + o[1] + '</label>'; }).join('') + '</div>';
        if (c.abre) h += '<div class="pergunta__detalhe" data-abre-de="' + id + '" data-quando="' + c.abre.quando + '" hidden>' + c.abre.campos.map(function (x) { return campoHTML(x, b, n); }).join('') + '</div>';
        h += '<p class="pergunta__detalhe campo__ajuda" data-dica-de="' + id + '" hidden></p></fieldset><div data-alerta-de="' + id + '"></div>';
      } else if (c.tipo === 'escala') {
        var o = '';
        for (var i = 0; i <= c.max; i++) o += '<input type="radio" id="' + id + '-' + i + '" name="' + id + '" value="' + i + '"><label for="' + id + '-' + i + '">' + i + '</label>';
        h += '<fieldset class="escala' + (c.curta ? ' escala--curta' : '') + '" data-campo="' + id + '"><legend class="campo__rotulo">' + esc(c.rotulo) + '</legend><div class="escala__opcoes">' + o + '</div>' +
          '<div class="escala__extremos"><span>' + esc(c.extremos[0]) + '</span><span>' + esc(c.extremos[1]) + '</span></div>' +
          (c.folha ? '<button class="botao botao--terciario botao--compacto" type="button" data-abre-folha="' + c.folha[0] + '">' + ic('file-text') + c.folha[1] + '</button>' : '') +
          '<p class="campo__ajuda" data-dica-de="' + id + '" hidden></p></fieldset><div data-alerta-de="' + id + '"></div>';
      } else if (c.tipo === 'opcoes' || c.tipo === 'multi') {
        var tipo = c.tipo === 'multi' ? 'checkbox' : 'radio';
        h += '<fieldset class="cl-opcoes" data-campo="' + id + '"><legend class="campo__rotulo">' + esc(c.rotulo) + (c.tipo === 'multi' ? ' <span class="campo__opcional">(marque todos que valem)</span>' : '') + '</legend><div class="marcas">' +
          c.opcoes.map(function (op, k) { return '<input type="' + tipo + '" id="' + id + '-' + k + '" name="' + id + '" value="' + esc(op) + '"><label for="' + id + '-' + k + '">' + ic('check') + esc(op) + '</label>'; }).join('') + '</div>';
        if (c.abre) h += '<div class="pergunta__detalhe" data-abre-de="' + id + '" data-quando="' + esc(c.abre.quando) + '" hidden>' + c.abre.campos.map(function (x) { return campoHTML(x, b, n); }).join('') + '</div>';
        h += '<p class="campo__ajuda" data-dica-de="' + id + '" hidden></p></fieldset><div data-alerta-de="' + id + '"></div>';
      } else if (c.tipo === 'num') {
        var ref = cfg.anterior[id];
        var refTxt = ref ? 'No ' + DIA_ANT + ' foi ' + ref + (c.unidade === 'g' ? ' g' : ' ' + c.unidade) + '.' : 'Sem valor do ' + DIA_ANT + ' para comparar.';
        h += '<div class="campo" data-campo="' + id + '"><label class="campo__rotulo" for="' + id + '">' + esc(c.rotulo) + '</label>' +
          '<div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="' + id + '" inputmode="' + (c.decimal ? 'decimal' : 'numeric') + '" autocomplete="off" enterkeyhint="next" placeholder="' + (c.exemplo || '') + '" aria-describedby="' + id + '-ref ' + id + '-msg"><span class="campo__unidade">' + c.unidade + '</span></div>' +
          '<p class="cl-ref" id="' + id + '-ref">' + ic('clock') + '<span data-ref-de="' + id + '">' + refTxt + '</span></p>' +
          '<p class="campo__ajuda" id="' + id + '-msg" data-msg-de="' + id + '" hidden></p></div><div data-alerta-de="' + id + '"></div>';
      } else if (c.tipo === 'pa') {
        var r = cfg.anterior[id];
        h += '<div class="campo" data-campo="' + id + '" role="group" aria-labelledby="' + id + '-rot"><span class="campo__rotulo" id="' + id + '-rot">' + esc(c.rotulo) + ' <span class="campo__opcional">(mmHg)</span></span>' +
          '<div class="cl-pa"><div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="' + id + '-s" inputmode="numeric" autocomplete="off" enterkeyhint="next" placeholder="120" aria-label="Pressão sistólica, mmHg"></div><span class="cl-pa__barra" aria-hidden="true">/</span>' +
          '<div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="' + id + '-d" inputmode="numeric" autocomplete="off" enterkeyhint="next" placeholder="80" aria-label="Pressão diastólica, mmHg"></div></div>' +
          '<p class="cl-ref">' + ic('clock') + '<span>' + (r ? 'No ' + DIA_ANT + ' foi ' + r + ' mmHg.' : 'Sem valor do ' + DIA_ANT + ' para comparar.') + ' Sem regra automática por enquanto.</span></p>' +
          '<p class="campo__ajuda" data-msg-de="' + id + '" hidden></p></div>';
      } else if (c.tipo === 'texto') {
        var entrada = c.curto
          ? '<input class="campo__entrada" id="' + id + '" autocomplete="off" placeholder="' + esc(c.exemplo || '') + '">'
          : '<textarea class="campo__entrada" id="' + id + '" rows="3" placeholder="' + esc(c.exemplo || '') + '"></textarea>';
        var temAnterior = c.trazer && cfg.textosAnteriores[id];
        h += '<div class="campo" data-texto="' + id + '"><label class="campo__rotulo" for="' + id + '">' + esc(c.rotulo) + '</label><div class="campo__caixa">' + entrada + '</div>' +
          (temAnterior ? '<div class="cl-trazer" data-trazer-de="' + id + '"><button class="botao botao--terciario botao--compacto" type="button" data-trazer="' + id + '">' + ic('clipboard-paste') + 'Trazer o texto do ' + DIA_ANT + '</button></div>' +
            '<div class="confirma-copia" data-confirma-de="' + id + '" role="group" aria-label="Confirmar texto trazido do ' + DIA_ANT + '" hidden><p class="apoio"><strong>Texto do ' + DIA_ANT + ' desta família (' + esc(cfg.familia) + ').</strong> Confirme que continua valendo hoje antes de salvar.</p>' +
            '<div class="confirma-copia__acoes"><button class="botao botao--primario botao--compacto" type="button" data-vale="' + id + '">' + ic('check') + 'Vale para hoje</button><button class="botao botao--compacto" type="button" data-apaga="' + id + '">Apagar e escrever</button></div></div>' : '') +
          '<p class="campo__ajuda" data-msg-de="' + id + '" hidden></p></div>';
      } else if (c.tipo === 'fatos') {
        h += '<div class="cl-pilha-campos cl-pilha-campos--2">' +
          '<div class="campo"><label class="campo__rotulo" for="ch-data">Data</label><div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="ch-data" inputmode="numeric" value="' + cfg.checkin.data + '" aria-describedby="ch-fato"></div></div>' +
          '<div class="campo"><label class="campo__rotulo" for="ch-hora">Horário</label><div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="ch-hora" inputmode="numeric" value="' + cfg.checkin.hora + '" aria-describedby="ch-fato"></div></div></div>' +
          '<p class="cl-ref" id="ch-fato">' + ic('map-pin') + '<span>Vieram do check-in. Toque para corrigir se precisar.</span></p>';
      }
      return h;
    }
    function grupoHTML(g, b, n) {
      return '<div class="cl-grupo">' + (g.titulo ? '<h2 class="cl-grupo__titulo">' + esc(g.titulo) + ' <span class="mini">bloco <span class="dado">' + g.cod + '</span></span></h2>' : '') +
        g.campos.map(function (c) { return campoHTML(c, b, n); }).join('') + '</div>';
    }
    function etapaHTML(e) {
      var h = '<section class="cl-etapa" id="etapa-' + e.n + '" data-etapa="' + e.n + '" aria-labelledby="etapa-' + e.n + '-t" hidden>' +
        '<div class="cl-etapa__cab"><h1 class="t-1" id="etapa-' + e.n + '-t" tabindex="-1">' + esc(e.titulo) + '</h1>' +
        (e.intro ? '<p class="apoio">' + esc(e.intro) + '</p>' : '') + '</div>';
      if (e.final) return h + '<div data-final></div></section>';
      if (e.bebes) {
        if (cfg.bebes.length > 1) {
          h += '<div class="abas cl-bebes" role="tablist" aria-label="Bebês desta família">' + cfg.bebes.map(function (b, k) {
            return '<button class="abas__item" type="button" role="tab" id="aba-' + b.id + '" aria-controls="painel-' + b.id + '" aria-selected="' + (k === 0) + '" tabindex="' + (k === 0 ? 0 : -1) + '" data-bebe="' + b.id + '">' + esc(b.nome) + '<span data-estado-bebe="' + b.id + '"></span></button>';
          }).join('') + '</div>';
        }
        h += cfg.bebes.map(function (b, k) {
          return '<div class="pilha pilha--6" role="' + (cfg.bebes.length > 1 ? 'tabpanel' : 'group') + '" id="painel-' + b.id + '" aria-labelledby="' + (cfg.bebes.length > 1 ? 'aba-' + b.id : 'nome-' + b.id) + '"' + (k ? ' hidden' : '') + '>' +
            '<div class="cl-bebe__cab"><h2 class="t-2" id="nome-' + b.id + '">' + esc(b.completo) + '</h2>' + (cfg.bebes.length > 1 ? '<span class="apoio">Bebê ' + (k + 1) + ' de ' + cfg.bebes.length + '</span>' : '') + '</div>' +
            e.grupos.map(function (g) { return grupoHTML(g, b, e.n); }).join('') + '</div>';
        }).join('');
      } else {
        h += e.grupos.map(function (g) { return grupoHTML(g, null, e.n); }).join('');
      }
      return h + '</section>';
    }
    raiz.innerHTML = ETAPAS.map(etapaHTML).join('');

    /* Folhas do checklist: etapas, acionamento, seletor do DOC 3, assinar */
    function folha(id, titulo, corpo) {
      var f = document.createElement('div');
      f.className = 'folha'; f.id = id; f.hidden = true;
      f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', id + '-t');
      f.innerHTML = '<div class="folha__topo"><h2 class="t-2" id="' + id + '-t" tabindex="-1">' + titulo + '</h2><button class="botao botao--icone botao--terciario" type="button" data-fecha-folha aria-label="Fechar">' + ic('x') + '</button></div><div class="folha__corpo">' + corpo + '</div>';
      document.body.appendChild(f);
      return f;
    }
    var fEtapas = folha('folha-etapas', 'Etapas do ' + DIA, '<ol class="lista-etapas" data-lista-etapas></ol>');
    var fAcion = folha('folha-acionamento', 'Registrar acionamento',
      '<div class="pares"><dt>Sinal</dt><dd data-ac-sinal></dd></div>' +
      '<div class="campo"><label class="campo__rotulo" for="ac-hora">Horário do acionamento</label><div class="campo__caixa"><input class="campo__entrada campo__entrada--dado" id="ac-hora" inputmode="numeric"></div></div>' +
      '<div class="campo" data-ac-campo="ori"><label class="campo__rotulo" for="ac-ori">Orientação médica recebida</label><div class="campo__caixa"><textarea class="campo__entrada" id="ac-ori" rows="3" placeholder="O que a supervisão orientou"></textarea></div>' +
      '<div class="cl-trazer"><button class="botao botao--compacto" type="button" data-audio="ac-ori">' + ic('mic') + 'Gravar áudio</button></div><p class="campo__ajuda" hidden></p></div>' +
      '<div class="campo" data-ac-campo="con"><label class="campo__rotulo" for="ac-con">Conduta adotada</label><div class="campo__caixa"><textarea class="campo__entrada" id="ac-con" rows="3" placeholder="O que foi feito com a família"></textarea></div><p class="campo__ajuda" hidden></p></div>' +
      '<div class="folha__acoes"><button class="botao" type="button" data-fecha-folha>Agora não</button><button class="botao botao--primario" type="button" data-salvar-acion>Salvar registro</button></div>');
    var fSel = folha('folha-seletor', 'Registrar outro sinal de alerta',
      '<p class="apoio">Sinais do DOC 3 que não têm campo próprio no checklist. Escolha um e siga a conduta que aparece.</p>' +
      (cfg.bebes.length > 1 ? '<fieldset class="cl-opcoes"><legend class="campo__rotulo">Se for sinal do bebê, qual</legend><div class="marcas">' + cfg.bebes.map(function (b, k) { return '<input type="radio" name="sel-bebe" id="sel-b-' + b.id + '" value="' + b.id + '"' + (k ? '' : ' checked') + '><label for="sel-b-' + b.id + '">' + ic('check') + esc(b.nome) + '</label>'; }).join('') + '</div></fieldset>' : '') +
      SELETOR.map(function (g) {
        return '<fieldset class="cl-opcoes"><legend class="t-3">' + g.grupo + '</legend><div class="marcas">' + g.itens.map(function (s) {
          return '<input type="radio" name="sel-sinal" id="sel-' + s[0] + '" value="' + s[0] + '"><label for="sel-' + s[0] + '"><span class="dado">' + s[0] + '</span> ' + esc(s[2]) + '</label>';
        }).join('') + '</div></fieldset>';
      }).join('') +
      '<p class="campo__ajuda" data-sel-erro hidden>' + ic('circle-alert') + 'Escolha um sinal antes de registrar.</p>' +
      '<div class="folha__acoes"><button class="botao" type="button" data-fecha-folha>Cancelar</button><button class="botao botao--primario" type="button" data-registrar-sinal>Registrar este sinal</button></div>');
    var latchItens = [['L', 'Pega'], ['A', 'Deglutição audível'], ['T', 'Tipo de mamilo'], ['C', 'Conforto'], ['H', 'Colo e posicionamento']];
    var fLatch = folha('folha-latch', 'Tabela LATCH',
      '<p class="apoio">DOC 4. Toque a nota de cada item, de 0 a 2. A soma vai para o campo quando você confirmar.</p><div class="latch">' +
      latchItens.map(function (it) {
        return '<fieldset class="latch__item"><legend class="campo__rotulo"><span class="dado">' + it[0] + '</span> ' + it[1] + '</legend><div class="marcas marcas--dado">' +
          [0, 1, 2].map(function (v) { return '<input type="radio" name="latch-' + it[0] + '" id="latch-' + it[0] + v + '" value="' + v + '"><label for="latch-' + it[0] + v + '">' + v + '</label>'; }).join('') + '</div></fieldset>';
      }).join('') +
      '<p class="latch__total" aria-live="polite"><span class="t-3">Total</span><span class="dado dado--corpo" data-latch-total>faltam 5 itens</span></p></div>' +
      '<p class="apoio">0 a 7: apoio necessário. 8 a 10: amamentação eficaz.</p>' +
      '<div class="folha__acoes"><button class="botao" type="button" data-fecha-folha>Fechar</button><button class="botao botao--primario" type="button" data-usar-latch disabled>Usar no campo</button></div>');
    fLatch.addEventListener('change', function () {
      var marcados = latchItens.map(function (it) { var m = $('input[name="latch-' + it[0] + '"]:checked', fLatch); return m ? +m.value : null; });
      var faltam = marcados.filter(function (x) { return x === null; }).length;
      var total = marcados.reduce(function (a, b) { return a + (b || 0); }, 0);
      $('[data-latch-total]', fLatch).textContent = faltam ? 'faltam ' + faltam + (faltam === 1 ? ' item' : ' itens') : total + ' de 10';
      var usar = $('[data-usar-latch]', fLatch); usar.disabled = !!faltam; usar.dataset.total = total;
      usar.textContent = faltam ? 'Usar no campo' : 'Usar LATCH ' + total + ' no campo';
    });
    fLatch.addEventListener('click', function (e) {
      var u = e.target.closest('[data-usar-latch]'); if (!u || u.disabled) return;
      var inp = document.getElementById('am-latch-' + u.dataset.total);
      KZ.fecharFolha(fLatch);
      if (inp) { inp.checked = true; inp.dispatchEvent(new Event('change', { bubbles: true })); inp.focus(); }
    });
    folha('folha-nts', 'Escala NTS, trauma mamilar',
      '<p class="apoio">DOC 4. Só para consulta: a nota vai no campo da etapa.</p><ol class="nts">' +
      [['0', 'Normal'], ['1', 'Leve: eritema ou edema'], ['2', 'Moderado: dano superficial em menos de 25% do mamilo'], ['3', 'Grave: dano superficial em mais de 25%'], ['4', 'Crítico: lesão de espessura parcial em menos de 25%'], ['5', 'Severo: lesão de espessura parcial em mais de 25%']]
        .map(function (n) { return '<li><span class="dado">' + n[0] + '</span><span>' + n[1] + '</span></li>'; }).join('') + '</ol>' +
      '<div class="folha__acoes"><button class="botao botao--bloco" type="button" data-fecha-folha>Fechar</button></div>');
    var fAss = folha('folha-assinar', 'Assinar o registro do ' + DIA + '?',
      '<p class="corpo">Depois de assinado, o registro não muda. Se precisar corrigir, você faz um adendo com o motivo.</p>' +
      '<div class="folha__acoes"><button class="botao" type="button" data-fecha-folha>Revisar</button><button class="botao botao--primario" type="button" data-assinar-agora>' + ic('pen-line') + 'Assinar agora</button></div>');

    /* Valor atual de um campo */
    function lerCampo(id) {
      var el = $('[data-campo="' + id + '"]', raiz);
      if (!el) return;
      var s = SPEC[id], c = s.c;
      if (c.tipo === 'multi') return $$('input:checked', el).filter(function (i) { return i.name === id; }).map(function (i) { return i.value; });
      if (c.tipo === 'num') return $('#' + id, el).value.trim();
      if (c.tipo === 'pa') return [$('#' + id + '-s').value.trim(), $('#' + id + '-d').value.trim()];
      var m = $$('input[name="' + id + '"]', el).filter(function (i) { return i.checked; })[0];
      return m ? (c.tipo === 'escala' ? +m.value : m.value) : undefined;
    }
    function respondido(id) {
      var s = SPEC[id], v = R[id];
      if (!s) return false;
      if (s.c.tipo === 'num') return v != null && v !== '' && OK[id] !== false;
      if (s.c.tipo === 'pa') return v && v[0] && v[1] && OK[id] !== false;
      if (s.c.tipo === 'multi') return v && v.length > 0;
      return v != null;
    }
    function visivel(el) { return !el.parentElement.closest('[data-abre-de][hidden]'); }
    function contados(n) {
      var sec = document.getElementById('etapa-' + n);
      return $$('[data-campo]', sec).filter(visivel).map(function (el) { return el.dataset.campo; });
    }

    /* Regras e dicas */
    function avaliar(id) {
      var s = SPEC[id]; if (!s) return;
      var c = s.c, v = R[id], el = $('[data-campo="' + id + '"]', raiz);
      // validação de digitação (campos numéricos)
      if (c.tipo === 'num' || c.tipo === 'pa') {
        var msg = $('[data-msg-de="' + id + '"]', raiz), res = null;
        if (c.tipo === 'num' && v !== '' && v != null) {
          var n = num(v);
          if (isNaN(n)) res = { e: 'erro', t: 'Use só números' + (c.decimal ? ' e vírgula' : '') + '. Confira e digite de novo.' };
          else if (c.validar) res = c.validar(n, v) || null;
          if (!res && c.peso) res = avaliarPeso(id, n);
          else if (c.peso) atualizarGanho(id, NaN);
        }
        if (c.tipo === 'pa' && v && v[0] && v[1]) {
          var ps = num(v[0]), pd = num(v[1]);
          if (ps < 60 || ps > 250 || pd < 30 || pd > 150 || pd >= ps) res = { e: 'erro', t: v[0] + '/' + v[1] + ' mmHg não parece certo. Confira os dois números e digite de novo.' };
        }
        OK[id] = !(res && res.e === 'erro');
        if (res) { el.dataset.estado = res.e; msg.hidden = false; msg.innerHTML = ic('circle-alert') + '<span>' + esc(res.t) + '</span>'; }
        else { el.removeAttribute('data-estado'); msg.hidden = true; msg.textContent = ''; }
        if (res && res.e === 'erro') { limparAlerta(id); return; }
      }
      // regra do DOC 3
      var alvoValor = c.tipo === 'num' ? num(v) : v;
      var achado = (c.regra && v != null && v !== '' && !(c.tipo === 'num' && isNaN(alvoValor))) ? c.regra(alvoValor, s.bebe) : null;
      if (!c.peso) { if (achado) abrirAlerta(id, achado); else limparAlerta(id); }
      // pergunta pintada quando a resposta pede atenção
      if (c.tipo === 'sn') {
        if (c.alertaSe && v === c.alertaSe) el.dataset.estado = 'alerta-clinico'; else el.removeAttribute('data-estado');
      }
      if (c.tipo === 'num') {
        if (achado) el.dataset.estado = 'alerta-clinico';
        else if (el.dataset.estado === 'alerta-clinico') el.removeAttribute('data-estado');
      }
      // dica de atenção (sem regra no DOC 3)
      var dica = $('[data-dica-de="' + id + '"]', raiz);
      if (dica) {
        var t = c.dica && v != null ? c.dica(v) : null;
        dica.hidden = !t; dica.innerHTML = t ? ic('info') + '<span>' + esc(t) + '</span>' : '';
      }
      // sofrimento emocional: sinais SM escolhidos viram alertas
      if (c.sm) {
        SM.forEach(function (sm) {
          var chave = id + ':' + sm[0];
          var marcado = (v || []).some(function (x) { return x.indexOf(sm[0]) === 0; });
          if (marcado) abrirAlerta(chave, { cod: sm[0], sev: sm[1], titulo: sm[2], meta: 'Fica como ocorrência privada: só a coordenação e a diretoria veem.' }, id);
          else limparAlerta(chave);
        });
      }
      // detalhes que abrem conforme a resposta
      $$('[data-abre-de="' + id + '"]', raiz).forEach(function (d) {
        var q = d.dataset.quando, abre;
        if (q.charAt(0) === '!') abre = v != null && v !== q.slice(1);
        else abre = Array.isArray(v) ? v.indexOf(q) >= 0 : v === q;
        d.hidden = !abre;
        if (!abre) $$('[data-campo]', d).forEach(function (f) { limparAlerta(f.dataset.campo); });
        else $$('[data-campo]', d).forEach(function (f) { if (R[f.dataset.campo] != null) avaliar(f.dataset.campo); });
      });
    }
    function avaliarPeso(id, n) {
      var ref = num(cfg.anterior[id]);
      if (!isNaN(ref) && (n > ref * 5 || n < ref / 5)) {
        atualizarGanho(id, NaN);
        return { e: 'aviso', t: fmtG(n) + ' g parece ter ' + (n > ref ? 'um zero a mais' : 'um dígito a menos') + '. Confira e digite de novo.' };
      }
      atualizarGanho(id, n);
      var s = SPEC[id], nasc = s.bebe && s.bebe.nascer;
      if (nasc && n < nasc * 0.9) abrirAlerta(id, { cod: 'RN-13', sev: 'prioritario', titulo: 'Perda de ' + fmt1((1 - n / nasc) * 100) + '% do peso ao nascer em ' + s.bebe.nome });
      else limparAlerta(id);
      return null;
    }
    function atualizarGanho(id, n) {
      var span = $('[data-ref-de="' + id + '"]', raiz), refS = cfg.anterior[id];
      if (!span || !refS) return;
      var ref = num(refS), t = 'No ' + DIA_ANT + ': ' + refS + ' g';
      if (!isNaN(n)) { var d = n - ref; t += d === 0 ? ' · sem ganho' : d > 0 ? ' · ganho de ' + fmtG(d) + ' g' : ' · perda de ' + fmtG(-d) + ' g'; }
      span.textContent = t + '.';
    }

    /* Alertas */
    function abrirAlerta(chave, a, campoBase) {
      var id = campoBase || chave;
      var existente = A[chave];
      if (existente && existente.cod === a.cod && existente.titulo === a.titulo) return;
      if (existente && existente.registrado) return;
      var s = SPEC[id];
      A[chave] = { chave: chave, campo: id, cod: a.cod, sev: a.sev, titulo: a.titulo, conduta: a.conduta || condutaDe(a.cod, a.sev), meta: a.meta,
        etapa: s ? s.etapa : atual, bebe: s && s.bebe, hora: KZ.agora(), novo: !montando, registrado: false };
      var pre = cfg.registrados && cfg.registrados[a.cod];
      if (pre) { A[chave].registrado = true; A[chave].registro = pre; A[chave].novo = false; }
      if (!montando) KZ.salvar('Alerta ' + a.cod + ' para a coordenação: ' + a.titulo, { alerta: true });
      desenharAlertas();
    }
    function limparAlerta(chave) {
      if (A[chave] && !A[chave].registrado) { delete A[chave]; desenharAlertas(); }
    }
    function faixaHTML(a, compacta) {
      if (a.registrado) {
        return '<section class="faixa faixa--sucesso" aria-label="Acionamento registrado">' + ic('circle-check') + '<div><p class="faixa__titulo"><span class="faixa__codigo">' + a.cod + '</span>Acionamento registrado às ' + esc(a.registro.hora) + '</p>' +
          '<p class="faixa__texto">' + esc(a.titulo) + '. A coordenação acompanha e fecha o alerta.</p></div></section>';
      }
      var imed = a.sev === 'imediato';
      if (compacta) {
        return '<section class="faixa ' + (imed ? 'faixa--imediato' : 'faixa--prioritario') + ' faixa--compacta cl-fixa" aria-label="Alerta ' + a.cod + ' aberto">' +
          ic(imed ? 'siren' : 'triangle-alert') + '<div><p class="faixa__titulo"><span class="faixa__codigo">' + a.cod + '</span>' + esc(a.titulo) + '</p>' +
          '<p class="faixa__meta">Da etapa ' + a.etapa + '. Registre o acionamento antes de assinar.</p>' +
          '<div class="faixa__acoes"><a class="botao botao--compacto' + (imed ? ' botao--alerta' : '') + '" href="' + SUPERVISAO.tel + '" aria-label="Ligar para a supervisão">' + ic('phone-call') + 'Ligar</a>' +
          '<button class="botao botao--compacto" type="button" data-registrar="' + esc(a.chave) + '">Registrar acionamento</button></div></div></section>';
      }
      return '<section class="faixa ' + (imed ? 'faixa--imediato' : 'faixa--prioritario') + ' cl-fixa"' + (a.novo ? ' role="alert"' : '') + ' aria-labelledby="fx-' + a.chave.replace(/[^a-z0-9]/gi, '') + (compacta ? '-c' : '') + '">' +
        ic(imed ? 'siren' : 'triangle-alert') + '<div><p class="faixa__titulo" id="fx-' + a.chave.replace(/[^a-z0-9]/gi, '') + (compacta ? '-c' : '') + '"><span class="faixa__codigo">' + a.cod + '</span>' + esc(a.titulo) + '</p>' +
        (compacta ? '<p class="faixa__texto">Registre o acionamento antes de assinar. Etapa ' + a.etapa + '.</p>'
          : '<p class="faixa__texto">' + esc(a.conduta) + '</p>' + (a.meta ? '<p class="faixa__meta">' + esc(a.meta) + '</p>' : '') + '<p class="faixa__meta">' + REGISTRO + '</p>') +
        (KZ.online() ? '' : '<p class="faixa__meta">Sem sinal: a coordenação recebe o alerta quando a conexão voltar. Se for urgente agora, ligue.</p>') +
        '<div class="faixa__acoes"><a class="botao' + (imed ? ' botao--alerta' : '') + '" href="' + SUPERVISAO.tel + '">' + ic('phone-call') + SUPERVISAO.rot + '</a>' +
        '<button class="botao" type="button" data-registrar="' + esc(a.chave) + '">' + ic('clipboard-pen') + 'Registrar acionamento</button></div></div></section>';
    }
    function desenharAlertas() {
      $$('[data-alerta-de]', raiz).forEach(function (el) { el.innerHTML = ''; });
      var extras = [];
      Object.keys(A).forEach(function (k) {
        var a = A[k];
        var lugar = $('[data-alerta-de="' + a.campo + '"]', raiz);
        if (lugar && SPEC[a.campo]) lugar.innerHTML += faixaHTML(a, false); else extras.push(a);
        a.novo = false;
      });
      var fixa = document.getElementById('cl-faixa-fixa');
      if (fixa) {
        var html = extras.filter(function (a) { return !a.registrado; }).map(function (a) { return faixaHTML(a, false); }).join('');
        var outras = Object.keys(A).map(function (k) { return A[k]; }).filter(function (a) { return !a.registrado && a.etapa !== atual && SPEC[a.campo]; });
        html += outras.map(function (a) { return faixaHTML(a, true); }).join('');
        fixa.innerHTML = html;
      }
      atualizarEstados();
    }
    KZ.alertas = function () { return A; };

    /* Estado das etapas, trilha, abas de bebê */
    function estadoEtapa(n) {
      if (n === 8) return assinado ? { k: 'completa' } : { k: 'nao-iniciada' };
      var ids = contados(n);
      var resp = ids.filter(respondido).length;
      var copias = Object.keys(COPIA).filter(function (id) { return COPIA[id] && SPEC[id] && SPEC[id].etapa === n; }).length;
      var alerta = Object.keys(A).map(function (k) { return A[k]; }).filter(function (a) { return a.etapa === n && !a.registrado; })[0];
      if (alerta) return { k: 'alerta', a: alerta, faltam: ids.length - resp + copias };
      if (resp === 0 && !copias) return { k: 'nao-iniciada', faltam: ids.length };
      if (resp === ids.length && !copias) return { k: 'completa' };
      return { k: 'pendencia', faltam: ids.length - resp + copias };
    }
    function seloEstado(st) {
      if (st.k === 'completa') return '<span class="selo selo--sucesso">' + ic('circle-check') + 'Completa</span>';
      if (st.k === 'alerta') return '<span class="selo selo--alerta">' + ic('siren') + 'Alerta ' + st.a.cod + '</span>';
      if (st.k === 'pendencia') return '<span class="selo selo--aviso">' + ic('clock-alert') + st.faltam + ' sem resposta</span>';
      return '<span class="selo selo--contorno">Não iniciada</span>';
    }
    function atualizarEstados() {
      if (montando) return;
      var trilha = $('[data-trilha]');
      if (trilha) trilha.innerHTML = ETAPAS.map(function (e) {
        var st = estadoEtapa(e.n);
        var d = e.n === atual ? 'atual' : st.k === 'completa' ? 'feito' : st.k === 'alerta' ? 'alerta' : st.k === 'pendencia' ? 'pendente' : '';
        return '<span' + (d ? ' data-estado="' + d + '"' : '') + '></span>';
      }).join('');
      var lista = $('[data-lista-etapas]');
      if (lista) lista.innerHTML = ETAPAS.map(function (e) {
        return '<li><button class="lista-etapas__item" type="button" data-ir="' + e.n + '"' + (e.n === atual ? ' aria-current="step"' : '') + '><span class="dado">' + e.n + '</span><span>' + esc(e.curto) + (e.n === atual ? '<span class="sr">, você está aqui</span>' : '') + '</span>' + seloEstado(estadoEtapa(e.n)) + '</button></li>';
      }).join('');
      cfg.bebes.forEach(function (b) {
        var alvo = $('[data-estado-bebe="' + b.id + '"]', raiz); if (!alvo) return;
        var painel = document.getElementById('painel-' + b.id);
        var ids = $$('[data-campo]', painel).filter(visivel).map(function (x) { return x.dataset.campo; });
        var falta = ids.filter(function (i) { return !respondido(i); }).length;
        var al = Object.keys(A).some(function (k) { return A[k].bebe === b && !A[k].registrado; });
        alvo.innerHTML = al ? '<span class="selo selo--alerta">' + ic('siren') + 'Alerta</span>' : falta ? '<span class="selo selo--aviso">' + (falta === 1 ? 'Falta 1' : 'Faltam ' + falta) + '</span>' : '<span class="selo selo--sucesso">' + ic('circle-check') + 'Completa</span>';
      });
      if (atual === 8) desenharFinal();
      atualizarBarra();
    }

    /* Etapa 8: resumo e assinatura */
    function pendenciasObrigatorias() {
      var p = [];
      var ok = function (ids) { return ids.every(respondido); };
      p.push({ ok: !!(cfg.checkin && cfg.checkin.data && cfg.checkin.hora), t: 'Data e horário da visita', ir: 1 });
      p.push({ ok: ok(['pu-temp', 'pu-pa', 'pu-fc']), t: 'Sinais vitais da puérpera', ir: 3 });
      cfg.bebes.forEach(function (b) { p.push({ ok: ok(['rn-' + b.id + '-temp', 'rn-' + b.id + '-fc', 'rn-' + b.id + '-fr', 'rn-' + b.id + '-peso']), t: 'Sinais vitais e peso de ' + b.nome, ir: 5, bebe: b.id }); });
      Object.keys(A).forEach(function (k) { var a = A[k]; if (!a.registrado) p.push({ ok: false, t: 'Registro do acionamento do ' + a.cod, registrar: k }); else p.push({ ok: true, t: 'Acionamento do ' + a.cod + ' registrado às ' + a.registro.hora }); });
      Object.keys(COPIA).forEach(function (id) { if (COPIA[id]) p.push({ ok: false, t: 'Confirmar o texto trazido do ' + DIA_ANT + ' em ' + SPEC[id].c.rotulo.toLowerCase(), ir: SPEC[id].etapa, campo: id }); });
      p.push({ ok: !!(R.resumo && R.resumo.trim()), t: 'Resumo descritivo do dia', campo: 'cl-resumo' });
      return p;
    }
    function semResposta() {
      var total = 0, etapas = [];
      for (var n = 1; n <= 7; n++) { var ids = contados(n).filter(function (i) { return !respondido(i); }); if (ids.length) { total += ids.length; etapas.push(n); } }
      return { total: total, etapas: etapas };
    }
    function desenharFinal() {
      var alvo = $('[data-final]', raiz); if (!alvo) return;
      if (assinado) {
        alvo.innerHTML = '<div class="cl-assinado"><section class="faixa faixa--sucesso" role="status">' + ic('circle-check') + '<div><p class="faixa__titulo">Assinado às ' + assinado + '</p><p class="faixa__texto">' +
          (KZ.online() ? 'O registro do ' + DIA + ' foi para a coordenação. A régua marca o dia como feito quando o servidor confirmar.' : 'Sobe quando houver sinal. Até lá, a régua mostra o ' + DIA + ' como ficha pendente.') + '</p></div></section>' +
          '<p class="corpo">O registro agora é só leitura. Se precisar corrigir algo, faça um adendo com o motivo.</p>' +
          '<div class="linha-flex"><a class="botao botao--primario" href="enfermeira-hoje.html">' + ic('house') + 'Voltar para Hoje</a><a class="botao" href="enfermeira-familia.html">' + ic('clipboard-pen') + 'Fazer adendo</a></div></div>';
        return;
      }
      var p = pendenciasObrigatorias(), sr = semResposta();
      var foco = document.activeElement && document.activeElement.id === 'cl-resumo';
      var htmlLista = '<ul class="cl-lista-ok">' + p.map(function (i) {
        var acao = i.ok ? '' : i.registrar ? '<button class="botao botao--compacto" type="button" data-registrar="' + esc(i.registrar) + '">Registrar</button>'
          : i.ir ? '<button class="botao botao--compacto" type="button" data-ir="' + i.ir + '"' + (i.bebe ? ' data-ir-bebe="' + i.bebe + '"' : '') + '>Ir para a etapa ' + i.ir + '</button>'
          : '<button class="botao botao--compacto" type="button" data-focar="' + i.campo + '">Escrever</button>';
        return '<li data-ok="' + (i.ok ? 'sim' : 'nao') + '">' + ic(i.ok ? 'circle-check' : 'clock-alert') + '<span class="cl-lista-ok__corpo">' + esc(i.t) + '<span class="sr">' + (i.ok ? ', feito' : ', falta') + '</span></span>' + acao + '</li>';
      }).join('') + '<li data-ok="nao">' + ic('pen-line') + '<span class="cl-lista-ok__corpo">Assinatura</span></li></ul>';
      var jaTem = $('#cl-resumo', alvo);
      if (!jaTem) {
        alvo.innerHTML =
          '<div class="pilha pilha--6"><section class="enf-secao" aria-labelledby="cl-concluir-t"><h2 class="t-2" id="cl-concluir-t">Para concluir o ' + DIA + '</h2><div data-lista-final></div>' +
          '<p class="apoio" data-sem-resposta></p></section>' +
          '<section class="enf-secao" aria-labelledby="cl-resumo-rot"><div class="campo"><label class="campo__rotulo" id="cl-resumo-rot" for="cl-resumo">Resumo descritivo do dia</label>' +
          '<div class="campo__caixa"><textarea class="campo__entrada" id="cl-resumo" rows="5" placeholder="Como foi a visita, o que chamou atenção e o que fica para amanhã"></textarea></div>' +
          '<div class="cl-trazer"><button class="botao botao--compacto" type="button" data-audio="cl-resumo">' + ic('mic') + 'Gravar áudio</button></div>' +
          '<p class="campo__ajuda" data-audio-msg="cl-resumo" hidden></p></div></section>' +
          (cfg.saida ? '<p class="apoio">Chegada às <span class="dado">' + cfg.checkin.hora + '</span>, saída às <span class="dado">' + cfg.saida + '</span>.</p>' : '') + '</div>';
        if (R.resumo) $('#cl-resumo', alvo).value = R.resumo;
      }
      $('[data-lista-final]', alvo).innerHTML = htmlLista;
      $('[data-sem-resposta]', alvo).innerHTML = sr.total
        ? 'Sem resposta, não impede assinar: ' + sr.total + ' ' + (sr.total === 1 ? 'pergunta' : 'perguntas') + ' na' + (sr.etapas.length > 1 ? 's etapas ' : ' etapa ') + sr.etapas.join(', ').replace(/, (\d)$/, ' e $1') + '. <button class="botao botao--terciario botao--compacto" type="button" data-ir="' + sr.etapas[0] + '">Ver a primeira</button>'
        : 'Todas as perguntas das etapas 1 a 7 têm resposta.';
      if (foco) $('#cl-resumo', alvo).focus();
    }

    /* Barra inferior */
    var bVoltar = $('[data-voltar]'), bProx = $('[data-proxima]'), razao = $('[data-razao]');
    function atualizarBarra() {
      if (!bProx) return;
      bVoltar.disabled = atual === 1;
      razao.hidden = true;
      if (assinado && atual === 8) {
        bProx.disabled = false; bProx.removeAttribute('aria-disabled');
        bProx.innerHTML = ic('house') + 'Voltar para Hoje'; bProx.dataset.modo = 'hoje'; return;
      }
      if (atual < 7) { bProx.innerHTML = 'Próxima etapa' + ic('arrow-right'); bProx.dataset.modo = 'proxima'; bProx.removeAttribute('aria-disabled'); }
      else if (atual === 7) { bProx.innerHTML = 'Resumo e assinatura' + ic('arrow-right'); bProx.dataset.modo = 'proxima'; bProx.removeAttribute('aria-disabled'); }
      else {
        var falta = pendenciasObrigatorias().filter(function (i) { return !i.ok; });
        bProx.innerHTML = ic('pen-line') + 'Assinar registro do ' + DIA; bProx.dataset.modo = 'assinar';
        if (falta.length) {
          bProx.setAttribute('aria-disabled', 'true');
          razao.hidden = false; razao.id = 'cl-razao';
          bProx.setAttribute('aria-describedby', 'cl-razao');
          razao.textContent = 'Para assinar falta: ' + falta.map(function (i) { return i.t.charAt(0).toLowerCase() + i.t.slice(1); }).join('; ') + '.';
        } else { bProx.removeAttribute('aria-disabled'); }
      }
    }

    /* Navegação entre etapas */
    function irPara(n, opts) {
      opts = opts || {};
      n = Math.max(1, Math.min(8, n));
      atual = n;
      $$('.cl-etapa', raiz).forEach(function (s) { s.hidden = +s.dataset.etapa !== n; });
      var e = ETAPAS[n - 1];
      var rot = $('[data-etapa-rotulo]');
      if (rot) { rot.textContent = 'Etapa ' + n + ' de 8'; rot.parentElement.setAttribute('aria-label', 'Etapa ' + n + ' de 8, ' + e.curto + '. Ver todas as etapas'); }
      if (!opts.inicio && history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#etapa-' + n);
      desenharAlertas();
      if (!opts.inicio) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        var t = document.getElementById('etapa-' + n + '-t'); if (t) t.focus({ preventScroll: true });
      }
    }
    KZ.irPara = irPara;
    function escolherBebe(bid) {
      bebeAtual = bid;
      cfg.bebes.forEach(function (b) {
        var aba = document.getElementById('aba-' + b.id), p = document.getElementById('painel-' + b.id);
        if (aba) { aba.setAttribute('aria-selected', String(b.id === bid)); aba.tabIndex = b.id === bid ? 0 : -1; }
        if (p) p.hidden = b.id !== bid;
      });
    }
    KZ.escolherBebe = escolherBebe;

    /* Eventos */
    document.addEventListener('pointerdown', function () { ponteiro = true; }, true);
    document.addEventListener('keydown', function () { ponteiro = false; }, true);
    raiz.addEventListener('change', function (e) {
      if (assinado) return;
      var campo = e.target.closest('[data-campo]');
      if (!campo) return;
      var id = campo.dataset.campo, s = SPEC[id];
      if (s.c.tipo === 'multi' && s.c.exclusiva && e.target.type === 'checkbox' && e.target.checked) {
        $$('input[name="' + id + '"]', campo).forEach(function (i) {
          if (i !== e.target && (e.target.value === s.c.exclusiva || i.value === s.c.exclusiva)) i.checked = false;
        });
      }
      if (s.c.tipo === 'num' && e.target.value) {
        var n = num(e.target.value);
        if (!isNaN(n) && s.c.decimal && n < 100) e.target.value = fmt1(n);
        if (!isNaN(n) && s.c.peso) e.target.value = fmtG(n);
      }
      R[id] = lerCampo(id);
      avaliar(id);
      atualizarEstados();
      var rotulo = s.c.texto || s.c.rotulo;
      var val = Array.isArray(R[id]) ? R[id].join(s.c.tipo === 'pa' ? '/' : ', ') : R[id] === 'sim' ? 'sim' : R[id] === 'nao' ? 'não' : R[id] === 'na' ? 'não se aplica' : R[id];
      KZ.salvar(DIA + (s.bebe ? ', ' + s.bebe.nome : '') + ': ' + rotulo + ', ' + val + (s.c.unidade && s.c.tipo === 'num' ? ' ' + s.c.unidade : ''));
      // O foco desce para a próxima pergunta quando a resposta veio do toque
      if (ponteiro && (s.c.tipo === 'sn' || s.c.tipo === 'escala' || s.c.tipo === 'opcoes') && e.target.type === 'radio') {
        var todos = $$('[data-campo]', document.getElementById('etapa-' + atual)).filter(function (x) { return visivel(x) && x.offsetParent !== null; });
        var i = todos.indexOf(campo);
        var prox = todos[i + 1];
        var dentro = $$('[data-abre-de="' + id + '"]:not([hidden]) [data-campo]', campo)[0];
        if (dentro) prox = dentro;
        if (prox) {
          var alvo = $('input', prox);
          if (alvo) alvo.focus({ preventScroll: true });
          var r = prox.getBoundingClientRect(), barra = $('.cl-barra'), limite = innerHeight - (barra ? barra.offsetHeight : 0) - 16;
          if (r.bottom > limite) window.scrollBy({ top: Math.min(r.bottom - limite, r.top - 180), behavior: reduzir ? 'auto' : 'smooth' });
        }
      }
    });
    raiz.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'cl-resumo') { R.resumo = t.value; atualizarBarra(); var l = $('[data-lista-final]', raiz); if (l && (t.value.trim().length <= 1)) desenharFinal(); return; }
      var tx = t.closest('[data-texto]');
      if (tx) vigiarColagem(tx.dataset.texto, t);
    });
    raiz.addEventListener('focusout', function (e) {
      var t = e.target;
      if (t.id === 'cl-resumo' && t.value.trim()) { KZ.salvar(DIA + ': resumo descritivo'); return; }
      var tx = t.closest('[data-texto]');
      if (tx && t.value.trim() && !COPIA[tx.dataset.texto]) { R[tx.dataset.texto] = t.value; KZ.salvar(DIA + ': ' + SPEC_TEXTO(tx.dataset.texto)); }
    });
    function SPEC_TEXTO(id) { var el = $('label[for="' + id + '"]', raiz); return el ? el.textContent.toLowerCase() : id; }
    function vigiarColagem(id, campo) {
      var msg = $('[data-msg-de="' + id + '"]', raiz), cx = campo.closest('.campo');
      var achou = cfg.outrasFamilias.filter(function (nome) { return campo.value.toLowerCase().indexOf(nome.toLowerCase()) >= 0; })[0];
      if (achou) {
        cx.dataset.estado = 'aviso'; msg.hidden = false;
        msg.innerHTML = ic('triangle-alert') + '<span>O texto colado cita ' + esc(achou.indexOf('Família') === 0 ? 'a ' + achou : achou) + ', que não é esta família. Confira antes de salvar.</span>';
      } else if (cx.dataset.estado === 'aviso') { cx.removeAttribute('data-estado'); msg.hidden = true; }
    }
    function trazer(id) {
      var el = document.getElementById(id), cx = el.closest('.campo');
      el.value = cfg.textosAnteriores[id];
      COPIA[id] = true;
      cx.dataset.estado = 'copiado';
      $('[data-confirma-de="' + id + '"]', raiz).hidden = false;
      $('[data-trazer-de="' + id + '"]', raiz).hidden = true;
      atualizarEstados();
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-trazer],[data-vale],[data-apaga],[data-ir],[data-registrar],[data-abre-etapas],[data-voltar],[data-proxima],[data-bebe],[data-focar],[data-audio],[data-salvar-acion],[data-registrar-sinal],[data-abre-seletor],[data-assinar-agora]');
      if (!t) return;
      if (t.dataset.trazer) { trazer(t.dataset.trazer); KZ.aviso('Texto do ' + DIA_ANT + ' trazido. Confirme se vale para hoje.', { icone: 'clipboard-paste' }); }
      else if (t.dataset.vale) {
        var id = t.dataset.vale, cx = document.getElementById(id).closest('.campo');
        COPIA[id] = false; R[id] = document.getElementById(id).value; cx.removeAttribute('data-estado');
        var box = $('[data-confirma-de="' + id + '"]', raiz); box.hidden = true;
        var msg = $('[data-msg-de="' + id + '"]', raiz); msg.hidden = false; msg.innerHTML = ic('check') + '<span>Confirmado para hoje às ' + KZ.agora() + '.</span>';
        KZ.salvar(DIA + ': ' + SPEC_TEXTO(id) + ', confirmado para hoje'); atualizarEstados();
        document.getElementById(id).focus({ preventScroll: true });
      }
      else if (t.dataset.apaga) {
        var ia = t.dataset.apaga, ea = document.getElementById(ia);
        ea.value = ''; COPIA[ia] = false; delete R[ia]; ea.closest('.campo').removeAttribute('data-estado');
        $('[data-confirma-de="' + ia + '"]', raiz).hidden = true; $('[data-trazer-de="' + ia + '"]', raiz).hidden = false;
        atualizarEstados(); ea.focus();
      }
      else if (t.dataset.ir) {
        var fo = t.closest('.folha'); if (fo) KZ.fecharFolha(fo);
        irPara(+t.dataset.ir);
        if (t.dataset.irBebe) escolherBebe(t.dataset.irBebe);
      }
      else if (t.dataset.registrar) { abrirAcionamento(t.dataset.registrar); }
      else if (t.hasAttribute('data-abre-etapas')) { atualizarEstados(); KZ.abrirFolha(fEtapas); }
      else if (t.hasAttribute('data-abre-seletor')) { $('[data-sel-erro]', fSel).hidden = true; KZ.abrirFolha(fSel); }
      else if (t.hasAttribute('data-voltar')) { irPara(atual - 1); }
      else if (t.hasAttribute('data-proxima')) {
        if (t.dataset.modo === 'hoje') { location.href = 'enfermeira-hoje.html'; return; }
        if (t.dataset.modo === 'assinar') { if (t.getAttribute('aria-disabled') === 'true') { razao.hidden = false; return; } KZ.abrirFolha(fAss); return; }
        irPara(atual + 1);
      }
      else if (t.dataset.bebe) { escolherBebe(t.dataset.bebe); }
      else if (t.dataset.focar) { var f = document.getElementById(t.dataset.focar); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } }
      else if (t.dataset.audio) { gravar(t); }
      else if (t.hasAttribute('data-salvar-acion')) { salvarAcionamento(); }
      else if (t.hasAttribute('data-registrar-sinal')) { registrarSinal(); }
      else if (t.hasAttribute('data-assinar-agora')) { assinar(t); }
    });
    raiz.addEventListener('keydown', function (e) {
      var aba = e.target.closest('[role="tab"]'); if (!aba || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var abas = $$('[role="tab"]', aba.parentElement), i = abas.indexOf(aba);
      var prox = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      escolherBebe(prox.dataset.bebe); prox.focus();
    });

    function gravar(bt) {
      var id = bt.dataset.audio;
      if (bt.getAttribute('aria-pressed') === 'true') {
        bt.setAttribute('aria-pressed', 'false'); bt.innerHTML = ic('mic') + 'Gravar outro áudio';
        var msg = bt.closest('.campo').querySelector('.campo__ajuda');
        if (msg) { msg.hidden = false; msg.innerHTML = ic('check') + '<span>Áudio de 0:18 salvo no aparelho às ' + KZ.agora() + '.</span>'; }
        if (id === 'cl-resumo') { R.resumo = (R.resumo || '') + ' '; if (!R.resumo.trim()) R.resumo = '(áudio)'; atualizarEstados(); }
        if (id === 'ac-ori') { bt.closest('.campo').dataset.audio = 'sim'; }
        KZ.salvar(DIA + ': áudio gravado');
        return;
      }
      bt.setAttribute('aria-pressed', 'true'); bt.innerHTML = ic('mic') + 'Gravando. Toque para parar';
    }

    var alertaEmRegistro = null;
    function abrirAcionamento(chave) {
      var a = A[chave]; if (!a) return;
      alertaEmRegistro = chave;
      $('[data-ac-sinal]', fAcion).innerHTML = '<span class="dado">' + a.cod + '</span> ' + esc(a.titulo);
      $('#ac-hora', fAcion).value = KZ.agora();
      $$('[data-ac-campo]', fAcion).forEach(function (c) { c.removeAttribute('data-estado'); $('.campo__ajuda', c).hidden = true; });
      KZ.abrirFolha(fAcion);
    }
    function salvarAcionamento() {
      var a = A[alertaEmRegistro]; if (!a) return;
      var ori = $('#ac-ori', fAcion), con = $('#ac-con', fAcion), faltou = false;
      [[ori, 'Falta a orientação médica recebida. Escreva ou grave um áudio.'], [con, 'Falta a conduta adotada. Escreva o que foi feito com a família.']].forEach(function (p) {
        var cx = p[0].closest('.campo'), aj = $('.campo__ajuda', cx);
        var vazio = !p[0].value.trim() && cx.dataset.audio !== 'sim';
        if (vazio) { faltou = true; cx.dataset.estado = 'erro'; aj.hidden = false; aj.innerHTML = ic('circle-alert') + '<span>' + p[1] + '</span>'; }
        else { cx.removeAttribute('data-estado'); aj.hidden = true; }
      });
      if (faltou) { ($('[data-ac-campo][data-estado="erro"] textarea', fAcion) || ori).focus(); return; }
      a.registrado = true; a.registro = { hora: $('#ac-hora', fAcion).value || KZ.agora(), orientacao: ori.value, conduta: con.value };
      ori.value = ''; con.value = '';
      KZ.fecharFolha(fAcion);
      KZ.salvar('Acionamento do ' + a.cod + ' registrado às ' + a.registro.hora, { alerta: true });
      desenharAlertas();
      KZ.aviso('Acionamento registrado. A coordenação acompanha e fecha o alerta.', { icone: 'clipboard-pen' });
    }
    function registrarSinal() {
      var m = $('input[name="sel-sinal"]:checked', fSel);
      if (!m) { $('[data-sel-erro]', fSel).hidden = false; return; }
      var info; SELETOR.forEach(function (g) { g.itens.forEach(function (s) { if (s[0] === m.value) info = { s: s, g: g }; }); });
      var bid = ($('input[name="sel-bebe"]:checked', fSel) || {}).value;
      var b = info.g.bebe ? (cfg.bebes.filter(function (x) { return x.id === bid; })[0] || cfg.bebes[0]) : null;
      var chave = 'sel:' + m.value + (b ? ':' + b.id : '');
      KZ.fecharFolha(fSel);
      m.checked = false;
      abrirAlerta(chave, { cod: info.s[0], sev: info.s[1], titulo: info.s[2] + (b ? ' em ' + b.nome : '') });
      A[chave].etapa = -1;
      desenharAlertas();
      window.scrollTo({ top: 0 });
    }
    function assinar(bt) {
      bt.setAttribute('aria-busy', 'true'); bt.innerHTML = ic('refresh-cw') + 'Assinando';
      setTimeout(function () {
        assinado = KZ.agora();
        bt.removeAttribute('aria-busy'); bt.innerHTML = ic('pen-line') + 'Assinar agora';
        KZ.fecharFolha(fAss);
        $$('input, textarea', raiz).forEach(function (i) { i.disabled = true; });
        $$('[data-trazer], [data-audio]', raiz).forEach(function (i) { i.disabled = true; });
        KZ.salvar('Registro do ' + DIA + ' assinado às ' + assinado);
        var sel = $('.cl-barra__sinal'); if (sel) sel.hidden = true;
        atualizarEstados();
        KZ.aviso(KZ.online() ? 'Assinado às ' + assinado + '.' : 'Assinado às ' + assinado + '. Sobe quando houver sinal.', { icone: 'pen-line' });
        var t = document.getElementById('etapa-8-t'); if (t) t.focus({ preventScroll: true });
      }, 1100);
    }
    document.addEventListener('kz:sinal', function () { desenharAlertas(); });

    /* Montagem com o que já foi respondido hoje (nunca com valor de outro dia) */
    var seeds = cfg.respostas || {};
    Object.keys(seeds).forEach(function (id) {
      var v = seeds[id], s = SPEC[id]; if (!s) return;
      var el = $('[data-campo="' + id + '"]', raiz);
      if (s.c.tipo === 'num') $('#' + id, el).value = v;
      else if (s.c.tipo === 'pa') { $('#' + id + '-s').value = v[0]; $('#' + id + '-d').value = v[1]; }
      else if (s.c.tipo === 'multi') $$('input', el).forEach(function (i) { if (i.name === id && v.indexOf(i.value) >= 0) i.checked = true; });
      else $$('input', el).forEach(function (i) { if (i.name === id && String(i.value) === String(v)) i.checked = true; });
      R[id] = lerCampo(id);
    });
    Object.keys(cfg.textos || {}).forEach(function (id) { var el = document.getElementById(id); if (el) { el.value = cfg.textos[id]; R[id] = cfg.textos[id]; var tr = $('[data-trazer-de="' + id + '"]', raiz); if (tr) tr.hidden = true; } });
    if (cfg.resumo) R.resumo = cfg.resumo;
    Object.keys(SPEC).forEach(function (id) { if (R[id] != null) avaliar(id); });
    (cfg.copiasPendentes || []).forEach(trazer);
    montando = false;
    var inicial = +(location.hash.match(/etapa-(\d)/) || [])[1] || cfg.etapa || 1;
    irPara(inicial, { inicio: true });
    // O navegador rola até #etapa-N ao carregar; a etapa começa no topo, abaixo do cabeçalho.
    if (/etapa-\d/.test(location.hash)) {
      var topo = function () { window.scrollTo(0, 0); };
      topo(); window.addEventListener('load', function () { setTimeout(topo, 0); });
    }
    if (cfg.bebeInicial) escolherBebe(cfg.bebeInicial);
    atualizarEstados();

    // Altura do cabeçalho para prender a faixa logo abaixo dele
    var cab = $('.cl-cab');
    function medir() { if (cab) document.documentElement.style.setProperty('--cl-cab-h', cab.offsetHeight + 'px'); }
    medir();
    if (window.ResizeObserver && cab) new ResizeObserver(medir).observe(cab);
  };
})();
