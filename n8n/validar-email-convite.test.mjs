// [v4.3] E-mail só no passo do convite da reunião com a Edilaine (PRD 11.11
// item 5 e 11.14). O pedido de e-mail passa apenas com a ficha em
// `agenda_estado = aguardando_email` e com a lista `pedido_dado_convite`
// vinda de `parametro.validador_listas`; CPF, RG, endereço, CEP, data de
// nascimento e documento continuam barrados nesse passo e em qualquer outro.
//
// Roda com: node --test n8n/validar-email-convite.test.mjs
// Listas e textos fictícios, espelho do seed (supabase/seed.sql).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validarResposta,
  termosLiberadosNoConvite,
  LISTA_PEDIDO_CONVITE,
  AGENDA_ESTADO_CONVITE,
} from './src/code/validar-resposta.js';

const LISTAS = {
  palavras_evitadas: ['mãezinha', 'mamãe', 'papai', 'amiga', 'cura', 'milagre', 'garantimos'],
  promessas: ['vai dar tudo certo', 'resultado garantido', 'garantimos'],
  escassez: ['última vaga', 'imperdível'],
  pedido_dado: ['cpf', 'rg', 'documento', 'documentos', 'endereço', 'cep', 'data de nascimento', 'e-mail', 'email'],
  pedido_dado_convite: ['e-mail', 'email'],
  pedido_verbos: ['manda', 'mande', 'me manda', 'passa', 'me passa', 'envia', 'informe', 'qual é o seu', 'qual a sua'],
  negar_assistente: ['sou humana', 'não sou um robô'],
  palavras_condicao: ['desconto', 'pix', 'à vista', 'cupom', 'parcela'],
};

const PLANOS = [{ nome: 'Essencial', valor_centavos: 420000, parcelas: 3, parcela_centavos: 140000 }];
const BASE = { planos: PLANOS, taxas_centavos: [], valor_minimo_centavos: 420000, listas: LISTAS };
const NO_CONVITE = { ...BASE, agenda_estado: AGENDA_ESTADO_CONVITE };

const PEDIDO_EMAIL = 'Perfeito, esse horário está livre! Me passa o seu e-mail para eu enviar o convite com o link da reunião?';

const regras = (resultado) => resultado.violacoes.map((v) => v.regra);

describe('pedido de e-mail só no passo do convite', () => {
  test('a lista e o estado têm os nomes do PRD', () => {
    assert.equal(LISTA_PEDIDO_CONVITE, 'pedido_dado_convite');
    assert.equal(AGENDA_ESTADO_CONVITE, 'aguardando_email');
  });

  test('com aguardando_email, pedir o e-mail para o convite passa', () => {
    const resultado = validarResposta(PEDIDO_EMAIL, NO_CONVITE);
    assert.deepEqual(resultado.violacoes, []);
    assert.equal(resultado.aprovada, true);
    assert.equal(validarResposta('Me passa o seu email e o do seu marido, para os dois receberem o convite?', NO_CONVITE).aprovada, true);
  });

  test('fora do passo do convite, o mesmo pedido de e-mail continua barrado', () => {
    for (const estado of [undefined, null, '', 'sem_reuniao', 'horarios_enviados', 'agendada', 'remarcada', 'faltou', 'AGUARDANDO_EMAIL']) {
      const resultado = validarResposta(PEDIDO_EMAIL, { ...BASE, agenda_estado: estado });
      assert.ok(regras(resultado).includes('pedido_de_dado'), `estado ${String(estado)} deveria barrar o e-mail`);
    }
  });

  test('sem a lista pedido_dado_convite, o e-mail continua barrado mesmo em aguardando_email (falha fechada)', () => {
    const { pedido_dado_convite, ...semLista } = LISTAS;
    assert.ok(pedido_dado_convite.length > 0);
    const resultado = validarResposta(PEDIDO_EMAIL, { ...NO_CONVITE, listas: semLista });
    assert.ok(regras(resultado).includes('pedido_de_dado'));
  });

  test('no passo do convite, CPF, RG, endereço, CEP, data de nascimento e documento continuam barrados', () => {
    const pedidos = [
      'Me passa o seu CPF para eu enviar o convite?',
      'Me passa o seu e-mail e o seu CPF?',
      'Me manda o seu RG, por favor.',
      'Qual é o seu endereço? Assim o convite chega certinho.',
      'Me passa o seu CEP?',
      'Me passa a sua data de nascimento para o convite?',
      'Me manda uma foto do documento.',
    ];
    for (const texto of pedidos) {
      const resultado = validarResposta(texto, NO_CONVITE);
      assert.ok(regras(resultado).includes('pedido_de_dado'), `deveria barrar: ${texto}`);
      const termos = resultado.violacoes.filter((v) => v.regra === 'pedido_de_dado').map((v) => v.detalhe);
      assert.ok(termos.every((detalhe) => !/"e-?mail"/.test(detalhe)), `o e-mail não deveria aparecer como violação: ${texto}`);
    }
  });

  test('uma lista de convite que tente liberar CPF não libera nada além do que o parâmetro diz, e o e-mail segue liberado só no passo certo', () => {
    const listas = { ...LISTAS, pedido_dado_convite: ['e-mail'] };
    assert.ok(regras(validarResposta('Me passa o seu CPF?', { ...NO_CONVITE, listas })).includes('pedido_de_dado'));
    assert.equal(validarResposta('Me passa o seu e-mail?', { ...NO_CONVITE, listas }).aprovada, true);
  });

  test('termosLiberadosNoConvite devolve a lista só com aguardando_email', () => {
    assert.deepEqual(termosLiberadosNoConvite(NO_CONVITE, LISTAS), ['e-mail', 'email']);
    assert.deepEqual(termosLiberadosNoConvite({ agenda_estado: ' aguardando_email ' }, LISTAS), ['e-mail', 'email']);
    assert.deepEqual(termosLiberadosNoConvite({ agenda_estado: 'agendada' }, LISTAS), []);
    assert.deepEqual(termosLiberadosNoConvite({}, LISTAS), []);
    assert.deepEqual(termosLiberadosNoConvite(NO_CONVITE, {}), []);
    assert.deepEqual(termosLiberadosNoConvite(null, LISTAS), []);
  });

  test('as outras regras seguem valendo no passo do convite', () => {
    assert.ok(regras(validarResposta('Me passa o seu e-mail? Corre, é a última vaga.', NO_CONVITE)).includes('escassez'));
    assert.ok(regras(validarResposta('Me passa o seu e-mail? Vai dar tudo certo.', NO_CONVITE)).includes('promessa'));
    assert.ok(regras(validarResposta('Me passa o seu e-mail? E qual a sua cidade?', NO_CONVITE)).includes('perguntas_demais'));
  });
});
