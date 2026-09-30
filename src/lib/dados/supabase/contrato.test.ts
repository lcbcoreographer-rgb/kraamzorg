// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Json } from "@/lib/db/types";
import { criarCobrancaSupabase, dadosLinkDoBanco, detalheDoBanco, listaCobrancasDoBanco } from "./cobranca";
import {
  criarContratoSupabase,
  dadosParaContratoDoBanco,
  reservaDoBanco,
  situacaoDoBanco,
} from "./contrato";
import type { ContextoSupabase } from "./comum";

/**
 * Caminho Supabase do contrato e da cobrança sem banco: o que as funções
 * api.* devolvem (0019_contrato_cobranca.sql, provado no pgTAP) vira os
 * tipos da tela, e o que a tela manda vira os argumentos certos.
 */

interface Chamada {
  funcao: string;
  args: Record<string, unknown>;
}

function clienteDeMentira(
  respostas: Record<string, { data?: Json; error?: { code: string; message: string } }>,
) {
  const chamadas: Chamada[] = [];
  const cliente = {
    schema: (nome: string) => {
      expect(nome).toBe("api");
      return {
        rpc: async (funcao: string, args: Record<string, unknown> = {}) => {
          chamadas.push({ funcao, args });
          const r = respostas[funcao];
          return { data: r?.data ?? null, error: r?.error ?? null };
        },
      };
    },
  };
  return {
    chamadas,
    contexto: { cliente, usuarioId: "u" } as unknown as ContextoSupabase,
  };
}

const ENDERECO = {
  cep: "01310100",
  logradouro: "Rua de Teste",
  numero: "100",
  complemento: "",
  bairro: "Bairro de Teste",
  cidade: "São Paulo",
  uf: "SP",
};

const CONTA = {
  valor_centavos: 420000,
  taxa_centavos: 35000,
  desconto_centavos: 0,
  total_centavos: 455000,
  parcelas: 3,
  parcela_centavos: 151666,
  primeira_parcela_centavos: 151668,
};

