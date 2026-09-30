// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Json } from "@/lib/db/types";
import type { ContextoSupabase } from "./comum";
import {
  agendaDoBanco,
  cascataDoBanco,
  conflitosDoBanco,
  criarEquipeSupabase,
  equipeDoBanco,
  escalaDoBanco,
} from "./equipe";
import {
  criarPortalSupabase,
  fichaAssistencialDoBanco,
  familiasPortalDoBanco,
  perfilPortalDoBanco,
  portalHojeDoBanco,
} from "./portal";

/**
 * Caminho Supabase da equipe e do portal sem banco: o que as funções api.*
 * da 0022_agenda_portal.sql devolvem (provado no pgTAP 022) vira os tipos da
 * tela, e o que a tela manda vira os argumentos certos.
 */

function clienteFalso(respostas: Record<string, Json | { erro: { code: string; message: string } }>) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const cliente = {
    schema: () => ({
      rpc: async (funcao: string, args: Record<string, unknown> = {}) => {
        chamadas.push({ funcao, args });
        const r = respostas[funcao];
        if (r && typeof r === "object" && !Array.isArray(r) && "erro" in r) {
          return { data: null, error: (r as { erro: { code: string; message: string } }).erro };
        }
        return { data: (r ?? null) as Json, error: null };
      },
    }),
  };
  return { contexto: { cliente, usuarioId: "u" } as unknown as ContextoSupabase, chamadas };
}

describe("equipe: do banco para a tela", () => {
  it("a equipe traz o estado, a semana, as famílias, os documentos e o resumo", () => {
    const visao = equipeDoBanco({
      dia: "2026-09-29",
      hoje: "2026-09-29",
      semana_inicio: "2026-09-28",
      documento_aviso_dias: 30,
      limite_visitas_dia: 2,
      documento_tipos: ["Carteira do conselho", 3],
      resumo: { em_visita: 1, em_atendimento: 2, reservada: 0, backup: 1, oferta_pendente: 1, folga: 0, livre: 1, oferta_mais_antiga_horas: 18 },
      profissionais: [
        {
          id: "p1",
          nome: "Profissional Teste",
          funcao: "enfermeira_obstetrica",
          atende_visitas: true,
          conselho: "COREN",
          conselho_uf: "SP",
          conselho_numero: "T-1",
          telefone_e164: "+5511900000201",
          regioes: ["r1"],
          vinculo: "mei",
          valor_hora_centavos: 10000,
          adicional_deslocamento_centavos: 0,
          ativa: true,
          tem_usuario: true,
          usuario_id: "u1",
          status: "em_visita",
          visitas_no_dia: 2,
          semana: [{ dia: "2026-09-28", status: "livre" }],
          familias: [
            { familia_id: "f1", nome_exibicao: "Família Teste", papel: "titular", acompanhamento_id: "a1", estado: "ativo", dias_contratados: 6, dia_atual: 2, dpp: null, data_nascimento: "2026-09-20" },
          ],
          ofertas_pendentes: 0,
          documentos: [{ id: "d1", tipo: "Carteira do conselho", numero: null, validade: "2026-10-19", situacao: "vencendo" }],
          bloqueios: [{ id: "b1", inicio: "2026-10-01", fim: "2026-10-02", motivo: "Folga" }],
        },
      ],
    });
    expect(visao.documentoTipos).toEqual(["Carteira do conselho"]);
    expect(visao.resumo).toMatchObject({ emVisita: 1, ofertaMaisAntigaHoras: 18 });
    const p = visao.profissionais[0]!;
    expect(p).toMatchObject({ status: "em_visita", visitasNoDia: 2, atendeVisitas: true, temUsuario: true, usuarioId: "u1" });
    expect(p.familias[0]).toMatchObject({ nomeExibicao: "Família Teste", diaAtual: 2, diasContratados: 6 });
    expect(p.documentos[0]?.situacao).toBe("vencendo");
    expect(p.bloqueios[0]).toEqual({ id: "b1", inicio: "2026-10-01", fim: "2026-10-02", motivo: "Folga" });
  });

  it("a escala vira duas células por dia", () => {
    const escala = escalaDoBanco({
      semana_inicio: "2026-09-28",
      limite_visitas_dia: 2,
      profissionais: [
        {
          profissional_id: "p1",
          nome: "P",
          dias: [
            { dia: "2026-09-28", turnos: { manha: { estado: "visita", visitas: 1, conflito: false }, tarde: { estado: "livre", visitas: 0, conflito: false } }, visitas: 1, sem_turno: 0, sobrecarga: false, folga: false },
          ],
        },
      ],
    });
    expect(escala.profissionais[0]?.dias[0]).toMatchObject({
      manha: { estado: "visita", visitas: 1 },
      tarde: { estado: "livre" },
      sobrecarga: false,
    });
  });

  it("a agenda traz hora curta, turno e conflitos; código desconhecido de conflito é descartado", () => {
    const agenda = agendaDoBanco({
      desde: "2026-09-29",
      ate: "2026-09-29",
      limite_visitas_dia: 2,
      visitas: [
        {
          visita_id: "v1", acompanhamento_id: "a1", familia_id: "f1", nome_exibicao: "Família Teste", bairro: "Santana", cidade: "São Paulo",
          dia_numero: 2, dias_contratados: 6, data: "2026-09-29", hora_prevista: "09:00:00", horas_por_visita: 3, turno: "manha", estado: "confirmada",
          profissional_id: "p1", profissional_nome: "P", movivel: true,
          conflitos: [{ codigo: "limite_visitas_dia", limite: 2, quantas: 3 }, { codigo: "inventado" }],
        },
      ],
    });
    expect(agenda.visitas[0]).toMatchObject({ horaPrevista: "09:00", turno: "manha", movivel: true });
    expect(agenda.visitas[0]?.conflitos).toEqual([{ codigo: "limite_visitas_dia", limite: 2, quantas: 3 }]);
  });

  it("conflitos e cascata", () => {
    expect(conflitosDoBanco([{ codigo: "sobreposicao", visita_id: "v9" }, { codigo: "periodo_diferente_do_d1", turno: "tarde", referencia: "manha" }])).toEqual([
      { codigo: "sobreposicao", visitaId: "v9" },
      { codigo: "periodo_diferente_do_d1", turno: "tarde", referencia: "manha" },
    ]);
    const c = cascataDoBanco({
      ok: true, simulado: true, deslocamento_dias: 10, conflitos_total: 1,
      visitas: [{ visita_id: "v1", dia_numero: 1, de: "2026-10-01", para: "2026-10-11", hora_prevista: "09:00:00", profissional_id: "p1", conflitos: [{ codigo: "bloqueio" }] }],
    });
    expect(c).toMatchObject({ simulado: true, deslocamentoDias: 10, conflitosTotal: 1 });
    expect(c.visitas[0]).toMatchObject({ para: "2026-10-11", horaPrevista: "09:00", conflitos: [{ codigo: "bloqueio" }] });
  });
});

