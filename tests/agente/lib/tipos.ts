/**
 * P28 · Tipos do roteiro de homologação da Isadora (PRD 11.5, Apêndice C).
 *
 * O roteiro descreve cada caso uma vez (`casos.ts`) e o confere sobre um
 * `ResultadoCaso`, que dois executores produzem do mesmo jeito:
 *
 * - `hml/driver-webhook.ts`: o de verdade. Manda os payloads ao webhook do
 *   fluxo 3 em homologação e lê a captura da UAZAPI e o banco de
 *   homologação. Só roda com as variáveis do ambiente (ver `ambiente.ts`).
 * - `local/execucao-local.ts`: o do simulador do fluxo 3 (`n8n/src/lib/
 *   simulador.mjs`) sobre o banco local, com um modelo roteirizado no lugar
 *   da OpenAI. Prova o encanamento, nunca o modelo.
 */

export type Json =
  null | boolean | number | string | Json[] | { [chave: string]: Json };
export type Objeto = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

export type TurnoMensagem =
  | { tipo: "texto"; texto: string }
  | { tipo: "audio"; transcricao: string; falharTranscricao?: false }
  | { tipo: "audio"; falharTranscricao: true; transcricao?: undefined }
  | { tipo: "foto"; legenda: string }
  | { tipo: "figurinha" };

/** Coisas que o roteiro faz entre duas mensagens da família. */
export type Acao =
  | { acao: "pausarIA" }
  | { acao: "resolverNoCRM" }
  | { acao: "devolverAIsadora" }
  | { acao: "envelhecerConversa"; horas: number }
  /** Roda o agendador do follow-up e espera a Isadora mandar o retorno (caso 23). */
  | { acao: "executarFollowup" };

export type Turno = TurnoMensagem | Acao;

export function ehAcao(turno: Turno): turno is Acao {
  return "acao" in turno;
}

// ---------------------------------------------------------------------------
// Preparo (estado do sistema antes do primeiro turno)
// ---------------------------------------------------------------------------

export type Preparo =
  /** Coloca `agente_modo` em teste e deixa o número do caso de fora da lista. */
  | { preparo: "modoTesteForaDaLista" }
  /** Liga `alerta_saude_sensivel_ativo` (K-20) durante o caso. */
  | { preparo: "ligarAlertaSaudeSensivel" }
  /** Cadastra os horários da Edilaine (`parametro.horarios_edilaine`). */
  | { preparo: "horariosDaEdilaine" }
  /** Abre a janela de envio do follow-up (agente_janela_envio) para o teste não depender da hora do dia. */
  | { preparo: "janelaDeEnvioAberta" }
  /**
   * Exige que estes textos de mensagem_modelo estejam aprovados: `agente.mensagem_sistema`
   * só devolve texto aprovado, e sem ele a família fica sem resposta. Homologação real:
   * falha com a lista do que falta aprovar. Banco local: aprova durante o caso e desfaz.
   */
  | { preparo: "textosAprovados"; chaves: string[] }
  /** Exige que a cidade volte "nao_atendida" em verificar_cobertura (precisa da lista completa do IBGE). */
  | {
      preparo: "cidadeForaDaArea";
      cidade: string;
      uf: string;
      codigoIbge: number;
    };

// ---------------------------------------------------------------------------
// O que se espera
// ---------------------------------------------------------------------------

/**
 * `sistema`: independe do modelo (caminho de saúde e perda, máscara de
 * CPF, freio, pausa, texto fixo). O simulador prova de verdade.
 * `modelo`: depende do que o modelo escolhe ou escreve. O simulador só prova
 * que o sistema faz a sua parte quando o modelo (roteirizado) faz a dele.
 */
export type Origem = "sistema" | "modelo";

/**
 * `bloqueante`: falha reprova a versão (PRD 11.5: saúde, valor sem
 * apresentação, promessa, dado sensível) ou é fato do sistema.
 * `conteudo`: heurística sobre o que a Isadora disse; confere regra, não
 * frase exata (a voz mudou na 4.2-rc4). Falha pede olhar humano no relatório.
 */
export type Gravidade = "bloqueante" | "conteudo";

export interface Falha {
  regra: string;
  detalhe: string;
}

export interface Regra {
  /** Identificador estável, aparece no relatório. */
  id: string;
  /** O que a regra confere, em uma frase para a equipe. */
  descricao: string;
  origem: Origem;
  gravidade: Gravidade;
  /** Turno (base 1) a que a regra se refere. Sem turno, vale para o caso todo. */
  turno?: number;
  verificar: (resultado: ResultadoCaso) => Falha[];
}

// ---------------------------------------------------------------------------
// Caso
// ---------------------------------------------------------------------------

export type GrupoCaso = "apendice" | "extra" | "extra_v42";

export type Ambiente = "real" | "local";

