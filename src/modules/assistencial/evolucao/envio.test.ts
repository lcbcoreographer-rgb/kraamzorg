// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DadosEnvioEvolucao } from "@/lib/dados/tipos-evolucao";
import {
  corpoDoEmail,
  enviarEvolucao,
  pacienteDoCorpo,
  periodoDoCorpo,
} from "./envio";

/** Escrito por código, para o arquivo não carregar o caractere (CLAUDE.md, texto de interface). */
const TRAVESSAO = String.fromCharCode(0x2014);

const RELATORIO = "d0000000-0000-4000-8000-000000000001";

const MODELO =
  "Olá, {tratamento} {medico}. Segue em anexo a evolução do acompanhamento de {paciente}, de {inicio} a {fim}.\n\nEm caso de dúvida, fale com {coordenacao} pelo {contato}.";

describe("corpo do e-mail", () => {
  it("preenche as variáveis do texto aprovado e separa os parágrafos", () => {
    const html = corpoDoEmail(MODELO, {
      tratamento: "Dr(a).",
      medico: "Helena",
      paciente: "Marina",
      inicio: "24/09/2026",
      fim: "29/09/2026",
      coordenacao: "a coordenação",
      contato: "e-mail c@exemplo.invalid",
    });
    expect(html).toBe(
      "<p>Olá, Dr(a). Helena. Segue em anexo a evolução do acompanhamento de Marina, de 24/09/2026 a 29/09/2026.</p><p>Em caso de dúvida, fale com a coordenação pelo e-mail c@exemplo.invalid.</p>",
    );
  });

  it("escapa o que vem de cadastro, para nome com < ou & não virar marcação", () => {
    const html = corpoDoEmail("Olá, {medico}.", { medico: '<b>Dr & "X"</b>' });
    expect(html).toBe("<p>Olá, &lt;b&gt;Dr &amp; &quot;X&quot;&lt;/b&gt;.</p>");
  });

  it("variável sem valor ou travessão no texto: não monta", () => {
    expect(
      corpoDoEmail("Olá, {medico} e {outro}.", { medico: "Helena" }),
    ).toBeNull();
    expect(
      corpoDoEmail(`Olá ${TRAVESSAO} {medico}.`, { medico: "Helena" }),
    ).toBeNull();
  });
});

describe("dados do corpo", () => {
  it("paciente do puerperal, bebê do neonatal e, sem nome, o bebê de quem é filho", () => {
    expect(pacienteDoCorpo({ paciente: { nome: "Marina" } })).toBe("Marina");
    expect(
      pacienteDoCorpo({ bebe: { nome: "Aurora" }, filiacao: ["Marina"] }),
    ).toBe("Aurora");
    expect(pacienteDoCorpo({ bebe: {}, filiacao: ["Marina"] })).toBe(
      "o bebê de Marina",
    );
    expect(pacienteDoCorpo({})).toBe("o bebê");
  });

  it("período em dd/mm/aaaa, ou nulo se faltar", () => {
    expect(
      periodoDoCorpo({ periodo: { inicio: "2026-09-24", fim: "2026-09-29" } }),
    ).toEqual({
      inicio: "24/09/2026",
      fim: "29/09/2026",
    });
    expect(periodoDoCorpo({ periodo: { inicio: "2026-09-24" } })).toBeNull();
  });
});

function dados(
  sobrescrever: Partial<DadosEnvioEvolucao> = {},
): DadosEnvioEvolucao {
  return {
    relatorioId: RELATORIO,
    tipo: "puerperal",
    status: "aprovado",
    conteudo: {
      dados: {
        paciente: { nome: "Marina Teste" },
        periodo: { inicio: "2026-09-24", fim: "2026-09-29" },
      },
      conteudo: { tipo: "puerperal", secoes: [], assinatura: {} },
    },
    destinatarios: [
      {
        medicoId: "m1",
        especialidade: "obstetra",
        nome: "Helena",
        email: "h@exemplo.invalid",
      },
      {
        medicoId: "m2",
        especialidade: "obstetra",
        nome: "Rui",
        email: "r@exemplo.invalid",
      },
    ],
    nomesProibidos: ["Marina Teste"],
    config: {
      tratamento: "Dr(a).",
      coordenacao: "a coordenação",
      contato: "e-mail c@exemplo.invalid",
    },
    textos: { assunto: "Evolução de enfermagem", corpo: MODELO },
    ...sobrescrever,
  };
}