describe("contrato: do banco para a tela", () => {
  it("situação do contrato", () => {
    const s = situacaoDoBanco({
      familia: { id: "f1", nome: "Família Teste", estado_sensivel: "normal", nao_contatar: false },
      oportunidade: { id: "o1", estagio_p2: "ganho", para_quem: "presente" },
      contrato: {
        id: "k1",
        status: "aguardando_dados",
        etapa: "pronto_para_gerar",
        template_versao: "C-11 teste",
        variante: "presente",
        conta: CONTA,
        pdf_gerado: false,
        formulario_recebido_em: "2026-09-29T15:00:00Z",
        enviado_em: null,
        assinado_em: null,
      },
      assinantes: [
        { papel: "gestante", nome: "Marina", email: "m***@exemplo.invalid", tem_contato: true },
        { papel: "kraamzorg", nome: "Rep", email: null, tem_contato: false },
      ],
      modelo: { versao: "C-11 teste", aprovado: false },
      cobrancas: [
        { parcela: 1, vencimento: "2026-10-02", status: "aberta", pago_em: null },
      ],
      pode_gerar: true,
      pode_enviar: false,
      pode_ver_cobranca: false,
      sensivel: false,
    });
    expect(s.contrato).toMatchObject({
      id: "k1",
      etapa: "pronto_para_gerar",
      variante: "presente",
      pdfGerado: false,
      formularioRecebidoEm: "2026-09-29T15:00:00Z",
    });
    expect(s.contrato?.conta?.totalCentavos).toBe(455000);
    expect(s.assinantes[0]).toEqual({
      papel: "gestante",
      nome: "Marina",
      email: "m***@exemplo.invalid",
      temContato: true,
    });
    expect(s.cobrancas[0]).toMatchObject({ id: null, valorCentavos: null, status: "aberta" });
    expect(s.podeGerar).toBe(true);
    expect(s.podeEnviar).toBe(false);
    expect(s.modelo).toEqual({ versao: "C-11 teste", aprovado: false });
  });

  it("sem contrato e sem oportunidade", () => {
    const s = situacaoDoBanco({
      familia: { id: "f1", nome: "Família", estado_sensivel: "normal", nao_contatar: false },
      oportunidade: null,
      contrato: null,
      assinantes: [],
      modelo: { versao: null, aprovado: false },
      cobrancas: [],
      pode_gerar: false,
      pode_enviar: false,
      pode_ver_cobranca: false,
      sensivel: false,
    });
    expect(s.contrato).toBeNull();
    expect(s.oportunidade).toBeNull();
  });

  it("dados para o PDF: CPF, endereços, pagador, testemunha, modelo e Kraamzorg", () => {
    const d = dadosParaContratoDoBanco({
      contrato: { id: "k1", variante: "completa", conta: CONTA, parcelas_max_sem_juros: 3 },
      pacote: { nome: "Essencial", linha: "Acompanhamento diário", dias: 6, gemelar: false, horas_por_visita: 3 },
      familia: { id: "f1", endereco_atendimento: ENDERECO },
      contratante: { nome: "Marina", email: "m@exemplo.invalid", cpf: "11144477735", data_nascimento: "1992-03-04", endereco: ENDERECO },
      pagador: null,
      testemunha: { nome: "Rafael", email: "r@exemplo.invalid" },
      modelo: {
        versao: "C-11 teste",
        aprovado: false,
        titulo: "Contrato",
        aviso_rascunho: "Provisório",
        profissional: "enfermeira",
        partes: { contratada: "CONTRATADA", contratante: "CONTRATANTE", pagador: "PAGADOR", testemunha: "TESTEMUNHA" },
        frentes: ["A mãe", 3],
        valores: { pacote: "Valor", desconto: "Desconto", taxa: "Taxa", total: "Total", forma: "Forma", forma_uma_vez: "à vista", forma_parcelada: "em {parcelas}" },
        clausulas: [{ titulo: "1", texto: "t", com_frentes: true }, { titulo: "2", texto: "v", valores: true }, { titulo: "3", texto: "p", somente_presente: true }],
        assinaturas: "Assinam",
      },
      kraamzorg: { signatario_nome: "Rep", signatario_email: "rep@exemplo.invalid", razao_social: "Kraamzorg", documento: "doc", endereco: "end" },
    });
    expect(d.contratante.cpf).toBe("11144477735");
    expect(d.contratante.dataNascimento).toBe("1992-03-04");
    expect(d.contratante.endereco.cidade).toBe("São Paulo");
    expect(d.familia.enderecoAtendimento?.logradouro).toBe("Rua de Teste");
    expect(d.pagador).toBeNull();
    expect(d.testemunha).toEqual({ nome: "Rafael", email: "r@exemplo.invalid" });
    expect(d.modelo.frentes).toEqual(["A mãe"]);
    expect(d.modelo.valores.formaParcelada).toBe("em {parcelas}");
    expect(d.modelo.clausulas.map((c) => [c.comFrentes, c.valores, c.somentePresente])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ]);
    expect(d.kraamzorg.signatarioEmail).toBe("rep@exemplo.invalid");
    expect(d.contrato.parcelasMaxSemJuros).toBe(3);
  });

  it("reserva do envio", () => {
    const r = reservaDoBanco({
      ok: true,
      contrato_id: "k1",
      pdf_path: "contratos/k1.pdf",
      nome_documento: "Contrato de cuidado domiciliar k1",
      modelo_versao: "C-11 teste",
      modelo_aprovado: true,
      gestante: { nome: "Marina", email: "m@exemplo.invalid", telefone: "+5511900000001" },
      testemunha: null,
      kraamzorg: { nome: "Rep", email: "rep@exemplo.invalid" },
    });
    expect(r).toMatchObject({
      contratoId: "k1",
      pdfPath: "contratos/k1.pdf",
      modeloAprovado: true,
      testemunha: null,
    });
    expect(r.gestante.telefone).toBe("+5511900000001");
  });
});

