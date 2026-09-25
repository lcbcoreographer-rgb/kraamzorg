import "server-only";
import { exigeMfa } from "@/lib/auth/papeis";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio, traduzirErroBanco } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";
import type { ClassificacaoContato, EnviadoPor } from "@/lib/dados/tipos";
import { obterLoja } from "@/lib/dados/demonstracao/loja";
import { obterLojaExtra, configuracaoDaLoja } from "./loja-extra";
import type {
  ClassificacaoNaoLead,
  ConfiguracaoAgente,
  ItemBaseConhecimento,
  MetricasAgente,
  ModoAgente,
  PedidoItemBaseConhecimento,
  RegraRetomada,
  UltimaIngestao,
} from "./tipos";

/**
 * O que este módulo (P27) acrescenta aos repositórios da fundação
 * (`src/lib/dados`), sem editar as interfaces nem as duas implementações de
 * lá (fora das pastas deste módulo, ver retorno da sessão). Segue a mesma
 * regra de sempre: a tela nunca sabe se está lendo do Supabase ou da
 * demonstração, e escrita relevante passa por função do schema `api`.
 *
 * O que já é possível hoje contra o banco real (grants do P07,
 * `0007_permissoes.sql`):
 * - `parametro`: leitura e escrita diretas, só diretoria (RLS). Cobre modo
 *   do agente, números de teste e a janela de retomada.
 * - `conversa.classificacao`: escrita direta concedida a authenticated
 *   (comercial, coordenação, diretoria). Cobre "marcar como não lead".
 *
 * O que depende das migrations 0012 a 0014 (trilha do banco, em andamento
 * agora, PROMPTS.md P21/P22) e por isso usa `rpcPendente` (devolve
 * `funcao_pendente` até a função existir, nunca falha em silêncio):
 * - Pausa e retomada do agente numa conversa (`agente_pausado_ate`,
 *   `agente_encerrado_em`): a coluna não é gravável direto por
 *   `authenticated` (comentário do grant em 0007: "a pausa e o modo do
 *   agente mudam só por função privado.retomar_agente, P22"). Funções
 *   esperadas: `api.pausar_conversa(conversa_id, motivo)`,
 *   `api.retomar_pausa_conversa(conversa_id)`,
 *   `api.retomar_agente(conversa_id)` (P22 item 4).
 * - "Marcar como resolvida" com desfecho: `handoff.status` e
 *   `resolvido_em` já são graváveis direto, mas não existe coluna para o
 *   desfecho ("formulário enviado" etc.) nem grant em `dados` (jsonb).
 *   Função esperada: `api.resolver_transferencia(handoff_id, desfecho)`.
 * - Base de conhecimento: `agente.base_conhecimento` mora no schema
 *   `agente`, que o PostgREST nunca expõe (PRD 5.2). Funções esperadas:
 *   `api.base_conhecimento_listar()`, `api.base_conhecimento_salvar(...)`,
 *   `api.base_conhecimento_aprovar(id)`.
 * - Métricas do 11.12: função esperada `api.metricas_agente(desde, ate)`
 *   (consultas documentadas em `metricas/dados.ts`).
 */

/** Diretoria exige AAL2 nas políticas do banco (PRD 13, 21.2); confere os
 * dois aqui, para a tela dar a mensagem certa em vez do banco recusar sem
 * explicação. */
function exigirDiretoria(
  sessao: { papeis: readonly string[]; aal: string } | null,
): void {
  if (!sessao || !sessao.papeis.includes("diretoria")) {
    throw new ErroRepositorio(
      "sem_permissao",
      "só a diretoria altera esta regra",
    );
  }
  if (exigeMfa(sessao.papeis as never) && sessao.aal !== "aal2") {
    throw new ErroRepositorio(
      "sem_permissao",
      "confirme o código do aplicativo (MFA)",
    );
  }
}

async function nomeDeQuemPede(): Promise<string> {
  const sessao = await obterSessao();
  return sessao?.nome ?? "Alguém da equipe";
}

function horaCurta(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);
}