describe("equipe: da tela para o banco", () => {
  it("reagendar manda os argumentos da função e simular vai como pedido", async () => {
    const { contexto, chamadas } = clienteFalso({ reagendar_visita: { ok: true, simulado: true, conflitos: [{ codigo: "bloqueio" }] } });
    const r = await criarEquipeSupabase(contexto).reagendarVisita({
      visitaId: "v1", data: "2026-10-10", horaPrevista: "10:00", motivo: " ", simular: true,
    });
    expect(r).toEqual({ simulado: true, conflitos: [{ codigo: "bloqueio" }] });
    expect(chamadas[0]).toEqual({
      funcao: "reagendar_visita",
      args: { visita_id: "v1", data: "2026-10-10", hora_prevista: "10:00", profissional_id: undefined, motivo: " ", simular: true, forcar: false },
    });
  });

  it("recusa de negócio do banco vira erro com o código equipe", async () => {
    const { contexto } = clienteFalso({ reagendar_cascata: { erro: { code: "P0001", message: "equipe:conflito dia 2" } } });
    await expect(
      criarEquipeSupabase(contexto).reagendarCascata({ acompanhamentoId: "a1", novaDataInicio: "2026-10-10" }),
    ).rejects.toMatchObject({ codigo: "recusado", message: expect.stringContaining("equipe:conflito") });
  });

  it("bloqueio devolve as visitas afetadas", async () => {
    const { contexto } = clienteFalso({ salvar_bloqueio_agenda: { ok: true, id: "b1", visitas_afetadas: [{ visita_id: "v1", data: "2026-10-01", dia_numero: 2 }] } });
    const r = await criarEquipeSupabase(contexto).salvarBloqueio({ profissionalId: "p1", inicio: "2026-10-01", fim: "2026-10-02", motivo: "Folga" });
    expect(r).toEqual({ id: "b1", visitasAfetadas: [{ visitaId: "v1", data: "2026-10-01", diaNumero: 2 }] });
  });
});