export interface Caso {
  id: string;
  grupo: GrupoCaso;
  /** Número no Apêndice C (1 a 24) ou rótulo do caso extra. */
  rotulo: string;
  titulo: string;
  /** Os turnos contam de 1, mensagens e ações juntas; as regras usam essa numeração. */
  turnos: Turno[];
  preparo?: Preparo[];
  regras: Regra[];
  /** Onde o caso roda. Padrão: os dois. */
  ambientes?: Ambiente[];
  /**
   * Regras que o sistema ainda não cumpre por falta de construção (não por bug do
   * teste). O caso conta como reprovado para o aceite, mas o simulador local exige
   * que a falha continue exatamente onde está declarada: no dia em que o sistema
   * passar a cumprir, o teste local acusa e a lacuna sai daqui.
   */
  lacunasConhecidas?: { regra: string; motivo: string }[];
  /** Nota curta sobre como o caso é montado ou por que só roda num ambiente. */
  nota?: string;
  /**
   * Caso do fechamento da venda (PRD 11.6, exceção à pergunta única): o
   * turno indicado pode juntar as confirmações que faltam numa mensagem só.
   */
  fechamentoDaVenda?: number;
  /**
   * Caso 23: depende do agendador (pg_cron mais o gatilho de 30 minutos do
   * fluxo 3), então no ambiente real leva mais de meia hora.
   */
  demorado?: boolean;
}

// ---------------------------------------------------------------------------
// Resultado (o que os dois executores devolvem)
// ---------------------------------------------------------------------------

export type Destino = "familia" | "grupo" | "plantao";

export interface Envio {
  turno: number;
  ordem: number;
  destino: Destino;
  tipo: "texto" | "documento";
  texto: string;
  arquivo?: string;
}

export interface TransferenciaLida {
  id: string;
  motivo: string;
  destino: string;
  prioridade: string;
  status: string;
  dados: Objeto;
  resumo: string;
  criado_em: string;
}

export interface MensagemLida {
  direcao: "entrada" | "saida";
  enviado_por: string;
  tipo: string;
  conteudo: string | null;
  transcricao: string | null;
}

export interface EstadoBanco {
  conversa: {
    id: string;
    classificacao: string;
    agente_pausado_ate: string | null;
    agente_pausa_motivo: string | null;
    agente_encerrado_em: string | null;
    agente_encerrado_motivo: string | null;
    familia_id: string | null;
  } | null;
  modo: string | null;
  transferencias: TransferenciaLida[];
  mensagens: MensagemLida[];
  oportunidade: {
    estagio_p1: string | null;
    pdf_enviado_em: string | null;
    sessao_interesse_em: string | null;
    proximo_contato_em: string | null;
    qualificacao: Objeto;
  } | null;
  familia: { estado_sensivel: string; nao_contatar: boolean } | null;
  /** Quantas tarefas o sistema abriu para o comercial depois do follow-up (caso 23). */
  tarefas_followup: number;
}

export interface Plano {
  nome: string;
  gemelar: boolean;
  dias: number;
  valor: string;
  valor_centavos: number;
  parcelas: number;
  parcela_texto: string;
  valor_parcela_centavos: number;
}

/** Tudo o que as regras precisam saber do sistema, lido do banco, nunca escrito no teste. */
export interface Referencia {
  planos: Plano[];
  taxasVisiveisCentavos: number[];
  listas: {
    escassez: string[];
    promessas: string[];
    pedido_dado: string[];
    pedido_verbos: string[];
    negar_assistente: string[];
    palavras_condicao: string[];
    palavras_evitadas: string[];
  };
  /** Texto das mensagens fixas por chave, com `{nome}` e outros marcadores. */
  modelos: Record<string, string>;
  /** Status de cada mensagem_modelo (rascunho, aprovado...). Só texto aprovado chega à família. */
  statusDosModelos: Record<string, string>;
  /** Nome do arquivo da apresentação, como o sistema envia. */
  nomeDoPdf: string;
  /** Números do caso, para as regras reconhecerem o que é da família. */
  telefone: string;
  cpfEnviado: string | null;
  horariosDaEdilaine: string[];
}

export interface ResultadoTurno {
  turno: number;
  /** O que a família mandou, já em texto (legenda, transcrição ou descrição da mídia). */
  enviado: string;
  envios: Envio[];
}

export interface ResultadoCaso {
  caso: Caso;
  turnos: ResultadoTurno[];
  estado: EstadoBanco;
  /** Estado depois de cada turno, ação ou mensagem (índice 0 = depois do turno 1). */
  estadoPorTurno: EstadoBanco[];
  referencia: Referencia;
  /** Verdadeiro quando o executor sabe que o modelo de conversa rodou neste turno (só o local sabe). */
  modeloRodouPorTurno?: boolean[];
}

export interface Veredito {
  regra: Regra;
  falhas: Falha[];
}

export interface RelatorioCaso {
  caso: Caso;
  resultado: ResultadoCaso;
  vereditos: Veredito[];
  erro?: string;
}
