import "server-only";
import { exigirSessao, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio, traduzirErroBanco } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { Ficha } from "@/lib/dados/tipos";
import {
  hojeBrasilia,
  textoIdadeGestacional,
} from "../pipeline/idade-gestacional";
import { rotuloEstagio } from "../pipeline/estagios";
import { tituloEvento } from "./rotulos";
import type {
  ConversaResumoTela,
  DadosContratoTela,
  EventoTela,
  FamiliaListaTela,
  FichaTela,
  FiltroFamiliasTela,
} from "./tipos";

/**
 * Dados da ficha 360 (P16). Usa `FichaRepositorio` e `FamiliasRepositorio`
 * da fundação (`src/lib/dados`) para tudo que já existe lá (ler a ficha, a
 * linha do tempo, os dados de contrato mascarados, o freio) e acrescenta
 * aqui, dentro da pasta do módulo, o que falta: marcar "não contatar" e
 * registrar as datas de nascimento e alta.
 *
 * As três colunas (`nao_contatar`, `data_nascimento`, `data_alta`) têm
 * `grant update` direto para comercial e diretoria em `familia`
 * (`supabase/migrations/0007_permissoes.sql`, seção 5.2), sem função
 * `api.*` própria: no Supabase a escrita é o update da coluna, com RLS
 * (mesmo precedente de `src/modules/crm/pipeline/dados.ts`, P15), e o
 * gatilho de auditoria registra a mudança com o motivo oculto.
 *
 * Linha do tempo: `evento_familia` não tem insert para `authenticated`
 * ("a linha do tempo é escrita pelas funções", 0007 seção 5.2), então o
 * app não grava o evento direto. Enquanto a trilha do banco não criar a
 * função `api.*` que grava a coluna e o evento na mesma transação, o evento
 * de "não contatar" e das datas só existe na demonstração, que já simula
 * essa função (pendência em `docs/sessoes/p16-ficha.md`).
 */

export function paraFichaTela(ficha: Ficha): FichaTela {
  const hoje = hojeBrasilia();
  const familia = ficha.familia;
  return {
    familiaId: familia.id,
    nome: familia.nome,
    bairro: familia.bairro,
    cidade: familia.cidade,
    uf: familia.uf,
    estadoSensivel: familia.estadoSensivel,
    estadoSensivelEm: familia.estadoSensivelEm,
    naoContatar: familia.naoContatar,
    gemelar: familia.gemelar,
    primeiraGestacao: familia.primeiraGestacao,
    datas: [
      { rotulo: "DPP", valor: familia.dpp, tipo: "estimativa" },
      {
        rotulo: "Nascimento",
        valor: familia.dataNascimento,
        tipo: "fato",
      },
      { rotulo: "Alta", valor: familia.dataAlta, tipo: "fato" },
      { rotulo: "Início", valor: familia.dataInicioEfetivo, tipo: "fato" },
    ],
    idadeGestacional: textoIdadeGestacional(
      familia.dpp,
      hoje,
      familia.dataNascimento,
    ),
    estagioRotulo: ficha.oportunidade
      ? rotuloEstagio(
          ficha.oportunidade.pipeline,
          ficha.oportunidade.pipeline === 1
            ? (ficha.oportunidade.estagioP1 ?? "novo")
            : (ficha.oportunidade.estagioP2 ?? "proposta_enviada"),
        )
      : null,
    pipeline: ficha.oportunidade?.pipeline ?? null,
    pessoas: ficha.pessoas,
    oportunidade: ficha.oportunidade,
  };
}

export async function obterFichaTela(
  familiaId: string,
): Promise<FichaTela | null> {
  const { ficha } = await obterRepositorios();
  const bruta = await ficha.obterFicha(familiaId);
  if (!bruta) return null;
  return paraFichaTela(bruta);
}

