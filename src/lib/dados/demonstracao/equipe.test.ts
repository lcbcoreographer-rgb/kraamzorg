// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { hojeEmBrasilia, somarDias } from "@/lib/agenda/datas";
import { codigoEquipe } from "../erros";
import type { Repositorios } from "../repositorios";
import { criarRepositoriosDemonstracao } from "./index";
import {
  DOCUMENTO_AVISO_DIAS,
  ID_PROFISSIONAL_NORTE_1,
  ID_PROFISSIONAL_SUL_1,
  ID_PROFISSIONAL_SUL_2,
  ID_PROFISSIONAL_SUL_3,
  PARAMETROS_EQUIPE,
} from "./equipe-fixtures";
import { obterLojaEquipe, reiniciarLojaEquipe } from "./equipe";
import { USUARIOS } from "./fixtures";
import { reiniciarLoja } from "./loja";

/**
 * Equipe, agenda e portal na demonstração (P37 e P38): as regras de
 * 0022_agenda_portal.sql que o pgTAP 022 prova no banco, aqui na loja em
 * memória que as telas e o e2e usam. E a paridade com o seed.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function repos(papel: Papel, aal: "aal1" | "aal2" = "aal2"): Repositorios {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

async function recusa(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (erro) {
    return (
      codigoEquipe(erro) ??
      (erro instanceof Error
        ? erro.name + ":" + (erro as { codigo?: string }).codigo
        : "erro")
    );
  }
}

beforeEach(() => {
  // relógio fixo: terça-feira, 29/09/2026, 12:00 em Brasília. As janelas da
  // DPP das famílias de demonstração dependem do dia.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T15:00:00Z"));
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaEquipe();
});

afterEach(() => {
  vi.useRealTimers();
  for (const [chave, valor] of Object.entries(ORIGINAL)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

const hoje = () => hojeEmBrasilia();

describe("equipe: quem vê", () => {
  it("coordenação e diretoria abrem a equipe; os outros papéis não", async () => {
    for (const papel of ["coordenacao", "diretoria"] as const) {
      const visao = await repos(papel).equipe.obterEquipe();
      expect(visao.profissionais.length).toBeGreaterThan(3);
    }
    for (const papel of [
      "comercial",
      "financeiro",
      "enfermeira",
      "marketing",
    ] as const) {
      const r = repos(papel, "aal2");
      await expect(r.equipe.obterEquipe()).rejects.toMatchObject({
        codigo: "sem_permissao",
      });
    }
  });

  it("coordenação sem MFA em AAL1 é recusada", async () => {
    await expect(
      repos("coordenacao", "aal1").equipe.obterEquipe(),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});

describe("equipe: estado sempre calculado", () => {
  it("cada estado do fluxo C sai das designações, visitas e bloqueios", async () => {
    const visao = await repos("coordenacao").equipe.obterEquipe();
    const por = (id: string) =>
      visao.profissionais.find((p) => p.id === id)?.status;
    expect(por(ID_PROFISSIONAL_SUL_2)).toBe("em_atendimento");
    expect(por(ID_PROFISSIONAL_NORTE_1)).toBe("em_atendimento");
    expect(por(ID_PROFISSIONAL_SUL_3)).toBe("oferta_pendente");
    expect(por(ID_PROFISSIONAL_SUL_1)).toBe("folga");
  });

  it("o resumo conta só quem faz visita e traz a oferta mais antiga", async () => {
    const { resumo } = await repos("diretoria").equipe.obterEquipe();
    expect(resumo.emAtendimento).toBe(2);
    expect(resumo.ofertaPendente).toBe(1);
    expect(resumo.folga).toBe(1);
    expect(resumo.emVisita).toBe(0);
    expect(resumo.ofertaMaisAntigaHoras).toBe(18);
  });

  it("a coordenação está na lista mas não conta como quem faz visita", async () => {
    const visao = await repos("coordenacao").equipe.obterEquipe();
    const coord = visao.profissionais.find((p) => p.funcao === "coordenacao");
    expect(coord?.atendeVisitas).toBe(false);
    const contadas = Object.entries(visao.resumo)
      .filter(([chave]) => chave !== "ofertaMaisAntigaHoras")
      .reduce((soma, [, n]) => soma + (n as number), 0);
    const quemFazVisita = visao.profissionais.filter(
      (p) => p.ativa && p.atendeVisitas,
    ).length;
    expect(contadas).toBe(quemFazVisita);
  });

  it("documentos vencidos e vencendo aparecem com a situação", async () => {
    const visao = await repos("coordenacao").equipe.obterEquipe();
    const sul2 = visao.profissionais.find(
      (p) => p.id === ID_PROFISSIONAL_SUL_2,
    )!;
    expect(sul2.documentos.map((d) => d.situacao)).toEqual([
      "vencendo",
      "em_dia",
    ]);
    const sul3 = visao.profissionais.find(
      (p) => p.id === ID_PROFISSIONAL_SUL_3,
    )!;
    expect(sul3.documentos[0]?.situacao).toBe("vencido");
    expect(visao.documentoAvisoDias).toBe(DOCUMENTO_AVISO_DIAS);
  });

  it("a inativa só aparece quando se pede", async () => {
    const r = repos("coordenacao");
    expect(
      (await r.equipe.obterEquipe()).profissionais.some((p) => !p.ativa),
    ).toBe(false);
    expect(
      (
        await r.equipe.obterEquipe({ incluirInativas: true })
      ).profissionais.some((p) => !p.ativa),
    ).toBe(true);
  });

  it("filtro por região", async () => {
    const l = await repos("coordenacao").equipe.obterEquipe({
      regiaoId: "00000000-0000-4000-8002-000000000002",
    });
    expect(l.profissionais.map((p) => p.id)).toContain(ID_PROFISSIONAL_NORTE_1);
    expect(l.profissionais.map((p) => p.id)).not.toContain(
      ID_PROFISSIONAL_SUL_2,
    );
  });
});

describe("portal: só as famílias atribuídas", () => {
  it("a enfermeira vê as duas famílias dela e nada das outras", async () => {
    const portal = repos("enfermeira").portal;
    const familias = await portal.listarFamilias();
    expect(familias.map((f) => f.nomeExibicao)).toEqual([
      "Família Teste Jade",
      "Família Teste Maré",
    ]);
    const hojeVisitas = await portal.obterHoje();
    expect(hojeVisitas.visitas.map((v) => v.nomeExibicao)).toEqual([
      "Família Teste Maré",
      "Família Teste Jade",
    ]);
    expect(hojeVisitas.visitas.map((v) => v.turno)).toEqual(["manha", "tarde"]);
  });

  it("não leva dado comercial", async () => {
    const dia = await repos("enfermeira").portal.obterHoje();
    const chaves = Object.keys(dia.visitas[0]!);
    for (const proibida of [
      "origem",
      "utm",
      "score",
      "oportunidade",
      "estagioP1",
      "estagioP2",
      "valorCentavos",
    ]) {
      expect(chaves).not.toContain(proibida);
    }
  });

  it("a ficha de uma família que não é dela não abre", async () => {
    const portal = repos("enfermeira").portal;
    const lua = obterLojaEquipe().acompanhamentos.find((a) =>
      a.id.endsWith("000000000003"),
    )!;
    expect(await portal.obterFichaAssistencial(lua.familiaId)).toBeNull();
    const dela = (await portal.listarFamilias())[0]!;
    const ficha = await portal.obterFichaAssistencial(dela.familiaId);
    expect(ficha?.familia.nomeExibicao).toBe(dela.nomeExibicao);
    expect(ficha?.pessoas.length).toBeGreaterThan(0);
  });

  it("outros papéis não abrem o portal", async () => {
    await expect(repos("coordenacao").portal.obterHoje()).rejects.toMatchObject(
      { codigo: "sem_permissao" },
    );
    await expect(
      repos("comercial").portal.listarFamilias(),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      repos("enfermeira", "aal1").portal.obterHoje(),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("as fichas pendentes vêm em destaque", async () => {
    const dia = await repos("enfermeira").portal.obterHoje();
    expect(dia.fichasPendentes.map((f) => f.nomeExibicao)).toEqual([
      "Família Teste Maré",
    ]);
    expect(dia.fichasPendentes[0]).toMatchObject({
      diaNumero: 1,
      diasContratados: 6,
      estado: "ficha_pendente",
    });
  });

  it("desativar a profissional corta o acesso na hora", async () => {
    const coord = repos("coordenacao");
    const sul2 = (await coord.equipe.obterEquipe()).profissionais.find(
      (p) => p.id === ID_PROFISSIONAL_SUL_2,
    )!;
    await coord.equipe.salvarProfissional({
      id: sul2.id,
      nome: sul2.nome,
      funcao: sul2.funcao,
      conselhoUf: sul2.conselhoUf,
      conselhoNumero: sul2.conselhoNumero,
      telefoneE164: sul2.telefoneE164,
      regioes: sul2.regioes,
      vinculo: sul2.vinculo,
      valorHoraCentavos: sul2.valorHoraCentavos,
      adicionalDeslocamentoCentavos: 0,
      ativa: false,
      usuarioId: USUARIOS.find((u) => u.papeis.includes("enfermeira"))!.id,
    });
    expect(await recusa(repos("enfermeira").portal.obterHoje())).toBe(
      "sem_profissional",
    );
  });
});

describe("chegada e saída: o estado muda sozinho", () => {
  it("em visita no check-in e volta ao estado anterior no check-out", async () => {
    const portal = repos("enfermeira").portal;
    const coord = repos("coordenacao").equipe;
    const dia = await portal.obterHoje();
    const visita = dia.visitas[0]!;
    expect(dia.status).toBe("em_atendimento");

    const chegada = new Date(Date.now() - 10 * 60_000).toISOString();
    const r1 = await portal.registrarChegadaSincronizada(
      visita.visitaId,
      chegada,
    );
    expect(r1.versao).toBe(visita.versao + 1);
    expect((await portal.obterHoje()).status).toBe("em_visita");
    const visao = await coord.obterEquipe();
    expect(
      visao.profissionais.find((p) => p.id === ID_PROFISSIONAL_SUL_2)?.status,
    ).toBe("em_visita");
    expect(visao.resumo.emVisita).toBe(1);
    const depois = (await portal.obterHoje()).visitas[0]!;
    expect(depois.estado).toBe("iniciada");
    expect(depois.checkinEm).toBe(chegada);

    // idempotente: a segunda chegada não mexe em nada
    const r2 = await portal.registrarChegadaSincronizada(
      visita.visitaId,
      new Date().toISOString(),
    );
    expect(r2.versao).toBe(r1.versao);
    expect((await portal.obterHoje()).visitas[0]!.checkinEm).toBe(chegada);

    const saida = new Date(Date.now() - 60_000).toISOString();
    const r3 = await portal.registrarSaidaSincronizada(visita.visitaId, saida);
    expect(r3.versao).toBe(r1.versao + 1);
    const fim = await portal.obterHoje();
    expect(fim.status).toBe("em_atendimento");
    expect(fim.visitas[0]).toMatchObject({
      estado: "ficha_pendente",
      checkoutEm: saida,
    });
    expect(fim.fichasPendentes.map((f) => f.visitaId)).toContain(
      visita.visitaId,
    );
    expect((await coord.obterEquipe()).resumo.emVisita).toBe(0);
  });

  it("recusa saída sem chegada, saída antes da chegada, hora no futuro e de outro dia", async () => {
    const portal = repos("enfermeira").portal;
    const [primeira] = (await portal.obterHoje()).visitas;
    const id = primeira!.visitaId;
    expect(
      await recusa(
        portal.registrarSaidaSincronizada(id, new Date().toISOString()),
      ),
    ).toBe("saida_sem_chegada");
    expect(
      await recusa(
        portal.registrarChegadaSincronizada(
          id,
          new Date(Date.now() + 2 * 3_600_000).toISOString(),
        ),
      ),
    ).toBe("hora_no_futuro");
    expect(
      await recusa(
        portal.registrarChegadaSincronizada(
          id,
          new Date(Date.now() - 24 * 3_600_000).toISOString(),
        ),
      ),
    ).toBe("fora_do_dia_da_visita");
    await portal.registrarChegadaSincronizada(
      id,
      new Date(Date.now() - 10 * 60_000).toISOString(),
    );
    expect(
      await recusa(
        portal.registrarSaidaSincronizada(
          id,
          new Date(Date.now() - 20 * 60_000).toISOString(),
        ),
      ),
    ).toBe("saida_antes_da_chegada");
  });

  it("não registra na visita de outra profissional", async () => {
    const portal = repos("enfermeira").portal;
    const dela = obterLojaEquipe().visitas.find(
      (v) => v.profissionalId === ID_PROFISSIONAL_NORTE_1 && v.data === hoje(),
    )!;
    await expect(
      portal.registrarChegadaSincronizada(dela.id, new Date().toISOString()),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });

  it("guarda o item processado e devolve o mesmo resultado", async () => {
    const portal = repos("enfermeira").portal;
    const item = {
      id: "11111111-1111-4111-8111-111111111111",
      usuarioId: "u",
      entidade: "visita" as const,
      entidadeId: null,
      campo: "checkin_em",
      payload: "x",
      versaoBase: 1,
      criadoNoClienteEm: new Date().toISOString(),
    };
    expect(await portal.resultadoProcessado(item.id)).toBeNull();
    await portal.guardarProcessado(item, {
      id: item.id,
      status: "processado",
      versaoResultante: 2,
    });
    expect(await portal.resultadoProcessado(item.id)).toEqual({
      id: item.id,
      status: "processado",
      versaoResultante: 2,
    });
  });
});

describe("agenda: conflitos aparecem antes de salvar", () => {
  it("simular mostra o conflito e não grava", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const jadeD2 = l.visitas.find(
      (v) => v.acompanhamentoId.endsWith("000000000002") && v.diaNumero === 2,
    )!;
    const antes = {
      data: jadeD2.data,
      hora: jadeD2.horaPrevista,
      versao: jadeD2.versao,
    };
    // Jade é da tarde; 09:30 cai em cima da visita das 09:00 da Maré e muda o período
    const r = await coord.reagendarVisita({
      visitaId: jadeD2.id,
      data: hoje(),
      horaPrevista: "09:30",
      simular: true,
    });
    expect(r.simulado).toBe(true);
    expect(r.conflitos.map((c) => c.codigo)).toEqual([
      "periodo_diferente_do_d1",
      "sobreposicao",
    ]);
    expect({
      data: jadeD2.data,
      hora: jadeD2.horaPrevista,
      versao: jadeD2.versao,
    }).toEqual(antes);
  });

  it("com conflito, só grava com confirmação e motivo", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const jadeD2 = l.visitas.find(
      (v) => v.acompanhamentoId.endsWith("000000000002") && v.diaNumero === 2,
    )!;
    const pedido = { visitaId: jadeD2.id, data: hoje(), horaPrevista: "09:30" };
    expect(await recusa(coord.reagendarVisita(pedido))).toBe("conflito");
    expect(
      await recusa(coord.reagendarVisita({ ...pedido, forcar: true })),
    ).toBe("motivo_obrigatorio");
    expect(jadeD2.data).toBe(somarDias(hoje(), 1));
    await coord.reagendarVisita({
      ...pedido,
      forcar: true,
      motivo: "Única data possível da família",
    });
    expect(jadeD2.data).toBe(hoje());
    expect(jadeD2.estado).toBe("agendada");
  });

  it("sem conflito, mantém o horário quando a hora não vem", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const mareD3 = l.visitas.find(
      (v) => v.acompanhamentoId.endsWith("000000000001") && v.diaNumero === 3,
    )!;
    await coord.reagendarVisita({
      visitaId: mareD3.id,
      data: somarDias(hoje(), 10),
    });
    expect(mareD3.data).toBe(somarDias(hoje(), 10));
    expect(mareD3.horaPrevista).toBe("09:00");
  });

  it("outra profissional precisa ter designação aceita na família", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const mareD3 = l.visitas.find(
      (v) => v.acompanhamentoId.endsWith("000000000001") && v.diaNumero === 3,
    )!;
    expect(
      await recusa(
        coord.reagendarVisita({
          visitaId: mareD3.id,
          data: somarDias(hoje(), 10),
          profissionalId: ID_PROFISSIONAL_SUL_3,
        }),
      ),
    ).toBe("sem_designacao");
  });

  it("visita que já começou não se reagenda", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const feita = l.visitas.find((v) => v.estado === "ficha_pendente")!;
    expect(
      await recusa(
        coord.reagendarVisita({
          visitaId: feita.id,
          data: somarDias(hoje(), 10),
        }),
      ),
    ).toBe("visita_nao_movivel");
  });

  it("a agenda do período marca o conflito de cada visita e respeita o limite de 62 dias", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const jadeD2 = l.visitas.find(
      (v) => v.acompanhamentoId.endsWith("000000000002") && v.diaNumero === 2,
    )!;
    await coord.reagendarVisita({
      visitaId: jadeD2.id,
      data: hoje(),
      horaPrevista: "09:30",
      forcar: true,
      motivo: "Teste",
    });
    const agenda = await coord.obterAgenda({ desde: hoje(), ate: hoje() });
    expect(agenda.visitas.length).toBeGreaterThanOrEqual(3);
    const comConflito = agenda.visitas.filter((v) => v.conflitos.length > 0);
    expect(comConflito.map((v) => v.visitaId)).toContain(jadeD2.id);
    expect(
      await recusa(
        coord.obterAgenda({ desde: hoje(), ate: somarDias(hoje(), 90) }),
      ),
    ).toBe("periodo_longo");
    expect(
      await recusa(
        coord.obterAgenda({ desde: hoje(), ate: somarDias(hoje(), -1) }),
      ),
    ).toBe("periodo_invalido");
  });
});

describe("cascata: nascimento ou alta mudam", () => {
  it("todas as visitas andam o mesmo número de dias, com o mesmo horário e período", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const acomp = l.acompanhamentos.find((a) => a.id.endsWith("000000000002"))!;
    const antes = l.visitas
      .filter((v) => v.acompanhamentoId === acomp.id)
      .map((v) => ({ id: v.id, hora: v.horaPrevista, data: v.data }));
    const nova = somarDias(hoje(), 12);

    const simulado = await coord.reagendarCascata({
      acompanhamentoId: acomp.id,
      novaDataInicio: nova,
      simular: true,
    });
    expect(simulado.simulado).toBe(true);
    expect(simulado.deslocamentoDias).toBe(12);
    expect(simulado.visitas).toHaveLength(6);
    expect(simulado.visitas[0]).toMatchObject({ diaNumero: 1, para: nova });
    expect(
      l.visitas
        .filter((v) => v.acompanhamentoId === acomp.id)
        .map((v) => v.data),
    ).toEqual(antes.map((a) => a.data));

    const feito = await coord.reagendarCascata({
      acompanhamentoId: acomp.id,
      novaDataInicio: nova,
      motivo: "Nascimento antecipado",
    });
    expect(feito.conflitosTotal).toBe(0);
    const depois = l.visitas
      .filter((v) => v.acompanhamentoId === acomp.id)
      .sort((a, b) => a.diaNumero - b.diaNumero);
    expect(depois.map((v) => v.data)).toEqual(
      Array.from({ length: 6 }, (_, i) => somarDias(nova, i)),
    );
    expect(depois.map((v) => v.horaPrevista)).toEqual(antes.map((a) => a.hora));
    expect(new Set(depois.map((v) => v.estado))).toEqual(new Set(["agendada"]));
  });

  it("só anda o que ainda não começou", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const acomp = l.acompanhamentos.find((a) => a.id.endsWith("000000000001"))!;
    const feita = l.visitas.find(
      (v) => v.acompanhamentoId === acomp.id && v.diaNumero === 1,
    )!;
    const dataFeita = feita.data;
    const r = await coord.reagendarCascata({
      acompanhamentoId: acomp.id,
      novaDataInicio: somarDias(hoje(), 20),
      motivo: "x",
    });
    expect(r.visitas.map((v) => v.diaNumero)).toEqual([2, 3, 4, 5, 6]);
    expect(feita.data).toBe(dataFeita);
  });

  it("conflito recusa a cascata inteira e não deixa meia cascata", async () => {
    const coord = repos("coordenacao").equipe;
    const l = obterLojaEquipe();
    const acomp = l.acompanhamentos.find((a) => a.id.endsWith("000000000002"))!;
    const datas = l.visitas
      .filter((v) => v.acompanhamentoId === acomp.id)
      .map((v) => v.data);
    // a Sul 2 tem a Maré às 09:00 nos dias 0 a 4: cair de manhã nesses dias é conflito
    const alvo = somarDias(hoje(), 2);
    const sim = await coord.reagendarCascata({
      acompanhamentoId: acomp.id,
      novaDataInicio: alvo,
      simular: true,
    });
    expect(sim.conflitosTotal).toBe(0); // Jade é da tarde e a Maré da manhã: sem choque
    // muda Jade para a manhã: agora choca
    for (const v of l.visitas.filter((x) => x.acompanhamentoId === acomp.id))
      v.horaPrevista = "09:30";
    expect(
      await recusa(
        coord.reagendarCascata({
          acompanhamentoId: acomp.id,
          novaDataInicio: alvo,
        }),
      ),
    ).toBe("conflito");
    expect(
      l.visitas
        .filter((v) => v.acompanhamentoId === acomp.id)
        .map((v) => v.data),
    ).toEqual(datas);
    expect(
      await recusa(
        coord.reagendarCascata({
          acompanhamentoId: acomp.id,
          novaDataInicio: alvo,
          forcar: true,
        }),
      ),
    ).toBe("motivo_obrigatorio");
  });
});

describe("cadastro", () => {
  it("cria, altera e valida a profissional", async () => {
    const coord = repos("coordenacao").equipe;
    const base = {
      nome: "Profissional Teste Nova",
      funcao: "enfermeira_obstetrica",
      conselhoUf: "sp",
      conselhoNumero: "TESTE-0100",
      telefoneE164: "+5511900002299",
      regioes: ["00000000-0000-4000-8002-000000000001"],
      vinculo: "mei" as const,
      valorHoraCentavos: 10000,
      adicionalDeslocamentoCentavos: 5000,
      ativa: true,
    };
    const criada = await coord.salvarProfissional(base);
    expect(criada.nova).toBe(true);
    const alterada = await coord.salvarProfissional({
      ...base,
      id: criada.id,
      ativa: false,
    });
    expect(alterada).toEqual({ id: criada.id, nova: false });
    expect(
      await recusa(
        coord.salvarProfissional({ ...base, telefoneE164: "11999990000" }),
      ),
    ).toBe("telefone_invalido");
    expect(
      await recusa(coord.salvarProfissional({ ...base, funcao: "pediatra" })),
    ).toBe("funcao_invalida");
    expect(
      await recusa(coord.salvarProfissional({ ...base, conselhoNumero: null })),
    ).toBe("conselho_incompleto");
    expect(
      await recusa(
        coord.salvarProfissional({
          ...base,
          regioes: ["00000000-0000-4000-8002-00000000abcd"],
        }),
      ),
    ).toBe("regiao_inexistente");
    expect(
      await recusa(
        coord.salvarProfissional({ ...base, valorHoraCentavos: -1 }),
      ),
    ).toBe("valor_invalido");
  });

  it("documento com validade e bloqueio com as visitas afetadas", async () => {
    const coord = repos("coordenacao").equipe;
    const doc = await coord.salvarDocumento({
      profissionalId: ID_PROFISSIONAL_SUL_3,
      tipo: "Carteira do conselho",
      numero: "TESTE-1",
      validade: somarDias(hoje(), 400),
    });
    const visao = await coord.obterEquipe();
    expect(
      visao.profissionais
        .find((p) => p.id === ID_PROFISSIONAL_SUL_3)!
        .documentos.find((d) => d.id === doc.id)?.situacao,
    ).toBe("em_dia");
    expect(
      await recusa(
        coord.salvarDocumento({
          profissionalId: ID_PROFISSIONAL_SUL_3,
          tipo: "  ",
        }),
      ),
    ).toBe("tipo_obrigatorio");

    const bloqueio = await coord.salvarBloqueio({
      profissionalId: ID_PROFISSIONAL_SUL_2,
      inicio: somarDias(hoje(), 1),
      fim: somarDias(hoje(), 2),
      motivo: "Consulta médica",
    });
    expect(bloqueio.visitasAfetadas.length).toBe(4);
    expect(
      await recusa(
        coord.salvarBloqueio({
          profissionalId: ID_PROFISSIONAL_SUL_2,
          inicio: hoje(),
          fim: somarDias(hoje(), -1),
          motivo: "x",
        }),
      ),
    ).toBe("periodo_invalido");
    expect(
      await recusa(
        coord.salvarBloqueio({
          profissionalId: ID_PROFISSIONAL_SUL_2,
          inicio: hoje(),
          fim: hoje(),
          motivo: " ",
        }),
      ),
    ).toBe("motivo_obrigatorio");
    await coord.removerBloqueio(bloqueio.id);
    expect(await recusa(coord.removerBloqueio(bloqueio.id))).toBe(
      "bloqueio_inexistente",
    );
  });
});

describe("escala semanal", () => {
  it("sete dias por dois turnos, com visita, folga e sobrecarga", async () => {
    const coord = repos("coordenacao").equipe;
    const escala = await coord.obterEscala();
    const sul2 = escala.profissionais.find(
      (p) => p.profissionalId === ID_PROFISSIONAL_SUL_2,
    )!;
    expect(sul2.dias).toHaveLength(7);
    const diaHoje = sul2.dias.find((d) => d.dia === hoje())!;
    expect(diaHoje.manha.estado).toBe("visita");
    expect(diaHoje.tarde.estado).toBe("visita");
    expect(diaHoje.sobrecarga).toBe(false);
    const sul1 = escala.profissionais.find(
      (p) => p.profissionalId === ID_PROFISSIONAL_SUL_1,
    )!;
    expect(sul1.dias.find((d) => d.dia === hoje())!.manha.estado).toBe("folga");
    expect(
      escala.profissionais.some((p) => p.nome.includes("Coordenação")),
    ).toBe(false);
  });

  it("a enfermeira vê só a própria linha", async () => {
    const escala = await repos("enfermeira").equipe.obterEscala();
    expect(escala.profissionais.map((p) => p.profissionalId)).toEqual([
      ID_PROFISSIONAL_SUL_2,
    ]);
  });
});

describe("paridade com o seed", () => {
  const seed = readFileSync(
    path.join(process.cwd(), "supabase", "seed.sql"),
    "utf8",
  );

  it("os parâmetros da agenda e do portal são os mesmos do seed", () => {
    for (const chave of [
      "agenda_visitas_por_dia",
      "periodos_visita",
      "visita_registro_horario",
      "documento_profissional_tipos",
    ]) {
      const achado = new RegExp(`\\('${chave}',\\s*'([^']+)'`).exec(seed);
      expect(achado, chave).not.toBeNull();
      expect(JSON.parse(achado![1]!), chave).toEqual(PARAMETROS_EQUIPE[chave]);
    }
  });

  it("a janela da DPP e a validade do acesso pós-encerramento são as do seed", () => {
    const janela = /\('janela_dpp_dias', '([^']+)'/.exec(seed);
    expect(JSON.parse(janela![1]!)).toEqual(PARAMETROS_EQUIPE.janela_dpp_dias);
    const acesso =
      /\('acesso_enfermeira_pos_encerramento_dias', '([^']+)'/.exec(seed);
    expect(JSON.parse(acesso![1]!)).toEqual(
      PARAMETROS_EQUIPE.acesso_enfermeira_pos_encerramento_dias,
    );
  });

  it("o aviso de documento vencendo é o do gatilho da automação (30 dias)", () => {
    const gatilho =
      /\('documento_vencendo'[\s\S]*?'\{"tipo":"dias_do_vencimento","dias":(\d+)\}'/.exec(
        seed,
      );
    expect(Number(gatilho![1])).toBe(DOCUMENTO_AVISO_DIAS);
  });
});
