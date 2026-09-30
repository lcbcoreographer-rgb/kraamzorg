// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { calcularAssinatura } from "@/lib/checklist/assinatura";
import type { AssistencialRepositorio } from "../tipos-assistencial";
import {
  criarAssistencialDemonstracao,
  obterLojaAssistencial,
  reiniciarLojaAssistencial,
} from "./assistencial";
import {
  ID_USUARIO_COORDENACAO,
  ID_USUARIO_ENFERMEIRA,
  PROFISSIONAL_ENFERMEIRA,
  VERSAO_INSTRUMENTO,
  dadosDeExemplo,
} from "./assistencial-fixtures";
import { USUARIOS } from "./fixtures";

/**
 * Checklist e alertas na demonstração (P39 e P40): as mesmas recusas de
 * 0023_checklist_alertas.sql (provadas no pgTAP 023), sobre a loja em
 * memória que as telas e o e2e usam.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${String(grupo).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

function como(
  papel: Papel,
  usuarioId?: string,
  aal: "aal1" | "aal2" = "aal2",
): AssistencialRepositorio {
  const u = USUARIOS.find((x) => x.papeis.includes(papel))!;
  return criarAssistencialDemonstracao({
    usuarioId: usuarioId ?? u.id,
    papeis: [...u.papeis],
    aal,
  });
}

const enfermeira = () => como("enfermeira", ID_USUARIO_ENFERMEIRA);
const coordenacao = () => como("coordenacao", ID_USUARIO_COORDENACAO);

async function registroDoDia(
  visitaId: string,
  familia: number,
  resumo = "Quarta visita: tudo tranquilo.",
) {
  const l = obterLojaAssistencial();
  const v = l.visitas.find((x) => x.id === visitaId)!;
  const bebes = l.bebes.filter((b) => b.familiaId === id(510, familia));
  const dados = dadosDeExemplo(
    { data: v.data, temperatura: 36.6, pesoBebe: 3200 },
    bebes.map((b) => b.id),
  );
  const assinadoEmMs = Date.now();
  const assinatura = await calcularAssinatura({
    dados,
    resumo,
    profissionalId: PROFISSIONAL_ENFERMEIRA.id,
    assinadoEmMs,
  });
  return {
    visitaId,
    profissionalId: PROFISSIONAL_ENFERMEIRA.id,
    instrumentoVersao: VERSAO_INSTRUMENTO,
    dados,
    resumoDescritivo: resumo,
    assinadoEmMs,
    assinatura,
  };
}

describe("assistencial na demonstração", () => {
  beforeEach(() => {
    process.env.KZ_DADOS = "demonstracao";
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    reiniciarLojaAssistencial();
  });
  afterEach(() => {
    for (const [chave, valor] of Object.entries(ORIGINAL)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });

  describe("quem vê o quê", () => {
    it("a enfermeira abre a própria visita e não a de outra profissional", async () => {
      expect(await enfermeira().obterChecklist(id(530, 4))).not.toBeNull();
      expect(await enfermeira().obterChecklist(id(530, 11))).toBeNull();
    });

    it("quem não é da área assistencial não abre nada", async () => {
      await expect(
        como("comercial").obterChecklist(id(530, 4)),
      ).rejects.toMatchObject({ codigo: "sem_permissao" });
    });

    it("papel com MFA em AAL1 não abre", async () => {
      await expect(
        como("enfermeira", ID_USUARIO_ENFERMEIRA, "aal1").obterChecklist(
          id(530, 4),
        ),
      ).rejects.toMatchObject({ codigo: "sem_permissao" });
    });

    it("a enfermeira vê só os alertas das famílias dela; a coordenação vê todos", async () => {
      const dela = await enfermeira().listarAlertas("abertos");
      const todos = await coordenacao().listarAlertas("abertos");
      expect(dela.map((a) => a.regraId)).toContain("RN-08");
      expect(todos.length).toBeGreaterThanOrEqual(dela.length);
    });
  });

  describe("registro append-only (P39)", () => {
    it("assina, grava e leva a visita a ficha_entregue", async () => {
      const registro = await registroDoDia(id(530, 4), 1);
      const r = await enfermeira().registrarAtendimento(registro, []);
      expect(r.jaRegistrado).toBe(false);
      const visita = obterLojaAssistencial().visitas.find(
        (v) => v.id === id(530, 4),
      )!;
      expect(visita.estado).toBe("ficha_entregue");
    });

    it("reenviar o mesmo registro não grava outro", async () => {
      const registro = await registroDoDia(id(530, 4), 1);
      const primeiro = await enfermeira().registrarAtendimento(registro, []);
      const segundo = await enfermeira().registrarAtendimento(registro, []);
      expect(segundo).toEqual({
        registroId: primeiro.registroId,
        jaRegistrado: true,
      });
      expect(
        obterLojaAssistencial().registros.filter(
          (x) => x.visitaId === id(530, 4),
        ),
      ).toHaveLength(1);
    });

    it("registro diferente para a mesma visita é recusado: a correção é por adendo", async () => {
      await enfermeira().registrarAtendimento(
        await registroDoDia(id(530, 4), 1),
        [],
      );
      const outro = await registroDoDia(id(530, 4), 1, "Resumo diferente.");
      await expect(
        enfermeira().registrarAtendimento(outro, []),
      ).rejects.toMatchObject({
        message: expect.stringContaining("checklist:registro_divergente"),
      });
    });

    it("assinatura que não bate com o conteúdo é recusada", async () => {
      const registro = await registroDoDia(id(530, 4), 1);
      await expect(
        enfermeira().registrarAtendimento(
          { ...registro, resumoDescritivo: "Texto trocado depois de assinar." },
          [],
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining("checklist:assinatura_invalida"),
      });
    });

    it("visita sem os obrigatórios não conclui", async () => {
      const resumo = "Resumo qualquer.";
      const dados = { "1": { data: "2026-09-30" } };
      const assinadoEmMs = Date.now();
      const assinatura = await calcularAssinatura({
        dados,
        resumo,
        profissionalId: PROFISSIONAL_ENFERMEIRA.id,
        assinadoEmMs,
      });
      await expect(
        enfermeira().registrarAtendimento(
          {
            visitaId: id(530, 4),
            profissionalId: PROFISSIONAL_ENFERMEIRA.id,
            instrumentoVersao: VERSAO_INSTRUMENTO,
            dados,
            resumoDescritivo: resumo,
            assinadoEmMs,
            assinatura,
          },
          [],
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining("checklist:obrigatorios_pendentes"),
      });
      expect(
        obterLojaAssistencial().registros.some(
          (x) => x.visitaId === id(530, 4),
        ),
      ).toBe(false);
    });

    it("só a profissional da visita assina", async () => {
      const registro = await registroDoDia(id(530, 4), 1);
      await expect(
        coordenacao().registrarAtendimento(registro, []),
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          "checklist:nao_e_a_profissional_da_visita",
        ),
      });
    });

    it("adendo exige motivo e conteúdo, guarda o original e não duplica", async () => {
      const registroId = id(560, 9);
      await expect(
        enfermeira().registrarAdendo(registroId, "  ", "Texto"),
      ).rejects.toMatchObject({
        message: expect.stringContaining("adendo_sem_motivo"),
      });
      const antes = structuredClone(
        obterLojaAssistencial().registros.find((r) => r.id === registroId)!
          .dados,
      );
      await enfermeira().registrarAdendo(
        registroId,
        "Erro de digitação",
        "36,8",
      );
      await enfermeira().registrarAdendo(
        registroId,
        "Erro de digitação",
        "36,8",
      );
      const registro = obterLojaAssistencial().registros.find(
        (r) => r.id === registroId,
      )!;
      expect(registro.adendos).toHaveLength(1);
      expect(registro.dados).toEqual(antes);
    });
  });

  describe("alertas (P40)", () => {
    it("o alerta vindo do aparelho e a reavaliação do servidor são o mesmo alerta", async () => {
      const uma = await enfermeira().registrarAlerta({
        visitaId: id(530, 4),
        regraId: "PU-01",
        instrumentoVersao: VERSAO_INSTRUMENTO,
        bebeId: null,
        campo: "2.1.temperatura",
        valorObservado: "38,2",
        manual: false,
      });
      const outra = await enfermeira().registrarAlerta({
        visitaId: id(530, 4),
        regraId: "PU-01",
        instrumentoVersao: VERSAO_INSTRUMENTO,
        bebeId: null,
        campo: "2.1.temperatura",
        valorObservado: "38,2",
        manual: false,
      });
      expect(uma.criado).toBe(true);
      expect(outra).toEqual({ id: uma.id, criado: false });
      // imediato: a coordenação é avisada
      expect(obterLojaAssistencial().avisosCoordenacao.length).toBe(1);
    });

    it("regra desligada não dispara sozinha, e o seletor manual obedece ao parâmetro", async () => {
      obterLojaAssistencial().parametros.seletorSinaisAtivo = false;
      await expect(
        enfermeira().registrarAlerta({
          visitaId: id(530, 4),
          regraId: "SM-01",
          instrumentoVersao: VERSAO_INSTRUMENTO,
          bebeId: null,
          campo: null,
          valorObservado: null,
          manual: false,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("regra_inativa"),
      });
      await expect(
        enfermeira().registrarAlerta({
          visitaId: id(530, 4),
          regraId: "SM-01",
          instrumentoVersao: VERSAO_INSTRUMENTO,
          bebeId: null,
          campo: null,
          valorObservado: null,
          manual: true,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("seletor_desligado"),
      });
    });

    it("alerta não fecha sem os quatro campos, e só a coordenação fecha", async () => {
      const alertaId = id(570, 1);
      await expect(
        coordenacao().fecharAlerta(alertaId, null),
      ).rejects.toMatchObject({
        message: expect.stringContaining("fechamento_incompleto"),
      });
      await expect(
        enfermeira().fecharAlerta(alertaId, null),
      ).rejects.toMatchObject({ codigo: "sem_permissao" });

      await enfermeira().registrarAcionamento({
        alertaId,
        versaoBase: null,
        sinalIdentificado: "Temperatura de 38,3 °C do bebê.",
        acionadoEm: new Date().toISOString(),
      });
      // ainda faltam a orientação e a conduta
      await expect(
        coordenacao().fecharAlerta(alertaId, null),
      ).rejects.toMatchObject({
        message: expect.stringMatching(
          /orientacao_medica.*conduta_adotada|conduta_adotada.*orientacao_medica/,
        ),
      });

      await coordenacao().registrarAcionamento({
        alertaId,
        versaoBase: null,
        orientacaoMedica: "Levar à emergência pediátrica.",
        condutaAdotada: "Família orientada por telefone.",
      });
      await coordenacao().fecharAlerta(alertaId, null);
      const fechados = await coordenacao().listarAlertas("fechados");
      expect(fechados.some((a) => a.id === alertaId)).toBe(true);
    });

    it("a hora do acionamento não pode estar no futuro", async () => {
      await expect(
        enfermeira().registrarAcionamento({
          alertaId: id(570, 1),
          versaoBase: null,
          acionadoEm: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("acionamento_no_futuro"),
      });
    });

    it("acionamento com versão velha é recusado, para não sobrescrever o de outra pessoa", async () => {
      await expect(
        enfermeira().registrarAcionamento({
          alertaId: id(570, 1),
          versaoBase: 99,
          sinalIdentificado: "Qualquer",
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("versao_desatualizada"),
      });
    });

    it("a diretoria lê o alerta e não registra nem fecha", async () => {
      const diretoria = como("diretoria");
      expect((await diretoria.listarAlertas("abertos")).length).toBeGreaterThan(
        0,
      );
      await expect(
        diretoria.registrarAcionamento({
          alertaId: id(570, 1),
          versaoBase: null,
          sinalIdentificado: "x",
        }),
      ).rejects.toMatchObject({ codigo: "sem_permissao" });
      await expect(
        diretoria.fecharAlerta(id(570, 1), null),
      ).rejects.toMatchObject({ codigo: "sem_permissao" });
    });
  });

  describe("áudio da visita (P39 item 6)", () => {
    it("aceita só o caminho da própria visita, sem nome de paciente", async () => {
      const visitaId = id(530, 4);
      await expect(
        enfermeira().registrarAudio(visitaId, "visitas/Aurora/mae.webm", 30),
      ).rejects.toMatchObject({
        message: expect.stringContaining("caminho_invalido"),
      });
      const ok = await enfermeira().registrarAudio(
        visitaId,
        `visitas/${visitaId}/${crypto.randomUUID()}.webm`,
        30,
      );
      expect(ok.id).toBeTruthy();
    });

    it("recusa áudio acima do limite do parâmetro", async () => {
      const visitaId = id(530, 4);
      await expect(
        enfermeira().registrarAudio(
          visitaId,
          `visitas/${visitaId}/${crypto.randomUUID()}.webm`,
          99_999,
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining("audio_longo"),
      });
    });
  });
});