export async function listarLinhaDoTempoTela(
  familiaId: string,
): Promise<EventoTela[]> {
  const { ficha } = await obterRepositorios();
  const eventos = await ficha.linhaDoTempo(familiaId);
  return eventos.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    titulo: tituloEvento(e),
    criadoEm: e.criadoEm,
    restrito: e.restrito,
  }));
}

export interface JustificativaPendente {
  pendente: boolean;
  /** Vencimento da tarefa ("Escreva o motivo até hoje, 18:00", P2 item 13). */
  venceEm: string | null;
}

const SEM_PENDENCIA: JustificativaPendente = { pendente: false, venceEm: null };

/**
 * Há tarefa de justificativa do freio aberta para quem está na tela?
 * `privado.acionar_freio` cria a tarefa para quem acionou sem motivo
 * (PRD 8.3); a faixa "Justificar o freio" só aparece nesse caso, e some
 * quando a justificativa conclui a tarefa. No banco a tarefa guarda
 * `payload.acao = 'justificar_freio'` (migration 0009); a demonstração usa
 * o título "Justificar o freio da ...". Falha de leitura não esconde a
 * ficha: só não mostra a faixa.
 */
export async function temJustificativaPendente(
  familiaId: string,
): Promise<JustificativaPendente> {
  try {
    const { tarefas } = await obterRepositorios();
    const abertas = await tarefas.listarTarefas({
      familiaId,
      minhas: true,
      status: ["aberta", "em_andamento"],
    });
    const tarefa = abertas.find((t) => {
      const payload = t.payload;
      const acao =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).acao
          : undefined;
      return (
        acao === "justificar_freio" ||
        t.titulo === "justificar_freio" ||
        t.titulo.startsWith("Justificar o freio")
      );
    });
    return tarefa ? { pendente: true, venceEm: tarefa.venceEm } : SEM_PENDENCIA;
  } catch {
    return SEM_PENDENCIA;
  }
}

export async function obterDadosContratoTela(
  pessoaId: string,
  completo: boolean,
): Promise<DadosContratoTela | null> {
  const { ficha } = await obterRepositorios();
  const bruto = (await ficha.dadosContrato(pessoaId, completo)) as {
    pessoa_id: string;
    completo?: boolean;
    cpf: string | null;
    data_nascimento?: string | null;
    endereco_residencial: Record<string, unknown> | null;
    preenchido_via?: string | null;
  } | null;
  if (!bruto) return null;
  return {
    pessoaId: bruto.pessoa_id,
    // A demonstração (`src/lib/dados/demonstracao/index.ts`, fora desta
    // pasta) ainda não devolve `completo` nem `preenchido_via` no jsonb;
    // o parâmetro `completo` que esta função recebeu é a fonte de verdade
    // enquanto isso não muda lá (o Supabase real já devolve os dois).
    completo: bruto.completo ?? completo,
    cpf: bruto.cpf,
    dataNascimento: bruto.data_nascimento ?? null,
    endereco: bruto.endereco_residencial,
    preenchidoVia: bruto.preenchido_via ?? null,
  };
}

/**
 * Conversa do WhatsApp da família, para a aba "Conversas" em leitura
 * (P16 item 1): a mais recente, filtrada no próprio repositório.
 */
export async function obterConversaDaFamilia(
  familiaId: string,
): Promise<ConversaResumoTela | null> {
  const { agente } = await obterRepositorios();
  const [conversa] = await agente.listarConversas({ familiaId, limite: 1 });
  if (!conversa) return null;
  const mensagens = await agente.mensagensDaConversa(conversa.id);
  return {
    conversaId: conversa.id,
    nomeContato: conversa.nomeContato,
    telefoneE164: conversa.telefoneE164,
    mensagens: mensagens.slice(-20),
  };
}

