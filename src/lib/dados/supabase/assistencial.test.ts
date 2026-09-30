// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ContextoSupabase } from "./comum";
import {
  alertaResumoDoBanco,
  checklistDoBanco,
  criarAssistencialSupabase,
} from "./assistencial";

/**
 * Caminho Supabase do checklist e dos alertas sem banco (P39 e P40): o que
 * as funções api.* da 0023 devolvem (provado no pgTAP 023) vira os tipos da
 * tela, e o que a tela manda vira os argumentos com os nomes que a função
 * lê.
 */

function contexto(rpc: ReturnType<typeof vi.fn>): ContextoSupabase {
  return {
    cliente: {
      schema: (nome: string) => {
        expect(nome).toBe("api");
        return { rpc };
      },
    } as unknown as ContextoSupabase["cliente"],
    usuarioId: "u",
  };
}

const resposta = (data: unknown) => vi.fn(async () => ({ data, error: null }));

describe("mapeamento do checklist", () => {
  it("a visita, a família e o registro assinado com adendos", () => {
    const c = checklistDoBanco({
      visita: {
        id: "v1",
        acompanhamento_id: "a1",
        profissional_id: "p1",
        dia_numero: 3,
        data: "2026-09-29",
        estado: "ficha_entregue",
        versao: 4,
      },
      familia: {
        id: "f1",
        nome_exibicao: "Família Teste Aurora",
        estado_sensivel: "perda",
        gemelar: true,
      },
      acompanhamento: { dias_contratados: 6, ultimo_dia: false },
      profissional: { id: "p1", nome: "Enfermeira Teste", conselho: "COREN" },
      instrumento: null,
      bebes: [{ id: "b1", ordem: 1, nome: null, peso_nascimento_g: 3100 }],
      medicos: [{ id: "m1", especialidade: "pediatra", nome: "Pediatra Teste" }],
      regras: [
        {
          id: "PU-01",
          grupo: "puerpera",
          descricao: "Febre",
          severidade: "imediato",
          conduta: "Acionar a supervisão.",
          campo: "2.1.temperatura",
          condicao: { campo: "2.1.temperatura", operador: ">=", valor: 38 },
          instrumento_versao: "v1-2026-09",
          ativa: true,
        },
      ],
      registro: {
        id: "r1",
        profissional_id: "p1",
        instrumento_versao: "v1-2026-09",
        dados: { "2.1": { temperatura: 36.6 } },
        resumo_descritivo: "Tudo tranquilo.",
        assinado_em: "2026-09-29T15:10:00Z",
        assinatura: "a".repeat(64),
        adendos: [
          {
            id: "ad1",
            motivo: "Digitação",
            conteudo: "36,8",
            criado_em: "2026-09-29T18:00:00Z",
            autor: "Enfermeira Teste",
          },
        ],
      },
      anteriores: [],
      alertas: [],
      audios: [],
      parametros: {
        seletor_sinais_doc3_ativo: false,
        supervisao_medica_telefone: "+5511900000099",
        audio_visita: { duracao_max_seg: 1800, tipos: ["audio/webm", 3] },
      },
    });

    expect(c.visita).toMatchObject({ id: "v1", diaNumero: 3, versao: 4 });
    expect(c.familia).toMatchObject({
      nomeExibicao: "Família Teste Aurora",
      estadoSensivel: "perda",
      gemelar: true,
    });
    expect(c.diasContratados).toBe(6);
    expect(c.instrumento).toBeNull();
    expect(c.regras[0]).toMatchObject({ id: "PU-01", ativa: true });
    expect(c.registro?.adendos).toEqual([
      {
        id: "ad1",
        motivo: "Digitação",
        conteudo: "36,8",
        criadoEm: "2026-09-29T18:00:00Z",
        autor: "Enfermeira Teste",
      },
    ]);
    // o seletor de sinais e a transcrição vêm desligados por padrão
    expect(c.parametros).toMatchObject({
      seletorSinaisAtivo: false,
      transcricaoAudioAtiva: false,
      supervisaoTelefone: "+5511900000099",
      audioUrlAssinadaSegundos: 60,
    });
    expect(c.parametros.audio.tipos).toEqual(["audio/webm"]);
  });

  it("resposta vazia não quebra e nada vem ligado por engano", () => {
    const c = checklistDoBanco({});
    expect(c.registro).toBeNull();
    expect(c.parametros.seletorSinaisAtivo).toBe(false);
    expect(c.parametros.transcricaoAudioAtiva).toBe(false);
    expect(c.bebes).toEqual([]);
  });

  it("o alerta da lista traz a família, o dia e os quatro campos do registro", () => {
    const a = alertaResumoDoBanco({
      id: "al1",
      familia_id: "f1",
      nome_exibicao: "Família Teste Cedro",
      estado_sensivel: "normal",
      visita_id: "v8",
      dia_numero: 6,
      regra_id: "RN-08",
      grupo: "recem_nascido",
      descricao: "Febre do recém-nascido",
      severidade: "imediato",
      conduta: "Acionar a supervisão.",
      criado_em: "2026-09-29T14:00:00Z",
      sinal_identificado: "38,3",
      acionado_em: "2026-09-29T14:20:00Z",
      orientacao_medica: null,
      conduta_adotada: null,
      fechado_em: null,
      versao: 3,
    });
    expect(a).toMatchObject({
      nomeFamilia: "Família Teste Cedro",
      diaNumero: 6,
      regraId: "RN-08",
      sinalIdentificado: "38,3",
      orientacaoMedica: null,
      fechadoEm: null,
      versao: 3,
    });
  });
});

