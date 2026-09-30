// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { ErroRepositorio } from "../erros";
import { criarRepositoriosDemonstracao } from "./index";
import { USUARIOS } from "./fixtures";
import {
  criarPortalFamiliaDemonstracao,
  criarRelacaoPublicaDemonstracao,
} from "./relacao-publica";
import { obterLojaRelacao, reiniciarLojaRelacao } from "./relacao-loja";

/**
 * Relacionamento na demonstração (P47 a P51): as mesmas regras de
 * 0027_relacao.sql que o pgTAP prova no banco (supabase/tests/027_*.sql),
 * aqui na loja em memória que as telas e o e2e usam. Os números esperados
 * saem das fixtures por conta própria, não da função testada.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaRelacao();
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function repos(papel: Papel, aal: "aal1" | "aal2" = "aal2") {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

async function recusaCom(promessa: Promise<unknown>, codigo?: string) {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ErroRepositorio);
  if (codigo)
    expect((erro as ErroRepositorio).message).toContain(`relacao:${codigo}`);
  else expect((erro as ErroRepositorio).codigo).toBe("sem_permissao");
}

const soma = (n: number[]) => n.reduce((a, b) => a + b, 0);

describe("marketing e atribuição (P47)", () => {
  it("receita e custo por origem batem com as fixtures", async () => {
    const l = obterLojaRelacao();
    const relatorio = await repos("diretoria").relacao.marketing.relatorio({});
    const receita = soma(
      l.leads.flatMap((x) => x.pagamentos.map((p) => p.valorCentavos)),
    );
    expect(relatorio.total.receitaCentavos).toBe(receita);
    expect(relatorio.total.leads).toBe(l.leads.length);
    expect(relatorio.total.custoCentavos).toBe(
      soma(l.custos.map((c) => c.valorCentavos)),
    );

    const meta = relatorio.porOrigem.find((o) => o.origem === "meta_ads");
    const leadsMeta = l.leads.filter((x) => x.origem === "meta_ads");
    expect(meta?.leads).toBe(leadsMeta.length);
    expect(meta?.receitaCentavos).toBe(
      soma(leadsMeta.flatMap((x) => x.pagamentos.map((p) => p.valorCentavos))),
    );
    expect(meta?.custoCentavos).toBe(350000);
  });

  it("filtra por período (só os pagamentos e leads do mês)", async () => {
    const setembro = await repos("diretoria").relacao.marketing.relatorio({
      desde: "2026-09-01",
      ate: "2026-09-30",
    });
    const esperado = soma(
      obterLojaRelacao()
        .leads.flatMap((x) => x.pagamentos)
        .filter((p) => p.data.startsWith("2026-09"))
        .map((p) => p.valorCentavos),
    );
    expect(setembro.total.receitaCentavos).toBe(esperado);
  });

  it("marketing só vê receita quando o parâmetro marketing.ve_receita permite; comercial nem abre", async () => {
    const r = await repos("marketing").relacao.marketing.relatorio({});
    expect(r.veValores).toBe(false);
    expect(r.total.receitaCentavos).toBeNull();
    expect(r.total.custoCentavos).toBeNull();
    // Só famílias elegíveis para o marketing entram na contagem.
    expect(r.soElegiveis).toBe(true);
    expect(r.total.leads).toBe(
      obterLojaRelacao().leads.filter((x) => x.elegivel).length,
    );
    await recusaCom(repos("comercial").relacao.marketing.relatorio({}));
    await recusaCom(repos("enfermeira").relacao.marketing.relatorio({}));
  });

  it("a exportação só leva família elegível, com nome de exibição e sem telefone nem e-mail", async () => {
    const exportacao = await repos("marketing").relacao.marketing.exportar({});
    const l = obterLojaRelacao();
    expect(exportacao.linhas).toHaveLength(
      l.leads.filter((x) => x.elegivel).length,
    );
    expect(exportacao.linhas.map((x) => x.nomeExibicao)).not.toContain(
      "Família Teste Kalu",
    );
    for (const linha of exportacao.linhas) {
      expect(Object.keys(linha).sort()).toEqual(
        [
          "codigoOrigem",
          "criadoEm",
          "dpp",
          "gemelar",
          "nomeExibicao",
          "origem",
          "primeiraGestacao",
          "utm",
        ].sort(),
      );
    }
  });

  it("canal: código de 3 a 12 letras maiúsculas ou números, único e imutável depois de usado", async () => {
    const { marketing } = repos("marketing").relacao;
    const novo = await marketing.salvarCanal({
      id: null,
      codigo: "EVENTO1",
      nome: "Feira de teste",
      origem: "evento",
      ativo: true,
    });
    expect(novo.codigo).toBe("EVENTO1");
    await recusaCom(
      marketing.salvarCanal({
        id: null,
        codigo: "evento 2",
        nome: "x",
        origem: "evento",
        ativo: true,
      }),
      "codigo_invalido",
    );
    await recusaCom(
      marketing.salvarCanal({
        id: null,
        codigo: "EVENTO1",
        nome: "Outra",
        origem: "evento",
        ativo: true,
      }),
      "codigo_em_uso",
    );
    const meta = (await marketing.canais()).canais.find(
      (c) => c.codigo === "META",
    );
    await recusaCom(
      marketing.salvarCanal({
        id: meta!.id,
        codigo: "META2",
        nome: meta!.nome,
        origem: "meta_ads",
        ativo: true,
      }),
      "codigo_ja_usado",
    );
  });

  it("custo por canal: só financeiro e diretoria lançam, em centavos inteiros", async () => {
    const canal = (await repos("marketing").relacao.marketing.canais())
      .canais[0]!;
    const pedido = {
      canalId: canal.id,
      mes: "2026-09-15",
      valorCentavos: 12345,
    };
    await recusaCom(repos("marketing").relacao.marketing.salvarCusto(pedido));
    await recusaCom(
      repos("financeiro").relacao.marketing.salvarCusto({
        ...pedido,
        valorCentavos: 10.5,
      }),
      "valor_invalido",
    );
    await repos("financeiro").relacao.marketing.salvarCusto(pedido);
    const custo = obterLojaRelacao().custos.find(
      (c) => c.canalId === canal.id && c.mes === "2026-09-01",
    );
    expect(custo?.valorCentavos).toBe(12345);
  });

  it("a página de captação: canal ativo devolve o link com o código, inativo ou inexistente não", async () => {
    const publico = criarRelacaoPublicaDemonstracao();
    expect((await publico.paginaCaptacao("IGBIO")).situacao).toBe("ok");
    expect((await publico.paginaCaptacao("nao-existe")).situacao).toBe(
      "indisponivel",
    );
    const inicio = await publico.iniciarCaptacao(
      "IGBIO",
      { utm_source: "instagram", nao_utm: "x" },
      "origem-teste",
    );
    expect(inicio.situacao).toBe("ok");
    expect(inicio.texto).toMatch(/KZ-IGBIO-[A-Z0-9]{4,}/);
    expect(inicio.numeroE164).toMatch(/^\+\d{10,15}$/);
  });
});

describe("portal da família (P49)", () => {
  const AURORA = "00000000-0000-4000-9006-000000000001";
  const CAIS = "00000000-0000-4000-9006-000000000004";
  const BRISA = "00000000-0000-4000-9006-000000000003";

  it("a família vê os próprios passos e datas, e nada da outra", async () => {
    const portal = await criarPortalFamiliaDemonstracao(AURORA).obter();
    expect(portal?.situacao).toBe("ok");
    if (portal?.situacao !== "ok") return;
    expect(portal.nomeFamilia).toBe("Família Teste Aurora");
    expect(portal.datas.dpp).toBe("2026-10-20");
    expect(portal.datas.dataNascimento).toBe("2026-10-05");
    // Enfermeira: nome só porque foi autorizado; foto não.
    expect(portal.enfermeira).toEqual({
      nome: "Enfermeira Teste Alfa",
      fotoPath: null,
    });
    expect(JSON.stringify(portal)).not.toContain("Brisa");
    expect(JSON.stringify(portal)).not.toContain("Cais");
  });

  it("enfermeira sem autorização aparece sem nome", async () => {
    obterLojaRelacao().profissionaisPortal.find((p) =>
      p.nome.endsWith("Alfa"),
    )!.autorizaNome = false;
    const portal = await criarPortalFamiliaDemonstracao(AURORA).obter();
    if (portal?.situacao !== "ok")
      throw new Error("esperava o portal completo");
    expect(portal.enfermeira?.nome).toBeNull();
    expect(JSON.stringify(portal)).not.toContain("Alfa");
  });

  it("evoluções ficam fora enquanto o K-10 não for decidido", async () => {
    const portal = await criarPortalFamiliaDemonstracao(AURORA).obter();
    if (portal?.situacao !== "ok")
      throw new Error("esperava o portal completo");
    expect(portal.evolucoes).toEqual({ ativo: false, itens: [] });
  });

  it("bloqueio_total mostra só o contato de uma pessoa", async () => {
    const portal = await criarPortalFamiliaDemonstracao(CAIS).obter();
    expect(portal?.situacao).toBe("contato");
    if (portal?.situacao !== "contato") return;
    expect(Object.keys(portal).sort()).toEqual([
      "contato",
      "primeiroNome",
      "situacao",
      "textos",
    ]);
    expect(portal.contato.nome).toBeTruthy();
  });

  it("sem acesso liberado o portal devolve null; sem pessoa também", async () => {
    expect(await criarPortalFamiliaDemonstracao(BRISA).obter()).toBeNull();
    expect(await criarPortalFamiliaDemonstracao(null).obter()).toBeNull();
  });

  it("liberar e suspender: comercial e coordenação liberam; bloqueio_total recusa; sem e-mail recusa", async () => {
    const { acessoFamilia } = repos("comercial").relacao;
    const bento = "00000000-0000-4000-9006-000000000002";
    const r = await acessoFamilia.liberar(bento);
    expect(r.jaLiberado).toBe(false);
    expect((await acessoFamilia.liberar(bento)).jaLiberado).toBe(true);
    await acessoFamilia.suspender(bento);
    expect(await criarPortalFamiliaDemonstracao(bento).obter()).toBeNull();
    await recusaCom(
      acessoFamilia.liberar("00000000-0000-4000-9006-000000000004"),
      "freio",
    );
    await recusaCom(repos("financeiro").relacao.acessoFamilia.liberar(bento));
  });

  it("link mágico: e-mail desconhecido e família em bloqueio_total têm a mesma resposta", async () => {
    const publico = criarRelacaoPublicaDemonstracao();
    const desconhecido = await publico.localizarAcessoPortal(
      "ninguem@exemplo.invalid",
      "o1",
    );
    const bloqueada = await publico.localizarAcessoPortal(
      "cais.teste@exemplo.invalid",
      "o2",
    );
    expect(desconhecido.situacao).toBe("nao_encontrado");
    expect(bloqueada.situacao).toBe("nao_encontrado");
    const ok = await publico.localizarAcessoPortal(
      "aurora.teste@exemplo.invalid",
      "o3",
    );
    expect(ok.situacao).toBe("ok");
  });

  it("só a coordenação e a diretoria autorizam nome e foto da enfermeira", async () => {
    const alfa = (
      await repos("coordenacao").relacao.acessoFamilia.enfermeiras()
    )[0]!;
    await recusaCom(
      repos("comercial").relacao.acessoFamilia.salvarAutorizacao({
        profissionalId: alfa.profissionalId,
        autorizaNome: true,
        autorizaFoto: true,
      }),
    );
    await recusaCom(
      repos("coordenacao").relacao.acessoFamilia.salvarAutorizacao({
        profissionalId: alfa.profissionalId,
        autorizaNome: true,
        autorizaFoto: true,
        fotoPath: "profissionais/Enfermeira Alfa/foto.jpg",
      }),
      "foto_invalida",
    );
  });
});

describe("parceiros médicos e indicações (P50)", () => {
  it("o aviso da vedação ética vem junto da lista e nenhum parceiro tem campo de valor", async () => {
    const lista = await repos("comercial").relacao.parceiros.listar();
    expect(lista.aviso).toMatch(/contrapartida financeira/);
    for (const p of lista.parceiros) {
      expect(
        Object.keys(p).some((k) =>
          /valor|comissao|centavos|pagamento/i.test(k),
        ),
      ).toBe(false);
    }
    await recusaCom(repos("coordenacao").relacao.parceiros.listar());
    await recusaCom(repos("marketing").relacao.parceiros.listar());
  });

  it("indicação de médico muda a origem da família e aparece no relatório por origem", async () => {
    const { parceiros } = repos("comercial").relacao;
    const medico = (await parceiros.listar()).parceiros[0]!;
    const antes = await repos("diretoria").relacao.marketing.relatorio({});
    const alvo = obterLojaRelacao().leads.find(
      (x) => x.origem === "desconhecida",
    )!;
    const r = await parceiros.registrarIndicacao({
      familiaId: alvo.id,
      medicoId: medico.medicoId,
      familiaPromotoraId: null,
      observacao: "",
    });
    expect(r.origem).toBe("indicacao_medica");

    const depois = await repos("diretoria").relacao.marketing.relatorio({});
    const n = (rel: typeof antes, o: string) =>
      rel.porOrigem.find((x) => x.origem === o)?.leads ?? 0;
    expect(n(depois, "indicacao_medica")).toBe(
      n(antes, "indicacao_medica") + 1,
    );
    expect(n(depois, "desconhecida")).toBe(n(antes, "desconhecida") - 1);

    const relatorio = await parceiros.relatorio({});
    expect(
      relatorio.porMedico.find((m) => m.medicoId === medico.medicoId)
        ?.indicacoes,
    ).toBeGreaterThanOrEqual(1);
    await recusaCom(
      parceiros.registrarIndicacao({
        familiaId: alvo.id,
        medicoId: medico.medicoId,
        familiaPromotoraId: null,
        observacao: "",
      }),
      "indicacao_ja_registrada",
    );
  });

  it("família promotora vira indicação de cliente; indicar a si mesma ou informar os dois é recusado", async () => {
    const { parceiros } = repos("comercial").relacao;
    const [a, b] = obterLojaRelacao().leads.filter(
      (x) => x.origem === "desconhecida" || x.origem === "site",
    );
    const r = await parceiros.registrarIndicacao({
      familiaId: b!.id,
      medicoId: null,
      familiaPromotoraId: a!.id,
      observacao: "",
    });
    expect(r.origem).toBe("indicacao_cliente");
    await recusaCom(
      parceiros.registrarIndicacao({
        familiaId: a!.id,
        medicoId: null,
        familiaPromotoraId: a!.id,
        observacao: "",
      }),
      "promotora_e_indicada",
    );
    const medico = (await parceiros.listar()).parceiros[0]!;
    await recusaCom(
      parceiros.registrarIndicacao({
        familiaId: a!.id,
        medicoId: medico.medicoId,
        familiaPromotoraId: b!.id,
        observacao: "",
      }),
      "indicacao_invalida",
    );
  });

  it("contato registrado marca o próximo contato pelo parâmetro de dias", async () => {
    const { parceiros } = repos("comercial").relacao;
    const medico = (await parceiros.listar()).parceiros[1]!;
    await parceiros.registrarContato(medico.medicoId, "");
    const depois = (await parceiros.listar()).parceiros.find(
      (m) => m.medicoId === medico.medicoId,
    )!;
    expect(depois.ultimoContatoEm).not.toBeNull();
    expect(depois.proximoContatoEm).not.toBeNull();
    expect(depois.diasSemContato).toBe(0);
  });
});

describe("tarefas por equipe (P51)", () => {
  it("só a coordenação e a diretoria abrem a visão, com AAL2", async () => {
    const visao = await repos("coordenacao").relacao.tarefasEquipe.visao();
    expect(visao.equipes.length).toBeGreaterThan(0);
    const abertas = soma(visao.equipes.map((e) => e.abertas));
    expect(visao.tarefas.length).toBe(abertas);
    await recusaCom(repos("comercial").relacao.tarefasEquipe.visao());
    await recusaCom(repos("coordenacao", "aal1").relacao.tarefasEquipe.visao());
  });
});

describe("manuais, protocolos e trilhas (P51)", () => {
  it("texto novo gera versão nova e zera a confirmação; texto igual não", async () => {
    const coord = repos("coordenacao").relacao.manuais;
    const enf = repos("enfermeira").relacao.manuais;
    const manual = (await enf.listar()).find(
      (m) => m.papeisAlvo.includes("enfermeira") && m.ativo,
    )!;
    const detalhe = (await enf.obter(manual.id))!;
    await enf.confirmarLeitura(detalhe.versaoId);
    expect((await enf.obter(manual.id))!.lido).toBe(true);

    const mesmo = await coord.salvar({
      manualId: manual.id,
      titulo: detalhe.titulo,
      categoria: detalhe.categoria,
      papeisAlvo: detalhe.papeisAlvo,
      conteudo: detalhe.conteudo,
      resumoMudanca: "",
      ativo: true,
    });
    expect(mesmo.novaVersao).toBe(false);

    await recusaCom(
      coord.salvar({
        manualId: manual.id,
        titulo: detalhe.titulo,
        categoria: detalhe.categoria,
        papeisAlvo: detalhe.papeisAlvo,
        conteudo: `${detalhe.conteudo}\nNovo passo.`,
        resumoMudanca: "",
        ativo: true,
      }),
      "resumo_obrigatorio",
    );
    const nova = await coord.salvar({
      manualId: manual.id,
      titulo: detalhe.titulo,
      categoria: detalhe.categoria,
      papeisAlvo: detalhe.papeisAlvo,
      conteudo: `${detalhe.conteudo}\nNovo passo.`,
      resumoMudanca: "Incluído o novo passo.",
      ativo: true,
    });
    expect(nova.novaVersao).toBe(true);
    expect(nova.versao).toBe(detalhe.versao + 1);
    expect((await enf.obter(manual.id))!.lido).toBe(false);
    // A confirmação da versão antiga não vale para a nova.
    await recusaCom(enf.confirmarLeitura(detalhe.versaoId), "versao_antiga");
    // Só a coordenação vê quem confirmou; a enfermeira não cria manual.
    expect((await coord.leituras(manual.id)).versao).toBe(nova.versao);
    await recusaCom(enf.leituras(manual.id));
    await recusaCom(
      enf.salvar({
        manualId: null,
        titulo: "Meu manual",
        categoria: "manual",
        papeisAlvo: [],
        conteudo: "x",
        resumoMudanca: "",
        ativo: true,
      }),
    );
  });

  it("a trilha da enfermeira mostra o que já foi lido", async () => {
    const enf = repos("enfermeira").relacao.manuais;
    const trilha = (await enf.trilhas())[0]!;
    expect(trilha.equipe).toBeNull();
    const item = trilha.itens.find((i) => !i.lido)!;
    await enf.confirmarLeitura(item.versaoId);
    const depois = (await enf.trilhas())[0]!;
    expect(depois.itens.find((i) => i.manualId === item.manualId)?.lido).toBe(
      true,
    );
    const gestao = (await repos("coordenacao").relacao.manuais.trilhas())[0]!;
    expect(gestao.equipe).not.toBeNull();
  });
});

describe("banco de talentos (P51)", () => {
  it("o roteiro tem 26 perguntas e 10 critérios de 1 a 5, vindos do parâmetro", async () => {
    const roteiro = await repos("coordenacao").relacao.talentos.roteiro();
    expect(soma(roteiro.blocos.map((b) => b.perguntas.length))).toBe(26);
    expect(roteiro.criterios).toHaveLength(10);
    expect(roteiro.escala).toEqual({ min: 1, max: 5 });
  });

  it("avaliação parcial vale; a média conta só os critérios avaliados; nota fora da escala é recusada", async () => {
    const { talentos } = repos("coordenacao").relacao;
    const candidata = (await talentos.listar()).candidatas[0]!;
    const roteiro = await talentos.roteiro();
    const pergunta = roteiro.blocos[0]!.perguntas[0]!.id;
    const criterios = roteiro.criterios.map((c) => c.id);

    const parcial = await talentos.avaliar({
      candidataId: candidata.id,
      respostas: { [pergunta]: "Resposta de teste." },
      notas: { [criterios[0]!]: 4 },
      observacoes: "",
    });
    expect(parcial).toMatchObject({
      criteriosAvaliados: 1,
      criteriosTotal: 10,
      completa: false,
      media: 4,
    });

    const completa = await talentos.avaliar({
      candidataId: candidata.id,
      respostas: {},
      notas: Object.fromEntries(
        criterios.map((c, i) => [c, i % 2 === 0 ? 5 : 3]),
      ),
      observacoes: "",
    });
    expect(completa).toMatchObject({ completa: true, media: 4 });

    await recusaCom(
      talentos.avaliar({
        candidataId: candidata.id,
        respostas: {},
        notas: { [criterios[0]!]: 6 },
        observacoes: "",
      }),
      "nota_invalida",
    );
    await recusaCom(
      talentos.avaliar({
        candidataId: candidata.id,
        respostas: {},
        notas: { inventado: 3 },
        observacoes: "",
      }),
      "criterio_invalido",
    );
  });

  it("só coordenação e diretoria, com AAL2, abrem o banco de talentos", async () => {
    await recusaCom(repos("comercial").relacao.talentos.listar());
    await recusaCom(repos("enfermeira").relacao.talentos.listar());
    await recusaCom(repos("coordenacao", "aal1").relacao.talentos.listar());
  });

  it("a página pública nasce desligada: não abre nem recebe candidatura", async () => {
    const publico = criarRelacaoPublicaDemonstracao();
    const abertura = await publico.abrirCandidatura();
    expect(abertura.situacao).toBe("desligada");
    const dados = {
      nome: "Candidata de Teste",
      telefone: "11999990000",
      email: "candidata.teste@exemplo.invalid",
      cidade: "São Paulo",
      conselho: "",
      apresentacao: "",
      consentimentoVersao: "T-1 provisório",
    };
    expect(await publico.enviarCandidatura(dados, "o1")).toEqual({
      situacao: "desligada",
    });
    expect(
      obterLojaRelacao().candidatas.some(
        (c) => c.nome === "Candidata de Teste",
      ),
    ).toBe(false);
  });

  it("ligado o parâmetro, exige o consentimento com a versão do termo e não duplica quem já se candidatou", async () => {
    const l = obterLojaRelacao();
    l.parametros.talentos_pagina_publica = {
      ...(l.parametros.talentos_pagina_publica as Record<string, unknown>),
      ativa: true,
    } as never;
    const publico = criarRelacaoPublicaDemonstracao();
    const dados = {
      nome: "Candidata de Teste",
      telefone: "11999990000",
      email: "candidata.teste@exemplo.invalid",
      cidade: "São Paulo",
      conselho: "",
      apresentacao: "",
      consentimentoVersao: "",
    };
    const semConsentimento = await publico.enviarCandidatura(dados, "o1");
    expect(semConsentimento).toMatchObject({ situacao: "corrigir" });
    const antes = l.candidatas.length;
    expect(
      await publico.enviarCandidatura(
        { ...dados, consentimentoVersao: "T-1 provisório" },
        "o1",
      ),
    ).toEqual({ situacao: "recebido" });
    expect(l.candidatas.length).toBe(antes + 1);
    // Mesma pessoa de novo: a resposta é a mesma, sem revelar que já existia.
    expect(
      await publico.enviarCandidatura(
        { ...dados, consentimentoVersao: "T-1 provisório" },
        "o1",
      ),
    ).toEqual({ situacao: "recebido" });
    expect(l.candidatas.length).toBe(antes + 1);
  });
});
