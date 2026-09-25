// Saída do nó 26 "Agente Isadora" (PRD 19.4 nós 27, 30 e 35). A validação e
// a reescrita (nós 28 e 29) ficam em `resposta-agente.js`.
// Funções puras, embutidas nos nós Code; os testes importam as mesmas.
//
// Nó 27 "IA Decidiu Responder?" (v4.2): se nesta execução o agente chamou
// `acionar_equipe_saude`, ou o fluxo 2 devolveu `instrucao_saude` para
// qualquer ferramenta, a saída do modelo é descartada, seja qual for.
// `[SILENCIO]` em qualquer posição do texto encerra. Falha do modelo (erro,
// item repassado ou texto vazio) vai para a transferência "IA fora do ar";
// nada sai para a família.

import { temSilencio } from './marcas-sistema.js';
import { prepararEnvio } from './preparar-envio.js';
import { comMarca, falhouChamada, descreverErro, textoLimpo } from './resultado-no.js';

export const FERRAMENTA_SAUDE = 'acionar_equipe_saude';
export const FERRAMENTA_TRANSFERIR = 'transferir_para_equipe';
export const FERRAMENTA_FICHA = 'atualizar_ficha';

function analisarObservacao(observacao) {
  if (observacao && typeof observacao === 'object') return observacao;
  if (typeof observacao !== 'string') return null;
  try {
    return JSON.parse(observacao);
  } catch {
    return observacao;
  }
}

// Procura, em qualquer profundidade, objetos do Retorno do fluxo 2.
function retornosDoFluxo2(valor, achados = []) {
  if (Array.isArray(valor)) {
    for (const item of valor) retornosDoFluxo2(item, achados);
  } else if (valor && typeof valor === 'object') {
    if ('instrucao_chave' in valor || 'handoff_id' in valor) achados.push(valor);
    for (const item of Object.values(valor)) if (item && typeof item === 'object') retornosDoFluxo2(item, achados);
  } else if (typeof valor === 'string') {
    const chave = /"instrucao_chave"\s*:\s*"([^"]+)"/.exec(valor);
    const handoff = /"handoff_id"\s*:\s*"([^"]+)"/.exec(valor);
    if (chave || handoff) achados.push({ instrucao_chave: chave?.[1], handoff_id: handoff?.[1] });
  }
  return achados;
}

export function chamadasDeFerramenta(passos) {
  if (!Array.isArray(passos)) return [];
  return passos
    .filter((passo) => passo && typeof passo === 'object')
    .map((passo) => {
      const acao = passo.action && typeof passo.action === 'object' ? passo.action : {};
      const observacao = analisarObservacao(passo.observation);
      return {
        ferramenta: textoLimpo(acao.tool),
        entrada: acao.toolInput ?? null,
        retornos: retornosDoFluxo2(observacao),
      };
    });
}

export function lerSaidaAgente(estado, resposta, { saudeExecutada = false } = {}) {
  const falhou = falhouChamada(resposta) || typeof resposta.output !== 'string';
  const saida = falhou ? '' : resposta.output;
  const chamadas = falhou ? [] : chamadasDeFerramenta(resposta.intermediateSteps);

  const retornos = chamadas.flatMap((chamada) => chamada.retornos);
  const saude =
    saudeExecutada === true ||
    chamadas.some((chamada) => chamada.ferramenta === FERRAMENTA_SAUDE) ||
    retornos.some((retorno) => retorno.instrucao_chave === 'instrucao_saude');
  const handoffs = retornos.map((retorno) => textoLimpo(retorno.handoff_id)).filter(Boolean);
  const motivosTransferidos = chamadas
    .filter((chamada) => chamada.ferramenta === FERRAMENTA_TRANSFERIR)
    .map((chamada) => textoLimpo(chamada.entrada?.motivo))
    .filter(Boolean);
  const fechamento =
    estado.validador?.quer_contratar === true ||
    chamadas.some((chamada) => chamada.ferramenta === FERRAMENTA_FICHA && JSON.stringify(chamada.entrada ?? '').includes('quer_contratar'));

  const silencio = !falhou && temSilencio(saida);
  const vazia = !falhou && !silencio && saida.trim().length === 0;
  const modeloFalhou = (falhou || vazia) && !saude;

  return comMarca({
    ...estado,
    saida_modelo: saida,
    modelo_falhou: modeloFalhou,
    falha_agente: modeloFalhou ? (falhou ? 'modelo_de_conversa' : 'resposta_vazia') : estado.falha_agente ?? null,
    agente_erro: falhou ? descreverErro(resposta) : null,
    saida_descartada_saude: saude,
    silencio,
    ferramentas_chamadas: chamadas.map((chamada) => chamada.ferramenta),
    motivos_transferidos: motivosTransferidos,
    fechamento_venda: fechamento,
    handoff_id_execucao: handoffs.length > 0 ? handoffs[handoffs.length - 1] : estado.handoff_id_execucao ?? null,
    responder: !falhou && !vazia && !saude && !silencio,
  });
}

// Nó 30 "Preparar Envio".
export function prepararEnvioDoAgente(estado, { agora, digitacao, intervaloSegundos }) {
  const texto = estado.texto_resposta ?? '';
  const preparo = prepararEnvio({ texto, pdf: estado.pdf ?? {}, agora, digitacao, intervaloSegundos });
  return comMarca({
    ...estado,
    envios: preparo.envios,
    tem_envio: preparo.tem_envio,
    apresentacao_motivo: preparo.apresentacao,
    faltou_apresentacao: preparo.faltou_apresentacao,
    falha_agente: preparo.faltou_apresentacao ? 'apresentacao_indisponivel' : estado.falha_agente ?? null,
  });
}

// Nó 35: só o que saiu é registrado, e a memória recebe o texto que de fato
// saiu (Apêndice A, `sincronizar_memoria`).
export function separarEnviosFeitos(itens) {
  return (itens ?? []).filter((item) => item && item.envio_saiu === true);
}

export function consolidarEnvio(itens) {
  const feitos = separarEnviosFeitos(itens).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return comMarca({
    pdf_saiu: feitos.some((item) => item.tipo === 'documento'),
    textos_enviados: feitos.filter((item) => item.tipo === 'texto').length,
    texto_enviado: feitos
      .filter((item) => item.tipo === 'texto')
      .map((item) => item.texto)
      .join('\n\n'),
  });
}
