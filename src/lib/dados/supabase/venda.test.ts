// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: () => {
    throw new Error("o teste de mapeamento não abre cliente");
  },
}));

import type { Json } from "@/lib/db/types";
import { aberturaDoBanco, dadosParaBanco, envioDoBanco } from "./formulario";
import {
  contaDoBanco,
  criarVendaSupabase,
  propostaDoBanco,
  resumoDoBanco,
} from "./venda";
import type { ContextoSupabase } from "./comum";

/**
 * Caminho Supabase da venda sem banco: o que as funções api.* e
 * public.formulario_contrato_* devolvem (0018_venda.sql, provado no pgTAP)
 * vira os tipos da tela, e o que a tela manda vira os argumentos certos.
 */

describe("formulário público", () => {
  it("abertura válida traz só nome, textos e a versão do termo", () => {
    const abertura = aberturaDoBanco({
      situacao: "valido",
      expira_em: "2026-10-02T15:00:00Z",
      pede_pagador: true,
      gestante: { nome: "Juliana Teste Gruta" },
      pagador: { nome: "Helena Teste" },
      testemunha: null,
      termo_versao: "1-rascunho",
      textos: { abertura: "Oi, Juliana.", corrigir: "Ajuste", numero: 3 },
    });
    expect(abertura).toEqual({
      situacao: "valido",
      expiraEm: "2026-10-02T15:00:00Z",
      pedePagador: true,
      nomeGestante: "Juliana Teste Gruta",
      nomePagador: "Helena Teste",
      nomeTestemunha: null,
      termoVersao: "1-rascunho",
      textos: { abertura: "Oi, Juliana.", corrigir: "Ajuste" },
    });
  });

  it("limite e qualquer outra coisa (inválido) nunca viram válido", () => {
    expect(aberturaDoBanco({ situacao: "limite", minutos: 15, textos: {} })).toEqual({
      situacao: "limite",
      minutos: 15,
      textos: {},
    });
    expect(aberturaDoBanco(null).situacao).toBe("invalido");
    expect(aberturaDoBanco({ situacao: "qualquer" }).situacao).toBe("invalido");
  });

  it("resultado do envio", () => {
    expect(envioDoBanco({ situacao: "recebido" })).toEqual({ situacao: "recebido" });
    expect(envioDoBanco({ situacao: "corrigir", erros: { "gestante.cpf": "invalido", x: 1 } })).toEqual({
      situacao: "corrigir",
      erros: { "gestante.cpf": "invalido" },
    });
    expect(envioDoBanco({ situacao: "limite", minutos: 15 })).toEqual({ situacao: "limite", minutos: 15 });
    expect(envioDoBanco("lixo")).toEqual({ situacao: "invalido" });
  });

  it("dados vão em snake_case, como a função lê", () => {
    const endereco = {
      cep: "01310100",
      logradouro: "Rua",
      numero: "1",
      complemento: "",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
    };
    const banco = dadosParaBanco({
      gestante: {
        nomeCompleto: "Juliana Teste",
        cpf: "11144477735",
        dataNascimento: "1994-05-17",
        email: "j@exemplo.invalid",
        endereco,
      },
      atendimentoNoMesmoEndereco: false,
      enderecoAtendimento: endereco,
      pagador: null,
      testemunha: { nomeCompleto: "Diego Teste", email: "d@exemplo.invalid" },
      consentimento: { aceito: true, versao: "1-rascunho" },
    }) as Record<string, Record<string, Json>>;
    expect(banco.gestante!.nome_completo).toBe("Juliana Teste");
    expect(banco.gestante!.data_nascimento).toBe("1994-05-17");
    expect(banco.atendimento_no_mesmo_endereco).toBe(false);
    expect(banco.endereco_atendimento).toMatchObject({ cep: "01310100" });
    expect(banco.testemunha).toEqual({ nome_completo: "Diego Teste", email: "d@exemplo.invalid" });
    expect(banco.consentimento).toEqual({ aceito: true, versao: "1-rascunho" });
  });
});

