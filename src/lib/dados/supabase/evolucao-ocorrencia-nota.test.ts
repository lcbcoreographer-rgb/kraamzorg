// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const servico = vi.hoisted(() => ({
  chamadas: [] as { funcao: string; args: Record<string, unknown> }[],
  respostas: {} as Record<string, unknown>,
}));

vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: (motivo: string) => {
    expect(motivo).toBe("pesquisa_publica");
    return {
      rpc: async (funcao: string, args: Record<string, unknown>) => {
        servico.chamadas.push({ funcao, args });
        return { data: servico.respostas[funcao] ?? null, error: null };
      },
    };
  },
}));

import type { ClienteServidor } from "@/lib/db/cliente-servidor";
import { criarEvolucaoSupabase, listaEvolucoesDoBanco } from "./evolucao";
import { criarNotaSupabase, dadosEmissaoDoBanco, detalheNotaDoBanco } from "./nota";
import {
  criarOcorrenciaSupabase,
  criarPosVendaSupabase,
  listaPosVendaDoBanco,
} from "./ocorrencia";
import {
  aberturaPesquisaDoBanco,
  criarPesquisaPublicaSupabase,
  envioPesquisaDoBanco,
} from "./pesquisa";

/**
 * Caminho Supabase de P41, P42 e P43 sem banco: o que as funções api.* e
 * public.* (0024, provadas no pgTAP 024) devolvem vira os tipos da tela, e o
 * que a tela manda vira os argumentos certos.
 */

function contexto(respostas: Record<string, unknown>) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const cliente = {
    schema(nome: string) {
      expect(nome).toBe("api");
      return {
        rpc: async (funcao: string, args: Record<string, unknown>) => {
          chamadas.push({ funcao, args });
          return { data: respostas[funcao] ?? null, error: null };
        },
      };
    },
  } as unknown as ClienteServidor;
  return { ctx: { cliente, usuarioId: "u1" }, chamadas };
}

describe("evolução", () => {
  it("lista com prazo, documentos por bebê e o bloqueio por falta de contato", () => {
    const lista = listaEvolucoesDoBanco({
      hoje: "2026-09-29",
      acompanhamentos: [
        {
          acompanhamento_id: "a1",
          familia_id: "f1",
          familia_nome: "Família Teste Aurora",
          concluido_em: "2026-09-25",
          prazo_aviso: "2026-09-28",
          prazo_escala: "2026-09-29",
          situacao: "escalada",
          bloqueado_contato: true,
          profissional_nome: "Enfermeira Teste Lima",
          documentos: [
            { tipo: "puerperal", bebe_id: null, bebe_ordem: 0, bebe_nome: null, relatorio_id: null, status: null, enviado_em: null, com_erros: false },
            { tipo: "neonatal", bebe_id: "b1", bebe_ordem: 1, bebe_nome: "Bebê Teste", relatorio_id: "r1", status: "em_revisao", enviado_em: null, com_erros: false },
          ],
        },
      ],
    });
    expect(lista.acompanhamentos[0]).toMatchObject({
      acompanhamentoId: "a1",
      situacao: "escalada",
      bloqueadoContato: true,
      prazoEscala: "2026-09-29",
    });
    expect(lista.acompanhamentos[0]?.documentos.map((d) => [d.tipo, d.bebeOrdem, d.status])).toEqual([
      ["puerperal", 0, null],
      ["neonatal", 1, "em_revisao"],
    ]);
  });

  it("salvar manda a entrada, os erros e a versão pelos parâmetros da função", async () => {
    const { ctx, chamadas } = contexto({
      salvar_evolucao: { id: "r1", versao: 3, status: "rascunho", criado: false },
    });
    const r = await criarEvolucaoSupabase(ctx).salvar({
      acompanhamentoId: "a1",
      tipo: "neonatal",
      bebeId: "b1",
      conteudo: { dados: { a: 1 }, conteudo: null },
      erros: ["Falta preencher: x."],
      versaoBase: 2,
    });
    expect(r).toEqual({ id: "r1", versao: 3, status: "rascunho", criado: false });
    expect(chamadas[0]).toEqual({
      funcao: "salvar_evolucao",
      args: {
        p_acompanhamento_id: "a1",
        p_tipo: "neonatal",
        p_bebe_id: "b1",
        p_conteudo: { dados: { a: 1 }, conteudo: null },
        p_erros: ["Falta preencher: x."],
        p_versao_base: 2,
      },
    });
  });

  it("registrar envio manda os médicos que receberam e o motivo quando falha", async () => {
    const { ctx, chamadas } = contexto({});
    const repo = criarEvolucaoSupabase(ctx);
    await repo.registrarEnvio({
      relatorioId: "r1",
      pdfPath: "evolucoes/r1.pdf",
      enviados: [{ especialidade: "obstetra", medicoId: "m1", enviadoEm: "2026-09-29T10:00:00Z" }],
    });
    await repo.registrarEnvio({ relatorioId: "r1", pdfPath: null, enviados: [], erro: "Falhou." });
    expect(chamadas[0]?.args).toEqual({
      p_relatorio_id: "r1",
      p_pdf_path: "evolucoes/r1.pdf",
      p_enviados: [{ especialidade: "obstetra", medico_id: "m1", enviado_em: "2026-09-29T10:00:00Z" }],
      p_erro: null,
    });
    expect(chamadas[1]?.args).toMatchObject({ p_pdf_path: null, p_enviados: [], p_erro: "Falhou." });
  });

  it("aprovar e devolver usam os nomes de parâmetro da migration", async () => {
    const { ctx, chamadas } = contexto({});
    const repo = criarEvolucaoSupabase(ctx);
    await repo.aprovar("r1", 4);
    await repo.devolver("r1", "Ajuste o grau.");
    await repo.enviarParaRevisao("r1", null);
    expect(chamadas).toEqual([
      { funcao: "aprovar_evolucao", args: { p_relatorio_id: "r1", p_versao_base: 4 } },
      { funcao: "devolver_evolucao", args: { p_relatorio_id: "r1", p_motivo: "Ajuste o grau." } },
      { funcao: "enviar_evolucao_para_revisao", args: { p_relatorio_id: "r1", p_versao_base: null } },
    ]);
  });
});

