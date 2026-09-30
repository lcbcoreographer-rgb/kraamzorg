// @vitest-environment node
// Precisa vir antes de importar db.ts: fake-indexeddb substitui o global
// `indexedDB` que o Dexie usa (invariante 4, PRD 16.1).
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import {
  DEFINICAO_DOC2,
  ID_USUARIO_COORDENACAO,
  ID_USUARIO_ENFERMEIRA,
  dadosDeExemplo,
} from "@/lib/dados/demonstracao/assistencial-fixtures";
import {
  criarAssistencialDemonstracao,
  obterLojaAssistencial,
  reiniciarLojaAssistencial,
} from "@/lib/dados/demonstracao/assistencial";
import type {
  AssistencialRepositorio,
  ChecklistVisita,
} from "@/lib/dados/tipos-assistencial";
import { criarBancoOffline, type BancoOffline } from "@/lib/sync/db";
import { processarFila, type EnviarLote } from "@/lib/sync/motor";
import { processarLote } from "@/lib/sync/protocolo";
import { RepositorioSincronizacaoAssistencial } from "@/lib/sync/repositorio-assistencial";
import { RepositorioSincronizacaoMemoria } from "@/lib/sync/repositorio-memoria";
import type { RespostaSincronizacao } from "@/lib/sync/tipos";
import {
  avaliarAlertasDoCampo,
  assinarRegistro,
  bebesDoFormulario,
  catalogoDasLinhas,
  dadosParaRespostas,
  montarDados,
} from "./registro";
import {
  enfileirarAdendo,
  enfileirarNovoAlerta,
  enfileirarRegistroAssinado,
} from "./fila";
import { valorObservadoEmTexto } from "./formato";

/**
 * Invariante 4 no checklist (PRD 16.1, P39 e P40): o registro criado sem
 * sinal chega íntegro e na ordem, uma vez só; a temperatura de 38,2 °C
 * dispara PU-01 no aparelho sem conexão e, ao sincronizar, a coordenação é
 * avisada; alerta não fecha sem os quatro campos; registro não aceita
 * update e a divergência vira adendo.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaAssistencial();
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function repos(papel: Papel, usuarioId: string): AssistencialRepositorio {
  return criarAssistencialDemonstracao({
    usuarioId,
    papeis: [papel],
    aal: "aal2",
  });
}
const enfermeira = () => repos("enfermeira", ID_USUARIO_ENFERMEIRA);
const coordenacao = () => repos("coordenacao", ID_USUARIO_COORDENACAO);

let contador = 0;
function novoBanco(): BancoOffline {
  contador += 1;
  return criarBancoOffline(`teste-checklist-${contador}-${Date.now()}`);
}

/** Visita de hoje da Família Teste Aurora (D4 de 6, iniciada). */
async function visitaAurora(
  repo: AssistencialRepositorio,
): Promise<ChecklistVisita> {
  const loja = obterLojaAssistencial();
  const visita = loja.visitas.find(
    (v) => v.diaNumero === 4 && v.estado === "iniciada",
  )!;
  const checklist = await repo.obterChecklist(visita.id);
  if (!checklist) throw new Error("visita de teste não encontrada");
  return checklist;
}

/** Registro do dia: o que a enfermeira responderia, com a temperatura pedida. */
async function registroDoDia(
  checklist: ChecklistVisita,
  temperatura: number,
  resumo = "Resumo do D4 sintético.",
  agora = new Date("2026-09-29T15:10:00.123Z"),
) {
  const bebeIds = checklist.bebes.map((b) => b.id);
  const dados = dadosDeExemplo(
    { data: checklist.visita.data, temperatura, pesoBebe: 3240 },
    bebeIds,
  );
  const respostas = dadosParaRespostas(DEFINICAO_DOC2, dados);
  respostas.blocos["resumo"] = { resumo_descritivo: resumo };
  const final = montarDados({
    definicao: DEFINICAO_DOC2,
    respostas,
    bebes: bebesDoFormulario(checklist.bebes),
    ultimoDia: checklist.ultimoDia,
  });
  return assinarRegistro({
    visitaId: checklist.visita.id,
    profissionalId: checklist.profissional.id,
    instrumentoVersao: checklist.instrumento!.versao,
    dados: final,
    resumo,
    agora,
  });
}

