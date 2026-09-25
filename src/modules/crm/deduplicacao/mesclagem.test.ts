// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error(
      "cookies() não deveria ser chamado neste teste (modo demonstração)",
    );
  },
  headers: async () => new Headers(),
}));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { FAMILIAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { criarLeadManual } from "../pipeline/dados";
import {
  familiaFicaDemo,
  familiasJaMescladas,
  mesclarFamilias,
  reiniciarMesclagemDemoParaTestes,
  vincularNovaGestacao,
  vinculoNovaGestacaoDemo,
} from "./mesclagem";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
    exigirSessao: async () => {
      if (!sessaoAtual) throw new Error("sem sessão no teste");
      return sessaoAtual;
    },
    __definirSessao: (s: SessaoUsuario | null) => {
      sessaoAtual = s;
    },
  };
});

function sessaoDe(nome: string, aal: "aal1" | "aal2" = "aal2"): SessaoUsuario {
  const usuario = USUARIOS.find((u) => u.nome === nome);
  if (!usuario) throw new Error(nome);
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal,
    aalPossivel: "aal2",
  };
}

async function logarComo(nome: string, aal: "aal1" | "aal2" = "aal2") {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe(nome, aal));
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarMesclagemDemoParaTestes();
  await logarComo("Perfil Teste Comercial", "aal1");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

const auroraId = () => FAMILIAS.find((f) => f.nome.endsWith("Aurora"))!.id;

describe("mesclarFamilias: move histórico, marca a que saiu, sem oportunidade aberta em duplicidade", () => {
  it("move pessoas, conversas e tarefas para a família que fica", async () => {
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Duplicada",
      nomeContato: "Marina Duplicada",
      papelContato: "mae",
      telefoneE164: "11900000301",
      origem: "outro",
    });

    await mesclarFamilias({
      familiaFicaId: auroraId(),
      familiaPerdeId: nova.familiaId,
    });

    const l = obterLoja();
    expect(l.pessoas.some((p) => p.familiaId === nova.familiaId)).toBe(false);
    expect(
      l.pessoas.some(
        (p) => p.familiaId === auroraId() && p.nome === "Marina Duplicada",
      ),
    ).toBe(true);
    expect(l.oportunidades.some((o) => o.familiaId === nova.familiaId)).toBe(
      false,
    );
    expect(familiasJaMescladas().has(nova.familiaId)).toBe(true);
    expect(familiaFicaDemo(nova.familiaId)).toBe(auroraId());
  });

  it("com as duas com oportunidade aberta, a que não fica passa para perdido antes de mover ([v4.2])", async () => {
    // Aurora está em "novo" (p1), que tem transição permitida para perdido.
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Duplicada",
      nomeContato: "Marina Duplicada",
      papelContato: "mae",
      telefoneE164: "11900000301",
      origem: "outro",
    });

    await mesclarFamilias({
      familiaFicaId: auroraId(),
      familiaPerdeId: nova.familiaId,
      oportunidadeFicaId: undefined, // a oportunidade da Aurora original fica
    });

    const l = obterLoja();
    const daAuroraOriginal = l.oportunidades.find(
      (o) => o.familiaId === auroraId() && o.estagioP1 !== "perdido",
    );
    expect(daAuroraOriginal).toBeTruthy();
    // A da família que saiu virou perdida antes de ser movida (motivo "outro").
    const todasDaFamiliaFica = l.oportunidades.filter(
      (o) => o.familiaId === auroraId(),
    );
    expect(todasDaFamiliaFica.some((o) => o.motivoPerda === "outro")).toBe(
      true,
    );
  });

  it("recusa mesclar uma família com ela mesma", async () => {
    await expect(
      mesclarFamilias({
        familiaFicaId: auroraId(),
        familiaPerdeId: auroraId(),
      }),
    ).rejects.toMatchObject({ codigo: "recusado" });
  });
});

describe("vincularNovaGestacao: liga por familia_anterior_id, não mescla (PRD 6.10 regra 12)", () => {
  it("grava o vínculo sem mexer em pessoas, conversas ou tarefas", async () => {
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Gestação Nova",
      nomeContato: "Marina",
      papelContato: "mae",
      telefoneE164: "11900000301",
      dpp: "2028-06-01",
      origem: "outro",
    });

    await vincularNovaGestacao(nova.familiaId, auroraId());

    expect(vinculoNovaGestacaoDemo(nova.familiaId)).toBe(auroraId());
    const l = obterLoja();
    expect(
      l.pessoas.filter((p) => p.familiaId === nova.familiaId),
    ).toHaveLength(1);
    expect(familiasJaMescladas().has(nova.familiaId)).toBe(false);
  });
});
