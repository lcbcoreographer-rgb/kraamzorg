// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import doc1 from "../../../../supabase/dados/instrumentos/doc1.json";
import type { ContextoSupabase } from "./comum";
import {
  alocacaoDoBanco,
  bebesParaBanco,
  consultaResumoDoBanco,
  criarOperacaoSupabase,
  entrevistaDoBanco,
  estadoPrenatalDoBanco,
  ofertaDoBanco,
  progressoDoBanco,
  radarDoBanco,
  respostaDoBanco,
  resultadoAltaDoBanco,
  resultadoSalvarDoBanco,
  respostasDaFicha,
} from "./operacao";

/**
 * Caminho Supabase da operação sem banco: o que as funções api.*
 * (0021_prenatal_nascimento.sql, provadas no pgTAP) devolvem vira os tipos da
 * tela, e o que a tela manda vira os argumentos certos.
 */

describe("consulta pré-natal", () => {
  it("resumo da lista traz o aviso das 34 semanas e a etapa, sem o conteúdo da ficha", () => {
    const r = consultaResumoDoBanco({
      consulta_id: "c1",
      familia_id: "f1",
      nome: "Família Teste Antúrio",
      status: "agendada",
      urgente: true,
      agendada_para: "2026-09-30T13:00:00Z",
      realizada_em: null,
      iniciada_em: "2026-09-29T20:00:00Z",
      etapa: 4,
      parou_em: "2026-09-29T20:10:00Z",
      respondidos: 12,
      dpp: "2026-11-08",
      ig: "34s2d",
      ig_semanas: 34,
      chegou_alerta: true,
      cidade: "São Paulo",
      uf: "SP",
      estagio_p2: "consulta_prenatal_agendada",
      ficha: { C: { nome_da_gestante: "não deve passar" } },
    });
    expect(r).toMatchObject({
      consultaId: "c1",
      familiaId: "f1",
      urgente: true,
      etapa: 4,
      chegouAlerta: true,
      igSemanas: 34,
      estagioP2: "consulta_prenatal_agendada",
    });
    expect(JSON.stringify(r)).not.toContain("não deve passar");
  });

  it("estado para o comercial: existe, status e andamento; sem consulta vira tudo vazio", () => {
    expect(
      estadoPrenatalDoBanco({
        existe: true,
        status: "realizada",
        agendada_para: "2026-09-30T13:00:00Z",
        realizada_em: "2026-09-30T14:00:00Z",
        em_andamento: false,
      }),
    ).toEqual({
      existe: true,
      status: "realizada",
      agendadaPara: "2026-09-30T13:00:00Z",
      realizadaEm: "2026-09-30T14:00:00Z",
      emAndamento: false,
    });
    expect(estadoPrenatalDoBanco({ existe: false })).toEqual({
      existe: false,
      status: null,
      agendadaPara: null,
      realizadaEm: null,
      emAndamento: false,
    });
  });

  it("progresso precisa de etapa numérica", () => {
    expect(progressoDoBanco({ etapa: 4, campo: "D.filhos_vivos", em: "2026-09-29T20:10:00Z" })).toEqual({
      etapa: 4,
      campo: "D.filhos_vivos",
      em: "2026-09-29T20:10:00Z",
    });
    expect(progressoDoBanco(null)).toBeNull();
    expect(progressoDoBanco({ etapa: "4" })).toBeNull();
  });

  it("a ficha do banco vira respostas do formulário, sem bloco vazio", () => {
    expect(respostasDaFicha({ C: { nome_da_gestante: "Ana" }, D: {} })).toEqual({
      blocos: { C: { nome_da_gestante: "Ana" } },
      por_bebe: {},
    });
    expect(respostasDaFicha(null)).toEqual({ blocos: {}, por_bebe: {} });
  });

  it("a entrevista traz a definição aprovada, as respostas, a versão e as sugestões de texto", () => {
    const e = entrevistaDoBanco({
      consulta: {
        id: "c1",
        status: "agendada",
        urgente: false,
        agendada_para: "2026-09-30T13:00:00Z",
        realizada_em: null,
        iniciada_em: null,
        instrumento_versao: "v1-2026-09",
        versao: 3,
        progresso: { etapa: 4, campo: "D.filhos_vivos" },
      },
      definicao: doc1,
      respostas: { C: { nome_da_gestante: "Ana Teste" } },
      familia: {
        id: "f1",
        nome: "Família Teste Jasmim",
        dpp: "2026-11-08",
        gemelar: false,
        cidade: "Barueri",
        uf: "SP",
        ig: "34s2d",
        ig_semanas: 34,
      },
      sugestoes: { "B.data_provavel_do_parto": "2026-11-08", ignorada: 1 },
      coletador: "Perfil Teste Coordenacao",
    });
    expect(e.consulta).toMatchObject({ id: "c1", versao: 3 });
    expect(e.consulta.progresso).toMatchObject({ etapa: 4, campo: "D.filhos_vivos" });
    expect(e.definicao.blocos.map((b) => b.id)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(e.respostas.blocos.C).toEqual({ nome_da_gestante: "Ana Teste" });
    expect(e.sugestoes).toEqual({ "B.data_provavel_do_parto": "2026-11-08" });
    expect(e.coletador).toBe("Perfil Teste Coordenacao");
    expect(e.familia).toMatchObject({ nome: "Família Teste Jasmim", igSemanas: 34 });
  });

  it("resultado de salvar campo: conflito devolve o original", () => {
    expect(
      resultadoSalvarDoBanco({ ok: false, versao: 7, conflito: true, original: "Bia", repetido: false }),
    ).toEqual({ ok: false, versao: 7, conflito: true, original: "Bia", repetido: false });
    expect(resultadoSalvarDoBanco({ ok: true, versao: 2, repetido: true })).toMatchObject({
      ok: true,
      conflito: false,
      repetido: true,
    });
  });
});

describe("alocação, ofertas e radar", () => {
  it("alocação com as quatro datas separadas, designações, candidatas e visitas", () => {
    const a = alocacaoDoBanco({
      familia: {
        id: "f1",
        nome: "Família Teste Orquídea",
        dpp: "2026-10-01",
        data_nascimento: "2026-09-29",
        data_alta: "2026-09-30",
        data_inicio_efetivo: "2026-10-01",
        gemelar: false,
        estado_sensivel: "normal",
        ig: "39s5d",
        estagio_p2: "atendimento_liberado",
        cidade: "São Bernardo do Campo",
        uf: "SP",
        regiao_id: "r1",
        janela_inicio: "2026-09-10",
        janela_fim: "2026-10-15",
        periodo_preferido: ["manha", "tarde", "invalido"],
        consulta_status: "realizada",
      },
      acompanhamento: {
        id: "a1",
        estado: "ativo",
        dias: 6,
        horas_por_visita: 3,
        periodo: "manha",
        inicio_efetivo: "2026-10-01",
        previsao_alta: "2026-09-30",
        visitas: 1,
        lista_visitas: [
          {
            dia_numero: 1,
            data: "2026-10-01",
            hora_prevista: "09:00:00",
            estado: "agendada",
            profissional_id: "p1",
            profissional: "Profissional Teste Sul 2",
          },
        ],
      },
      designacoes: [
        {
          id: "d1",
          papel: "titular",
          status: "recusada",
          profissional_id: "p1",
          profissional: "Profissional Teste Sul 2",
          oferecida_em: "2026-09-28T12:00:00Z",
          respondida_em: "2026-09-28T13:00:00Z",
          prazo_resposta_em: "2026-09-29T12:00:00Z",
          direta: false,
          motivo_recusa: "Folga",
        },
      ],
      candidatas: [
        {
          profissional_id: "p3",
          nome: "Profissional Teste Sul 3",
          funcao: "enfermeira_obstetrica",
          estado_hoje: "livre",
          na_regiao: true,
          titulares_na_janela: 1,
          bloqueio_na_janela: false,
          oferta_pendente: false,
          ja_nesta_familia: false,
        },
      ],
      tarefas: [{ tipo: "designar_profissional", titulo: "Designar", prioridade: "alta", vence_em: null }],
    });
    expect(a.familia).toMatchObject({
      dpp: "2026-10-01",
      dataNascimento: "2026-09-29",
      dataAlta: "2026-09-30",
      dataInicioEfetivo: "2026-10-01",
      periodoPreferido: ["manha", "tarde"],
    });
    expect(a.acompanhamento).toMatchObject({ dias: 6, horasPorVisita: 3, periodo: "manha", visitas: 1 });
    expect(a.acompanhamento!.listaVisitas[0]).toMatchObject({ diaNumero: 1, profissional: "Profissional Teste Sul 2" });
    expect(a.designacoes[0]).toMatchObject({ status: "recusada", motivoRecusa: "Folga", direta: false });
    expect(a.candidatas[0]).toMatchObject({ titularesNaJanela: 1, jaNestaFamilia: false });
    expect(a.tarefas[0]).toMatchObject({ tipo: "designar_profissional", prioridade: "alta" });
  });

  it("alocação sem acompanhamento mantém null", () => {
    const a = alocacaoDoBanco({ familia: { id: "f1", nome: "F" }, acompanhamento: null });
    expect(a.acompanhamento).toBeNull();
    expect(a.designacoes).toEqual([]);
    expect(a.familia.estadoSensivel).toBe("normal");
  });

  it("oferta e resposta da enfermeira", () => {
    expect(
      ofertaDoBanco({
        designacao_id: "d1",
        papel: "titular",
        oferecida_em: "2026-09-28T12:00:00Z",
        prazo_resposta_em: "2026-09-29T12:00:00Z",
        vencida: false,
        familia: "Família Teste Girassol",
        bairro: "Itaim Bibi",
        cidade: "São Paulo",
        uf: "SP",
        dpp: "2026-10-24",
        gemelar: false,
        dias: 6,
        horas_por_visita: 3,
        periodo: "manha",
      }),
    ).toMatchObject({ designacaoId: "d1", papel: "titular", bairro: "Itaim Bibi", dias: 6, periodo: "manha" });
    expect(respostaDoBanco({ ok: true, aceita: false, expirada: false, desfecho: "backup_assumiu" })).toEqual({
      ok: true,
      aceita: false,
      expirada: false,
      desfecho: "backup_assumiu",
    });
  });

  it("radar com titular, backup, sem contato e ocupação", () => {
    const r = radarDoBanco({
      hoje: "2026-09-29",
      janela: { antes: 21, depois: 14 },
      limite_alerta_pct: 85,
      familias: [
        {
          familia_id: "f1",
          nome: "Família Teste Hortênsia",
          cidade: "São Paulo",
          uf: "SP",
          regiao_id: "r1",
          regiao: "São Paulo",
          gemelar: false,
          dpp: "2026-10-04",
          ig: "39s2d",
          ig_semanas: 39,
          dias_para_dpp: 5,
          na_janela: true,
          passou_da_janela: false,
          estagio_p2: "aguardando_nascimento",
          consulta_status: "realizada",
          titular: { designacao_id: "d1", profissional_id: "p1", nome: "Sul 1", status: "aceita", prazo_resposta_em: null },
          backup: null,
          ultimo_contato: null,
          dias_sem_contato: null,
          sem_contato: true,
          checkin_pendente: true,
          dpp_sem_confirmacao: false,
          dpp_sem_contato: false,
          estado_sensivel: "normal",
        },
      ],
      nasceram: [
        {
          familia_id: "f2",
          nome: "Família Teste Margarida",
          regiao_id: "r1",
          data_nascimento: "2026-09-28",
          estagio_p2: "bebe_nasceu",
          previsao_alta: "2026-09-30",
          titular: "Sul 1",
        },
      ],
      ocupacao: [
        { regiao_id: "r1", regiao: "São Paulo", semana: "2026-09-28", ocupacao_pct: 90, familias: 4, acima_do_limite: true },
      ],
    });
    expect(r.janela).toEqual({ antes: 21, depois: 14 });
    expect(r.limiteAlertaPct).toBe(85);
    expect(r.familias[0]).toMatchObject({
      naJanela: true,
      semContato: true,
      diasSemContato: null,
      checkinPendente: true,
      backup: null,
    });
    expect(r.familias[0]!.titular).toMatchObject({ nome: "Sul 1", status: "aceita" });
    expect(r.nasceram[0]).toMatchObject({ previsaoAlta: "2026-09-30", titular: "Sul 1" });
    expect(r.ocupacao[0]).toMatchObject({ ocupacaoPct: 90, acimaDoLimite: true });
  });

  it("resultado da alta e bebês nas chaves do banco, sem campo vazio", () => {
    expect(
      resultadoAltaDoBanco({
        visitas: 12,
        acompanhamento_estado: "ativo",
        inicio_efetivo: "2026-10-01",
        periodo: "tarde",
        estagio_p2: "atendimento_liberado",
      }),
    ).toEqual({
      visitas: 12,
      acompanhamentoEstado: "ativo",
      inicioEfetivo: "2026-10-01",
      periodo: "tarde",
      estagioP2: "atendimento_liberado",
    });
    expect(
      bebesParaBanco([{ nome: "", sexo: "feminino", pesoNascimentoG: 3200, tipoParto: "vaginal" }, {}]),
    ).toEqual([{ sexo: "feminino", peso_nascimento_g: 3200, tipo_parto: "vaginal" }, {}]);
  });
});

describe("chamadas ao banco", () => {
  function contexto(rpc: ReturnType<typeof vi.fn>): ContextoSupabase {
    return {
      cliente: { schema: () => ({ rpc }) } as unknown as ContextoSupabase["cliente"],
      usuarioId: "u",
    };
  }

  it("salvar campo manda os nomes do banco, inclusive o id do item para a idempotência", async () => {
    const rpc = vi.fn(async () => ({
      data: { ok: true, versao: 4, conflito: false, repetido: false },
      error: null,
    }));
    const operacao = criarOperacaoSupabase(contexto(rpc));
    const r = await operacao.salvarCampo({
      consultaId: "c1",
      bloco: "D",
      campo: "filhos_vivos",
      valor: "1",
      versaoBase: 3,
      progresso: { etapa: 4, campo: "D.filhos_vivos" },
      itemId: "item-1",
    });
    expect(rpc).toHaveBeenCalledWith("prenatal_salvar_campo", {
      consulta_id: "c1",
      bloco: "D",
      campo: "filhos_vivos",
      valor: "1",
      versao_base: 3,
      progresso: { etapa: 4, campo: "D.filhos_vivos" },
      motivo: null,
      item_id: "item-1",
    });
    expect(r).toMatchObject({ ok: true, versao: 4 });
  });

  it("nascimento e alta chamam as funções api com os nomes do banco", async () => {
    const rpc = vi.fn(async (funcao: string) => ({
      data:
        funcao === "registrar_alta"
          ? { visitas: 6, acompanhamento_estado: "ativo", inicio_efetivo: "2026-10-01", periodo: "manha", estagio_p2: "atendimento_liberado" }
          : { estagio_p2: "bebe_nasceu" },
      error: null,
    }));
    const operacao = criarOperacaoSupabase(contexto(rpc));
    const n = await operacao.registrarNascimento({
      familiaId: "f1",
      dataNascimento: "2026-09-29",
      bebes: [{ pesoNascimentoG: 3200 }],
    });
    expect(n.estagioP2).toBe("bebe_nasceu");
    expect(rpc).toHaveBeenCalledWith("registrar_nascimento", {
      familia_id: "f1",
      data_nascimento: "2026-09-29",
      bebes: [{ peso_nascimento_g: 3200 }],
      previsao_alta: null,
    });
    const a = await operacao.registrarAlta({ familiaId: "f1", dataAlta: "2026-09-30" });
    expect(a.visitas).toBe(6);
    expect(rpc).toHaveBeenCalledWith("registrar_alta", {
      familia_id: "f1",
      data_alta: "2026-09-30",
      primeira_visita: null,
      periodo: null,
    });
  });

  it("oferta, atribuição direta e resposta chamam as funções de designação", async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, aceita: true, expirada: false, desfecho: null }, error: null }));
    const operacao = criarOperacaoSupabase(contexto(rpc));
    await operacao.oferecer({ familiaId: "f1", profissionalId: "p1", papel: "titular" });
    await operacao.atribuir({ familiaId: "f1", profissionalId: "p3", papel: "backup", motivo: "Urgência" });
    await operacao.responder("d1", true, null);
    expect(rpc.mock.calls).toEqual([
      ["oferecer_designacao", { familia_id: "f1", profissional_id: "p1", papel: "titular" }],
      ["atribuir_designacao", { familia_id: "f1", profissional_id: "p3", papel: "backup", motivo: "Urgência" }],
      ["responder_designacao", { designacao_id: "d1", aceita: true, motivo: null }],
    ]);
  });

  it("recusa do banco vira ErroRepositorio com o código da operação na mensagem", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "P0001", message: "operacao:papel_ocupado oferecida" },
    }));
    const operacao = criarOperacaoSupabase(contexto(rpc));
    await expect(
      operacao.oferecer({ familiaId: "f1", profissionalId: "p1", papel: "titular" }),
    ).rejects.toMatchObject({
      codigo: "recusado",
      message: expect.stringContaining("operacao:papel_ocupado"),
    });
  });

  it("função ainda sem migration aplicada vira funcao_pendente, sem derrubar a tela", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    }));
    const operacao = criarOperacaoSupabase(contexto(rpc));
    await expect(operacao.listarConsultas()).rejects.toMatchObject({ codigo: "funcao_pendente" });
  });
});