describe("contrato: da tela para o banco", () => {
  it("chama cada função com os argumentos certos", async () => {
    const { contexto, chamadas } = clienteDeMentira({
      reservar_envio_contrato: {
        data: {
          contrato_id: "k1",
          pdf_path: "contratos/k1.pdf",
          nome_documento: "n",
          gestante: { nome: "M" },
          kraamzorg: { nome: "R", email: "r@exemplo.invalid" },
        },
      },
    });
    const repo = criarContratoSupabase(contexto);
    await repo.registrarGerado("k1", "contratos/k1.pdf", "a".repeat(64));
    await repo.reservarEnvio("k1");
    await repo.concluirEnvio("k1", "doc-1234567");
    await repo.liberarEnvio("k1");
    expect(chamadas).toEqual([
      {
        funcao: "registrar_contrato_gerado",
        args: { contrato_id: "k1", pdf_path: "contratos/k1.pdf", pdf_sha256: "a".repeat(64) },
      },
      { funcao: "reservar_envio_contrato", args: { contrato_id: "k1" } },
      {
        funcao: "concluir_envio_contrato",
        args: { contrato_id: "k1", autentique_doc_id: "doc-1234567" },
      },
      { funcao: "liberar_envio_contrato", args: { contrato_id: "k1" } },
    ]);
  });

  it("a recusa de negócio do banco chega como erro recusado com o código", async () => {
    const { contexto } = clienteDeMentira({
      dados_para_contrato: {
        error: { code: "P0001", message: "venda:formulario_pendente " },
      },
    });
    await expect(
      criarContratoSupabase(contexto).dadosParaContrato("k1"),
    ).rejects.toMatchObject({
      codigo: "recusado",
      message: expect.stringContaining("venda:formulario_pendente"),
    });
  });

  it("sem permissão (42501) vira sem_permissao", async () => {
    const { contexto } = clienteDeMentira({
      contrato_situacao: { error: { code: "42501", message: "acesso negado" } },
    });
    await expect(
      criarContratoSupabase(contexto).obterSituacao("f1"),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
});

describe("cobrança: do banco para a tela e de volta", () => {
  it("lista e resumo", () => {
    const lista = listaCobrancasDoBanco({
      resumo: { abertas: 1, vencidas: 2, pagas: 3, a_receber_centavos: 1000, recebido_centavos: 5000 },
      cobrancas: [
        {
          id: "c1",
          contrato_id: "k1",
          familia_id: "f1",
          familia_nome: "Família Teste",
          parcela: 1,
          valor_centavos: 420000,
          vencimento: "2026-10-02",
          situacao: "vencida",
          pago_em: null,
          valor_pago_centavos: null,
          capture_method: null,
          parcelas_cartao: null,
          tem_link: true,
          nota_status: null,
        },
      ],
    });
    expect(lista.resumo).toEqual({ abertas: 1, vencidas: 2, pagas: 3, aReceberCentavos: 1000, recebidoCentavos: 5000 });
    expect(lista.cobrancas[0]).toMatchObject({ id: "c1", situacao: "vencida", temLink: true, valorCentavos: 420000 });
  });

  it("detalhe, com recibo da InfinitePay e sem arquivo", () => {
    const d = detalheDoBanco({
      id: "c1",
      contrato_id: "k1",
      contrato_status: "assinado",
      familia_id: "f1",
      familia_nome: "Família Teste",
      pagador_nome: "Marina",
      parcela: 1,
      valor_centavos: 455000,
      vencimento: "2026-10-02",
      situacao: "paga",
      pago_em: "2026-10-01T10:00:00Z",
      valor_pago_centavos: 455000,
      capture_method: "credit_card",
      parcelas_cartao: 3,
      parcelas_contrato: 3,
      parcelas_max: 3,
      acima_do_limite: false,
      link_pagamento: "https://pay.exemplo.invalid/c1",
      comprovante: "recibo",
      recibo_url: "https://recibo.exemplo.invalid/1",
      comprovante_path: null,
      nota: { status: "pendente", numero: null },
      pode_gerar_link: false,
      pode_baixar_manual: false,
      comprovante_max_bytes: 3145728,
    });
    expect(d).toMatchObject({
      situacao: "paga",
      metodo: "credit_card",
      parcelasCartao: 3,
      comprovante: "recibo",
      reciboUrl: "https://recibo.exemplo.invalid/1",
      comprovantePath: null,
      nota: { status: "pendente", numero: null },
      comprovanteMaxBytes: 3145728,
      podeBaixarManual: false,
    });
  });

  it("dados do link nunca levam CPF", () => {
    const d = dadosLinkDoBanco({
      cobranca_id: "c1",
      contrato_id: "k1",
      familia_id: "f1",
      valor_centavos: 455000,
      parcelas: 3,
      parcelas_max: 3,
      acima_do_limite: false,
      descricao: "Cuidado domiciliar pós-parto",
      cliente: { nome: "Marina", email: "m@exemplo.invalid", telefone: "+5511900000001" },
    });
    expect(Object.keys(d.cliente).sort()).toEqual(["email", "nome", "telefone"]);
    expect(JSON.stringify(d)).not.toMatch(/cpf/i);
  });

  it("chama cada função com os argumentos certos", async () => {
    const { contexto, chamadas } = clienteDeMentira({
      gerar_cobranca: { data: { ok: true, cobranca_id: "c9" } },
      cobrancas: { data: { resumo: {}, cobrancas: [] } },
    });
    const repo = criarCobrancaSupabase(contexto);
    await repo.listar("paga");
    await repo.listar();
    expect(await repo.gerarDoContrato("k1")).toBe("c9");
    await repo.registrarLink("c1", "https://pay.exemplo.invalid/c1", "slug");
    await repo.registrarLink("c1", "https://pay.exemplo.invalid/c1", null);
    await repo.baixarManual({
      cobrancaId: "c1",
      valorPagoCentavos: 455000,
      comprovantePath: "comprovantes/c1-abc12345.png",
      motivo: "Pix recebido",
    });
    expect(chamadas).toEqual([
      { funcao: "cobrancas", args: { situacao: "paga" } },
      { funcao: "cobrancas", args: { situacao: undefined } },
      { funcao: "gerar_cobranca", args: { contrato_id: "k1" } },
      {
        funcao: "registrar_link_pagamento",
        args: { cobranca_id: "c1", url: "https://pay.exemplo.invalid/c1", slug: "slug" },
      },
      {
        funcao: "registrar_link_pagamento",
        args: { cobranca_id: "c1", url: "https://pay.exemplo.invalid/c1", slug: undefined },
      },
      {
        funcao: "baixar_cobranca_manual",
        args: {
          cobranca_id: "c1",
          valor_pago_centavos: 455000,
          comprovante_path: "comprovantes/c1-abc12345.png",
          motivo: "Pix recebido",
        },
      },
    ]);
  });
});