// --- Modo do agente e números de teste (item 3) -----------------------------

export async function obterConfiguracaoAgente(): Promise<ConfiguracaoAgente> {
  if (modoDados() === "demonstracao") {
    return configuracaoDaLoja(obterLojaExtra());
  }
  const { configuracoes } = await obterRepositorios();
  const [modo, whitelist] = await Promise.all([
    configuracoes.lerParametro("agente_modo"),
    configuracoes.lerParametro("agente_whitelist"),
  ]);
  const modoValor =
    typeof modo?.valor === "string" ? (modo.valor as ModoAgente) : "desligado";
  const numeros = Array.isArray(whitelist?.valor)
    ? (whitelist.valor as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  return {
    modo: modoValor,
    numerosTeste: numeros,
    atualizadoEm: modo?.atualizadoEm ?? null,
  };
}

async function salvarParametro(chave: string, valor: unknown): Promise<string> {
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("parametro")
    .update({ valor: valor as never })
    .eq("chave", chave)
    .select("atualizado_em")
    .maybeSingle();
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, `parâmetro ${chave}`);
  }
  return resposta.data?.atualizado_em ?? new Date().toISOString();
}

export interface PedidoConfiguracaoAgente {
  modo: ModoAgente;
  numerosTeste: string[];
}

/** Diretoria altera o modo e a lista de teste (PRD 11.3, 11.7). */
export async function salvarConfiguracaoAgente(
  pedido: PedidoConfiguracaoAgente,
): Promise<ConfiguracaoAgente> {
  const sessao = await obterSessao();
  exigirDiretoria(sessao);

  if (modoDados() === "demonstracao") {
    const l = obterLojaExtra();
    l.modo = pedido.modo;
    l.numerosTeste = [...pedido.numerosTeste];
    l.configAtualizadaEm = new Date().toISOString();
    return configuracaoDaLoja(l);
  }

  const [em] = await Promise.all([
    salvarParametro("agente_modo", pedido.modo),
    salvarParametro("agente_whitelist", pedido.numerosTeste),
  ]);
  return {
    modo: pedido.modo,
    numerosTeste: pedido.numerosTeste,
    atualizadoEm: em,
  };
}

// --- Regra de retomada (item 1, PRD 11.3, telas.md C6) ----------------------

export async function obterRegraRetomada(): Promise<RegraRetomada> {
  if (modoDados() === "demonstracao") {
    const l = obterLojaExtra();
    return { horas: l.followupHoras, atualizadoEm: l.followupAtualizadoEm };
  }
  const { configuracoes } = await obterRepositorios();
  const parametro = await configuracoes.lerParametro("agente_followup_horas");
  // Sem valor inventado: fora da diretoria a RLS de `parametro` devolve
  // nada, e a tela diz que a janela é da diretoria em vez de mostrar um
  // número que pode não ser o do banco.
  const horas = typeof parametro?.valor === "number" ? parametro.valor : null;
  return { horas, atualizadoEm: parametro?.atualizadoEm ?? null };
}

/** Só a diretoria (protótipo `comercial-agente-regras.html`). Mínimo 24h (PRD 11.3). */
export async function salvarRegraRetomada(
  horas: number,
): Promise<RegraRetomada> {
  const sessao = await obterSessao();
  exigirDiretoria(sessao);
  if (!Number.isFinite(horas) || horas < 24) {
    throw new ErroRepositorio(
      "recusado",
      "a janela mínima de retomada é 24 horas",
    );
  }

  if (modoDados() === "demonstracao") {
    const l = obterLojaExtra();
    l.followupHoras = horas;
    l.followupAtualizadoEm = new Date().toISOString();
    return { horas, atualizadoEm: l.followupAtualizadoEm };
  }
  const em = await salvarParametro("agente_followup_horas", horas);
  return { horas, atualizadoEm: em };
}

// --- Marcar como não lead (funcional hoje: classificacao é gravável) -------

