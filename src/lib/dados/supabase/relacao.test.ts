// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Json } from "@/lib/db/types";
import type { ContextoSupabase } from "./comum";
import {
  argumentosFerramenta,
  criarRelacaoSupabase,
  exportacaoDoBanco,
  manualDoBanco,
  portalFamiliaDoBanco,
  relatorioMarketingDoBanco,
  tarefasEquipeDoBanco,
} from "./relacao";

/**
 * Caminho Supabase do relacionamento sem banco: o que as funções api.*
 * (0027_relacao.sql, provadas no pgTAP) devolvem vira os tipos da tela, e o
 * que a tela manda vira os argumentos certos, com o nome exato da função.
 */

function clienteFalso(resposta: Json = null) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (funcao: string, args: Record<string, unknown>) => {
    chamadas.push({ funcao, args });
    return { data: resposta, error: null };
  });
  const cliente = { schema: () => ({ rpc }) };
  return {
    chamadas,
    contexto: { cliente, usuarioId: null } as unknown as ContextoSupabase,
  };
}

describe("marketing", () => {
  it("relatório sem valores (papel sem acesso) devolve nulos, não zeros", () => {
    const r = relatorioMarketingDoBanco({
      desde: null,
      ate: null,
      ve_valores: false,
      so_elegiveis: true,
      por_origem: [{ origem: "meta_ads", leads: 3, qualificados: 2, ganhos: 1 }],
      por_canal: [],
      total: { leads: 3, qualificados: 2, ganhos: 1 },
    });
    expect(r.veValores).toBe(false);
    expect(r.total.receitaCentavos).toBeNull();
    expect(r.total.custoCentavos).toBeNull();
    expect(r.porOrigem[0]).toMatchObject({ origem: "meta_ads", leads: 3 });
  });

  it("relatório com valores mantém centavos inteiros", () => {
    const r = relatorioMarketingDoBanco({
      ve_valores: true,
      so_elegiveis: false,
      por_origem: [
        {
          origem: "google",
          leads: 2,
          qualificados: 1,
          ganhos: 1,
          contratos_pagos: 1,
          receita_centavos: 450000,
          custo_centavos: 90000,
        },
      ],
      por_canal: [],
      total: { leads: 2, qualificados: 1, ganhos: 1, contratos_pagos: 1, receita_centavos: 450000, custo_centavos: 90000 },
    });
    expect(r.porOrigem[0]).toMatchObject({ receitaCentavos: 450000, custoCentavos: 90000 });
    expect(Number.isInteger(r.total.receitaCentavos)).toBe(true);
  });

  it("a exportação leva só os campos da lista, sem contato", () => {
    const e = exportacaoDoBanco({
      limite: 5000,
      linhas: [
        {
          nome_exibicao: "Família Teste Aurora",
          dpp: "2027-01-15",
          gemelar: false,
          primeira_gestacao: true,
          origem: "meta_ads",
          codigo_origem: "META",
          utm: { utm_source: "meta" },
          criado_em: "2026-08-12T10:00:00-03:00",
          telefone: "+5511999990000",
        },
      ],
    });
    expect(e.linhas[0]).not.toHaveProperty("telefone");
    expect(e.linhas[0]!.nomeExibicao).toBe("Família Teste Aurora");
  });

  it("chama a função certa com os argumentos certos", async () => {
    const { chamadas, contexto } = clienteFalso({
      id: "c1",
      codigo: "EVENTO1",
      nome: "Feira",
      origem: "evento",
      ativo: true,
      visitas: 0,
      conversas: 0,
    });
    const { marketing } = criarRelacaoSupabase(contexto);
    await marketing.salvarCanal({ id: null, codigo: "EVENTO1", nome: "Feira", origem: "evento", ativo: true });
    await marketing.salvarCusto({ canalId: "c1", mes: "2026-09-15", valorCentavos: 12345 });
    expect(chamadas.map((c) => c.funcao)).toEqual(["marketing_canal_salvar", "marketing_custo_salvar"]);
    expect(chamadas[0]!.args).toMatchObject({ id: null, codigo: "EVENTO1", origem: "evento" });
    expect(chamadas[1]!.args).toEqual({ canal_id: "c1", mes: "2026-09-15", valor_centavos: 12345 });
  });
});