/** O servidor de sincronização sobre o repositório da enfermeira. */
function servidor(repo: AssistencialRepositorio) {
  const sincronizacao = new RepositorioSincronizacaoAssistencial(
    repo,
    new RepositorioSincronizacaoMemoria(),
    new Map(),
  );
  const enviar: EnviarLote = async (itens) =>
    (await processarLote({ itens }, sincronizacao)) as RespostaSincronizacao;
  return { sincronizacao, enviar };
}

const SEM_REDE: EnviarLote = async () => {
  throw new Error("Sem sinal");
};

describe("registro criado sem conexão chega íntegro e uma vez só", () => {
  it("38,2 °C dispara PU-01 no aparelho, sem rede; ao sincronizar o registro grava e a coordenação é avisada", async () => {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const { catalogo } = catalogoDasLinhas(checklist.regras);

    // 1. No aparelho, sem conexão: o campo é salvo e a regra roda.
    const registro = await registroDoDia(checklist, 38.2);
    const alertas = avaliarAlertasDoCampo(
      { bloco: "2.1", campo: "temperatura" },
      registro.dados,
      {
        catalogo,
        bebes: checklist.bebes,
        anteriores: checklist.anteriores,
        dataVisita: checklist.visita.data,
      },
    );
    expect(alertas.map((a) => a.codigo)).toEqual(["PU-01"]);

    await enfileirarNovoAlerta(db, ID_USUARIO_ENFERMEIRA, {
      visitaId: checklist.visita.id,
      regraId: "PU-01",
      instrumentoVersao: checklist.instrumento!.versao,
      bebeId: null,
      campo: alertas[0]!.campo,
      valorObservado: valorObservadoEmTexto(alertas[0]!.valorObservado),
      manual: false,
    });
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, registro);

    // 2. Sem sinal: nada chega ao servidor e nada se perde.
    const semRede = await processarFila(db, SEM_REDE, undefined, {
      ignorarEspera: true,
    });
    expect(semRede.erros).toBe(2);
    expect(semRede.pendentesRestantes).toBe(2);
    expect(
      obterLojaAssistencial().alertas.filter(
        (a) => a.visitaId === checklist.visita.id,
      ),
    ).toHaveLength(0);
    expect(
      obterLojaAssistencial().registros.find(
        (r) => r.visitaId === checklist.visita.id,
      ),
    ).toBeUndefined();

    // 3. A conexão volta: sobe na ordem, tudo de uma vez.
    const { enviar } = servidor(nurse);
    const volta = await processarFila(db, enviar, undefined, {
      ignorarEspera: true,
    });
    expect(volta).toMatchObject({
      sincronizados: 2,
      conflitos: 0,
      erros: 0,
      pendentesRestantes: 0,
    });

    const loja = obterLojaAssistencial();
    const gravado = loja.registros.find(
      (r) => r.visitaId === checklist.visita.id,
    )!;
    expect(gravado.dados).toEqual(registro.dados);
    expect(gravado.assinatura).toBe(registro.assinatura);
    expect(gravado.resumoDescritivo).toBe(registro.resumoDescritivo);
    expect(loja.visitas.find((v) => v.id === checklist.visita.id)?.estado).toBe(
      "ficha_entregue",
    );

    // Um alerta só: o do aparelho e a reavaliação do servidor são o mesmo.
    const doDia = loja.alertas.filter(
      (a) => a.visitaId === checklist.visita.id,
    );
    expect(doDia).toHaveLength(1);
    expect(doDia[0]).toMatchObject({
      regraId: "PU-01",
      severidade: "imediato",
      valorObservado: "38,2",
    });
    // A coordenação foi avisada, uma vez.
    expect(loja.avisosCoordenacao).toEqual([
      expect.objectContaining({
        titulo: "alerta_clinico_imediato",
        regraId: "PU-01",
      }),
    ]);
    await db.delete();
  });

  it("o servidor reavalia: alerta que o aparelho não viu nasce na sincronização", async () => {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const registro = await registroDoDia(checklist, 38.6);
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, registro);
    const { enviar } = servidor(nurse);
    await processarFila(db, enviar, undefined, { ignorarEspera: true });
    const alertas = obterLojaAssistencial().alertas.filter(
      (a) => a.visitaId === checklist.visita.id,
    );
    expect(alertas.map((a) => a.regraId)).toEqual(["PU-01"]);
    await db.delete();
  });

  it("reenviar o mesmo lote não duplica registro, alerta nem aviso (idempotente)", async () => {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const registro = await registroDoDia(checklist, 38.2);
    const item = await enfileirarRegistroAssinado(
      db,
      ID_USUARIO_ENFERMEIRA,
      registro,
    );
    const { enviar } = servidor(nurse);
    const entrada = {
      id: item.id,
      usuarioId: item.usuarioId,
      entidade: item.entidade,
      entidadeId: item.entidadeId,
      campo: item.campo,
      payload: item.payload,
      versaoBase: item.versaoBase,
      criadoNoClienteEm: item.criadoNoClienteEm,
    };
    await enviar([entrada]);
    const segunda = await enviar([entrada]);
    expect(segunda.resultados[0]?.status).toBe("processado");
    const loja = obterLojaAssistencial();
    expect(
      loja.registros.filter((r) => r.visitaId === checklist.visita.id),
    ).toHaveLength(1);
    expect(
      loja.alertas.filter((a) => a.visitaId === checklist.visita.id),
    ).toHaveLength(1);
    expect(loja.avisosCoordenacao).toHaveLength(1);
    await db.delete();
  });

  it("registro com assinatura que não confere é recusado, nada é gravado e o item fica para tentar de novo", async () => {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const registro = await registroDoDia(checklist, 36.6);
    const adulterado = {
      ...registro,
      dados: {
        ...registro.dados,
        "2.1": { ...(registro.dados["2.1"] as object), temperatura: 35.0 },
      },
    };
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, adulterado);
    const { enviar } = servidor(nurse);
    const resumo = await processarFila(db, enviar, undefined, {
      ignorarEspera: true,
    });
    expect(resumo.erros).toBe(1);
    expect(
      obterLojaAssistencial().registros.find(
        (r) => r.visitaId === checklist.visita.id,
      ),
    ).toBeUndefined();
    const [item] = await db.fila.toArray();
    expect(item?.estado).toBe("erro");
    expect(item?.erroMensagem).toMatch(/assinatura_invalida/);
    await db.delete();
  });

  it("visita sem os obrigatórios não conclui (o servidor confere)", async () => {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const registro = await registroDoDia(checklist, 36.6);
    const semTemperatura = structuredClone(registro.dados);
    delete (semTemperatura["2.1"] as Record<string, unknown>)["temperatura"];
    const assinado = await assinarRegistro({
      visitaId: registro.visitaId,
      profissionalId: registro.profissionalId,
      instrumentoVersao: registro.instrumentoVersao,
      dados: semTemperatura,
      resumo: registro.resumoDescritivo,
    });
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, assinado);
    const { enviar } = servidor(nurse);
    await processarFila(db, enviar, undefined, { ignorarEspera: true });
    const [item] = await db.fila.toArray();
    expect(item?.estado).toBe("erro");
    expect(item?.erroMensagem).toMatch(
      /obrigatorios_pendentes 2\.1\.temperatura/,
    );
    expect(
      obterLojaAssistencial().registros.find(
        (r) => r.visitaId === checklist.visita.id,
      ),
    ).toBeUndefined();
    await db.delete();
  });
});