export async function marcarNaoLead(
  conversaId: string,
  classificacao: ClassificacaoNaoLead,
): Promise<void> {
  await obterSessao();
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === conversaId);
    if (!conversa) {
      throw new ErroRepositorio("nao_encontrado", "demonstração: conversa");
    }
    conversa.classificacao = classificacao as ClassificacaoContato;
    return;
  }
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("conversa")
    .update({ classificacao })
    .eq("id", conversaId)
    .select("id")
    .maybeSingle();
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "marcar não lead");
  }
  if (!resposta.data) {
    throw new ErroRepositorio("nao_encontrado", "conversa");
  }
}

// --- Pausa e retomada do agente numa conversa (pendente, ver cabeçalho) ----

/**
 * `agente_pausa_humano_horas` (PRD 11.3, 6.8): por quanto tempo a Isadora
 * fica calada depois que alguém da equipe assume ou pausa. Só a diretoria
 * lê `parametro` pela RLS; para os demais papéis devolve null e a tela fala
 * da pausa sem citar horas.
 */
export async function obterHorasPausaHumano(): Promise<number | null> {
  const { configuracoes } = await obterRepositorios();
  const parametro = await configuracoes.lerParametro(
    "agente_pausa_humano_horas",
  );
  return typeof parametro?.valor === "number" && parametro.valor > 0
    ? parametro.valor
    : null;
}

export async function pausarConversa(
  conversaId: string,
  origem: "assumir" | "pausar",
): Promise<void> {
  const nome = await nomeDeQuemPede();
  const agora = new Date();
  const motivo =
    origem === "assumir"
      ? `Conversa assumida por ${nome} às ${horaCurta(agora)}.`
      : `Pausada por ${nome} às ${horaCurta(agora)}.`;

  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === conversaId);
    if (!conversa)
      throw new ErroRepositorio("nao_encontrado", "demonstração: conversa");
    // Duração da pausa vem de `parametro` (PRD 11.3), nunca do código. No
    // banco real quem decide é a função `api.pausar_conversa` (security
    // definer, lê o parâmetro seja qual for o papel); a demonstração faz o
    // mesmo lendo da loja, sem a RLS de leitura de `parametro`.
    const valor = l.parametros.find(
      (p) => p.chave === "agente_pausa_humano_horas",
    )?.valor;
    const horas = typeof valor === "number" && valor > 0 ? valor : null;
    if (horas === null) {
      throw new ErroRepositorio(
        "indisponivel",
        "demonstração: agente_pausa_humano_horas ausente",
      );
    }
    conversa.agentePausadoAte = new Date(
      agora.getTime() + horas * 60 * 60_000,
    ).toISOString();
    obterLojaExtra().pausaMotivo[conversaId] = motivo;
    return;
  }

  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "pausar_conversa", {
    conversa_id: conversaId,
    motivo,
  });
}

/** "Devolver agora" de uma pausa manual (lead ainda não qualificado). */
export async function retomarPausaManual(conversaId: string): Promise<void> {
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === conversaId);
    if (!conversa)
      throw new ErroRepositorio("nao_encontrado", "demonstração: conversa");
    conversa.agentePausadoAte = null;
    delete obterLojaExtra().pausaMotivo[conversaId];
    return;
  }
  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "retomar_pausa_conversa", {
    conversa_id: conversaId,
  });
}

/**
 * "Devolver à Isadora" (P22 item 4, PRD 11.7 D-17): só para conversa em
 * `humano_comercial` (`agenteEncerradoEm` preenchido). Chama
 * `privado.retomar_agente` por `api.retomar_agente`.
 */