function ambiente(d: DadosEnvioEvolucao, falhaEm: string[] = []) {
  const registros: unknown[] = [];
  const enviados: { para: string[]; assunto: string; anexos: string[] }[] = [];
  const armazenados: string[] = [];
  return {
    registros,
    enviados,
    armazenados,
    deps: {
      evolucoes: {
        async dadosEnvio() {
          return d;
        },
        async registrarEnvio(pedido: unknown) {
          registros.push(pedido);
        },
      },
      email: {
        ambienteDeTeste: true,
        async enviar(entrada: {
          para: string[];
          assunto: string;
          anexos?: { nomeArquivo: string }[];
        }) {
          if (falhaEm.includes(entrada.para[0]!)) throw new Error("rede");
          enviados.push({
            para: entrada.para,
            assunto: entrada.assunto,
            anexos: (entrada.anexos ?? []).map((a) => a.nomeArquivo),
          });
          return { id: "e1" };
        },
      },
      armazenamento: {
        async salvar(caminho: string) {
          armazenados.push(caminho);
        },
      },
      renderizar: async (id: string) => ({
        ok: true as const,
        buffer: Buffer.from("%PDF-1.7 teste"),
        nomeArquivo: `${id}.pdf`,
      }),
    },
  };
}

describe("enviarEvolucao", () => {
  it("guarda o PDF por id, manda um e-mail por médico e registra o envio", async () => {
    const a = ambiente(dados());
    const r = await enviarEvolucao(RELATORIO, a.deps);
    expect(r).toEqual({ ok: true, enviados: 2, falhas: 0 });
    expect(a.armazenados).toEqual([`evolucoes/${RELATORIO}.pdf`]);
    expect(a.enviados.map((e) => e.para[0])).toEqual([
      "h@exemplo.invalid",
      "r@exemplo.invalid",
    ]);
    expect(a.enviados[0]?.anexos).toEqual([`${RELATORIO}.pdf`]);
    expect(a.registros).toEqual([
      expect.objectContaining({
        relatorioId: RELATORIO,
        pdfPath: `evolucoes/${RELATORIO}.pdf`,
        enviados: [
          expect.objectContaining({
            medicoId: "m1",
            especialidade: "obstetra",
          }),
          expect.objectContaining({ medicoId: "m2" }),
        ],
      }),
    ]);
  });

  it("um médico falha e o outro recebe: registra só quem recebeu", async () => {
    const a = ambiente(dados(), ["h@exemplo.invalid"]);
    const r = await enviarEvolucao(RELATORIO, a.deps);
    expect(r).toEqual({ ok: true, enviados: 1, falhas: 1 });
    expect(a.registros).toEqual([
      expect.objectContaining({
        enviados: [expect.objectContaining({ medicoId: "m2" })],
      }),
    ]);
  });

  it("todos falham: o documento fica em envio com erro, com o motivo", async () => {
    const a = ambiente(dados(), ["h@exemplo.invalid", "r@exemplo.invalid"]);
    const r = await enviarEvolucao(RELATORIO, a.deps);
    expect(r).toMatchObject({ ok: false, codigo: "falha_email" });
    expect(a.registros).toEqual([
      expect.objectContaining({
        pdfPath: null,
        enviados: [],
        erro: expect.stringContaining("Nada chegou ao médico"),
      }),
    ]);
  });

  it.each([
    [
      "sem conteúdo montado",
      { conteudo: { dados: {}, conteudo: null } },
      "sem_conteudo",
    ],
    ["sem médico com e-mail", { destinatarios: [] }, "sem_destinatario"],
    [
      "sem contato no cadastro",
      {
        config: {
          tratamento: "Dr(a).",
          coordenacao: "a coordenação",
          contato: " ",
        },
      },
      "sem_configuracao",
    ],
    [
      "sem assunto",
      { textos: { assunto: null, corpo: MODELO } },
      "sem_texto_email",
    ],
    [
      "assunto com travessão",
      { textos: { assunto: `Evolução ${TRAVESSAO} Kraamzorg`, corpo: MODELO } },
      "sem_texto_email",
    ],
  ] as const)(
    "%s: nada sai e o motivo fica registrado",
    async (_nome, extra, codigo) => {
      const a = ambiente(dados(extra as Partial<DadosEnvioEvolucao>));
      const r = await enviarEvolucao(RELATORIO, a.deps);
      expect(r).toMatchObject({ ok: false, codigo });
      expect(a.enviados).toEqual([]);
      expect(a.armazenados).toEqual([]);
      expect(a.registros).toHaveLength(1);
    },
  );

  it("assunto com o nome da paciente é barrado pela guarda e nada sai", async () => {
    const d = dados({
      textos: { assunto: "Evolução de Marina Teste", corpo: MODELO },
    });
    const a = ambiente(d);
    // usa o e-mail de verdade da fábrica na demonstração para passar pela guarda
    process.env.KZ_DADOS = "demonstracao";
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    const { obterEmail, limparCaixaDeSaidaEmailDemo, caixaDeSaidaEmailDemo } =
      await import("@/lib/integracoes/fabrica");
    limparCaixaDeSaidaEmailDemo();
    const r = await enviarEvolucao(RELATORIO, {
      ...a.deps,
      email: obterEmail(),
    });
    expect(r).toMatchObject({ ok: false, codigo: "dado_pessoal" });
    expect(caixaDeSaidaEmailDemo()).toEqual([]);
    delete process.env.KZ_DADOS;
  });
});