export async function listarFamiliasTela(
  filtro: FiltroFamiliasTela = {},
): Promise<FamiliaListaTela[]> {
  const { familias } = await obterRepositorios();
  const hoje = hojeBrasilia();
  const resumo = await familias.listarFamilias({ busca: filtro.busca });
  return resumo.map((f) => ({
    id: f.id,
    nome: f.nome,
    bairro: f.bairro,
    cidade: f.cidade,
    uf: f.uf,
    dpp: f.dpp,
    dataNascimento: f.dataNascimento,
    estadoSensivel: f.estadoSensivel,
    naoContatar: f.naoContatar,
    idadeGestacional: textoIdadeGestacional(f.dpp, hoje, f.dataNascimento),
  }));
}

function exigirComercialOuDiretoria(papeis: readonly string[]): void {
  if (!papeis.includes("comercial") && !papeis.includes("diretoria")) {
    throw new ErroRepositorio(
      "sem_permissao",
      "marcar não contatar e registrar datas exige comercial ou diretoria",
    );
  }
}

/** Marca ou desmarca "não contatar" com motivo (P16 item 3). Evento na
 * linha do tempo, não restrito: é dado comercial, não assistencial. */
export async function marcarNaoContatar(
  familiaId: string,
  motivo: string,
): Promise<void> {
  const sessao = await exigirSessao();
  exigirComercialOuDiretoria(sessao.papeis);
  if (!motivo.trim()) {
    throw new ErroRepositorio("recusado", "motivo de não contatar vazio");
  }
  const agora = new Date().toISOString();

  if (modoDados() === "demonstracao") {
    const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
    const loja = obterLoja();
    const familia = loja.familias.find((f) => f.id === familiaId);
    if (!familia) {
      throw new ErroRepositorio("nao_encontrado", "demonstração: família");
    }
    familia.naoContatar = true;
    loja.eventos.push({
      id: loja.proximoEvento++,
      familiaId,
      tipo: "nao_contatar",
      titulo: "Marcada para não contatar",
      restrito: false,
      criadoEm: agora,
      // O motivo fica só na família (coluna auditada com valor oculto),
      // nunca copiado no evento.
      dados: {},
    });
    return;
  }

  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("familia")
    .update({
      nao_contatar: true,
      nao_contatar_em: agora,
      nao_contatar_motivo: motivo,
    })
    .eq("id", familiaId)
    .select("id");
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "marcar não contatar");
  }
  // RLS que não deixa alterar devolve zero linhas, sem erro.
  if (!resposta.data?.length) {
    throw new ErroRepositorio("sem_permissao", "marcar não contatar");
  }
}

export async function desmarcarNaoContatar(familiaId: string): Promise<void> {
  const sessao = await exigirSessao();
  exigirComercialOuDiretoria(sessao.papeis);

  if (modoDados() === "demonstracao") {
    const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
    const loja = obterLoja();
    const familia = loja.familias.find((f) => f.id === familiaId);
    if (!familia) {
      throw new ErroRepositorio("nao_encontrado", "demonstração: família");
    }
    familia.naoContatar = false;
    loja.eventos.push({
      id: loja.proximoEvento++,
      familiaId,
      tipo: "nao_contatar",
      titulo: "Voltou a poder ser contatada",
      restrito: false,
      criadoEm: new Date().toISOString(),
      dados: {},
    });
    return;
  }

  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("familia")
    .update({
      nao_contatar: false,
      nao_contatar_em: null,
      nao_contatar_motivo: null,
    })
    .eq("id", familiaId)
    .select("id");
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "desmarcar não contatar");
  }
  // RLS que não deixa alterar devolve zero linhas, sem erro.
  if (!resposta.data?.length) {
    throw new ErroRepositorio("sem_permissao", "desmarcar não contatar");
  }
}

export type CampoDataFato = "data_nascimento" | "data_alta";

/** "aaaa-mm-dd" que existe no calendário (recusa 2026-02-31). */
export function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return (
    !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
  );
}

const TITULO_DATA_FATO: Record<CampoDataFato, string> = {
  data_nascimento: "Nascimento registrado",
  data_alta: "Alta registrada",
};