describe("copiloto", () => {
  it("cada ferramenta vira a função api.* de mesmo nome, só com os argumentos do catálogo", () => {
    expect(argumentosFerramenta("copiloto_conversao", { desde: "2026-09-01", ate: null, sql: "drop table x" })).toEqual({
      desde: "2026-09-01",
      ate: null,
    });
    expect(argumentosFerramenta("copiloto_pipeline", { pipeline: 2 })).toEqual({ pipeline: 2 });
    expect(argumentosFerramenta("copiloto_ocupacao", {})).toEqual({ semana_desde: null, semanas: 8 });
  });

  it("executar chama a função da ferramenta escolhida", async () => {
    const { chamadas, contexto } = clienteFalso({ pipeline: 1, total: 0, estagios: [] });
    await criarRelacaoSupabase(contexto).copiloto.executar("copiloto_pipeline", { pipeline: 1 });
    expect(chamadas).toEqual([{ funcao: "copiloto_pipeline", args: { pipeline: 1 } }]);
  });
});

describe("portal da família", () => {
  it("modo normal traz datas, passos e o contato; nada além", () => {
    const p = portalFamiliaDoBanco({
      situacao: "ok",
      primeiro_nome: "Aurora",
      nome_familia: "Família Teste Aurora",
      gemelar: false,
      datas: { dpp: "2026-10-20", data_nascimento: null, data_alta: null, data_inicio_efetivo: null },
      contrato_assinado_em: "2026-09-06T10:00:00-03:00",
      pagamento_confirmado_em: null,
      prenatal: null,
      acompanhamento: null,
      enfermeira: { nome: null, foto_path: null },
      visitas: [],
      pesquisa: null,
      evolucoes: { ativo: false, itens: [] },
      contato: { nome: "Equipe", telefone_e164: "+5511900000001", horario: "9h às 18h", funcao: null },
      textos: { titulo: "Olá" },
    });
    expect(p.situacao).toBe("ok");
    if (p.situacao !== "ok") return;
    expect(p.datas.dpp).toBe("2026-10-20");
    expect(p.enfermeira).toEqual({ nome: null, fotoPath: null });
    expect(p.evolucoes.ativo).toBe(false);
  });

  it("bloqueio_total devolve só o contato", () => {
    const p = portalFamiliaDoBanco({
      situacao: "contato",
      primeiro_nome: "Cais",
      contato: { nome: "Coordenação", telefone_e164: "+5511900000002", horario: null, funcao: "Coordenação de enfermagem" },
      textos: { contato_titulo: "Estamos aqui" },
    });
    expect(p.situacao).toBe("contato");
    expect(Object.keys(p).sort()).toEqual(["contato", "primeiroNome", "situacao", "textos"]);
  });
});

describe("tarefas, manuais e talentos", () => {
  it("tarefas por equipe", () => {
    const v = tarefasEquipeDoBanco({
      equipes: [{ equipe: "coordenacao", abertas: 3, em_andamento: 1, vencidas: 1, sem_responsavel: 0, concluidas_7d: 2 }],
      pessoas: [],
      tarefas: [],
    });
    expect(v.equipes[0]).toEqual({ equipe: "coordenacao", abertas: 3, emAndamento: 1, vencidas: 1, semResponsavel: 0, concluidas7d: 2 });
  });

  it("manual traz o histórico de versões e se a pessoa já leu", () => {
    const m = manualDoBanco({
      id: "m1",
      titulo: "Manual de teste",
      categoria: "manual",
      papeis_alvo: ["enfermeira"],
      ativo: true,
      versao: 2,
      versao_id: "v2",
      conteudo: "Texto",
      publicada_em: "2026-09-01T00:00:00Z",
      lido: false,
      historico: [
        { versao: 2, publicada_em: "2026-09-01T00:00:00Z", resumo_mudanca: "Novo passo" },
        { versao: 1, publicada_em: "2026-08-01T00:00:00Z", resumo_mudanca: null },
      ],
    });
    expect(m).toMatchObject({ versao: 2, versaoId: "v2", lido: false });
    expect(m.historico).toHaveLength(2);
  });

  it("avaliar manda respostas e notas ao banco sem alterar as chaves", async () => {
    const { chamadas, contexto } = clienteFalso({
      avaliacao_id: "a1",
      criterios_avaliados: 1,
      criterios_total: 10,
      completa: false,
      media: 4,
    });
    const r = await criarRelacaoSupabase(contexto).talentos.avaliar({
      candidataId: "c1",
      respostas: { p01: "Resposta" },
      notas: { c01: 4 },
      observacoes: "",
    });
    expect(r).toMatchObject({ avaliacaoId: "a1", criteriosAvaliados: 1, media: 4, completa: false });
    expect(chamadas[0]).toMatchObject({
      funcao: "talento_avaliar",
      args: { candidata_id: "c1", respostas: { p01: "Resposta" }, notas: { c01: 4 } },
    });
  });
});
