import "server-only";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio, traduzirErroBanco } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type {
  CartaoOportunidade,
  MotivoPerda,
  NumeroPipeline,
} from "@/lib/dados/tipos";
import { normalizarTelefoneBr } from "../deduplicacao/normalizar";
import {
  hojeBrasilia,
  haQuantoTempo,
  textoIdadeGestacional,
} from "./idade-gestacional";
import { ROTULO_MOTIVO_PERDA } from "./estagios";
import type {
  CartaoPipelineTela,
  FiltroPipelineTela,
  PedidoLeadManual,
  PedidoPerda,
} from "./tipos";

/**
 * Dados do pipeline (P15) e o que P17 precisa gravar (motivo e detalhe da
 * perda). Usa os repositórios da fundação (`src/lib/dados`) para tudo que
 * já existe lá (listar, contar, transicionar) e acrescenta aqui, dentro da
 * pasta do módulo, o que falta: motivo/detalhe da perda e o cadastro manual
 * de lead, sem função `api.*` própria ainda (0012 a 0014 são de outra
 * trilha). No Supabase isto é insert direto em `familia`, `pessoa` e
 * `oportunidade`, que o grant e a RLS do comercial e da diretoria já
 * permitem (0007_permissoes.sql); no modo demonstração é a mesma escrita
 * na loja em memória que `criarRepositoriosDemonstracao` usa.
 */

/** Só para o texto de confirmação da perda no modo demonstração: a loja não
 * tem coluna própria para o detalhe (o tipo é da fundação). Perdido no
 * reinício do processo, como o resto da loja de demonstração. */
const detalhesPerdaDemo = new Map<string, string>();

export function detalhePerdaDemo(oportunidadeId: string): string | undefined {
  return detalhesPerdaDemo.get(oportunidadeId);
}

/** Só para testes: volta este mapa auxiliar ao estado vazio, junto de
 * `reiniciarLoja` (src/lib/dados/demonstracao/loja.ts). */
export function reiniciarDetalhesPerdaDemoParaTestes(): void {
  detalhesPerdaDemo.clear();
}

export async function listarPipelineTela(
  filtro: FiltroPipelineTela,
): Promise<CartaoPipelineTela[]> {
  const [{ familias }, sessao] = await Promise.all([
    obterRepositorios(),
    obterSessao(),
  ]);
  const cartoes = await familias.listarPipeline({
    pipeline: filtro.pipeline,
    estagio: filtro.estagio,
    regiaoId: filtro.regiaoId,
    classificacao: filtro.classificacao,
    busca: filtro.busca,
  });
  const hoje = hojeBrasilia();

  return cartoes
    .filter((c) => !filtro.minhas || c.responsavelId === sessao?.usuarioId)
    .filter((c) => {
      if (filtro.semanasMin === undefined && filtro.semanasMax === undefined)
        return true;
      const ig = textoIdadeGestacional(c.dpp, hoje);
      const semanas = ig ? Number(ig.split("s")[0]) : null;
      if (semanas === null) return false;
      if (filtro.semanasMin !== undefined && semanas < filtro.semanasMin)
        return false;
      if (filtro.semanasMax !== undefined && semanas > filtro.semanasMax)
        return false;
      return true;
    })
    .map((c) => paraCartaoTela(c, hoje));
}

function paraCartaoTela(
  cartao: CartaoOportunidade,
  hoje: string,
): CartaoPipelineTela {
  return {
    ...cartao,
    idadeGestacional: textoIdadeGestacional(cartao.dpp, hoje),
    tempoNoEstagio: haQuantoTempo(cartao.atualizadoEm),
  };
}

export async function contarPorEstagioTela(pipeline: NumeroPipeline) {
  const { familias } = await obterRepositorios();
  return familias.contarPorEstagio(pipeline);
}

export async function transicionarEstagio(pedido: {
  oportunidadeId: string;
  pipeline: NumeroPipeline;
  para: string;
  motivo?: string;
}): Promise<void> {
  const { familias } = await obterRepositorios();
  await familias.transicionar({
    maquina: pedido.pipeline === 1 ? "p1" : "p2",
    entidadeId: pedido.oportunidadeId,
    para: pedido.para,
    motivo: pedido.motivo,
  });
}

/**
 * Grava `motivo_perda` e `motivo_perda_detalhe` (colunas soltas, fora da
 * máquina de estado) e só depois chama `privado.transicionar` para
 * `perdido` (P15 item 2). A ordem importa: se a transição corresse antes,
 * uma leitura no meio do caminho veria "perdido" sem motivo nenhum.
 */
export async function marcarPerdido(pedido: PedidoPerda): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroRepositorio("sem_permissao", "sem sessão");
  const detalhe = pedido.detalhe?.trim() || undefined;

  if (modoDados() === "demonstracao") {
    const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
    const loja = obterLoja();
    const oportunidade = loja.oportunidades.find(
      (o) => o.id === pedido.oportunidadeId,
    );
    if (!oportunidade) {
      throw new ErroRepositorio(
        "nao_encontrado",
        "demonstração: oportunidade inexistente",
      );
    }
    oportunidade.motivoPerda = pedido.motivo;
    if (detalhe) detalhesPerdaDemo.set(pedido.oportunidadeId, detalhe);
    else detalhesPerdaDemo.delete(pedido.oportunidadeId);
  } else {
    const cliente = await criarClienteServidor();
    const resposta = await cliente
      .from("oportunidade")
      .update({
        motivo_perda: pedido.motivo,
        motivo_perda_detalhe: detalhe ?? null,
      })
      .eq("id", pedido.oportunidadeId);
    if (resposta.error) {
      throw traduzirErroBanco(resposta.error, "gravar motivo da perda");
    }
  }

  await transicionarEstagio({
    oportunidadeId: pedido.oportunidadeId,
    pipeline: pedido.pipeline,
    para: "perdido",
    motivo: motivoLivreDaPerda(pedido),
  });
}