/** Registro das datas de nascimento e alta (P16 item 4). São FATO, nunca
 * calculadas: a família ou a equipe avisa quando acontece (PRD 6.10). */
export async function registrarDataFato(
  familiaId: string,
  campo: CampoDataFato,
  valor: string,
): Promise<void> {
  const sessao = await exigirSessao();
  exigirComercialOuDiretoria(sessao.papeis);
  if (!dataValida(valor)) {
    throw new ErroRepositorio("recusado", "data fora do formato esperado");
  }
  if (valor > hojeBrasilia()) {
    throw new ErroRepositorio("recusado", "data de fato no futuro");
  }

  if (modoDados() === "demonstracao") {
    const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
    const loja = obterLoja();
    const familia = loja.familias.find((f) => f.id === familiaId);
    if (!familia) {
      throw new ErroRepositorio("nao_encontrado", "demonstração: família");
    }
    if (campo === "data_nascimento") familia.dataNascimento = valor;
    else familia.dataAlta = valor;
    loja.eventos.push({
      id: loja.proximoEvento++,
      familiaId,
      tipo: campo,
      titulo: TITULO_DATA_FATO[campo],
      restrito: false,
      criadoEm: new Date().toISOString(),
      dados: { valor },
    });
    return;
  }

  const cliente = await criarClienteServidor();
  const atualizacao =
    campo === "data_nascimento"
      ? { data_nascimento: valor }
      : { data_alta: valor };
  const resposta = await cliente
    .from("familia")
    .update(atualizacao)
    .eq("id", familiaId)
    .select("id");
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "registrar data");
  }
  // RLS que não deixa alterar devolve zero linhas, sem erro.
  if (!resposta.data?.length) {
    throw new ErroRepositorio("sem_permissao", "registrar data");
  }
}

/**
 * Quantos segundos o "Desfazer" vale depois deste acionamento (PRD 8.3).
 * A fonte é o próprio banco: `privado.acionar_freio` devolve `desfazer_ate`
 * (agora + `parametro.freio_desfazer_segundos`, só para usuário do app).
 * Isso importa porque `parametro` só é legível pela diretoria (RLS, 0007):
 * o comercial, que é quem mais aciona, não consegue ler o parâmetro.
 *
 * A demonstração devolve o mesmo campo, calculado do parâmetro da loja em
 * memória. Sem ele, 0 (sem "Desfazer").
 */
export async function prazoDesfazerSegundos(
  resposta: unknown,
  agora: number = Date.now(),
): Promise<number> {
  const desfazerAte =
    resposta && typeof resposta === "object" && !Array.isArray(resposta)
      ? (resposta as Record<string, unknown>).desfazer_ate
      : undefined;
  if (typeof desfazerAte === "string") {
    const fim = Date.parse(desfazerAte);
    return Number.isNaN(fim)
      ? 0
      : Math.max(0, Math.floor((fim - agora) / 1000));
  }
  return 0;
}

/** Prazo do "Desfazer" do freio (`parametro.freio_desfazer_segundos`,
 * PRD 8.3). Nunca fixo no código; 0 quando o parâmetro falta ou é inválido,
 * e 0 quer dizer "sem Desfazer" (mesma leitura de `privado.acionar_freio`,
 * migration 0009). */
export async function obterFreioDesfazerSegundos(): Promise<number> {
  const { configuracoes } = await obterRepositorios();
  const parametro = await configuracoes.lerParametro("freio_desfazer_segundos");
  const valor = parametro?.valor;
  return typeof valor === "number" && valor > 0 ? Math.floor(valor) : 0;
}

/** Sessão atual só para decidir o que a tela mostra (não é checagem de
 * segurança: quem barra de verdade é `exigirSessao`/a RLS). */
export async function obterPapeisSessao(): Promise<readonly string[]> {
  const sessao = await obterSessao();
  return sessao?.papeis ?? [];
}
