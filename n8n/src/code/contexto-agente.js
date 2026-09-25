// Nó "Preparar Entrada do Agente", depois do nó 25 "Montar Contexto do
// Agente" (`agente.ficha_para_agente`, PRD 19.4 e Apêndice A). Função pura:
// monta os campos do prompt de sistema, a entrada do modelo e o contexto do
// validador (nó 28). O build embute este arquivo no nó Code; os testes
// importam a mesma função.
//
// Contrato esperado do banco (P21): ficha_para_agente(conversa_id) -> {ok,
// ficha, data_hora, planos, valores_permitidos, pdf_status,
// horarios_edilaine, valor: {essencial, imersao, continuado,
// gemelar_essencial, gemelar_continuado, minimo}, parcela: {continuado},
// pagina: {filho_unico, gemelar}, validador: {planos: [{nome, apelidos?,
// valor_centavos, parcelas, parcela_centavos}], taxas_centavos,
// valor_minimo_centavos, listas: {palavras_evitadas, promessas, escassez,
// pedido_dado, pedido_verbos?, negar_assistente, palavras_condicao},
// motivo_em_curso, quer_contratar}, pdf: {url, nome_arquivo,
// reenvio_janela_horas, enviado_em}}.

import { comMarca, resultadoDoBanco, descreverErro, textoLimpo } from './resultado-no.js';

// Variáveis de `n8n/prompts/isadora-system.md`, na ordem da tabela do
// cabeçalho. O build confere que o prompt não usa nenhuma outra.
export const VARIAVEIS_PROMPT_ISADORA = [
  'data_hora',
  'modo',
  'ficha',
  'planos',
  'valores_permitidos',
  'pdf_status',
  'horarios_edilaine',
  'valor.essencial',
  'valor.imersao',
  'valor.continuado',
  'valor.gemelar_essencial',
  'valor.gemelar_continuado',
  'valor.minimo',
  'parcela.continuado',
  'pagina.filho_unico',
  'pagina.gemelar',
];

const VALOR_AUSENTE = 'não informado';

function lerCaminho(objeto, caminho) {
  if (!objeto || typeof objeto !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(objeto, caminho)) return objeto[caminho];
  return caminho.split('.').reduce((atual, parte) => (atual && typeof atual === 'object' ? atual[parte] : undefined), objeto);
}

function comoTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor)) return valor.map(comoTexto).filter(Boolean).join('\n');
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export function camposDoPrompt(ficha, modo) {
  const campos = {};
  for (const variavel of VARIAVEIS_PROMPT_ISADORA) {
    const valor = variavel === 'modo' ? modo : comoTexto(lerCaminho(ficha, variavel));
    campos[variavel] = valor || VALOR_AUSENTE;
  }
  return campos;
}

function listaDeTexto(lista) {
  return Array.isArray(lista) ? lista.filter((item) => typeof item === 'string' && item.trim()) : [];
}

export function contextoDoValidador(validador) {
  if (!validador || typeof validador !== 'object') return { planos: [], listas: null };
  const planos = Array.isArray(validador.planos)
    ? validador.planos
        .filter((plano) => plano && typeof plano.nome === 'string')
        .map((plano) => ({
          nome: plano.nome,
          apelidos: listaDeTexto(plano.apelidos),
          valor_centavos: Number(plano.valor_centavos),
          parcelas: plano.parcelas === undefined || plano.parcelas === null ? null : Number(plano.parcelas),
          parcela_centavos: Number(plano.parcela_centavos),
        }))
    : [];
  const listas = validador.listas && typeof validador.listas === 'object' ? validador.listas : null;
  return {
    planos,
    taxas_centavos: Array.isArray(validador.taxas_centavos) ? validador.taxas_centavos.map(Number) : [],
    valor_minimo_centavos: Number(validador.valor_minimo_centavos),
    listas,
    motivo_em_curso: textoLimpo(validador.motivo_em_curso) || null,
    quer_contratar: validador.quer_contratar === true,
  };
}

// `ficha_para_agente.pdf.url` devolve a URL de `parametro.pdf_apresentacao.url`
// quando existe, senão o `path` cru do bucket (ADR 0003, divergência 4): o
// banco não sabe montar URL pública, só o build conhece o domínio do bucket
// de marketing por ambiente. Uma string que já começa com http(s) é usada
// como está; senão é tratada como caminho e prefixada por
// `urlPublicaMarketing` (config, `storage.urlPublicaMarketing`). Sem essa
// configuração, um caminho cru não vira envio: fica vazio, e
// `faltou_apresentacao` abre a transferência em vez de mandar um link quebrado.
const URL_ABSOLUTA = /^https?:\/\//i;

export function resolverUrlPdf(url, urlPublicaMarketing) {
  const valor = textoLimpo(url);
  if (!valor) return '';
  if (URL_ABSOLUTA.test(valor)) return valor;
  const base = textoLimpo(urlPublicaMarketing).replace(/\/+$/, '');
  if (!base) return '';
  return `${base}/${valor.replace(/^\/+/, '')}`;
}

export function prepararEntradaAgente(estado, respostaFicha, { linhaMidia, nomesMidia, urlPublicaMarketing } = {}) {
  const ficha = resultadoDoBanco(respostaFicha);
  const fichaOk = ficha?.ok === true && typeof ficha.ficha === 'string' && ficha.ficha.trim().length > 0;
  const comLegenda = estado.midia === true && textoLimpo(estado.texto_agrupado).length > 0;
  const entrada = comLegenda
    ? linhaDeMidia(estado, { modelo: linhaMidia, nomes: nomesMidia })
    : textoLimpo(estado.texto_agrupado);
  const pdf = ficha?.pdf && typeof ficha.pdf === 'object' ? ficha.pdf : {};
  return comMarca({
    ...estado,
    ficha_ok: fichaOk,
    ficha_erro: fichaOk ? null : ficha ? 'ficha_para_agente sem ficha' : descreverErro(respostaFicha),
    falha_agente: fichaOk ? null : 'ficha_do_agente',
    prompt: fichaOk ? camposDoPrompt(ficha, estado.modo) : {},
    validador: fichaOk ? contextoDoValidador(ficha.validador) : { planos: [], listas: null },
    pdf: {
      url: resolverUrlPdf(pdf.url, urlPublicaMarketing),
      nome_arquivo: textoLimpo(pdf.nome_arquivo),
      reenvio_janela_horas: Number(pdf.reenvio_janela_horas) || 0,
      enviado_em: textoLimpo(pdf.enviado_em) || null,
    },
    entrada_agente: entrada,
  });
}

// Linha que vai ao agente junto com a legenda de uma mídia (PRD 19.4 nó 24).
// O modelo da linha e o nome de cada tipo de mídia vêm do config.
export function linhaDeMidia(estado, { modelo, nomes = {} }) {
  const tipo = (estado.tipos_midia ?? [])[0];
  const nome = textoLimpo(nomes[tipo]) || textoLimpo(nomes.padrao);
  return String(modelo ?? '')
    .split('{midia}')
    .join(nome)
    .split('{legenda}')
    .join(textoLimpo(estado.texto_agrupado));
}