export async function retomarAgenteComercial(
  conversaId: string,
): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroRepositorio("sem_permissao", "sem sessão");

  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === conversaId);
    if (!conversa)
      throw new ErroRepositorio("nao_encontrado", "demonstração: conversa");
    if (!conversa.agenteEncerradoEm) {
      // Mesma recusa que `privado.retomar_agente` faz: só sai de
      // `humano_comercial` quem está nele.
      throw new ErroRepositorio(
        "recusado",
        "demonstração: conversa não está em humano_comercial",
      );
    }
    const agora = new Date();
    conversa.agenteEncerradoEm = null;
    conversa.agenteEncerradoMotivo = null;
    // "grava no log" (PROMPTS.md P27, aceite): na demonstração, o evento da
    // linha do tempo da família e o aviso do sistema no meio da conversa
    // (fluxos.md, fluxo E, "eventos do sistema no meio"). No banco real,
    // quem grava é `privado.retomar_agente`.
    const texto = `${sessao.nome} devolveu a conversa à Isadora às ${horaCurta(agora)}.`;
    l.mensagens.push({
      id: crypto.randomUUID(),
      conversaId,
      direcao: "saida",
      enviadoPor: "sistema",
      tipo: "sistema",
      conteudo: texto,
      enviadaEm: agora.toISOString(),
    });
    if (conversa.familiaId) {
      l.eventos.push({
        id: l.proximoEvento++,
        familiaId: conversa.familiaId,
        tipo: "agente_retomado",
        titulo: "Conversa devolvida à Isadora",
        restrito: false,
        criadoEm: agora.toISOString(),
        dados: {},
      });
    }
    return;
  }
  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "retomar_agente", { conversa_id: conversaId });
}

export function pausaMotivoDemonstracao(conversaId: string): string | null {
  if (modoDados() !== "demonstracao") return null;
  return obterLojaExtra().pausaMotivo[conversaId] ?? null;
}

/**
 * `agente_pausa_motivo` para uma lista de conversas (a leitura de `conversa`
 * é liberada por inteiro a `authenticated`, PRD 13; só a escrita dessa
 * coluna é que depende da função pendente). `ResumoConversa` não expõe esta
 * coluna porque é só desta tela (mostrar "por Otávio Lemos às 15:28").
 */
export async function pausaMotivosReais(
  conversaIds: string[],
): Promise<Record<string, string | null>> {
  if (conversaIds.length === 0) return {};
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("conversa")
    .select("id, agente_pausa_motivo")
    .in("id", conversaIds);
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "pausa das conversas");
  }
  return Object.fromEntries(
    resposta.data.map((linha) => [linha.id, linha.agente_pausa_motivo]),
  );
}

/**
 * Motivo da pausa e última mensagem de várias conversas numa consulta só
 * (lista `/conversas`), em vez de ler o histórico inteiro de cada conversa:
 * o PostgREST limita a mensagem embutida a uma por conversa
 * (`referencedTable`). Só no Supabase real; a demonstração lê da loja.
 */
export async function resumoConversasReais(conversaIds: string[]): Promise<
  Record<
    string,
    {
      pausaMotivo: string | null;
      ultima: { conteudo: string | null; enviadoPor: EnviadoPor } | null;
    }
  >
> {
  if (conversaIds.length === 0) return {};
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("conversa")
    .select(
      "id, agente_pausa_motivo, mensagem ( conteudo, enviado_por, enviada_em )",
    )
    .in("id", conversaIds)
    .order("enviada_em", { referencedTable: "mensagem", ascending: false })
    .limit(1, { referencedTable: "mensagem" });
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "resumo das conversas");
  }
  return Object.fromEntries(
    resposta.data.map((linha) => {
      const ultima = linha.mensagem?.[0] ?? null;
      return [
        linha.id,
        {
          pausaMotivo: linha.agente_pausa_motivo,
          ultima: ultima
            ? { conteudo: ultima.conteudo, enviadoPor: ultima.enviado_por }
            : null,
        },
      ];
    }),
  );
}

export interface EstadoAgenteConversa {
  agentePausadoAte: string | null;
  agenteEncerradoEm: string | null;
}

/**
 * Pausa e modo de cada conversa com transferência na fila, para a fila
 * mostrar em vermelho a transferência aberta cuja pausa já venceu (PRD
 * 11.7, modo `pausado`: "o CRM mostra em vermelho e a Isadora volta a
 * responder").
 */