describe("ocorrência e pós-venda", () => {
  it("registrar e atualizar mandam os parâmetros p_*, sem inventar o que não foi pedido", async () => {
    const { ctx, chamadas } = contexto({
      registrar_ocorrencia: { id: "o1", privada: true },
      atualizar_ocorrencia: { id: "o1", status: "resolvida", versao: 5 },
    });
    const repo = criarOcorrenciaSupabase(ctx);
    const aberta = await repo.registrar({
      familiaId: "f1",
      profissionalId: null,
      tipo: "detrator",
      prioridade: "alta",
      privada: false,
      titulo: "Retorno",
      descricao: "Descrição.",
      responsavelId: null,
    });
    expect(aberta).toEqual({ id: "o1", privada: true });
    const r = await repo.atualizar({
      ocorrenciaId: "o1",
      status: "resolvida",
      nota: "Combinado com a família.",
      versaoBase: 4,
    });
    expect(r).toEqual({ id: "o1", status: "resolvida", versao: 5 });
    expect(chamadas[1]?.args).toMatchObject({
      p_ocorrencia_id: "o1",
      p_status: "resolvida",
      p_nota: "Combinado com a família.",
      p_versao_base: 4,
      p_responsavel_id: null,
      p_prioridade: null,
      p_privada: null,
    });
  });

  it("pós-venda: item com bloqueio pelo freio, link ativo e resumo do NPS", () => {
    const lista = listaPosVendaDoBanco({
      resumo: {
        aguardando_envio: 1,
        aguardando_resposta: 0,
        respondidas: 2,
        promotores: 1,
        neutros: 0,
        detratores: 1,
        nps: 0,
      },
      itens: [
        {
          id: "p1",
          acompanhamento_id: "a1",
          familia_id: "f1",
          familia_nome: "Família Teste Aurora",
          estagio: "protocolo_ultimo_dia_concluido",
          nps: null,
          classificacao: null,
          depoimento_autorizado: null,
          autorizacao_imagem: null,
          pesquisa_enviada_em: null,
          pesquisa_respondida_em: null,
          pesquisa_expira_em: null,
          link_ativo: false,
          bloqueio: "freio",
          pode_gerar_link: false,
          acao_executada_em: null,
          criado_em: "2026-09-28T10:00:00Z",
        },
      ],
    });
    expect(lista.resumo).toMatchObject({ aguardandoEnvio: 1, detratores: 1, nps: 0 });
    expect(lista.itens[0]).toMatchObject({
      estagio: "protocolo_ultimo_dia_concluido",
      bloqueio: "freio",
      podeGerarLink: false,
    });
  });

  it("gerar o link devolve o token uma vez; freio segurando vira bloqueado, não erro", async () => {
    const { ctx } = contexto({
      gerar_link_pesquisa: { token: "abc", expira_em: "2026-10-30T00:00:00Z", texto: "Oi @@LINK@@" },
    });
    const ok = await criarPosVendaSupabase(ctx).gerarLink("p1");
    expect(ok).toEqual({
      bloqueado: false,
      token: "abc",
      expiraEm: "2026-10-30T00:00:00Z",
      texto: "Oi @@LINK@@",
    });
    const { ctx: c2 } = contexto({
      gerar_link_pesquisa: { bloqueado: true, motivo: "familia_em_estado_sensivel" },
    });
    expect(await criarPosVendaSupabase(c2).gerarLink("p1")).toEqual({
      bloqueado: true,
      motivo: "familia_em_estado_sensivel",
    });
  });
});

