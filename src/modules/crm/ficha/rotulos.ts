import {
  ROTULO_ESTAGIO_P1,
  ROTULO_ESTAGIO_P2,
  ROTULO_PAPEL_PESSOA,
} from "../pipeline/estagios";
import type { Json } from "@/lib/db/types";
import type { EstadoSensivel, PapelPessoa } from "@/lib/dados/tipos";

/**
 * Rótulos da ficha. Sem "server-only": a folha de reversão do freio (um
 * componente de cliente) lê os rótulos e os efeitos dos estados daqui.
 * Reaproveita o que o pipeline (P15) já mantém (`ROTULO_PAPEL_PESSOA`, os
 * rótulos de estágio) em vez de duplicar.
 */
export { ROTULO_PAPEL_PESSOA };

export function rotuloPapelPessoa(papel: PapelPessoa): string {
  return ROTULO_PAPEL_PESSOA[papel];
}

export const ROTULO_ESTADO_SENSIVEL: Record<EstadoSensivel, string> = {
  normal: "Normal",
  atencao: "Atenção",
  bloqueio_total: "Bloqueio total",
  encerrado_sensivel: "Encerrado sensível",
};

/** Efeito de cada estado em uma frase (PRD 8.1, telas.md K7). */
export const EFEITO_ESTADO_SENSIVEL: Record<EstadoSensivel, string> = {
  normal: "Operação normal. Todas as réguas voltam a funcionar.",
  atencao:
    "Réguas de conteúdo e marketing pausadas. A comunicação operacional continua. A Isadora só acolhe e encaminha, não vende.",
  bloqueio_total:
    "Toda automação que fala com a família fica congelada. A Isadora fica desativada para esta família. Só contato humano e pelo nome.",
  encerrado_sensivel:
    "A família sai de pesquisa, indicação, remarketing e qualquer régua futura, para sempre.",
};

/**
 * `evento_familia.tipo` é texto livre (comentário da coluna na migration
 * 0003: "lead_entrou, estagio, pdf_enviado, sessao, contrato, ..."), sem
 * enum no banco. Aqui só troca o código por um rótulo mais claro quando a
 * tela reconhece o tipo; um tipo desconhecido nunca quebra.
 */
export const ROTULO_TIPO_EVENTO: Record<string, string> = {
  entrada: "Entrada",
  lead_entrou: "Entrada",
  estagio: "Mudança de estágio",
  marco: "Marco comercial",
  pdf_enviado: "Apresentação enviada",
  sessao: "Sessão de venda",
  contrato: "Contrato",
  freio: "Freio",
  nao_contatar: "Não contatar",
  data_nascimento: "Nascimento registrado",
  data_alta: "Alta registrada",
  mesclagem: "Famílias unidas",
  nova_gestacao: "Vínculo com a gestação anterior",
  outro: "Evento",
};

export function rotuloTipoEvento(tipo: string): string {
  return ROTULO_TIPO_EVENTO[tipo] ?? "Evento";
}

function texto(dados: Json, chave: string): string | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const valor = (dados as Record<string, Json | undefined>)[chave];
  return typeof valor === "string" ? valor : null;
}

function rotuloEstado(valor: string | null): string | null {
  return valor && valor in ROTULO_ESTADO_SENSIVEL
    ? ROTULO_ESTADO_SENSIVEL[valor as EstadoSensivel]
    : null;
}

function rotuloEstagioLivre(maquina: string | null, valor: string | null) {
  if (!valor) return null;
  const tabela: Record<string, string> =
    maquina === "p2" ? ROTULO_ESTAGIO_P2 : ROTULO_ESTAGIO_P1;
  return tabela[valor] ?? null;
}

/** Título gravado pelo banco que é código, não frase ("qualificado →
 * sessao_venda_agendada", "justificativa", "vinculo_nova_gestacao"). */
function pareceCodigo(titulo: string): boolean {
  return /^[a-z0-9_ →]+$/.test(titulo.trim());
}

/**
 * Título do evento para a linha do tempo. As funções do banco
 * (`privado.transicionar`, `privado.acionar_freio` e as outras do freio,
 * migrations 0006 e 0009) gravam o título como código, com o detalhe em
 * `dados`; a tela monta a frase a partir de `dados` e nunca mostra código
 * nem seta. Evento com título já em frase (seed, eventos desta ficha)
 * aparece como veio.
 */
export function tituloEvento(evento: {
  tipo: string;
  titulo: string;
  dados: Json;
}): string {
  const { tipo, dados } = evento;
  const acao = texto(dados, "acao");

  if (tipo === "freio" && acao) {
    const para = rotuloEstado(texto(dados, "para"));
    if (acao === "acionar")
      return para ? `Freio acionado: ${para.toLowerCase()}` : "Freio acionado";
    if (acao === "desfazer") return "Freio desfeito por quem acionou";
    if (acao === "justificar") return "Freio justificado";
    if (acao === "reverter")
      return para
        ? `Freio ajustado para ${para.toLowerCase()}`
        : "Freio ajustado";
  }

  if (tipo === "estagio" && pareceCodigo(evento.titulo)) {
    const maquina = texto(dados, "maquina");
    const para = rotuloEstagioLivre(maquina, texto(dados, "para"));
    if (para) return `Mudou para ${para}`;
  }

  if (!evento.titulo.trim() || pareceCodigo(evento.titulo)) {
    return rotuloTipoEvento(tipo);
  }
  return evento.titulo;
}
