// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "127.0.0.1:3000" }),
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado neste teste");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/sessao", () => {
  let atual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => atual,
    exigirSessao: async () => {
      if (!atual) throw new Error("sem sessão no teste");
      return atual;
    },
    __definir: (s: SessaoUsuario | null) => {
      atual = s;
    },
  };
});

import type { SessaoUsuario } from "@/lib/auth/tipos";
import {
  familiaPorNome,
  PACOTES,
  USUARIOS,
  VERSOES_PACOTE,
} from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  obterLojaVenda,
  reiniciarLojaVenda,
} from "@/lib/dados/demonstracao/venda";
import { obterArmazenamento } from "@/lib/armazenamento";
import { reiniciarArmazenamentoMemoria } from "@/lib/armazenamento/memoria";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  acaoBaixarManual,
  acaoGerarCobranca,
  acaoGerarLinkPagamento,
  acaoSimularPagamento,
} from "./acoes";
import { estadoInicialCobranca } from "./estado-acoes";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

async function entrar(nome: string, aal: "aal1" | "aal2" = "aal2") {
  const usuario = USUARIOS.find((u) => u.nome === nome)!;
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definir: (s: SessaoUsuario | null) => void;
  };
  modulo.__definir({
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal,
    aalPossivel: "aal2",
  });
}

const cedro = familiaPorNome("Cedro").id;
const PDF = new TextEncoder().encode("%PDF-1.7 comprovante de teste");

/** Um contrato assinado de família em bloqueio_total: a cobrança ainda não existe (o freio segurou). */
function contratoAssinadoSemCobranca(parcelas = 3) {
  const l = obterLoja();
  const lv = obterLojaVenda();
  const o = l.oportunidades.find((x) => x.familiaId === cedro)!;
  o.pipeline = 2;
  o.estagioP2 = "assinado";
  const mae = l.pessoas.find(
    (p) => p.familiaId === cedro && p.papel === "mae",
  )!;
  mae.email = "beatriz.teste@exemplo.invalid";
  const pacote = PACOTES.find((p) => p.nome === "Essencial")!;
  const versao = VERSOES_PACOTE.find(
    (v) => v.pacoteId === pacote.pacoteId && v.vigenciaFim === null,
  )!;
  const id = crypto.randomUUID();
  lv.contratos.push({
    id,
    familiaId: cedro,
    pacoteVersaoId: versao.versaoId,
    contratantePessoaId: mae.id,
    pagadorPessoaId: null,
    testemunhaPessoaId: null,
    valorCentavos: 420000,
    taxaCentavos: 0,
    descontoCentavos: 0,
    parcelas,
    templateVersao: "C-11 provisório",
    tokenHash: null,
    expiraEm: new Date().toISOString(),
    status: "assinado",
    criadoEm: new Date().toISOString(),
    pdfPath: `contratos/${id}-assinado.pdf`,
    autentiqueDocId: "doc-demo-abcdef01",
    enviadoEm: new Date().toISOString(),
    assinadoEm: new Date().toISOString(),
  });
  return id;
}

async function cobrancaCriada(parcelas = 3) {
  const contratoId = contratoAssinadoSemCobranca(parcelas);
  await entrar("Perfil Teste Financeiro");
  const r = await acaoGerarCobranca(contratoId, cedro);
  expect(r.erro).toBeUndefined();
  const { cobrancas } = await obterRepositorios();
  const lista = await cobrancas.listar();
  return lista.cobrancas.find((c) => c.familiaId === cedro)!;
}