/** Texto livre gravado no evento e na auditoria da transição (PRD 7: a
 * função `transicionar` grava `motivo` como texto, à parte de
 * `motivo_perda`/`motivo_perda_detalhe`, que já foram gravados acima). */
function motivoLivreDaPerda(pedido: PedidoPerda): string {
  const rotulo = ROTULO_MOTIVO_PERDA[pedido.motivo as MotivoPerda];
  return pedido.detalhe?.trim()
    ? `${rotulo}: ${pedido.detalhe.trim()}`
    : rotulo;
}

export async function criarLeadManual(
  pedido: PedidoLeadManual,
): Promise<{ familiaId: string; oportunidadeId: string }> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroRepositorio("sem_permissao", "sem sessão");
  if (
    !sessao.papeis.includes("comercial") &&
    !sessao.papeis.includes("diretoria")
  ) {
    throw new ErroRepositorio(
      "sem_permissao",
      "cadastro manual de lead exige comercial ou diretoria",
    );
  }
  const telefone = normalizarTelefoneBr(pedido.telefoneE164);
  if (!telefone) {
    throw new ErroRepositorio("recusado", "telefone fora do formato esperado");
  }

  if (modoDados() === "demonstracao") {
    return criarLeadManualDemonstracao(pedido, telefone, sessao.usuarioId);
  }
  return criarLeadManualSupabase(pedido, telefone, sessao.usuarioId);
}

async function criarLeadManualDemonstracao(
  pedido: PedidoLeadManual,
  telefone: string,
  usuarioId: string,
): Promise<{ familiaId: string; oportunidadeId: string }> {
  const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
  const { CIDADES, REGIOES } =
    await import("@/lib/dados/demonstracao/fixtures");
  const loja = obterLoja();
  const regiao = REGIOES[0];
  if (!regiao) {
    throw new ErroRepositorio(
      "indisponivel",
      "demonstração: sem região cadastrada",
    );
  }
  // A loja de demonstração exige uma `cidade` já resolvida (fixtures da
  // fundação); no cadastro manual, como no banco de verdade, a cidade só
  // fica em texto livre (`cidade_informada`) até alguém resolver o
  // cadastro. Usa a primeira cidade da região como o mais próximo possível
  // dessa realidade, sem inventar um valor fora do enum de cidades.
  const cidade =
    Object.values(CIDADES).find((c) => c.regiaoId === regiao.id) ??
    Object.values(CIDADES)[0]!;

  const familiaId = crypto.randomUUID();
  loja.familias.push({
    id: familiaId,
    nome: pedido.nomeFamilia.trim(),
    bairro: pedido.bairro?.trim() || pedido.cidadeInformada?.trim() || "",
    cidade,
    dpp: pedido.dpp || null,
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    gemelar: false,
    primeiraGestacao: null,
    estadoSensivel: "normal",
    estadoSensivelEm: null,
    naoContatar: false,
  });

  loja.pessoas.push({
    id: crypto.randomUUID(),
    familiaId,
    papel: pedido.papelContato,
    nome: pedido.nomeContato.trim(),
    telefoneE164: telefone,
    email: null,
    contatoPrincipal: true,
  });

  const oportunidadeId = crypto.randomUUID();
  loja.oportunidades.push({
    id: oportunidadeId,
    familiaId,
    pipeline: 1,
    estagioP1: "novo",
    estagioP2: null,
    score: 0,
    classificacao: "frio",
    pdfEnviadoEm: null,
    cadenciaEtapa: 0,
    motivoPerda: null,
    responsavelId: usuarioId,
    proximoContatoEm: null,
  });

  loja.eventos.push({
    id: loja.proximoEvento++,
    familiaId,
    tipo: "entrada",
    titulo: "Cadastro manual do comercial",
    restrito: false,
    criadoEm: new Date().toISOString(),
    dados: {},
  });

  return { familiaId, oportunidadeId };
}

async function criarLeadManualSupabase(
  pedido: PedidoLeadManual,
  telefone: string,
  usuarioId: string,
): Promise<{ familiaId: string; oportunidadeId: string }> {
  const cliente = await criarClienteServidor();

  const familia = await cliente
    .from("familia")
    .insert({
      criado_por: usuarioId,
      nome_exibicao: pedido.nomeFamilia.trim(),
      bairro: pedido.bairro?.trim() || null,
      cidade_informada: pedido.cidadeInformada?.trim() || null,
      dpp: pedido.dpp || null,
      origem: pedido.origem,
    })
    .select("id")
    .single();
  if (familia.error) throw traduzirErroBanco(familia.error, "criar família");
  const familiaId = familia.data.id;

  const pessoa = await cliente
    .from("pessoa")
    .insert({
      criado_por: usuarioId,
      familia_id: familiaId,
      papel: pedido.papelContato,
      nome: pedido.nomeContato.trim(),
      telefone_e164: telefone,
      contato_principal: true,
    })
    .select("id")
    .single();
  if (pessoa.error) throw traduzirErroBanco(pessoa.error, "criar pessoa");

  const oportunidade = await cliente
    .from("oportunidade")
    .insert({
      criado_por: usuarioId,
      familia_id: familiaId,
      pipeline: 1,
      estagio_p1: "novo",
      responsavel_id: usuarioId,
    })
    .select("id")
    .single();
  if (oportunidade.error) {
    throw traduzirErroBanco(oportunidade.error, "criar oportunidade");
  }

  return { familiaId, oportunidadeId: oportunidade.data.id };
}
