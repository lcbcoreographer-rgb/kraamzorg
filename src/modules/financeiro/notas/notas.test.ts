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

import { obterArmazenamento } from "@/lib/armazenamento";
import { reiniciarArmazenamentoMemoria } from "@/lib/armazenamento/memoria";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  definirEmissaoAutomaticaDemo,
  reiniciarLojaNotas,
} from "@/lib/dados/demonstracao/nota";
import { reiniciarLojaVenda } from "@/lib/dados/demonstracao/venda";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { GET as abrirArquivo } from "@/app/(app)/notas/[id]/arquivo/[tipo]/route";
import {
  acaoAjustarDemonstracaoNota,
  acaoConsultarNota,
  acaoEmitirNota,
  acaoRegistrarNotaManual,
  acaoVerDadosDaNota,
} from "./acoes";
import { obterTelaListaNotas } from "./dados";
import { estadoInicialNota } from "./estado-acoes";

/**
 * P43, aceite: erro mostra o motivo e permite reenviar. Aqui sobre o
 * repositório de demonstração e o provedor de mentira; o banco é coberto por
 * supabase/tests/024_evolucao_ocorrencia_nf.sql e o adaptador real por
 * src/lib/integracoes/nfse.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

const nota = (n: number) =>
  `00000000-0000-4000-8b00-${n.toString().padStart(12, "0")}`;
const PENDENTE = nota(1);
const COM_ERRO = nota(2);
const PROCESSANDO = nota(3);

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

const PDF = new TextEncoder().encode("%PDF-1.7 nota de teste");
const XML = new TextEncoder().encode(
  '<?xml version="1.0"?><NFSe><numero>1</numero></NFSe>',
);

function formularioManual(
  notaId: string,
  extra: Record<string, string | File | null> = {},
): FormData {
  const f = new FormData();
  f.set("notaId", notaId);
  f.set("numero", "2026/154");
  f.set("emitidaEm", "2026-09-28");
  f.set("provedor", "Portal da contadora");
  for (const [chave, valor] of Object.entries(extra)) {
    if (valor === null) f.delete(chave);
    else f.set(chave, valor);
  }
  return f;
}

async function detalhe(id: string) {
  const { notas } = await obterRepositorios();
  return notas.obter(id);
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaVenda();
  reiniciarLojaNotas();
  reiniciarArmazenamentoMemoria();
  await entrar("Perfil Teste Financeiro");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("lista de notas", () => {
  it("mostra cada estado, o motivo do erro e o resumo em números", async () => {
    const { notas } = await obterRepositorios();
    const lista = await notas.listar();
    const estados = Object.fromEntries(
      lista.notas.map((n) => [n.id, n.status]),
    );
    expect(estados[PENDENTE]).toBe("pendente");
    expect(estados[COM_ERRO]).toBe("erro");
    expect(estados[PROCESSANDO]).toBe("processando");
    expect(lista.resumo.comErro).toBeGreaterThanOrEqual(1);
    expect(lista.resumo.pendentes).toBeGreaterThanOrEqual(1);
    // erro vem primeiro na fila
    expect(lista.notas[0]?.status).toBe("erro");
    // o tomador é quem paga, com nome, e o filtro funciona
    expect(lista.notas.find((n) => n.id === COM_ERRO)?.tomadorNome).toBe(
      "Paulo Teste Pagador",
    );
    const soErro = await notas.listar("erro");
    expect(soErro.notas.every((n) => n.status === "erro")).toBe(true);
    expect(lista.emissaoAutomatica).toBe(false);
  });

  it("a tela pede o código do aplicativo antes de abrir e recusa quem não é do financeiro", async () => {
    await entrar("Perfil Teste Financeiro", "aal1");
    const usuario = {
      usuarioId: "x",
      nome: "x",
      email: "x",
      papeis: ["financeiro"],
      ativo: true,
      aal: "aal1",
      aalPossivel: "aal2",
    } as SessaoUsuario;
    expect(await obterTelaListaNotas(usuario)).toEqual({ situacao: "mfa" });

    await entrar("Perfil Teste Comercial");
    const { notas } = await obterRepositorios();
    await expect(notas.listar()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await entrar("Perfil Teste Coordenacao");
    const { notas: dela } = await obterRepositorios();
    await expect(dela.listar()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});

describe("emissão pelo provedor: erro mostra o motivo e permite reenviar", () => {
  it("a nota que voltou com erro mostra o motivo e reenvia até sair", async () => {
    definirEmissaoAutomaticaDemo(true);
    const antes = await detalhe(COM_ERRO);
    expect(antes.status).toBe("erro");
    expect(antes.erro).toMatch(
      /O provedor recusou a nota: o CPF do tomador não confere/,
    );
    expect(antes.podeEmitir).toBe(true);
    expect(antes.emissaoAutomatica).toBe(true);

    const r = await acaoEmitirNota(COM_ERRO);
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Nota emitida, número D/);
    const depois = await detalhe(COM_ERRO);
    expect(depois.status).toBe("emitida");
    expect(depois.erro).toBeNull();
    expect(depois.tentativas).toBe(2);
    expect(depois.numero).toMatch(/^D[0-9A-F]{8}$/);
    // emitida não reemite
    expect((await acaoEmitirNota(COM_ERRO)).erro).toMatch(
      /já foi emitida|Nota emitida/,
    );
    expect((await detalhe(COM_ERRO)).tentativas).toBe(2);
  });

  it("falha do provedor: a nota fica com erro, o motivo aparece na frase e o reenvio funciona", async () => {
    definirEmissaoAutomaticaDemo(true);
    expect(
      (await acaoAjustarDemonstracaoNota(PENDENTE, "falha_proxima")).sucesso,
    ).toMatch(/vai voltar com erro/);
    const falhou = await acaoEmitirNota(PENDENTE);
    expect(falhou.sucesso).toBeUndefined();
    expect(falhou.erro).toMatch(
      /O provedor recusou a nota: o endereço de quem paga está incompleto/,
    );
    expect(falhou.erro).toMatch(/toque em Reenviar/);
    const comErro = await detalhe(PENDENTE);
    expect(comErro.status).toBe("erro");
    expect(comErro.erro).toMatch(/endereço de quem paga está incompleto/);
    expect(comErro.tentativas).toBe(1);
    expect(comErro.podeEmitir).toBe(true);

    const reenviada = await acaoEmitirNota(PENDENTE);
    expect(reenviada.erro).toBeUndefined();
    const emitida = await detalhe(PENDENTE);
    expect(emitida.status).toBe("emitida");
    expect(emitida.tentativas).toBe(2);
    expect(emitida.erro).toBeNull();
  });

  it("uma emissão em andamento não aceita outra e a consulta resolve a nota em processamento", async () => {
    definirEmissaoAutomaticaDemo(true);
    const emAndamento = await detalhe(PROCESSANDO);
    expect(emAndamento.status).toBe("processando");
    expect(emAndamento.podeConsultar).toBe(true);
    expect((await acaoEmitirNota(PROCESSANDO)).erro).toMatch(
      /emissão em andamento|não emite|Atualize a tela/,
    );
    const consultada = await acaoConsultarNota(PROCESSANDO);
    expect(consultada.erro).toBeUndefined();
    expect(consultada.sucesso).toMatch(/Nota emitida/);
    expect((await detalhe(PROCESSANDO)).status).toBe("emitida");
  });

  it("o comercial não emite nota", async () => {
    await entrar("Perfil Teste Comercial");
    expect((await acaoEmitirNota(PENDENTE)).erro).toMatch(
      /não permite esta etapa/,
    );
    expect((await acaoVerDadosDaNota(PENDENTE)).erro).toMatch(
      /não permite esta etapa/,
    );
  });
});

describe("emissão manual assistida (T-05)", () => {
  it("mostra os dados para copiar sob pedido, com o tomador que paga, e registra número, data e arquivos", async () => {
    const dados = await acaoVerDadosDaNota(PENDENTE);
    expect(dados.dados).toMatchObject({
      tomadorNome: "Carla Teste Pagadora",
      tomadorCpf: "529.982.247-25",
      codigoServico: "05266",
      descricaoServico: "Cuidado domiciliar pós-parto",
      valor: expect.stringContaining("4.200"),
    });
    expect(dados.dados?.endereco).toMatch(/CEP 01310-100/);

    const r = await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(PENDENTE, {
        pdf: new File([PDF], "da-contadora.pdf", { type: "application/pdf" }),
        xml: new File([XML], "da-contadora.xml", { type: "application/xml" }),
      }),
    );
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Nota registrada/);
    const depois = await detalhe(PENDENTE);
    expect(depois.status).toBe("emitida");
    expect(depois.manual).toBe(true);
    expect(depois.numero).toBe("2026/154");
    expect(depois.temPdf).toBe(true);
    expect(depois.temXml).toBe(true);

    // os arquivos ficam no storage privado com nome por id, sem nome do arquivo enviado
    const armazenamento = obterArmazenamento();
    expect(await armazenamento.ler(`notas/${PENDENTE}.pdf`)).not.toBeNull();
    expect(await armazenamento.ler(`notas/${PENDENTE}.xml`)).not.toBeNull();

    // e abrem pela rota autenticada
    const pdf = await abrirArquivo(new Request("http://x"), {
      params: Promise.resolve({ id: PENDENTE, tipo: "pdf" }),
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("Content-Disposition")).toBe(
      `inline; filename="nota-${PENDENTE}.pdf"`,
    );
    expect(pdf.headers.get("Cache-Control")).toContain("no-store");
    const xml = await abrirArquivo(new Request("http://x"), {
      params: Promise.resolve({ id: PENDENTE, tipo: "xml" }),
    });
    expect(xml.headers.get("Content-Type")).toBe("application/xml");
    const semArquivo = await abrirArquivo(new Request("http://x"), {
      params: Promise.resolve({ id: COM_ERRO, tipo: "pdf" }),
    });
    expect(semArquivo.status).toBe(404);
    expect(
      (
        await abrirArquivo(new Request("http://x"), {
          params: Promise.resolve({ id: PENDENTE, tipo: "docx" }),
        })
      ).status,
    ).toBe(404);
  });

  it("nota registrada à mão sem os arquivos também vale, e a frase avisa quando falta o PDF", async () => {
    const r = await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(COM_ERRO),
    );
    expect(r.erro).toBeUndefined();
    const depois = await detalhe(COM_ERRO);
    expect(depois.status).toBe("emitida");
    expect(depois.temPdf).toBe(false);
    expect(depois.erro).toBeNull();
  });

  it("número faltando, data futura e arquivo do tipo errado voltam como campos marcados, sem gravar nada", async () => {
    const f = formularioManual(PENDENTE, {
      numero: "",
      emitidaEm: "",
      pdf: new File([XML], "trocado.pdf", { type: "application/pdf" }),
    });
    const r = await acaoRegistrarNotaManual(estadoInicialNota, f);
    expect(r.erro).toMatch(/Falta alguma coisa/);
    expect(Object.keys(r.campos ?? {}).sort()).toEqual([
      "emitidaEm",
      "numero",
      "pdf",
    ]);
    expect(r.campos?.pdf).toMatch(/não é um PDF/);
    expect((await detalhe(PENDENTE)).status).toBe("pendente");
    expect(await obterArmazenamento().ler(`notas/${PENDENTE}.pdf`)).toBeNull();

    const futura = await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(PENDENTE, { emitidaEm: "2999-01-01" }),
    );
    expect(futura.erro).toMatch(/data da nota não pode ser futura/);
    expect((await detalhe(PENDENTE)).status).toBe("pendente");
  });

  it("nota em processamento ou já emitida não aceita registro manual", async () => {
    const r = await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(PROCESSANDO),
    );
    expect(r.erro).toMatch(/já foi emitida ou está em processamento/);
    await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(PENDENTE),
    );
    const de_novo = await acaoRegistrarNotaManual(
      estadoInicialNota,
      formularioManual(PENDENTE),
    );
    expect(de_novo.erro).toMatch(/já foi emitida ou está em processamento/);
  });
});