function formularioBaixa(
  cobrancaId: string,
  sobrescrever: Record<string, string | File | null> = {},
) {
  const f = new FormData();
  f.set("cobrancaId", cobrancaId);
  f.set("familiaId", cedro);
  f.set("valor", "4.200,00");
  f.set("motivo", "Pix recebido no extrato de 29/09");
  f.set(
    "comprovante",
    new File([PDF], "comprovante-da-marina.pdf", { type: "application/pdf" }),
  );
  for (const [chave, valor] of Object.entries(sobrescrever)) {
    if (valor === null) f.delete(chave);
    else f.set(chave, valor);
  }
  return f;
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaVenda();
  reiniciarArmazenamentoMemoria();
  obterLoja().familias.find((f) => f.id === cedro)!.estadoSensivel =
    "bloqueio_total";
  await entrar("Perfil Teste Financeiro");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("gerar a cobrança e o link", () => {
  it("o financeiro gera a cobrança que o freio segurou e depois o link, com no máximo o limite de parcelas", async () => {
    const cobranca = await cobrancaCriada();
    expect(cobranca.temLink).toBe(false);
    const r = await acaoGerarLinkPagamento(cobranca.id, cedro);
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Link de pagamento gerado/);
    const { cobrancas } = await obterRepositorios();
    const detalhe = await cobrancas.obter(cobranca.id);
    expect(detalhe.linkPagamento).toMatch(/^https:\/\//);
    expect(detalhe.podeGerarLink).toBe(false);
    expect((await acaoGerarLinkPagamento(cobranca.id, cedro)).erro).toMatch(
      /já tem link/,
    );
  });

  it("parcelamento acima do limite: o link não sai e a frase explica o caminho", async () => {
    const cobranca = await cobrancaCriada(5);
    expect((await acaoGerarLinkPagamento(cobranca.id, cedro)).erro).toMatch(
      /mais parcelas do que o link de pagamento permite/,
    );
  });

  it("comercial não gera cobrança nem link", async () => {
    const cobranca = await cobrancaCriada();
    await entrar("Perfil Teste Comercial");
    expect((await acaoGerarLinkPagamento(cobranca.id, cedro)).erro).toMatch(
      /não permite esta etapa/,
    );
    expect((await acaoGerarCobranca(crypto.randomUUID(), cedro)).erro).toMatch(
      /não permite esta etapa/,
    );
  });
});

describe("baixa manual (P32 item 4)", () => {
  it("guarda o comprovante com nome pelo id, dá a baixa e move o P2", async () => {
    const cobranca = await cobrancaCriada();
    const r = await acaoBaixarManual(
      estadoInicialCobranca,
      formularioBaixa(cobranca.id),
    );
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Baixa registrada/);
    const { cobrancas } = await obterRepositorios();
    const detalhe = await cobrancas.obter(cobranca.id);
    expect(detalhe.situacao).toBe("paga");
    expect(detalhe.metodo).toBe("pix");
    expect(detalhe.comprovante).toBe("arquivo");
    expect(detalhe.comprovantePath).toMatch(
      new RegExp(`^comprovantes/${cobranca.id}-[a-z0-9]{16}\\.pdf$`),
    );
    expect(detalhe.comprovantePath).not.toMatch(/marina/i);
    const aberto = await obterArmazenamento().abrir(
      detalhe.comprovantePath!,
      60,
    );
    expect(aberto?.tipo).toBe("bytes");
    expect(
      obterLoja().oportunidades.find((o) => o.familiaId === cedro)?.estagioP2,
    ).toBe("pagamento_confirmado");
  });

  it("marca os campos que faltam, sem gravar nada", async () => {
    const cobranca = await cobrancaCriada();
    const r = await acaoBaixarManual(
      estadoInicialCobranca,
      formularioBaixa(cobranca.id, {
        valor: "quatro mil",
        motivo: "curto",
        comprovante: null,
      }),
    );
    expect(r.erro).toBe("Falta alguma coisa para dar a baixa.");
    expect(Object.keys(r.campos ?? {}).sort()).toEqual([
      "comprovante",
      "motivo",
      "valor",
    ]);
    const { cobrancas } = await obterRepositorios();
    expect((await cobrancas.obter(cobranca.id)).situacao).not.toBe("paga");
  });

  it("recusa arquivo que não é PDF, PNG ou JPG (pelos bytes, não pela extensão)", async () => {
    const cobranca = await cobrancaCriada();
    const r = await acaoBaixarManual(
      estadoInicialCobranca,
      formularioBaixa(cobranca.id, {
        comprovante: new File(["<html>oi</html>"], "comprovante.pdf", {
          type: "application/pdf",
        }),
      }),
    );
    expect(r.erro).toBe("O comprovante não é um PDF, PNG ou JPG.");
    expect(r.campos?.comprovante).toBeDefined();
  });

  it("recusa comprovante acima do limite do parâmetro (3 MB)", async () => {
    const cobranca = await cobrancaCriada();
    const grande = new Uint8Array(3 * 1024 * 1024 + 1);
    grande.set(PDF);
    const r = await acaoBaixarManual(
      estadoInicialCobranca,
      formularioBaixa(cobranca.id, {
        comprovante: new File([grande], "c.pdf", { type: "application/pdf" }),
      }),
    );
    expect(r.erro).toBe("O comprovante é grande demais.");
    expect(r.campos?.comprovante).toMatch(/até 3 MB/);
  });

  it("valor menor que o da cobrança: o banco recusa com a frase", async () => {
    const cobranca = await cobrancaCriada();
    const r = await acaoBaixarManual(
      estadoInicialCobranca,
      formularioBaixa(cobranca.id, { valor: "10,00" }),
    );
    expect(r.erro).toMatch(/menor que o da cobrança/);
  });

  it("comercial e sem MFA não dão baixa", async () => {
    const cobranca = await cobrancaCriada();
    await entrar("Perfil Teste Comercial");
    expect(
      (
        await acaoBaixarManual(
          estadoInicialCobranca,
          formularioBaixa(cobranca.id),
        )
      ).erro,
    ).toMatch(/não permite esta etapa/);
    await entrar("Perfil Teste Financeiro", "aal1");
    expect(
      (
        await acaoBaixarManual(
          estadoInicialCobranca,
          formularioBaixa(cobranca.id),
        )
      ).erro,
    ).toMatch(/não permite esta etapa/);
  });
});

describe("simular o pagamento (só demonstração)", () => {
  it("faz o que o webhook faria", async () => {
    const cobranca = await cobrancaCriada();
    const r = await acaoSimularPagamento(cobranca.id, cedro);
    expect(r.sucesso).toBe("Pagamento simulado. A cobrança está paga.");
    const { cobrancas } = await obterRepositorios();
    expect((await cobrancas.obter(cobranca.id)).situacao).toBe("paga");
  });

  it("fora da demonstração não faz nada", async () => {
    const cobranca = await cobrancaCriada();
    process.env.KZ_DADOS = "";
    expect((await acaoSimularPagamento(cobranca.id, cedro)).erro).toBe(
      "Esta ação existe só na demonstração.",
    );
  });
});