export async function estadoAgentePorConversa(
  conversaIds: string[],
): Promise<Record<string, EstadoAgenteConversa>> {
  if (conversaIds.length === 0) return {};
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    return Object.fromEntries(
      l.conversas
        .filter((c) => conversaIds.includes(c.id))
        .map((c) => [
          c.id,
          {
            agentePausadoAte: c.agentePausadoAte,
            agenteEncerradoEm: c.agenteEncerradoEm,
          },
        ]),
    );
  }
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("conversa")
    .select("id, agente_pausado_ate, agente_encerrado_em")
    .in("id", conversaIds);
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "estado do agente nas conversas");
  }
  return Object.fromEntries(
    resposta.data.map((linha) => [
      linha.id,
      {
        agentePausadoAte: linha.agente_pausado_ate,
        agenteEncerradoEm: linha.agente_encerrado_em,
      },
    ]),
  );
}

// --- Resolver transferência com desfecho (pendente, ver cabeçalho) ---------

export async function resolverTransferencia(
  transferenciaId: string,
  desfecho: string,
): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroRepositorio("sem_permissao", "sem sessão");

  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const transferencia = l.transferencias.find(
      (t) => t.id === transferenciaId,
    );
    if (!transferencia) {
      throw new ErroRepositorio(
        "nao_encontrado",
        "demonstração: transferência",
      );
    }
    if (transferencia.status === "resolvido") {
      throw new ErroRepositorio("recusado", "demonstração: já resolvida");
    }
    transferencia.status = "resolvido";
    obterLojaExtra().desfecho[transferenciaId] = desfecho;
    return;
  }

  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "resolver_transferencia", {
    handoff_id: transferenciaId,
    desfecho,
  });
}

export function desfechoDemonstracao(transferenciaId: string): string | null {
  if (modoDados() !== "demonstracao") return null;
  return obterLojaExtra().desfecho[transferenciaId] ?? null;
}

export function notificacaoOkDemonstracao(
  transferenciaId: string,
): boolean | null {
  if (modoDados() !== "demonstracao") return null;
  const registrada = obterLojaExtra().notificacaoOk[transferenciaId];
  return registrada === undefined ? null : registrada;
}

/** "Reenviar aviso" quando a faixa vermelha aparece (PRD 22.2, protótipo C1). */
export async function reenviarNotificacaoHandoff(
  transferenciaId: string,
): Promise<void> {
  if (modoDados() === "demonstracao") {
    obterLojaExtra().notificacaoOk[transferenciaId] = true;
    return;
  }
  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "reenviar_notificacao_handoff", {
    handoff_id: transferenciaId,
  });
}

// --- Base de conhecimento (item 4, pendente, ver cabeçalho) -----------------

export async function listarBaseConhecimento(): Promise<
  ItemBaseConhecimento[]
> {
  if (modoDados() === "demonstracao") {
    return obterLojaExtra().baseConhecimento.map((item) => ({ ...item }));
  }
  const cliente = await criarClienteServidor();
  const resposta = (await rpcPendente(
    cliente,
    "base_conhecimento_listar",
    {},
  )) as unknown;
  return Array.isArray(resposta) ? (resposta as ItemBaseConhecimento[]) : [];
}

export async function salvarItemBaseConhecimento(
  pedido: PedidoItemBaseConhecimento,
): Promise<ItemBaseConhecimento> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroRepositorio("sem_permissao", "sem sessão");

  if (modoDados() === "demonstracao") {
    const l = obterLojaExtra();
    const agora = new Date().toISOString();
    if (pedido.id) {
      const item = l.baseConhecimento.find((i) => i.id === pedido.id);
      if (!item)
        throw new ErroRepositorio("nao_encontrado", "demonstração: item");
      item.tipo = pedido.tipo;
      item.titulo = pedido.titulo;
      item.texto = pedido.texto;
      item.fonte = pedido.fonte ?? null;
      item.atualizadoEm = agora;
      return { ...item };
    }
    const novo: ItemBaseConhecimento = {
      id: crypto.randomUUID(),
      tipo: pedido.tipo,
      titulo: pedido.titulo,
      texto: pedido.texto,
      fonte: pedido.fonte ?? null,
      status: "rascunho",
      aprovadoPor: null,
      aprovadoEm: null,
      atualizadoEm: agora,
    };
    l.baseConhecimento.unshift(novo);
    return { ...novo };
  }

  const cliente = await criarClienteServidor();
  const resposta = (await rpcPendente(cliente, "base_conhecimento_salvar", {
    id: pedido.id ?? null,
    tipo: pedido.tipo,
    titulo: pedido.titulo,
    texto: pedido.texto,
    fonte: pedido.fonte ?? null,
  })) as unknown;
  return resposta as ItemBaseConhecimento;
}

