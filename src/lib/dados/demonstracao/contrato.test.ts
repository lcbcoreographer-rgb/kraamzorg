// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { criarRepositoriosDemonstracao } from "./index";
import { PARAMETROS_CONTRATO, MENSAGENS_COBRANCA } from "./contrato-fixtures";
import {
  cobrancaDoContratoDemonstracao,
  simularAssinaturaDemonstracao,
  simularPagamentoDemonstracao,
} from "./contrato";
import { PACOTES, USUARIOS, VERSOES_PACOTE, familiaPorNome } from "./fixtures";
import { obterLoja, reiniciarLoja } from "./loja";
import { obterLojaVenda, reiniciarLojaVenda } from "./venda";

/**
 * Contrato e cobrança na demonstração (P31 e P32): as mesmas regras de
 * 0019_contrato_cobranca.sql que o pgTAP prova no banco
 * (supabase/tests/019_contrato_cobranca.sql), aqui na loja em memória que
 * as telas e o e2e usam. E a paridade com o seed: parâmetros e textos são
 * cópia do supabase/seed.sql.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function repos(papel: Papel, aal: "aal1" | "aal2" = "aal2") {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

const endereco = {
  cep: "01310100",
  logradouro: "Rua de Teste",
  numero: "100",
  complemento: "",
  bairro: "Bairro de Teste",
  cidade: "São Paulo",
  uf: "SP",
};

/** Deixa a Família Teste Cedro com o formulário recebido, pronta para gerar o contrato. */
function prepararRecebido(
  ajustes: {
    parcelas?: number;
    presente?: boolean;
    dpp?: string;
    estado?: "normal" | "bloqueio_total";
  } = {},
) {
  const l = obterLoja();
  const lv = obterLojaVenda();
  const familia = familiaPorNome("Cedro");
  const f = l.familias.find((x) => x.id === familia.id)!;
  if (ajustes.dpp) f.dpp = ajustes.dpp;
  if (ajustes.estado) f.estadoSensivel = ajustes.estado;
  const o = l.oportunidades.find((x) => x.familiaId === familia.id)!;
  o.pipeline = 2;
  o.estagioP2 = "ganho";
  const mae = l.pessoas.find(
    (p) => p.familiaId === familia.id && p.papel === "mae",
  )!;
  mae.email = "juliana.teste@exemplo.invalid";
  lv.dadosContrato[mae.id] = {
    cpf: "11144477735",
    dataNascimento: "1994-05-17",
    endereco,
  };
  lv.enderecoAtendimento[familia.id] = endereco;
  if (ajustes.presente) {
    lv.propostas[o.id] = {
      condicaoId: null,
      descontoPct: 0,
      descontoMotivo: null,
      descontoAprovadoPor: null,
      paraQuem: "presente",
      pagadorPessoaId: null,
      planoInteressePacoteId: null,
    };
  }
  const pacote = PACOTES.find((p) => p.nome === "Essencial")!;
  const versao = VERSOES_PACOTE.find(
    (v) => v.pacoteId === pacote.pacoteId && v.vigenciaFim === null,
  )!;
  const contratoId = crypto.randomUUID();
  lv.contratos.push({
    id: contratoId,
    familiaId: familia.id,
    pacoteVersaoId: versao.versaoId,
    contratantePessoaId: mae.id,
    pagadorPessoaId: null,
    testemunhaPessoaId: null,
    valorCentavos: 420000,
    taxaCentavos: 35000,
    descontoCentavos: 0,
    parcelas: ajustes.parcelas ?? 3,
    templateVersao: "C-11 antigo",
    tokenHash: null,
    expiraEm: new Date(Date.now() - 3_600_000).toISOString(),
    status: "aguardando_dados",
    criadoEm: new Date().toISOString(),
  });
  return { familiaId: familia.id, contratoId, oportunidadeId: o.id };
}

const SHA = "a".repeat(64);

async function ateEnviado(contratoId: string) {
  const { contratos } = repos("comercial");
  await contratos.registrarGerado(
    contratoId,
    `contratos/${contratoId}.pdf`,
    SHA,
  );
  await contratos.reservarEnvio(contratoId);
  await contratos.concluirEnvio(contratoId, "doc-demo-0001");
}