describe("portal: do banco para a tela", () => {
  it("as visitas do dia trazem endereço, contato, chegada e saída", () => {
    const hoje = portalHojeDoBanco({
      dia: "2026-09-29",
      profissional: { id: "p1", nome: "P" },
      status: "em_visita",
      visitas: [
        {
          visita_id: "v1", acompanhamento_id: "a1", familia_id: "f1", nome_exibicao: "Família Teste", bairro: "Santana",
          endereco_atendimento: { logradouro: "Rua Fictícia", numero: "10", complemento: null, bairro: "Santana", cep: "02000-000", referencia: "Portaria" },
          cidade: "São Paulo", uf: "SP", dia_numero: 2, dias_contratados: 6, data: "2026-09-29", hora_prevista: "09:00:00", horas_por_visita: 3,
          turno: "manha", estado: "iniciada", checkin_em: "2026-09-29T12:05:00Z", checkout_em: null, versao: 4, papel: "titular",
          estado_sensivel: "normal", gemelar: false, contato_nome: "Marina Teste", contato_telefone: "+5511900000301",
        },
      ],
      fichas_pendentes: [{ visita_id: "v0", familia_id: "f0", nome_exibicao: "Família Ontem", dia_numero: 1, dias_contratados: 6, data: "2026-09-28", estado: "ficha_pendente" }],
    });
    expect(hoje.status).toBe("em_visita");
    expect(hoje.visitas[0]).toMatchObject({ horaPrevista: "09:00", checkinEm: "2026-09-29T12:05:00Z", checkoutEm: null, versao: 4, papel: "titular" });
    expect(hoje.visitas[0]?.endereco).toMatchObject({ logradouro: "Rua Fictícia", referencia: "Portaria" });
    expect(hoje.fichasPendentes[0]).toMatchObject({ nomeExibicao: "Família Ontem", diaNumero: 1 });
  });

  it("famílias, ficha e perfil", () => {
    const familias = familiasPortalDoBanco([
      {
        familia_id: "f1", nome_exibicao: "Família Teste", bairro: "Santana", cidade: "São Paulo", uf: "SP", dpp: "2026-09-10", data_nascimento: "2026-09-12",
        data_alta: "2026-09-14", data_inicio_efetivo: "2026-09-15", gemelar: false, estado_sensivel: "normal", papel: "titular",
        acompanhamento: { id: "a1", estado: "em_execucao", dias_contratados: 6, periodo: "manha", inicio_efetivo: "2026-09-15", encerramento: null },
        visitas: [{ visita_id: "v1", dia_numero: 1, data: "2026-09-15", hora_prevista: "09:00:00", estado: "encerrada", checkin_em: null, checkout_em: null, profissional_id: "p1" }],
      },
    ]);
    expect(familias[0]).toMatchObject({ papel: "titular", acompanhamento: { diasContratados: 6, periodo: "manha" } });
    expect(familias[0]?.visitas[0]?.horaPrevista).toBe("09:00");

    const ficha = fichaAssistencialDoBanco({
      familia: { id: "f1", nome_exibicao: "Família Teste", bairro: "Santana", endereco_atendimento: { logradouro: "Rua Fictícia" }, cidade: "São Paulo", uf: "SP", dpp: "2026-09-10", idade_gestacional: null, data_nascimento: "2026-09-12", data_alta: null, data_inicio_efetivo: null, gemelar: false, estado_sensivel: "normal" },
      pessoas: [{ id: "x", papel: "mae", nome: "Marina Teste", telefone_e164: "+5511900000301", email: null, contato_principal: true }],
      bebes: [{ id: "b", ordem: 1, nome: "Bebê Teste", sexo: "feminino", data_nascimento: "2026-09-12", peso_nascimento_g: 3210, peso_alta_g: null, tipo_parto: "normal" }],
      medicos: [{ id: "m", especialidade: "pediatra", nome: "Médico Teste", telefone_e164: null, hospital: null }],
    });
    expect(ficha.pessoas[0]?.contatoPrincipal).toBe(true);
    expect(ficha.bebes[0]).toMatchObject({ pesoNascimentoG: 3210, pesoAltaG: null });
    expect(ficha.medicos[0]?.especialidade).toBe("pediatra");

    const perfil = perfilPortalDoBanco({
      profissional: { id: "p1", nome: "P", funcao: "enfermeira_neonatal", conselho: "COREN", conselho_uf: "SP", conselho_numero: "T-2", telefone_e164: null, regioes: ["r1"] },
      status: "livre",
      documentos: [{ id: "d", tipo: "Carteira do conselho", numero: null, validade: "2026-10-19", situacao: "vencendo" }],
      bloqueios: [{ id: "b", inicio: "2026-10-01", fim: "2026-10-02" }],
    });
    expect(perfil.documentos[0]?.situacao).toBe("vencendo");
    expect(perfil.bloqueios).toHaveLength(1);
  });
});