/** Aprovação só da diretoria (PRD 13: "aprovação pelo Leonardo"). */
export async function aprovarItemBaseConhecimento(id: string): Promise<void> {
  const sessao = await obterSessao();
  exigirDiretoria(sessao);

  if (modoDados() === "demonstracao") {
    const l = obterLojaExtra();
    const item = l.baseConhecimento.find((i) => i.id === id);
    if (!item)
      throw new ErroRepositorio("nao_encontrado", "demonstração: item");
    item.status = "aprovado";
    item.aprovadoPor = sessao?.nome ?? null;
    item.aprovadoEm = new Date().toISOString();
    return;
  }
  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "base_conhecimento_aprovar", { id });
}

export async function obterUltimaIngestao(): Promise<UltimaIngestao | null> {
  if (modoDados() === "demonstracao") {
    return obterLojaExtra().ultimaIngestao;
  }
  try {
    const cliente = await criarClienteServidor();
    const resposta = (await rpcPendente(
      cliente,
      "ultima_ingestao_base",
      {},
    )) as unknown;
    return (resposta as UltimaIngestao) ?? null;
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "funcao_pendente")
      return null;
    throw erro;
  }
}

// --- Métricas (item 5, PRD 11.12, pendente, ver cabeçalho e metricas/dados.ts) --

export async function obterMetricas(
  desde: string,
  ate: string,
): Promise<MetricasAgente> {
  if (modoDados() === "demonstracao") {
    return metricasDemonstracao(desde, ate);
  }
  const cliente = await criarClienteServidor();
  const resposta = (await rpcPendente(cliente, "metricas_agente", {
    desde,
    ate,
  })) as unknown;
  return resposta as MetricasAgente;
}

function metricasDemonstracao(desde: string, ate: string): MetricasAgente {
  const l = obterLoja();
  const leads = l.conversas.filter((c) =>
    ["lead", "cliente", "nao_classificado"].includes(c.classificacao),
  );
  const comMensagemDaFamilia = leads.filter((c) =>
    l.mensagens.some((m) => m.conversaId === c.id && m.direcao === "entrada"),
  );
  const oportunidadesQualificadas = l.oportunidades.filter(
    (o) => o.estagioP1 && o.estagioP1 !== "novo",
  );
  const comPdf = oportunidadesQualificadas.filter((o) => o.pdfEnviadoEm);
  const sessoesRealizadas = l.oportunidades.filter(
    (o) => o.estagioP1 === "sessao_venda_realizada",
  );
  const ganhos = l.oportunidades.filter(
    (o) => o.estagioP2 && o.estagioP2 !== "perdido",
  );

  const pct = (parte: number, total: number): number | null =>
    total === 0 ? null : Math.round((parte / total) * 1000) / 10;

  return {
    periodoDesde: desde,
    periodoAte: ate,
    tempoPrimeiraRespostaMinutos: 3,
    leadsQueRespondemPct: pct(comMensagemDaFamilia.length, leads.length),
    qualificadosComValorEPdfPct: pct(
      comPdf.length,
      oportunidadesQualificadas.length,
    ),
    conversasComEdilaineRegistradasPct: pct(
      sessoesRealizadas.length,
      oportunidadesQualificadas.length,
    ),
    followupAposPdfPct: pct(Math.min(1, comPdf.length), comPdf.length),
    conversaoLeadsPct: pct(ganhos.length, l.oportunidades.length),
    condicoesForaDaTabela: 0,
    leadsTotal: leads.length,
  };
}
