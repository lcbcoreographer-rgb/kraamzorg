// @vitest-environment node
/**
 * P31 item 1: o modelo provisório do contrato (C-11) vira PDF com
 * contratante, pagador, pacote (dias vezes horas e total, enfermeira
 * obstétrica ou neonatal, as quatro frentes, pré-natal online), valor,
 * taxa, parcelas e a versão do modelo; a variante de presente sai sem
 * valores. Dado 100% sintético.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DadosParaContrato } from "@/lib/dados/tipos-contrato";
import { PARAMETROS_CONTRATO } from "@/lib/dados/demonstracao/contrato-fixtures";
import {
  kraamzorgDoBanco,
  modeloDoBanco,
} from "@/lib/dados/mapeamento-contrato";
import { lerPaginas, textoDasPaginas } from "./__fixtures__/ler-pdf";
import {
  formatarCpf,
  linhaDeEndereco,
  montarConteudoContrato,
  textosDoContrato,
} from "./contrato-conteudo";
import { gerarPdfContrato } from "./gerar-contrato";

const ID = "b1900000-0000-4000-8000-000000000001";

const endereco = {
  cep: "01310-100",
  logradouro: "Rua de Teste",
  numero: "100",
  complemento: "apto 12",
  bairro: "Bairro de Teste",
  cidade: "São Paulo",
  uf: "SP",
};

function dados(
  variante: "completa" | "presente" = "completa",
  ajuste: (d: DadosParaContrato) => void = () => {},
): DadosParaContrato {
  const d: DadosParaContrato = {
    contrato: {
      id: ID,
      variante,
      conta: {
        valorCentavos: 420000,
        taxaCentavos: 35000,
        descontoCentavos: 0,
        totalCentavos: 455000,
        parcelas: 3,
        parcelaCentavos: 151666,
        primeiraParcelaCentavos: 151668,
      },
      parcelasMaxSemJuros: 3,
    },
    pacote: {
      nome: "Essencial",
      linha: "Acompanhamento diário",
      dias: 6,
      gemelar: false,
      horasPorVisita: 3,
    },
    familia: { id: "f", enderecoAtendimento: { ...endereco, numero: "200" } },
    contratante: {
      nome: "Marina Teste Fluxo",
      email: "marina.fluxo@exemplo.invalid",
      cpf: "11144477735",
      endereco,
      dataNascimento: "1992-03-04",
    },
    pagador:
      variante === "presente"
        ? {
            nome: "Carla Teste Presenteadora",
            email: "carla@exemplo.invalid",
            cpf: "39053344705",
            endereco: { ...endereco, numero: "300" },
          }
        : null,
    testemunha: { nome: "Rafael Teste Fluxo", email: "rafael@exemplo.invalid" },
    modelo: modeloDoBanco(PARAMETROS_CONTRATO.contrato_modelo),
    kraamzorg: kraamzorgDoBanco(PARAMETROS_CONTRATO.contrato_kraamzorg),
  };
  ajuste(d);
  return d;
}

describe("conteúdo do contrato", () => {
  it("formata CPF e endereço", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35");
    expect(linhaDeEndereco(endereco)).toBe(
      "Rua de Teste, 100, apto 12, Bairro de Teste, São Paulo/SP, CEP 01310-100",
    );
  });

  it("completa: partes, pacote (dias x horas = total), quatro frentes, pré-natal e valores", () => {
    const r = montarConteudoContrato(dados(), new Date("2026-09-29T15:00:00Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = textosDoContrato(r.conteudo).join("\n");
    expect(texto).toContain("Marina Teste Fluxo");
    expect(texto).toContain("111.444.777-35");
    expect(texto).toContain("04/03/1992");
    expect(texto).toContain("Rafael Teste Fluxo");
    expect(texto).toContain("pacote Essencial");
    expect(texto).toContain("enfermeira obstétrica ou neonatal");
    expect(texto).toContain("São 6 dias de visita, com 3 horas por visita");
    expect(texto).toContain("total de 18 horas");
    expect(texto).toContain("A mãe:");
    expect(texto).toContain("O bebê:");
    expect(texto).toContain("A amamentação:");
    expect(texto).toContain("A família:");
    expect(texto).toContain("pré-natal online");
    expect(texto).toContain("R$ 4.200");
    expect(texto).toContain("R$ 350");
    expect(texto).toContain("R$ 4.550");
    expect(texto).toContain("até 3 vezes sem juros");
    expect(texto).toContain("C-11 provisório");
    expect(texto).toContain("29/09/2026");
    expect(r.conteudo.aviso).toMatch(/provisório/);
  });

  it("uma parcela só: a forma é à vista e não cita parcelamento", () => {
    const r = montarConteudoContrato(
      dados("completa", (d) => {
        d.contrato.conta.parcelas = 1;
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = textosDoContrato(r.conteudo).join("\n");
    expect(texto).toContain("à vista");
    expect(texto).not.toContain("sem juros");
  });

  it("desconto aparece com sinal e a taxa some quando é zero", () => {
    const r = montarConteudoContrato(
      dados("completa", (d) => {
        d.contrato.conta.descontoCentavos = 39000;
        d.contrato.conta.taxaCentavos = 0;
        d.contrato.conta.totalCentavos = 381000;
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = textosDoContrato(r.conteudo).join("\n");
    expect(texto).toContain("-R$ 390");
    expect(texto).not.toContain("Taxa de deslocamento");
  });

  it("presente: nenhum valor para quem recebe o cuidado e nada de quem paga além do nome", () => {
    const r = montarConteudoContrato(dados("presente"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = textosDoContrato(r.conteudo).join("\n");
    expect(texto).not.toContain("R$");
    expect(texto).not.toContain("Valor do pacote");
    expect(texto).toContain("Carla Teste Presenteadora");
    expect(texto).toContain("presenteia a CONTRATANTE");
    expect(texto).not.toContain("390.533.447-05");
    expect(texto).not.toContain("39053344705");
    expect(r.conteudo.partes.map((p) => p.titulo)).not.toContain("PAGADOR(A)");
  });

  it("completa com pagador diferente: o bloco do pagador entra com CPF", () => {
    const r = montarConteudoContrato(
      dados("completa", (d) => {
        d.pagador = {
          nome: "Helena Teste Pagadora",
          email: null,
          cpf: "39053344705",
          endereco,
        };
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = textosDoContrato(r.conteudo).join("\n");
    expect(texto).toContain("Helena Teste Pagadora");
    expect(texto).toContain("390.533.447-05");
  });

  it("modelo aprovado não leva o aviso de rascunho", () => {
    const r = montarConteudoContrato(
      dados("completa", (d) => {
        d.modelo.aprovado = true;
      }),
    );
    expect(r.ok && r.conteudo.aviso).toBeNull();
  });

  it("recusa travessão, meia-risca, variável sem valor e modelo vazio", () => {
    const comTravessao = montarConteudoContrato(
      dados("completa", (d) => {
        d.modelo.clausulas[0]!.texto = "Prazo \u2014 seis dias";
      }),
    );
    expect(comTravessao).toEqual({
      ok: false,
      erros: ["O contrato tem travessão ou meia-risca. Troque no modelo."],
    });
    const meiaRisca = montarConteudoContrato(
      dados("completa", (d) => {
        d.modelo.clausulas[0]!.texto = "6\u201312 dias";
      }),
    );
    expect(meiaRisca.ok).toBe(false);
    const semValor = montarConteudoContrato(
      dados("completa", (d) => {
        d.modelo.clausulas[0]!.texto = "Valor {inexistente}";
      }),
    );
    expect(semValor).toEqual({
      ok: false,
      erros: ["O modelo do contrato usa {inexistente}, que não tem valor."],
    });
    const vazio = montarConteudoContrato(
      dados("completa", (d) => {
        d.modelo.clausulas = [];
      }),
    );
    expect(vazio.ok).toBe(false);
  });
});

describe("PDF do contrato", () => {
  it("gera o PDF com nome pelo id, resumo sha256, rodapé e paginação em toda página", async () => {
    const r = await gerarPdfContrato(dados(), new Date("2026-09-29T15:00:00Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nomeArquivo).toBe(`${ID}.pdf`);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.buffer.subarray(0, 4).toString()).toBe("%PDF");

    const paginas = lerPaginas(r.buffer);
    expect(paginas.length).toBeGreaterThanOrEqual(1);
    const textos = textoDasPaginas(r.buffer);
    textos.forEach((pagina, i) => {
      expect(pagina).toContain("Modelo C-11 provisório");
      expect(pagina).toContain(`Página ${i + 1} de ${textos.length}`);
    });
    const tudo = textos.join(" ");
    expect(tudo).toContain("Marina Teste Fluxo");
    expect(tudo).toContain("R$ 4.550");
  });

  it("os metadados do PDF não levam nome de gente", async () => {
    const r = await gerarPdfContrato(dados());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const bruto = r.buffer.toString("latin1");
    for (const nome of ["Marina", "Rafael", "Fluxo"]) {
      // O nome só existe dentro do conteúdo comprimido, nunca no dicionário /Info.
      const info =
        /\/Title[^\n]*|\/Author[^\n]*|\/Subject[^\n]*|\/Keywords[^\n]*/g;
      for (const linha of bruto.match(info) ?? []) {
        expect(linha).not.toContain(nome);
      }
    }
  });

  it("modelo com erro não gera PDF", async () => {
    const r = await gerarPdfContrato(
      dados("completa", (d) => {
        d.modelo.clausulas = [];
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("presente: o PDF inteiro sai sem R$", async () => {
    const r = await gerarPdfContrato(dados("presente"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(textoDasPaginas(r.buffer).join(" ")).not.toContain("R$");
  });
});