describe("portal: da tela para o banco", () => {
  it("chegada e saída sincronizadas mandam a hora do aparelho e marcam a origem", async () => {
    const { contexto, chamadas } = clienteFalso({
      registrar_chegada: { ok: true, versao: 5 },
      registrar_saida: { ok: true, versao: 6 },
    });
    const portal = criarPortalSupabase(contexto);
    expect(await portal.registrarChegadaSincronizada("v1", "2026-09-29T12:05:00.000Z")).toEqual({ versao: 5 });
    expect(await portal.registrarSaidaSincronizada("v1", "2026-09-29T15:00:00.000Z")).toEqual({ versao: 6 });
    expect(chamadas.map((c) => c.args)).toEqual([
      { visita_id: "v1", quando: "2026-09-29T12:05:00.000Z", via_sincronizacao: true },
      { visita_id: "v1", quando: "2026-09-29T15:00:00.000Z", via_sincronizacao: true },
    ]);
  });

  it("guarda o item processado ou em conflito, e nunca o erro (o aparelho tenta de novo)", async () => {
    const { contexto, chamadas } = clienteFalso({ sincronizacao_registrar: null });
    const portal = criarPortalSupabase(contexto);
    const item = {
      id: "i1", usuarioId: "u", entidade: "visita" as const, entidadeId: "v1", campo: "checkin_em",
      payload: "2026-09-29T12:05:00.000Z", versaoBase: 3, criadoNoClienteEm: "2026-09-29T12:05:01.000Z",
    };
    await portal.guardarProcessado(item, { id: "i1", status: "erro", erro: "fora do ar" });
    expect(chamadas).toHaveLength(0);
    await portal.guardarProcessado(item, { id: "i1", status: "conflito", conflito: { original: {}, versaoAtual: 5, tentativa: "x" } });
    expect(chamadas[0]?.funcao).toBe("sincronizacao_registrar");
    expect(chamadas[0]?.args).toMatchObject({ item_id: "i1", entidade: "visita", status: "conflito", versao_base: 3 });
  });

  it("o item conflitado volta com o conflito; o inexistente volta nulo", async () => {
    const { contexto } = clienteFalso({
      sincronizacao_item: { status: "conflito", conflito: { original: {}, versaoAtual: 5, tentativa: "x" }, entidade: "visita", entidade_id: "v1" },
    });
    const r = await criarPortalSupabase(contexto).resultadoProcessado("i1");
    expect(r).toMatchObject({ id: "i1", status: "conflito", conflito: { versaoAtual: 5 } });
    const { contexto: vazio } = clienteFalso({ sincronizacao_item: null });
    expect(await criarPortalSupabase(vazio).resultadoProcessado("i2")).toBeNull();
  });

  it("ficha de família que não é da enfermeira volta nula", async () => {
    const { contexto } = clienteFalso({ ficha_assistencial: { erro: { code: "42501", message: "não atribuída" } } });
    expect(await criarPortalSupabase(contexto).obterFichaAssistencial("f9")).toBeNull();
  });
});