function estagio(familiaId: string) {
  return obterLoja().oportunidades.find((o) => o.familiaId === familiaId)!
    .estagioP2;
}

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaVenda();
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("situação do contrato", () => {
  it("exige AAL2 e papel; o financeiro só abre família com contrato", async () => {
    const { familiaId } = prepararRecebido();
    await expect(
      repos("comercial", "aal1").contratos.obterSituacao(familiaId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      repos("enfermeira").contratos.obterSituacao(familiaId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      repos("coordenacao").contratos.obterSituacao(familiaId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      repos("financeiro").contratos.obterSituacao(familiaPorNome("Aurora").id),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    const financeiro =
      await repos("financeiro").contratos.obterSituacao(familiaId);
    expect(financeiro.contrato?.etapa).toBe("pronto_para_gerar");
    expect(financeiro.podeGerar).toBe(false);
    expect(financeiro.podeVerCobranca).toBe(true);
  });

  it("pronto para gerar: quem assina, e-mail mascarado e conta com a taxa", async () => {
    const { familiaId } = prepararRecebido();
    const s = await repos("comercial").contratos.obterSituacao(familiaId);
    expect(s.contrato?.etapa).toBe("pronto_para_gerar");
    expect(s.contrato?.variante).toBe("completa");
    expect(s.contrato?.conta?.totalCentavos).toBe(455000);
    expect(s.podeGerar).toBe(true);
    expect(s.assinantes.map((a) => a.papel)).toEqual(["gestante", "kraamzorg"]);
    expect(s.assinantes[0]?.email).toBe("j***@exemplo.invalid");
    expect(s.modelo.aprovado).toBe(false);
  });

  it("o comercial vê da cobrança só o status, sem valor nem id", async () => {
    const familia = familiaPorNome("Íris").id;
    const s = await repos("comercial").contratos.obterSituacao(familia);
    expect(s.contrato?.etapa).toBe("assinado");
    expect(s.cobrancas[0]).toMatchObject({
      status: "paga",
      valorCentavos: null,
      id: null,
    });
    const f = await repos("financeiro").contratos.obterSituacao(familia);
    expect(f.cobrancas[0]?.valorCentavos).toBe(420000);
    expect(f.cobrancas[0]?.id).not.toBeNull();
  });
});

describe("gerar, enviar e assinar", () => {
  it("gerar move o P2 para contrato_gerado, grava a versão do modelo e permite gerar de novo", async () => {
    const { familiaId, contratoId } = prepararRecebido();
    const { contratos } = repos("comercial");
    const dados = await contratos.dadosParaContrato(contratoId);
    expect(dados.contratante.cpf).toBe("11144477735");
    expect(dados.pacote.dias).toBe(6);
    expect(dados.contrato.conta.totalCentavos).toBe(455000);

    await expect(
      contratos.registrarGerado(contratoId, "contratos/Juliana-Teste.pdf", SHA),
    ).rejects.toThrow(/caminho_pdf_invalido/);
    await expect(
      contratos.registrarGerado(contratoId, `contratos/${contratoId}.pdf`, "x"),
    ).rejects.toThrow(/pdf_sem_resumo/);
    await contratos.registrarGerado(
      contratoId,
      `contratos/${contratoId}.pdf`,
      SHA,
    );
    expect(estagio(familiaId)).toBe("contrato_gerado");
    const k = obterLojaVenda().contratos.find((x) => x.id === contratoId)!;
    expect(k.status).toBe("gerado");
    expect(k.templateVersao).toBe("C-11 provisório");

    await contratos.registrarGerado(
      contratoId,
      `contratos/${contratoId}.pdf`,
      SHA,
    );
    expect(estagio(familiaId)).toBe("contrato_gerado");
  });

  it("sem o formulário recebido não há dado para o PDF; financeiro e enfermeira não geram", async () => {
    const { contratoId } = prepararRecebido();
    obterLojaVenda().contratos.find((x) => x.id === contratoId)!.tokenHash =
      "hash";
    await expect(
      repos("comercial").contratos.dadosParaContrato(contratoId),
    ).rejects.toThrow(/formulario_pendente/);
    obterLojaVenda().contratos.find((x) => x.id === contratoId)!.tokenHash =
      null;
    await expect(
      repos("financeiro").contratos.dadosParaContrato(contratoId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      repos("comercial", "aal1").contratos.dadosParaContrato(contratoId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("família em bloqueio_total não gera nem envia", async () => {
    const { contratoId } = prepararRecebido({ estado: "bloqueio_total" });
    await expect(
      repos("comercial").contratos.dadosParaContrato(contratoId),
    ).rejects.toThrow(/familia_em_estado_sensivel/);
  });

  it("o envio em três passos: dois cliques nunca criam dois documentos", async () => {
    const { familiaId, contratoId } = prepararRecebido();
    const { contratos } = repos("comercial");
    await expect(contratos.reservarEnvio(contratoId)).rejects.toThrow(
      /contrato_nao_gerado/,
    );
    await contratos.registrarGerado(
      contratoId,
      `contratos/${contratoId}.pdf`,
      SHA,
    );
    const reserva = await contratos.reservarEnvio(contratoId);
    expect(reserva.pdfPath).toBe(`contratos/${contratoId}.pdf`);
    expect(reserva.kraamzorg.email).toBe(
      "assinatura.kraamzorg@exemplo.invalid",
    );
    expect(reserva.nomeDocumento).not.toMatch(/Cedro|Juliana/);
    await expect(contratos.reservarEnvio(contratoId)).rejects.toThrow(
      /envio_em_andamento/,
    );
    const emAndamento = await contratos.obterSituacao(familiaId);
    expect(emAndamento.contrato?.etapa).toBe("envio_em_andamento");

    await contratos.liberarEnvio(contratoId);
    await contratos.reservarEnvio(contratoId);
    await expect(contratos.concluirEnvio(contratoId, "x")).rejects.toThrow(
      /documento_invalido/,
    );
    await contratos.concluirEnvio(contratoId, "doc-demo-0001");
    expect(estagio(familiaId)).toBe("aguardando_assinatura");
    await expect(
      contratos.concluirEnvio(contratoId, "doc-demo-0002"),
    ).rejects.toThrow(/envio_nao_reservado/);
    await expect(contratos.reservarEnvio(contratoId)).rejects.toThrow(
      /contrato_nao_gerado/,
    );
    await expect(
      repos("financeiro").contratos.reservarEnvio(contratoId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("assinatura: contrato assinado, cobrança com o total, link e tarefa; repetir não duplica", async () => {
    const { familiaId, contratoId } = prepararRecebido();
    await ateEnviado(contratoId);
    const r = simularAssinaturaDemonstracao(contratoId);
    expect(r.mudou).toBe(true);
    expect(r.cobrancaId).not.toBeNull();
    expect(estagio(familiaId)).toBe("cobranca_gerada");

    const lv = obterLojaVenda();
    const cobrancas = lv.cobrancas.filter((c) => c.contratoId === contratoId);
    expect(cobrancas).toHaveLength(1);
    expect(cobrancas[0]?.valorCentavos).toBe(455000);
    expect(cobrancas[0]?.linkPagamento).toMatch(/^https:\/\//);
    const tarefa = obterLoja().tarefas.find(
      (t) => (t.payload as Record<string, unknown>)?.acao === "link_pagamento",
    );
    expect(tarefa?.familiaId).toBe(familiaId);
    expect(
      String((tarefa?.payload as Record<string, unknown>).textoSugerido),
    ).toContain(cobrancas[0]!.linkPagamento!);
    expect(cobrancaDoContratoDemonstracao(contratoId)).toBe(cobrancas[0]!.id);

    expect(() => simularAssinaturaDemonstracao(contratoId)).toThrow(
      /contrato_nao_enviado/,
    );
    expect(
      lv.cobrancas.filter((c) => c.contratoId === contratoId),
    ).toHaveLength(1);
  });

  it("freio: contrato assinado de família em bloqueio_total não gera cobrança sozinho, e o financeiro gera à mão", async () => {
    const { familiaId, contratoId } = prepararRecebido();
    await ateEnviado(contratoId);
    obterLoja().familias.find((f) => f.id === familiaId)!.estadoSensivel =
      "bloqueio_total";
    const r = simularAssinaturaDemonstracao(contratoId);
    expect(r.mudou).toBe(true);
    expect(r.cobrancaId).toBeNull();
    expect(estagio(familiaId)).toBe("assinado");
    expect(
      obterLojaVenda().notificacoes.some((n) =>
        n.titulo.startsWith("Contrato assinado, mas a cobrança não foi gerada"),
      ),
    ).toBe(true);

    const id = await repos("financeiro").cobrancas.gerarDoContrato(contratoId);
    expect(id).toBeTruthy();
    expect(estagio(familiaId)).toBe("cobranca_gerada");
    expect(
      await repos("financeiro").cobrancas.gerarDoContrato(contratoId),
    ).toBe(id);
  });

  it("parcelas acima do limite do pacote: a cobrança nasce sem link e o link não é gerado", async () => {
    const { contratoId } = prepararRecebido({ parcelas: 5 });
    await ateEnviado(contratoId);
    const r = simularAssinaturaDemonstracao(contratoId);
    const { cobrancas } = repos("financeiro");
    const c = await cobrancas.obter(r.cobrancaId!);
    expect(c.acimaDoLimite).toBe(true);
    expect(c.linkPagamento).toBeNull();
    expect(c.podeGerarLink).toBe(false);
    await expect(cobrancas.dadosLinkPagamento(c.id)).rejects.toThrow(
      /parcelas_acima_do_limite/,
    );
  });
});

describe("cobrança e baixa", () => {
  async function ateAssinado(
    ajustes: Parameters<typeof prepararRecebido>[0] = {},
  ) {
    const preparado = prepararRecebido(ajustes);
    await ateEnviado(preparado.contratoId);
    const { cobrancaId } = simularAssinaturaDemonstracao(preparado.contratoId);
    return { ...preparado, cobrancaId: cobrancaId! };
  }

  it("só financeiro e diretoria, em AAL2, abrem as cobranças", async () => {
    await ateAssinado();
    await expect(repos("comercial").cobrancas.listar()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(
      repos("financeiro", "aal1").cobrancas.listar(),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    const lista = await repos("financeiro").cobrancas.listar();
    expect(lista.cobrancas.length).toBe(5);
    expect(lista.cobrancas[0]?.situacao).not.toBe("paga");
  });

  it("a lista inicial espelha o seed: uma aberta e três pagas, com os totais em centavos", async () => {
    const lista = await repos("diretoria").cobrancas.listar();
    expect(lista.resumo).toMatchObject({
      abertas: 1,
      vencidas: 0,
      pagas: 3,
      aReceberCentavos: 741000,
      recebidoCentavos: 420000 + 420000 + 540000,
    });
    const abertas = await repos("diretoria").cobrancas.listar("aberta");
    expect(abertas.cobrancas).toHaveLength(1);
  });

  it("webhook da InfinitePay: baixa move o P2, deixa a nota pendente e cria a tarefa; duplicado não repete", async () => {
    const { familiaId, cobrancaId } = await ateAssinado();
    expect(simularPagamentoDemonstracao(cobrancaId).mudou).toBe(true);
    expect(estagio(familiaId)).toBe("pagamento_confirmado");
    const c = obterLojaVenda().cobrancas.find((x) => x.id === cobrancaId)!;
    expect(c.status).toBe("paga");
    expect(c.notaStatus).toBe("pendente");
    expect(c.valorPagoCentavos).toBe(455000);
    const tarefas = obterLoja().tarefas.filter(
      (t) =>
        (t.payload as Record<string, unknown>)?.acao === "pagamento_confirmado",
    );
    expect(tarefas).toHaveLength(1);
    expect(
      String((tarefas[0]?.payload as Record<string, unknown>).textoSugerido),
    ).toMatch(/^Pagamento confirmado, Beatriz\./);
    expect(
      obterLoja().tarefas.some(
        (t) =>
          (t.payload as Record<string, unknown>)?.acao === "prenatal_urgente",
      ),
    ).toBe(false);

    expect(simularPagamentoDemonstracao(cobrancaId)).toEqual({
      mudou: false,
      motivo: "ja_paga",
    });
    expect(
      obterLoja().tarefas.filter(
        (t) =>
          (t.payload as Record<string, unknown>)?.acao ===
          "pagamento_confirmado",
      ),
    ).toHaveLength(1);
  });

  it("34 semanas ou mais: tarefa de prioridade máxima para a coordenação e a mensagem _34s", async () => {
    const hoje = new Date();
    const dpp = new Date(hoje.getTime() + 40 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { cobrancaId } = await ateAssinado({ dpp });
    simularPagamentoDemonstracao(cobrancaId);
    const urgente = obterLoja().tarefas.find(
      (t) =>
        (t.payload as Record<string, unknown>)?.acao === "prenatal_urgente",
    );
    expect(urgente?.prioridade).toBe("maxima");
    expect(urgente?.papelResponsavel).toBe("coordenacao");
    const msg = obterLoja().tarefas.find(
      (t) =>
        (t.payload as Record<string, unknown>)?.acao === "pagamento_confirmado",
    );
    expect(
      String((msg?.payload as Record<string, unknown>).textoSugerido),
    ).toContain("Como você já está com 34 semanas");
    expect(
      obterLojaVenda().notificacoes.some((n) =>
        n.titulo.startsWith("Pagamento confirmado com 34 semanas"),
      ),
    ).toBe(true);
  });

  it("link de pagamento: só https e um por cobrança", async () => {
    const { cobrancaId } = await ateAssinado();
    const { cobrancas } = repos("financeiro");
    await expect(
      cobrancas.registrarLink(cobrancaId, "http://pay.exemplo.invalid/x", null),
    ).rejects.toThrow(/link_invalido/);
    await expect(
      cobrancas.registrarLink(
        cobrancaId,
        "https://pay.exemplo.invalid/outro",
        null,
      ),
    ).rejects.toThrow(/link_ja_gerado/);
  });

  it("baixa manual: comprovante, motivo e valor; depois de dada, não repete", async () => {
    const { familiaId, cobrancaId } = await ateAssinado();
    const { cobrancas } = repos("financeiro");
    const caminho = `comprovantes/${cobrancaId}-abc12345.png`;
    const base = {
      cobrancaId,
      valorPagoCentavos: 455000,
      comprovantePath: caminho,
      motivo: "Pix recebido no extrato de 29/09",
    };
    await expect(
      cobrancas.baixarManual({ ...base, motivo: "curto" }),
    ).rejects.toThrow(/motivo_obrigatorio/);
    await expect(
      cobrancas.baixarManual({
        ...base,
        comprovantePath: "comprovantes/Juliana.png",
      }),
    ).rejects.toThrow(/comprovante_obrigatorio/);
    await expect(
      cobrancas.baixarManual({ ...base, valorPagoCentavos: 1000 }),
    ).rejects.toThrow(/valor_menor_que_a_cobranca/);
    await expect(
      repos("comercial").cobrancas.baixarManual(base),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });

    await cobrancas.baixarManual(base);
    expect(estagio(familiaId)).toBe("pagamento_confirmado");
    const detalhe = await cobrancas.obter(cobrancaId);
    expect(detalhe.situacao).toBe("paga");
    expect(detalhe.comprovante).toBe("arquivo");
    expect(detalhe.comprovantePath).toBe(caminho);
    await expect(cobrancas.baixarManual(base)).rejects.toThrow(
      /cobranca_nao_aberta/,
    );
  });

  it("pagamento em cobrança cancelada ou abaixo do valor não baixa e avisa o financeiro", async () => {
    const { cobrancaId } = await ateAssinado();
    const lv = obterLojaVenda();
    const c = lv.cobrancas.find((x) => x.id === cobrancaId)!;
    c.status = "cancelada";
    expect(simularPagamentoDemonstracao(cobrancaId).motivo).toBe(
      "cobranca_encerrada",
    );
    expect(c.status).toBe("cancelada");
    expect(
      lv.notificacoes.some((n) =>
        n.titulo.startsWith("Chegou um pagamento em cobrança cancelada"),
      ),
    ).toBe(true);
  });

  it("detalhe: sem permissão para o comercial e cobrança inexistente", async () => {
    const { cobrancaId } = await ateAssinado();
    await expect(
      repos("comercial").cobrancas.obter(cobrancaId),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await expect(
      repos("financeiro").cobrancas.obter(crypto.randomUUID()),
    ).rejects.toThrow(/cobranca_inexistente/);
  });
});

describe("paridade com o seed", () => {
  const seed = readFileSync(
    path.join(process.cwd(), "supabase", "seed.sql"),
    "utf8",
  );

  it("os parâmetros de contrato e cobrança são os mesmos do seed", () => {
    for (const [chave, valor] of Object.entries(PARAMETROS_CONTRATO)) {
      const achado = new RegExp(`\\('${chave}', '([^']+)'`).exec(seed);
      expect(achado, chave).not.toBeNull();
      expect(JSON.parse(achado![1]!), chave).toEqual(valor);
    }
  });

  it("os textos da cobrança são os mesmos do seed, em rascunho", () => {
    for (const mensagem of MENSAGENS_COBRANCA) {
      const literal = mensagem.texto
        .replaceAll("'", "''")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const padrao = new RegExp(
        `\\('${mensagem.chave}', 'whatsapp', 'familia',\\s*'${literal}',[^)]*'rascunho'\\)`,
      );
      expect(seed, mensagem.chave).toMatch(padrao);
    }
  });
});
