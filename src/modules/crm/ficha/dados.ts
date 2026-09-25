import "server-only";
import { exigirSessao, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio, traduzirErroBanco } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { EstadoSensivel, Ficha } from "@/lib/dados/tipos";
import {
  hojeBrasilia,
  textoIdadeGestacional,
} from "../pipeline/idade-gestacional";
import { rotuloEstagio } from "../pipeline/estagios";
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
 * `api.*` própria: a escrita aqui segue o mesmo precedente que
 * `src/modules/crm/pipeline/dados.ts` (P15) usou para `motivo_perda` e o
 * cadastro manual de lead. No modo demonstração é a mesma escrita na loja
 * em memória que `criarRepositoriosDemonstracao` usa para o resto da
 * família.
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
    idadeGestacional: textoIdadeGestacional(familia.dpp, hoje),
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
    titulo: e.titulo,
    criadoEm: e.criadoEm,
    restrito: e.restrito,
  }));
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
 * (P16 item 1). `FiltroConversas` (fundação) não filtra por família, então
 * este módulo lista e procura aqui: mesmo padrão de "filtra por cima" que
 * `listarPipelineTela` (P15) usa para "minhas oportunidades" e semanas.
 */
export async function obterConversaDaFamilia(
  familiaId: string,
): Promise<ConversaResumoTela | null> {
  const { agente } = await obterRepositorios();
  const conversas = await agente.listarConversas({ limite: 500 });
  const conversa = conversas.find((c) => c.familiaId === familiaId);
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
    idadeGestacional: textoIdadeGestacional(f.dpp, hoje),
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
      dados: { motivo },
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
    .eq("id", familiaId);
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "marcar não contatar");
  }
  const evento = await cliente.from("evento_familia").insert({
    familia_id: familiaId,
    tipo: "nao_contatar",
    titulo: "Marcada para não contatar",
    restrito: false,
    dados: { motivo },
  });
  if (evento.error) {
    throw traduzirErroBanco(evento.error, "registrar evento de não contatar");
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
    .eq("id", familiaId);
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "desmarcar não contatar");
  }
  const evento = await cliente.from("evento_familia").insert({
    familia_id: familiaId,
    tipo: "nao_contatar",
    titulo: "Voltou a poder ser contatada",
    restrito: false,
    dados: {},
  });
  if (evento.error) {
    throw traduzirErroBanco(evento.error, "registrar evento de não contatar");
  }
}

export type CampoDataFato = "data_nascimento" | "data_alta";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErroRepositorio("recusado", "data fora do formato esperado");
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
    .eq("id", familiaId);
  if (resposta.error) {
    throw traduzirErroBanco(resposta.error, "registrar data");
  }
  const evento = await cliente.from("evento_familia").insert({
    familia_id: familiaId,
    tipo: campo,
    titulo: TITULO_DATA_FATO[campo],
    restrito: false,
    dados: { valor },
  });
  if (evento.error) {
    throw traduzirErroBanco(evento.error, "registrar evento da data");
  }
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

export const ROTULO_ESTADO_SENSIVEL: Record<EstadoSensivel, string> = {
  normal: "Normal",
  atencao: "Atenção",
  bloqueio_total: "Bloqueio total",
  encerrado_sensivel: "Encerrado sensível",
};

export const EFEITO_ESTADO_SENSIVEL: Record<EstadoSensivel, string> = {
  normal: "Operação normal. Todas as réguas voltam a funcionar.",
  atencao:
    "Réguas de conteúdo e marketing pausadas. A comunicação operacional continua. A Isadora só acolhe e encaminha, não vende.",
  bloqueio_total:
    "Toda automação que fala com a família fica congelada. A Isadora fica desativada para esta família. Só contato humano e pelo nome.",
  encerrado_sensivel:
    "A família sai de pesquisa, indicação, remarketing e qualquer régua futura, para sempre.",
};