describe("proposta, conta e resumo", () => {
  it("conta em centavos", () => {
    expect(
      contaDoBanco({
        valor_centavos: 420000,
        taxa_centavos: 35000,
        desconto_centavos: 0,
        total_centavos: 455000,
        parcelas: 3,
        parcela_centavos: 151666,
        primeira_parcela_centavos: 151668,
      }),
    ).toEqual({
      valorCentavos: 420000,
      taxaCentavos: 35000,
      descontoCentavos: 0,
      totalCentavos: 455000,
      parcelas: 3,
      parcelaCentavos: 151666,
      primeiraParcelaCentavos: 151668,
    });
  });

  it("resumo só com listas de texto", () => {
    expect(
      resumoDoBanco({
        duvidas: ["a", 1],
        objecoes: [],
        plano_interesse: "Essencial",
        proximos_passos: ["b"],
        origem: "ia",
        modelo: "m",
        salvo_em: "2026-09-29T15:00:00Z",
      }),
    ).toEqual({
      duvidas: ["a"],
      objecoes: [],
      planoInteresse: "Essencial",
      proximosPassos: ["b"],
      origem: "ia",
      modelo: "m",
      salvoEm: "2026-09-29T15:00:00Z",
    });
    expect(resumoDoBanco(null)).toBeNull();
  });

  it("proposta com contrato e situação do formulário", () => {
    const proposta = propostaDoBanco({
      oportunidade: {
        id: "o",
        familia_id: "f",
        pipeline: 2,
        estagio_p1: "qualificado",
        estagio_p2: "proposta_enviada",
        para_quem: "presente",
        desconto_pct: 5,
        precisa_aprovacao: true,
        desconto_aprovado: false,
      },
      familia: {
        id: "f",
        nome: "Família Teste",
        gemelar: false,
        estado_sensivel: "normal",
        cidade: { nome: "Granja Viana", uf: "SP", taxa_centavos: 35000 },
      },
      pessoas: [{ id: "p", nome: "Juliana", papel: "mae", contato_principal: true }],
      pacotes: [],
      condicoes: [],
      contrato: {
        id: "k",
        status: "aguardando_dados",
        pacote_versao_id: "v",
        template_versao: "C-11 provisório",
        conta: { total_centavos: 455000, parcelas: 3 },
        formulario: { situacao: "aguardando", expira_em: "2026-10-02T15:00:00Z" },
      },
      formulario_validade_horas: 72,
      pode_editar: true,
      pode_aprovar: false,
    });
    expect(proposta.oportunidade.pipeline).toBe(2);
    expect(proposta.oportunidade.paraQuem).toBe("presente");
    expect(proposta.familia.cidade?.taxaCentavos).toBe(35000);
    expect(proposta.contrato?.formulario).toEqual({
      situacao: "aguardando",
      expiraEm: "2026-10-02T15:00:00Z",
      recebidoEm: null,
    });
    expect(proposta.formularioValidadeHoras).toBe(72);
    expect(proposta.podeAprovar).toBe(false);
  });
});

describe("chamadas do repositório", () => {
  function contexto(rpc: ReturnType<typeof vi.fn>): ContextoSupabase {
    return {
      cliente: { schema: () => ({ rpc }) } as unknown as ContextoSupabase["cliente"],
      usuarioId: "u",
    };
  }

  it("marcar a conversa chama api.agendar_sessao_venda com os nomes do banco", async () => {
    const rpc = vi.fn(async () => ({
      data: { sessao_id: "s", tarefa_lembrete_id: "t", estagio_p1: "sessao_venda_agendada" },
      error: null,
    }));
    const venda = criarVendaSupabase(contexto(rpc));
    const resultado = await venda.agendarSessao({
      familiaId: "f",
      agendadaPara: "2026-10-01T22:00:00.000Z",
      conduzidaPor: "c",
      linkReuniao: "https://meet.exemplo.invalid/x",
      handoffId: "h",
    });
    expect(rpc).toHaveBeenCalledWith("agendar_sessao_venda", {
      familia_id: "f",
      agendada_para: "2026-10-01T22:00:00.000Z",
      conduzida_por: "c",
      link_reuniao: "https://meet.exemplo.invalid/x",
      opcoes_informadas: undefined,
      handoff_id: "h",
    });
    expect(resultado).toEqual({
      sessaoId: "s",
      tarefaLembreteId: "t",
      estagioP1: "sessao_venda_agendada",
    });
  });

  it("recusa do banco vira ErroRepositorio com o código da venda na mensagem", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "P0001", message: "venda:data_no_passado 2026-09-01" },
    }));
    const venda = criarVendaSupabase(contexto(rpc));
    await expect(
      venda.agendarSessao({
        familiaId: "f",
        agendadaPara: "2026-09-01T12:00:00Z",
        conduzidaPor: "c",
        linkReuniao: "https://x.invalid",
      }),
    ).rejects.toMatchObject({ codigo: "recusado", message: expect.stringContaining("venda:data_no_passado") });
  });

  it("o link do formulário volta com o token, que nunca é gravado pela tela", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        token: "t".repeat(43),
        expira_em: "2026-10-02T15:00:00Z",
        contrato_id: "k",
        tarefa_id: "tf",
        estagio_p2: "ganho",
      },
      error: null,
    }));
    const venda = criarVendaSupabase(contexto(rpc));
    expect(await venda.gerarLinkFormulario("o")).toEqual({
      token: "t".repeat(43),
      expiraEm: "2026-10-02T15:00:00Z",
      contratoId: "k",
      tarefaId: "tf",
      estagioP2: "ganho",
    });
    expect(rpc).toHaveBeenCalledWith("gerar_link_formulario_contrato", { oportunidade_id: "o" });
  });
});
