import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";
import { exigirSessao } from "@/lib/auth/sessao";
import { diferencaDias, mesmoTelefone, similaridadeNome } from "./normalizar";
import type {
  FamiliaDuplicata,
  ParDuplicataCerta,
  ParDuplicataProvavel,
  ResultadoDuplicatas,
} from "./tipos";

/**
 * Detecção de duplicatas (P17 item 1, PRD 6.10 regra 2 e 12): duplicata
 * certa por telefone normalizado; duplicata provável por similaridade de
 * nome com DPP a até 14 dias; mesmo telefone com DPP muito distante sugere
 * vínculo de nova gestação (regra 12), não mesclagem.
 *
 * No Supabase, `api.buscar_duplicatas_pipeline()` (migration 0017) devolve
 * todos os pares de uma vez, pela regra de `privado.buscar_duplicatas`
 * (0010) e com os cortes de `parametro.deduplicacao`. Se a função não
 * existir no banco (`funcao_pendente`), a tela mostra `indisponivelNoBanco`
 * em vez de "nenhuma duplicata" (são coisas diferentes). O caminho de
 * demonstração calcula a mesma regra em memória,
 * com os mesmos cortes do parâmetro `deduplicacao` do seed (P08):
 * `limiar_nome` 0,6 e `dpp_dias` 14. Comercial e coordenação não leem
 * `parametro` (PRD 13), então os cortes ficam aqui, não em
 * `configuracoes.lerParametro`.
 */
const LIMIAR_NOME = 0.6;
const DPP_DIAS_PROVAVEL = 14;
export const NOVA_GESTACAO_DIAS = 180;

export interface ResultadoDeteccao extends ResultadoDuplicatas {
  novasGestacoes: ParDuplicataCerta[];
}

export async function listarDuplicatas(): Promise<ResultadoDeteccao> {
  await exigirSessao("/pipeline/duplicatas");

  if (modoDados() === "demonstracao") {
    return listarDuplicatasDemonstracao();
  }
  return listarDuplicatasSupabase();
}

async function listarDuplicatasSupabase(): Promise<ResultadoDeteccao> {
  const cliente = await criarClienteServidor();
  let resposta: unknown;
  try {
    resposta = await rpcPendente(cliente, "buscar_duplicatas_pipeline", {});
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "funcao_pendente") {
      return {
        certas: [],
        provaveis: [],
        novasGestacoes: [],
        indisponivelNoBanco: true,
      };
    }
    throw erro;
  }
  return lerResultadoBanco(resposta);
}

/** O jsonb de `api.buscar_duplicatas_pipeline` já vem no formato da tela
 * (chaves de `ResultadoDeteccao`); aqui só garante listas quando falta
 * alguma chave, para a tela nunca quebrar. */
function lerResultadoBanco(resposta: unknown): ResultadoDeteccao {
  const registro =
    resposta && typeof resposta === "object" && !Array.isArray(resposta)
      ? (resposta as Record<string, unknown>)
      : {};
  const lista = <T>(valor: unknown): T[] =>
    Array.isArray(valor) ? (valor as T[]) : [];
  return {
    certas: lista<ParDuplicataCerta>(registro.certas),
    provaveis: lista<ParDuplicataProvavel>(registro.provaveis),
    novasGestacoes: lista<ParDuplicataCerta>(registro.novasGestacoes),
    indisponivelNoBanco: registro.indisponivelNoBanco === true,
  };
}

async function listarDuplicatasDemonstracao(): Promise<ResultadoDeteccao> {
  const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
  const { familiasJaMescladas } = await import("./mesclagem");
  const loja = obterLoja();
  const mescladas = familiasJaMescladas();
  const familias = loja.familias.filter((f) => !mescladas.has(f.id));

  const paraDuplicata = (id: string): FamiliaDuplicata => {
    const f = loja.familias.find((x) => x.id === id);
    if (!f) throw new Error(`família ausente: ${id}`);
    return {
      id: f.id,
      nome: f.nome,
      bairro: f.bairro,
      cidade: f.cidade.nome,
      dpp: f.dpp,
    };
  };

  const telefonePorFamilia = new Map<string, string[]>();
  for (const pessoa of loja.pessoas) {
    if (mescladas.has(pessoa.familiaId)) continue;
    const lista = telefonePorFamilia.get(pessoa.familiaId) ?? [];
    lista.push(pessoa.telefoneE164);
    telefonePorFamilia.set(pessoa.familiaId, lista);
  }

  const certas: ParDuplicataCerta[] = [];
  const novasGestacoes: ParDuplicataCerta[] = [];
  const vistosPorTelefone = new Set<string>();

  for (let i = 0; i < familias.length; i++) {
    for (let j = i + 1; j < familias.length; j++) {
      const a = familias[i]!;
      const b = familias[j]!;
      const telefonesA = telefonePorFamilia.get(a.id) ?? [];
      const telefonesB = telefonePorFamilia.get(b.id) ?? [];
      const telefoneComum = telefonesA.find((ta) =>
        telefonesB.some((tb) => mesmoTelefone(ta, tb)),
      );
      if (!telefoneComum) continue;
      const chave = [a.id, b.id].sort().join(":");
      if (vistosPorTelefone.has(chave)) continue;
      vistosPorTelefone.add(chave);

      const dias = a.dpp && b.dpp ? diferencaDias(a.dpp, b.dpp) : null;
      const par: ParDuplicataCerta = {
        tipo: "certa",
        a: paraDuplicata(a.id),
        b: paraDuplicata(b.id),
        telefone: telefoneComum,
      };
      if (dias !== null && dias > NOVA_GESTACAO_DIAS) {
        novasGestacoes.push(par);
      } else {
        certas.push(par);
      }
    }
  }

  const jaCertasOuVinculo = new Set(
    [...certas, ...novasGestacoes].map((p) =>
      [p.a.id, p.b.id].sort().join(":"),
    ),
  );
  const provaveis: ParDuplicataProvavel[] = [];
  for (let i = 0; i < familias.length; i++) {
    for (let j = i + 1; j < familias.length; j++) {
      const a = familias[i]!;
      const b = familias[j]!;
      const chave = [a.id, b.id].sort().join(":");
      if (jaCertasOuVinculo.has(chave)) continue;
      const similaridade = similaridadeNome(a.nome, b.nome);
      if (similaridade < LIMIAR_NOME) continue;
      if (!a.dpp || !b.dpp) continue;
      const dias = diferencaDias(a.dpp, b.dpp);
      if (dias === null || dias > DPP_DIAS_PROVAVEL) continue;
      provaveis.push({
        tipo: "provavel",
        a: paraDuplicata(a.id),
        b: paraDuplicata(b.id),
        similaridade,
        diasEntreDpp: dias,
      });
    }
  }

  return { certas, provaveis, novasGestacoes, indisponivelNoBanco: false };
}