describe("pesquisa pública", () => {
  it("abre pelo cliente de serviço com o token e a origem, e devolve só o primeiro nome e as perguntas", async () => {
    servico.chamadas.length = 0;
    servico.respostas.pesquisa_abrir = {
      situacao: "valido",
      nome: "Marina",
      perguntas: [
        { id: "nps", tipo: "escala_0_10", obrigatoria: true, texto: "Nota", rotulo_min: "Nada", rotulo_max: "Muito" },
      ],
      textos: { titulo: "Como foi para vocês?", abertura: "Oi, {nome}." },
    };
    const r = await criarPesquisaPublicaSupabase().abrir("tok", "203.0.113.5");
    expect(r).toMatchObject({
      situacao: "valido",
      nome: "Marina",
      perguntas: [{ id: "nps", rotuloMin: "Nada", rotuloMax: "Muito" }],
    });
    expect(servico.chamadas[0]).toEqual({
      funcao: "pesquisa_abrir",
      args: { p_token: "tok", p_origem: "203.0.113.5" },
    });
  });

  it("envio: recebido, limite, corrigir e qualquer outra coisa vira inválido", async () => {
    expect(envioPesquisaDoBanco({ situacao: "recebido" })).toEqual({ situacao: "recebido" });
    expect(envioPesquisaDoBanco({ situacao: "limite", minutos: 15 })).toEqual({
      situacao: "limite",
      minutos: 15,
    });
    expect(
      envioPesquisaDoBanco({ situacao: "corrigir", erros: { nps: "obrigatorio" } }),
    ).toEqual({ situacao: "corrigir", erros: { nps: "obrigatorio" } });
    expect(envioPesquisaDoBanco({ situacao: "qualquer" })).toEqual({ situacao: "invalido" });
    expect(aberturaPesquisaDoBanco({ situacao: "outra", textos: {} })).toEqual({
      situacao: "invalido",
      textos: {},
    });
  });
});

describe("nota fiscal", () => {
  it("dados da emissão: tomador é quem paga, com CPF e endereço; sem endereço vira nulo", () => {
    const d = dadosEmissaoDoBanco({
      nota_id: "n1",
      cobranca_id: "c1",
      familia_id: "f1",
      status: "processando",
      valor_centavos: 420000,
      codigo_servico: "05266",
      descricao_servico: "Cuidado domiciliar pós-parto",
      tomador: { nome: "Carla", cpf: "52998224725", email: null, endereco: null },
    });
    expect(d).toMatchObject({
      notaId: "n1",
      valorCentavos: 420000,
      tomador: { nome: "Carla", cpf: "52998224725", endereco: null },
    });
  });

  it("detalhe: só diz se o tomador tem CPF, nunca o CPF", () => {
    const d = detalheNotaDoBanco({
      id: "n1",
      cobranca_id: "c1",
      contrato_id: "k1",
      familia_id: "f1",
      familia_nome: "Família Teste",
      tomador_nome: "Carla",
      tomador_tem_cpf: true,
      parcela: 1,
      valor_centavos: 420000,
      status: "erro",
      erro: "O provedor recusou.",
      tentativas: 1,
      manual: false,
      tem_pdf: false,
      tem_xml: false,
      criado_em: "2026-09-28T10:00:00Z",
      pode_emitir: true,
      pode_consultar: false,
      emissao_automatica: true,
      versao: 2,
    });
    expect(d).toMatchObject({ tomadorTemCpf: true, status: "erro", podeEmitir: true });
    expect(JSON.stringify(d)).not.toMatch(/\d{11}/);
  });

  it("registrar o resultado e a nota manual usam os parâmetros da migration", async () => {
    const { ctx, chamadas } = contexto({
      registrar_resultado_nota: { status: "emitida", mudou: true },
    });
    const repo = criarNotaSupabase(ctx);
    const r = await repo.registrarResultado("n1", {
      estado: "emitida",
      providerRef: "ref",
      numero: "154",
      pdfPath: "notas/n1.pdf",
    });
    expect(r).toEqual({ status: "emitida", mudou: true });
    await repo.registrarManual({ notaId: "n1", numero: "2026/154", emitidaEm: "2026-09-28" });
    expect(chamadas[0]?.args).toEqual({
      p_nota_id: "n1",
      p_estado: "emitida",
      p_provider_ref: "ref",
      p_numero: "154",
      p_pdf_path: "notas/n1.pdf",
      p_xml_path: null,
      p_erro: null,
    });
    expect(chamadas[1]).toEqual({
      funcao: "registrar_nota_manual",
      args: {
        p_nota_id: "n1",
        p_numero: "2026/154",
        p_emitida_em: "2026-09-28",
        p_provider: null,
        p_pdf_path: null,
        p_xml_path: null,
      },
    });
  });
});