describe("registro não aceita update: divergência e correção viram adendo", () => {
  async function comRegistroGravado() {
    const db = novoBanco();
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const registro = await registroDoDia(checklist, 36.6);
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, registro);
    const { enviar } = servidor(nurse);
    await processarFila(db, enviar, undefined, { ignorarEspera: true });
    return { db, nurse, checklist, registro, enviar };
  }

  it("um segundo registro diferente da mesma visita (outro aparelho, offline) vira adendo e o original fica como estava", async () => {
    const { db, checklist, registro, enviar } = await comRegistroGravado();
    const outro = await registroDoDia(
      checklist,
      37.0,
      "Resumo escrito em outro aparelho.",
      new Date("2026-09-29T15:20:00.000Z"),
    );
    await enfileirarRegistroAssinado(db, ID_USUARIO_ENFERMEIRA, outro);
    const resumo = await processarFila(db, enviar, undefined, {
      ignorarEspera: true,
    });
    expect(resumo.sincronizados).toBe(1);

    const gravado = obterLojaAssistencial().registros.find(
      (r) => r.visitaId === checklist.visita.id,
    )!;
    expect(gravado.assinatura).toBe(registro.assinatura);
    expect(gravado.resumoDescritivo).toBe(registro.resumoDescritivo);
    expect(gravado.adendos).toHaveLength(1);
    expect(gravado.adendos[0]?.motivo).toMatch(/conteúdo diferente/);
    expect(gravado.adendos[0]?.conteudo).toContain(
      "Resumo escrito em outro aparelho.",
    );
    await db.delete();
  });

  it("adendo com motivo pedido pela enfermeira sobe pela fila e o registro não muda", async () => {
    const { db, checklist, registro, enviar } = await comRegistroGravado();
    await enfileirarAdendo(
      db,
      ID_USUARIO_ENFERMEIRA,
      checklist.visita.id,
      "Correção da temperatura do bebê",
      "A temperatura do bebê era 36,9 °C.",
    );
    await processarFila(db, enviar, undefined, { ignorarEspera: true });
    const gravado = obterLojaAssistencial().registros.find(
      (r) => r.visitaId === checklist.visita.id,
    )!;
    expect(gravado.dados).toEqual(registro.dados);
    expect(gravado.adendos.map((a) => a.motivo)).toEqual([
      "Correção da temperatura do bebê",
    ]);
    await db.delete();
  });

  it("adendo sem motivo é recusado", async () => {
    const { db, checklist, enviar } = await comRegistroGravado();
    await enfileirarAdendo(
      db,
      ID_USUARIO_ENFERMEIRA,
      checklist.visita.id,
      "  ",
      "Texto",
    );
    const resumo = await processarFila(db, enviar, undefined, {
      ignorarEspera: true,
    });
    expect(resumo.erros).toBe(1);
    const gravado = obterLojaAssistencial().registros.find(
      (r) => r.visitaId === checklist.visita.id,
    )!;
    expect(gravado.adendos).toHaveLength(0);
    await db.delete();
  });
});

