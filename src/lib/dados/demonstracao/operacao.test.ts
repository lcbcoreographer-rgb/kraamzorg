// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { ErroRepositorio } from "../erros";
import { criarRepositoriosDemonstracao } from "./index";
import { USUARIOS } from "./fixtures";
import {
  avisosDaOperacaoDemo,
  obterLojaOperacao,
  reiniciarLojaOperacao,
} from "./operacao";
import { PARAMETROS_OPERACAO, SUL_1, SUL_2, SUL_3 } from "./operacao-fixtures";

/**
 * Operação na demonstração (P35 e P36): as mesmas regras de
 * 0021_prenatal_nascimento.sql que o pgTAP prova no banco
 * (supabase/tests/021_prenatal_nascimento.sql), aqui na loja em memória que
 * as telas e o e2e usam.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function repos(papel: Papel, aal: "aal1" | "aal2" = "aal2") {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

function diaBrasilia(somar = 0): string {
  const hoje = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const base = new Date(`${hoje}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + somar);
  return base.toISOString().slice(0, 10);
}

async function idDaFamilia(nome: string): Promise<string> {
  const { operacao } = repos("coordenacao");
  const consultas = await operacao.listarConsultas();
  const achada = consultas.find((c) => c.nome === `Família Teste ${nome}`);
  if (achada) return achada.familiaId;
  const radar = await operacao.radar(null);
  const noRadar =
    radar.familias.find((f) => f.nome === `Família Teste ${nome}`) ??
    radar.nasceram.find((f) => f.nome === `Família Teste ${nome}`);
  if (!noRadar) throw new Error(nome);
  return noRadar.familiaId;
}

async function recusaCom(promessa: Promise<unknown>, codigo: string) {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ErroRepositorio);
  expect((erro as ErroRepositorio).message).toContain(`operacao:${codigo}`);
}

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaOperacao();
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("consulta pré-natal e entrevista (P35)", () => {
  it("a entrevista nova nasce vazia e o repositório não tem como duplicar outra", async () => {
    const { operacao } = repos("coordenacao");
    expect(
      Object.keys(operacao).some((k) => /duplic|copiar|clonar/i.test(k)),
    ).toBe(false);

    const begonia = await operacao.abrirEntrevista(
      await idDaFamilia("Begônia"),
    );
    expect(begonia.respostas.blocos).toEqual({});
    expect(begonia.consulta.progresso).toBeNull();
    expect(begonia.definicao.blocos.length).toBeGreaterThan(0);

    // A Jasmim já tem respostas; as dela não vazam para a Begônia.
    const jasmim = await operacao.abrirEntrevista(await idDaFamilia("Jasmim"));
    expect(JSON.stringify(jasmim.respostas)).toContain("Helena Teste");
    expect(JSON.stringify(begonia.respostas)).not.toContain("Helena Teste");
  });

  it("guarda a etapa e o campo onde parou, e reabre no mesmo lugar", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Begônia");
    const aberta = await operacao.abrirEntrevista(familiaId);
    const r = await operacao.salvarCampo({
      consultaId: aberta.consulta.id,
      bloco: "D",
      campo: "intercorrencias_gestacao_atual",
      valor: "Nenhuma",
      versaoBase: aberta.consulta.versao,
      progresso: { etapa: 4, campo: "D.intercorrencias_gestacao_atual" },
    });
    expect(r).toMatchObject({ ok: true, conflito: false, repetido: false });

    const reaberta = await operacao.abrirEntrevista(familiaId);
    expect(reaberta.consulta.progresso).toMatchObject({
      etapa: 4,
      campo: "D.intercorrencias_gestacao_atual",
    });
    expect(reaberta.respostas.blocos.D).toEqual({
      intercorrencias_gestacao_atual: "Nenhuma",
    });
    const lista = await operacao.listarConsultas();
    expect(lista.find((c) => c.familiaId === familiaId)?.etapa).toBe(4);
  });

  it("conflito de versão devolve o valor que estava lá; o mesmo item enviado duas vezes não duplica", async () => {
    const { operacao } = repos("coordenacao");
    const aberta = await operacao.abrirEntrevista(await idDaFamilia("Begônia"));
    const base = aberta.consulta.versao;
    const primeiro = await operacao.salvarCampo({
      consultaId: aberta.consulta.id,
      bloco: "C",
      campo: "nome_da_gestante",
      valor: "Ana Teste",
      versaoBase: base,
      itemId: "item-1",
    });
    expect(primeiro.ok).toBe(true);

    // Reenvio do mesmo item da fila: repetido, sem mudar a versão.
    const repetido = await operacao.salvarCampo({
      consultaId: aberta.consulta.id,
      bloco: "C",
      campo: "nome_da_gestante",
      valor: "Ana Teste",
      versaoBase: base,
      itemId: "item-1",
    });
    expect(repetido).toMatchObject({ ok: true, repetido: true });
    expect(repetido.versao).toBe(primeiro.versao);

    // Outro aparelho, com a versão antiga, mexendo no mesmo campo.
    const conflito = await operacao.salvarCampo({
      consultaId: aberta.consulta.id,
      bloco: "C",
      campo: "nome_da_gestante",
      valor: "Outra Teste",
      versaoBase: base,
      itemId: "item-2",
    });
    expect(conflito.conflito).toBe(true);
    expect(conflito.ok).toBe(false);
    expect(conflito.original).toBe("Ana Teste");
  });

  it("campo automático e campo que não existe são recusados", async () => {
    const { operacao } = repos("coordenacao");
    const aberta = await operacao.abrirEntrevista(await idDaFamilia("Begônia"));
    const pedido = {
      consultaId: aberta.consulta.id,
      valor: "x",
      versaoBase: aberta.consulta.versao,
    };
    await recusaCom(
      operacao.salvarCampo({
        ...pedido,
        bloco: "B",
        campo: "idade_gestacional_atual",
      }),
      "campo_automatico",
    );
    await recusaCom(
      operacao.salvarCampo({
        ...pedido,
        bloco: "B",
        campo: "campo_que_nao_existe",
      }),
      "campo_inexistente",
    );
  });

  it("depois de concluída, resposta nova exige motivo", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Girassol"); // já realizada no seed
    const aberta = await operacao.abrirEntrevista(familiaId);
    await recusaCom(
      operacao.salvarCampo({
        consultaId: aberta.consulta.id,
        bloco: "C",
        campo: "nome_da_gestante",
        valor: "Bia Teste",
        versaoBase: aberta.consulta.versao,
      }),
      "motivo_obrigatorio",
    );
    await recusaCom(
      operacao.concluirEntrevista(aberta.consulta.id),
      "consulta_ja_realizada",
    );
  });

  it("o aviso das 34 semanas é só da coordenação; o comercial vê apenas o estado", async () => {
    const coord = repos("coordenacao").operacao;
    const lista = await coord.listarConsultas();
    const antúrio = lista.find((c) => c.nome === "Família Teste Antúrio");
    const begonia = lista.find((c) => c.nome === "Família Teste Begônia");
    expect(antúrio?.chegouAlerta).toBe(true);
    expect(antúrio?.igSemanas).toBeGreaterThanOrEqual(
      PARAMETROS_OPERACAO.prenatal_semanas_alerta,
    );
    expect(begonia?.chegouAlerta).toBe(false);

    const comercial = repos("comercial", "aal1").operacao;
    await expect(comercial.listarConsultas()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(
      comercial.abrirEntrevista(antúrio!.familiaId),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    const estado = await comercial.estadoPrenatal(antúrio!.familiaId);
    expect(estado).toMatchObject({
      existe: true,
      status: "pendente",
      emAndamento: false,
    });
    expect(Object.keys(estado)).not.toContain("respostas");
  });

  it("marcar a consulta leva o P2 adiante e conclui a tarefa de agendar", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Begônia");
    await recusaCom(
      operacao.agendarConsulta({
        familiaId,
        agendadaPara: new Date(Date.now() - 3_600_000).toISOString(),
      }),
      "data_no_passado",
    );
    await operacao.agendarConsulta({
      familiaId,
      agendadaPara: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const loja = obterLojaOperacao();
    const f = loja.familias.find((x) => x.id === familiaId)!;
    expect(f.estagioP2).toBe("consulta_prenatal_agendada");
    expect(
      loja.tarefas.filter(
        (t) =>
          t.familiaId === familiaId &&
          t.tipo === "agendar_prenatal" &&
          t.status === "aberta",
      ),
    ).toHaveLength(0);
  });
});

describe("designação (P36)", () => {
  it("a recusa da titular aciona o backup e avisa a coordenação", async () => {
    const enfermeira = repos("enfermeira", "aal2").operacao;
    const ofertas = await enfermeira.minhasOfertas();
    const girassol = ofertas.find(
      (o) => o.familia === "Família Teste Girassol",
    );
    expect(girassol).toMatchObject({ papel: "titular" });

    await recusaCom(
      enfermeira.responder(girassol!.designacaoId, false, ""),
      "motivo_obrigatorio",
    );
    const r = await enfermeira.responder(
      girassol!.designacaoId,
      false,
      "Folga nessas datas",
    );
    expect(r).toMatchObject({
      ok: true,
      aceita: false,
      desfecho: "backup_assumiu",
    });

    const coord = repos("coordenacao").operacao;
    const aloc = await coord.alocacao(await idDaFamilia("Girassol"));
    const titular = aloc.designacoes.find(
      (d) => d.papel === "titular" && d.status === "aceita",
    );
    expect(titular?.profissionalId).toBe(SUL_3);
    expect(
      aloc.designacoes.find((d) => d.status === "recusada")?.motivoRecusa,
    ).toBe("Folga nessas datas");
    expect(aloc.tarefas.some((t) => t.tipo === "designar_profissional")).toBe(
      true,
    );
    expect(
      avisosDaOperacaoDemo().some(
        (a) =>
          a.papel === "coordenacao" &&
          a.titulo === "A titular recusou a oferta",
      ),
    ).toBe(true);
    // Uma oferta respondida não volta para a lista.
    expect(
      (await enfermeira.minhasOfertas()).some(
        (o) => o.familia === "Família Teste Girassol",
      ),
    ).toBe(false);
  });

  it("sem backup, a recusa devolve a família à coordenação com tarefa de prioridade alta", async () => {
    const coord = repos("coordenacao").operacao;
    const familiaId = await idDaFamilia("Camélia");
    await coord.oferecer({
      familiaId,
      profissionalId: SUL_2,
      papel: "titular",
    });
    const enfermeira = repos("enfermeira", "aal2").operacao;
    const oferta = (await enfermeira.minhasOfertas()).find(
      (o) => o.familia === "Família Teste Camélia",
    );
    expect(oferta?.prazoRespostaEm).not.toBeNull();
    const r = await enfermeira.responder(
      oferta!.designacaoId,
      false,
      "Fica longe de mim",
    );
    expect(r.desfecho).toBe("sem_backup");
    const tarefa = obterLojaOperacao().tarefas.find(
      (t) =>
        t.familiaId === familiaId &&
        t.tipo === "designar_profissional" &&
        t.status === "aberta",
    );
    expect(tarefa).toMatchObject({
      titulo: "Oferecer a outra enfermeira",
      prioridade: "alta",
    });
  });

  it("aceitar a oferta da titular (com backup aceito) leva o P2 a aguardando nascimento", async () => {
    const coord = repos("coordenacao").operacao;
    const familiaId = await idDaFamilia("Girassol");
    const enfermeira = repos("enfermeira", "aal2").operacao;
    const oferta = (await enfermeira.minhasOfertas()).find(
      (o) => o.familia === "Família Teste Girassol",
    );
    const r = await enfermeira.responder(oferta!.designacaoId, true, null);
    expect(r).toMatchObject({ ok: true, aceita: true });
    const aloc = await coord.alocacao(familiaId);
    expect(aloc.familia.estagioP2).toBe("aguardando_nascimento");
  });

  it("papel ocupado, mesma enfermeira nos dois papéis e atribuição direta com motivo", async () => {
    const coord = repos("coordenacao").operacao;
    const familiaId = await idDaFamilia("Lírio");
    await coord.oferecer({
      familiaId,
      profissionalId: SUL_1,
      papel: "titular",
    });
    await recusaCom(
      coord.oferecer({ familiaId, profissionalId: SUL_3, papel: "titular" }),
      "papel_ocupado",
    );
    await recusaCom(
      coord.oferecer({ familiaId, profissionalId: SUL_1, papel: "backup" }),
      "mesma_profissional",
    );
    await recusaCom(
      coord.atribuir({
        familiaId,
        profissionalId: SUL_3,
        papel: "backup",
        motivo: "  ",
      }),
      "motivo_obrigatorio",
    );
    await coord.atribuir({
      familiaId,
      profissionalId: SUL_3,
      papel: "backup",
      motivo: "Urgência da semana",
    });
    const aloc = await coord.alocacao(familiaId);
    const backup = aloc.designacoes.find(
      (d) => d.papel === "backup" && d.status === "aceita",
    );
    expect(backup).toMatchObject({ profissionalId: SUL_3, direta: true });
  });

  it("enfermeira só responde a própria oferta; coordenação não responde por ela", async () => {
    const coord = repos("coordenacao").operacao;
    const enfermeira = repos("enfermeira", "aal2").operacao;
    const oferta = (await enfermeira.minhasOfertas())[0]!;
    await expect(
      coord.responder(oferta.designacaoId, true, null),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(coord.minhasOfertas()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(enfermeira.radar(null)).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});

describe("radar, nascimento e alta (P36)", () => {
  it("o radar traz janela, titular e backup, quem está sem contato e a ocupação", async () => {
    const radar = await repos("coordenacao").operacao.radar(null);
    const por = (n: string) =>
      radar.familias.find((f) => f.nome === `Família Teste ${n}`)!;
    expect(por("Hortênsia")).toMatchObject({
      naJanela: true,
      checkinPendente: true,
    });
    expect(por("Hortênsia").titular?.status).toBe("aceita");
    // Ipê: a data provável passou há 12 dias (ainda dentro da janela), sem backup e sem contato.
    expect(por("Ipê")).toMatchObject({
      naJanela: true,
      semContato: true,
      dppSemConfirmacao: true,
      dppSemContato: true,
    });
    expect(por("Ipê").backup).toBeNull();
    expect(por("Lírio").titular).toBeNull();
    // Não entra no radar quem já nasceu; entra na lista dos que aguardam a alta.
    expect(
      radar.familias.some((f) => f.nome === "Família Teste Margarida"),
    ).toBe(false);
    expect(radar.nasceram.map((n) => n.nome)).toContain(
      "Família Teste Margarida",
    );
    expect(radar.ocupacao.length).toBeGreaterThan(0);
    expect(radar.limiteAlertaPct).toBe(
      PARAMETROS_OPERACAO.capacidade_alerta_pct,
    );
    // Filtro por praça
    const londrina =
      radar.ocupacao.find((o) => o.regiao === "Londrina")?.regiaoId ??
      "sem-praca";
    const filtrado = await repos("coordenacao").operacao.radar(londrina);
    expect(filtrado.familias).toHaveLength(0);
  });

  it("o nascimento registra o fato e leva o P2 a bebê nasceu, sem mexer na DPP", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Orquídea");
    const antes = await operacao.alocacao(familiaId);
    const r = await operacao.registrarNascimento({
      familiaId,
      dataNascimento: diaBrasilia(0),
      bebes: [
        { pesoNascimentoG: 3200, sexo: "feminino", tipoParto: "vaginal" },
      ],
    });
    expect(r.estagioP2).toBe("bebe_nasceu");
    const depois = await operacao.alocacao(familiaId);
    expect(depois.familia.dataNascimento).toBe(diaBrasilia(0));
    expect(depois.familia.dpp).toBe(antes.familia.dpp);
    expect(
      obterLojaOperacao().bebes.filter((b) => b.familiaId === familiaId),
    ).toHaveLength(1);
  });

  it("recusa nascimento no futuro, bebê inválido e alta antes do nascimento", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Orquídea");
    await recusaCom(
      operacao.registrarNascimento({
        familiaId,
        dataNascimento: diaBrasilia(2),
        bebes: [{}],
      }),
      "data_no_futuro",
    );
    await recusaCom(
      operacao.registrarNascimento({
        familiaId,
        dataNascimento: diaBrasilia(0),
        bebes: [],
      }),
      "bebes_invalidos",
    );
    await recusaCom(
      operacao.registrarAlta({ familiaId, dataAlta: diaBrasilia(0) }),
      "sem_nascimento",
    );
    await operacao.registrarNascimento({
      familiaId,
      dataNascimento: diaBrasilia(0),
      bebes: [{}],
    });
    await recusaCom(
      operacao.registrarAlta({ familiaId, dataAlta: diaBrasilia(-1) }),
      "alta_antes_do_nascimento",
    );
    await recusaCom(
      operacao.registrarAlta({
        familiaId,
        dataAlta: diaBrasilia(0),
        primeiraVisita: diaBrasilia(-1),
      }),
      "primeira_visita_antes_da_alta",
    );
  });

  it("pacote de 6 dias: a alta gera 6 visitas de D1 a D6 no mesmo período", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Orquídea");
    await operacao.registrarNascimento({
      familiaId,
      dataNascimento: diaBrasilia(0),
      bebes: [{}],
    });
    const r = await operacao.registrarAlta({
      familiaId,
      dataAlta: diaBrasilia(0),
    });
    expect(r).toMatchObject({
      visitas: 6,
      periodo: "manha",
      inicioEfetivo: diaBrasilia(1),
    });

    const aloc = await operacao.alocacao(familiaId);
    const lista = aloc.acompanhamento!.listaVisitas;
    expect(lista.map((v) => v.diaNumero)).toEqual([1, 2, 3, 4, 5, 6]);
    lista.forEach((v, i) => {
      expect(v.data).toBe(diaBrasilia(i + 1));
      expect(v.horaPrevista?.slice(0, 5)).toBe(
        PARAMETROS_OPERACAO.visita_hora_por_periodo.manha,
      );
      expect(v.profissionalId).toBe(SUL_2); // a titular da Orquídea
    });
    expect(aloc.familia.dataInicioEfetivo).toBe(diaBrasilia(1));
    // A tarefa do guia e o aviso à profissional saem da alta.
    expect(
      obterLojaOperacao().tarefas.some(
        (t) => t.familiaId === familiaId && /guia/i.test(t.titulo),
      ),
    ).toBe(true);
    expect(avisosDaOperacaoDemo().some((a) => a.papel === "enfermeira")).toBe(
      true,
    );
    // Alta repetida com a mesma data não gera visitas de novo.
    await operacao.registrarAlta({ familiaId, dataAlta: diaBrasilia(0) });
    expect(
      (await operacao.alocacao(familiaId)).acompanhamento!.listaVisitas,
    ).toHaveLength(6);
  });

  it("pacote de 12 dias: 12 visitas à tarde, com o primeiro dia escolhido pela coordenação", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Violeta");
    await operacao.registrarNascimento({
      familiaId,
      dataNascimento: diaBrasilia(0),
      bebes: [{}, {}],
    });
    const r = await operacao.registrarAlta({
      familiaId,
      dataAlta: diaBrasilia(0),
      primeiraVisita: diaBrasilia(2),
    });
    expect(r).toMatchObject({
      visitas: 12,
      periodo: "tarde",
      inicioEfetivo: diaBrasilia(2),
    });
    const lista = (await operacao.alocacao(familiaId)).acompanhamento!
      .listaVisitas;
    expect(lista).toHaveLength(12);
    expect(lista[0]!.data).toBe(diaBrasilia(2));
    expect(lista[11]!.data).toBe(diaBrasilia(13));
    expect(new Set(lista.map((v) => v.horaPrevista?.slice(0, 5)))).toEqual(
      new Set([PARAMETROS_OPERACAO.visita_hora_por_periodo.tarde]),
    );
  });

  it("a alta pede o período quando a entrevista não indicou, e só aceita manhã ou tarde", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Margarida"); // já nasceu; preferência: manhã
    await recusaCom(
      operacao.registrarAlta({
        familiaId,
        dataAlta: diaBrasilia(0),
        periodo: "noite_avaliar",
      }),
      "periodo_invalido",
    );
    const r = await operacao.registrarAlta({
      familiaId,
      dataAlta: diaBrasilia(0),
      periodo: "tarde",
    });
    expect(r.periodo).toBe("tarde");
  });

  it("previsão de alta é estimativa: não gera visita e não pode ser antes do nascimento", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Margarida");
    await recusaCom(
      operacao.registrarPrevisaoAlta(familiaId, diaBrasilia(-30)),
      "previsao_antes_do_nascimento",
    );
    await operacao.registrarPrevisaoAlta(familiaId, diaBrasilia(2));
    const aloc = await operacao.alocacao(familiaId);
    expect(aloc.acompanhamento?.previsaoAlta).toBe(diaBrasilia(2));
    expect(aloc.acompanhamento?.listaVisitas ?? []).toHaveLength(0);
  });

  it("família em estado sensível não recebe oferta nem marcação", async () => {
    const { operacao } = repos("coordenacao");
    const familiaId = await idDaFamilia("Lírio");
    const f = obterLojaOperacao().familias.find((x) => x.id === familiaId)!;
    f.estadoSensivel = "bloqueio_total";
    await recusaCom(
      operacao.oferecer({ familiaId, profissionalId: SUL_1, papel: "titular" }),
      "familia_em_estado_sensivel",
    );
    await recusaCom(
      operacao.agendarConsulta({
        familiaId,
        agendadaPara: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      "familia_em_estado_sensivel",
    );
  });
});