describe("chamadas ao schema api", () => {
  it("obterChecklist devolve nulo para visita de outra profissional ou inexistente", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "P0002", message: "api.checklist_visita: visita v-x não existe" },
    }));
    const repo = criarAssistencialSupabase(contexto(rpc));
    expect(await repo.obterChecklist("v-x")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("checklist_visita", { visita_id: "v-x" });
  });

  it("obterChecklist devolve nulo para visita de outra profissional (42501)", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        code: "42501",
        message: "api.checklist_visita: visita de outra profissional",
      },
    }));
    const repo = criarAssistencialSupabase(contexto(rpc));
    expect(await repo.obterChecklist("v-x")).toBeNull();
  });

  it("obterChecklist repassa o erro que não é 'não achei'", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "XX000", message: "queda do banco" },
    }));
    const repo = criarAssistencialSupabase(contexto(rpc));
    await expect(repo.obterChecklist("v")).rejects.toBeInstanceOf(Error);
  });

  it("registrarAtendimento manda a assinatura e os alertas com os nomes da função", async () => {
    const rpc = resposta({ id: "r1", ja_registrado: false });
    const repo = criarAssistencialSupabase(contexto(rpc));
    const r = await repo.registrarAtendimento(
      {
        visitaId: "v1",
        profissionalId: "p1",
        instrumentoVersao: "v1-2026-09",
        dados: { "2.1": { temperatura: 38.2 } },
        resumoDescritivo: "Resumo.",
        assinadoEmMs: 1_790_000_000_000,
        assinatura: "b".repeat(64),
      },
      [
        {
          regraId: "PU-01",
          bebeId: null,
          campo: "2.1.temperatura",
          valorObservado: "38,2",
        },
      ],
    );
    expect(r).toEqual({ registroId: "r1", jaRegistrado: false });
    expect(rpc).toHaveBeenCalledWith("registrar_atendimento", {
      visita_id: "v1",
      dados: { "2.1": { temperatura: 38.2 } },
      resumo: "Resumo.",
      assinado_em_ms: 1_790_000_000_000,
      assinatura: "b".repeat(64),
      instrumento_versao: "v1-2026-09",
      alertas: [
        {
          regra_id: "PU-01",
          bebe_id: null,
          campo: "2.1.temperatura",
          valor_observado: "38,2",
        },
      ],
    });
  });

  it("adendo, acionamento e fechamento chamam a função certa", async () => {
    const rpc = resposta({});
    const repo = criarAssistencialSupabase(contexto(rpc));
    await repo.registrarAdendo("r1", "Motivo", "Texto");
    await repo.registrarAcionamento({
      alertaId: "al1",
      versaoBase: 2,
      sinalIdentificado: "Febre",
    });
    await repo.fecharAlerta("al1", 3);
    expect(rpc.mock.calls).toEqual([
      ["registrar_adendo", { registro_id: "r1", motivo: "Motivo", conteudo: "Texto" }],
      [
        "registrar_acionamento_alerta",
        {
          alerta_id: "al1",
          versao_base: 2,
          sinal_identificado: "Febre",
          acionado_em: null,
          orientacao_medica: null,
          conduta_adotada: null,
        },
      ],
      ["fechar_alerta_clinico", { alerta_id: "al1", versao_base: 3 }],
    ]);
  });

  it("recusa do banco no fechamento vira erro com o código do checklist na mensagem", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        code: "P0001",
        message: "checklist:fechamento_incompleto falta registrar: conduta_adotada",
      },
    }));
    const repo = criarAssistencialSupabase(contexto(rpc));
    await expect(repo.fecharAlerta("al1", null)).rejects.toMatchObject({
      message: expect.stringContaining("checklist:fechamento_incompleto"),
    });
  });

  it("situação do contato médico: sem resposta, a evolução fica bloqueada", async () => {
    const repo = criarAssistencialSupabase(contexto(resposta({})));
    expect(await repo.situacaoContatoMedico("f1")).toEqual({
      obstetra: false,
      pediatra: false,
      tarefaAberta: false,
      evolucaoBloqueada: true,
    });
  });

  it("áudio: registra pelo caminho e ouve com a validade que o banco mandou", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "au1" }, error: null })
      .mockResolvedValueOnce({
        data: { arquivo_path: "visitas/v1/x.webm", validade_seg: 60 },
        error: null,
      });
    const repo = criarAssistencialSupabase(contexto(rpc));
    expect(await repo.registrarAudio("v1", "visitas/v1/x.webm", 42)).toEqual({
      id: "au1",
    });
    expect(await repo.audioParaOuvir("au1")).toEqual({
      arquivoPath: "visitas/v1/x.webm",
      validadeSeg: 60,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "registrar_anexo_audio", {
      visita_id: "v1",
      arquivo_path: "visitas/v1/x.webm",
      duracao_seg: 42,
    });
  });

  it("telefone da supervisão: texto do parâmetro, vazio quando não há", async () => {
    expect(
      await criarAssistencialSupabase(
        contexto(resposta("+5511900000099")),
      ).telefoneSupervisao(),
    ).toBe("+5511900000099");
    expect(
      await criarAssistencialSupabase(contexto(resposta(null))).telefoneSupervisao(),
    ).toBe("");
  });
});