describe("alerta clínico: fechamento só com os quatro campos", () => {
  async function comAlertaAberto() {
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    const { id } = await nurse.registrarAlerta({
      visitaId: checklist.visita.id,
      regraId: "PU-01",
      instrumentoVersao: checklist.instrumento!.versao,
      bebeId: null,
      campo: "2.1.temperatura",
      valorObservado: "38,2",
      manual: false,
    });
    return { nurse, coord: coordenacao(), id, checklist };
  }

  it("não fecha sem sinal, hora, orientação e conduta; fecha com os quatro", async () => {
    const { nurse, coord, id } = await comAlertaAberto();
    await expect(coord.fecharAlerta(id, null)).rejects.toThrow(
      /fechamento_incompleto/,
    );

    await nurse.registrarAcionamento({
      alertaId: id,
      versaoBase: 1,
      sinalIdentificado: "Febre de 38,2 °C",
      acionadoEm: new Date(Date.now() - 600_000).toISOString(),
    });
    await expect(coord.fecharAlerta(id, null)).rejects.toThrow(
      /orientacao_medica, conduta_adotada/,
    );

    await coord.registrarAcionamento({
      alertaId: id,
      versaoBase: null,
      orientacaoMedica: "Observação com antitérmico.",
      condutaAdotada: "Antitérmico e reavaliação em 2 horas.",
    });
    await coord.fecharAlerta(id, null);
    const fechados = await coord.listarAlertas("fechados");
    expect(fechados.some((a) => a.id === id && a.fechadoEm)).toBe(true);
  });

  it("a enfermeira não fecha; a hora do acionamento não pode ser futura; versão desatualizada dá conflito", async () => {
    const { nurse, id } = await comAlertaAberto();
    await expect(nurse.fecharAlerta(id, null)).rejects.toThrow(
      /sem_permissao|papel/,
    );
    await expect(
      nurse.registrarAcionamento({
        alertaId: id,
        versaoBase: 1,
        acionadoEm: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(/acionamento_no_futuro/);
    await nurse.registrarAcionamento({
      alertaId: id,
      versaoBase: 1,
      sinalIdentificado: "Febre",
    });
    await expect(
      nurse.registrarAcionamento({
        alertaId: id,
        versaoBase: 1,
        sinalIdentificado: "Outra",
      }),
    ).rejects.toThrow(/versao_desatualizada/);
  });

  it("saúde mental imediata cria ocorrência privada e aviso de prioridade máxima na coordenação", async () => {
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    await nurse.registrarAlerta({
      visitaId: checklist.visita.id,
      regraId: "SM-01",
      instrumentoVersao: checklist.instrumento!.versao,
      bebeId: null,
      campo: null,
      valorObservado: null,
      manual: true,
    });
    const loja = obterLojaAssistencial();
    expect(loja.ocorrenciasPrivadas).toEqual([
      expect.objectContaining({ regraId: "SM-01" }),
    ]);
    expect(loja.avisosCoordenacao).toHaveLength(1);
  });

  it("sinal manual com o seletor desligado é recusado (K-07 aguarda a validação clínica)", async () => {
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    obterLojaAssistencial().parametros.seletorSinaisAtivo = false;
    await expect(
      nurse.registrarAlerta({
        visitaId: checklist.visita.id,
        regraId: "PU-05",
        instrumentoVersao: checklist.instrumento!.versao,
        bebeId: null,
        campo: null,
        valorObservado: null,
        manual: true,
      }),
    ).rejects.toThrow(/seletor_desligado/);
  });

  it("regra desligada não dispara sozinha (PU-08 é [clínico])", async () => {
    const nurse = enfermeira();
    const checklist = await visitaAurora(nurse);
    await expect(
      nurse.registrarAlerta({
        visitaId: checklist.visita.id,
        regraId: "PU-08",
        instrumentoVersao: checklist.instrumento!.versao,
        bebeId: null,
        campo: null,
        valorObservado: null,
        manual: false,
      }),
    ).rejects.toThrow(/regra_inativa/);
  });
});

describe("permissões da demonstração espelham o banco", () => {
  it("a enfermeira só abre as próprias visitas; a coordenação abre qualquer; outros papéis, nenhuma", async () => {
    const loja = obterLojaAssistencial();
    const dela = loja.visitas.find(
      (v) => v.diaNumero === 4 && v.estado === "iniciada",
    )!;
    const deOutra = loja.visitas.find((v) => v.familiaId.endsWith("0006"))!;
    expect(await enfermeira().obterChecklist(dela.id)).not.toBeNull();
    expect(await enfermeira().obterChecklist(deOutra.id)).toBeNull();
    expect(await coordenacao().obterChecklist(deOutra.id)).not.toBeNull();
    await expect(
      repos("comercial", "00000000-0000-4000-8001-000000000001").obterChecklist(
        dela.id,
      ),
    ).rejects.toThrow();
  });

  it("papel com MFA sem AAL2 não lê", async () => {
    const semMfa = criarAssistencialDemonstracao({
      usuarioId: ID_USUARIO_ENFERMEIRA,
      papeis: ["enfermeira"],
      aal: "aal1",
    });
    const visita = obterLojaAssistencial().visitas[0]!;
    await expect(semMfa.obterChecklist(visita.id)).rejects.toThrow();
  });

  it("só a profissional da visita assina", async () => {
    const loja = obterLojaAssistencial();
    const deOutra = loja.visitas.find((v) => v.familiaId.endsWith("0006"))!;
    const checklist = (await coordenacao().obterChecklist(deOutra.id))!;
    const registro = await registroDoDia(checklist, 36.6);
    await expect(
      enfermeira().registrarAtendimento(registro, []),
    ).rejects.toThrow(/nao_e_a_profissional_da_visita/);
  });
});

describe("último dia: contatos dos médicos", () => {
  async function ultimoDia() {
    const nurse = enfermeira();
    const loja = obterLojaAssistencial();
    const visita = loja.visitas.find(
      (v) => v.diaNumero === 6 && v.estado === "iniciada",
    )!;
    const checklist = (await nurse.obterChecklist(visita.id))!;
    return { nurse, checklist };
  }

  async function assinarUltimo(
    checklist: ChecklistVisita,
    ultimo: Record<string, unknown>,
  ) {
    const base = dadosDeExemplo(
      { data: checklist.visita.data, temperatura: 36.6, pesoBebe: 3300 },
      checklist.bebes.map((b) => b.id),
    );
    const dados = { ...base, ultimo_dia: ultimo };
    return assinarRegistro({
      visitaId: checklist.visita.id,
      profissionalId: checklist.profissional.id,
      instrumentoVersao: checklist.instrumento!.versao,
      dados,
      resumo: "Resumo do último dia.",
    });
  }

  it("com contato de telefone, cadastra o médico; a evolução não fica bloqueada", async () => {
    const { nurse, checklist } = await ultimoDia();
    const registro = await assinarUltimo(checklist, {
      contato_obstetra: "Dra. Teste (11) 91234-5678",
      contato_pediatra: {
        ausente: true,
        justificativa: "A família não tinha o número",
      },
      resumo_encerramento: "Encerramento sintético.",
    });
    await nurse.registrarAtendimento(registro, []);
    const situacao = await nurse.situacaoContatoMedico(checklist.familia.id);
    expect(situacao).toMatchObject({
      obstetra: true,
      pediatra: false,
      tarefaAberta: true,
      evolucaoBloqueada: false,
    });
  });

  it("sem nenhum contato, a visita encerra, nasce a tarefa e a evolução fica bloqueada", async () => {
    const { nurse, checklist } = await ultimoDia();
    const registro = await assinarUltimo(checklist, {
      contato_obstetra: { ausente: true, justificativa: "Sem número" },
      contato_pediatra: { ausente: true, justificativa: "Sem número" },
      resumo_encerramento: "Encerramento sintético.",
    });
    await nurse.registrarAtendimento(registro, []);
    const loja = obterLojaAssistencial();
    expect(loja.visitas.find((v) => v.id === checklist.visita.id)?.estado).toBe(
      "ficha_entregue",
    );
    expect(loja.tarefas).toEqual([
      expect.objectContaining({
        tipo: "obter_contato_medico",
        titulo: "Obter o contato do obstetra e do pediatra",
      }),
    ]);
    expect(
      (await nurse.situacaoContatoMedico(checklist.familia.id))
        .evolucaoBloqueada,
    ).toBe(true);
  });

  it("no último dia, sem justificar a ausência do contato, o registro não conclui", async () => {
    const { nurse, checklist } = await ultimoDia();
    const registro = await assinarUltimo(checklist, {
      contato_obstetra: "",
      contato_pediatra: { ausente: true, justificativa: "Sem número" },
      resumo_encerramento: "Fim.",
    });
    await expect(nurse.registrarAtendimento(registro, [])).rejects.toThrow(
      /obrigatorios_pendentes ultimo_dia\.contato_obstetra/,
    );
  });
});
