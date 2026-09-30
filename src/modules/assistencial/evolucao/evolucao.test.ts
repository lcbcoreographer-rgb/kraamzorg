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
import { obterArmazenamento } from "@/lib/armazenamento";
import { reiniciarArmazenamentoMemoria } from "@/lib/armazenamento/memoria";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import {
  obterLojaEvolucao,
  reiniciarLojaEvolucao,
} from "@/lib/dados/demonstracao/evolucao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  caixaDeSaidaEmailDemo,
  limparCaixaDeSaidaEmailDemo,
} from "@/lib/integracoes/fabrica";
import { textosDoConteudo, type ConteudoEvolucao } from "@/lib/pdf";
import {
  acaoAprovarEEnviar,
  acaoDevolverEvolucao,
  acaoEnviarParaRevisao,
  acaoMontarEvolucao,
  acaoReenviarEvolucao,
  acaoSalvarEvolucao,
} from "./acoes";
import { camposVisiveis, obter } from "./campos";
import { estadoInicialEvolucao } from "./estado-acoes";
import { abrirPdfEvolucao } from "./pdf-rota";

/**
 * P41, aceite: o acompanhamento do seed gera os PDFs certos; conclusão
 * incoerente bloqueia a aprovação; o e-mail sai com o PDF em anexo e com
 * assunto sem dado pessoal. Tudo sobre o repositório de demonstração, que
 * repete as regras de 0024_evolucao_ocorrencia_nf.sql (a prova do banco é o
 * supabase/tests/024_evolucao_ocorrencia_nf.sql).
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

const AURORA = id(610, 1);
const BRISA = id(610, 2);
const CEDRO = id(610, 3);
const ESTRELA = id(610, 4);

async function entrar(nome: string) {
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
    aal: "aal2",
    aalPossivel: "aal2",
  });
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor);
  return f;
}

/**
 * O formulário como o navegador o envia: todo campo visível vai junto, os
 * vazios como texto vazio, e os botões de opção só quando há uma marcada.
 * Foi o que o e2e mostrou: salvar com a lista de orientações em branco
 * apagava o objeto e o montador quebrava.
 */
function formularioComoNavegador(
  detalhe: Awaited<ReturnType<typeof relatorioDe>>,
  preenchido: Record<string, string> = {},
): FormData {
  const f = new FormData();
  f.set("relatorioId", detalhe.id);
  f.set("versao", String(detalhe.versao));
  const dados = detalhe.conteudo.dados;
  for (const campo of camposVisiveis(detalhe.tipo, dados)) {
    const valor = obter(dados, campo.caminho);
    if (campo.tipo === "faixa") {
      const faixa = (valor ?? {}) as { min?: number; max?: number };
      f.set(`${campo.caminho}.min`, String(faixa.min ?? ""));
      f.set(`${campo.caminho}.max`, String(faixa.max ?? ""));
    } else if (campo.tipo === "simnao") {
      if (valor !== undefined) f.set(campo.caminho, valor ? "sim" : "nao");
    } else if (campo.tipo === "opcao") {
      f.set(campo.caminho, typeof valor === "string" ? valor : "");
    } else if (campo.tipo === "lista") {
      f.set(campo.caminho, Array.isArray(valor) ? valor.join("\n") : "");
    } else {
      f.set(campo.caminho, valor === undefined ? "" : String(valor));
    }
  }
  for (const [chave, valor] of Object.entries(preenchido)) f.set(chave, valor);
  return f;
}

async function relatorioDe(
  acompanhamentoId: string,
  tipo: "puerperal" | "neonatal",
  ordem = 0,
) {
  const { evolucoes } = await obterRepositorios();
  const base = await evolucoes.base(acompanhamentoId);
  const bebe = base.bebes.find((b) => b.ordem === ordem);
  const achado = base.relatorios.find(
    (r) => r.tipo === tipo && r.bebeId === (bebe?.id ?? null),
  );
  if (!achado) throw new Error("relatório não encontrado no teste");
  return evolucoes.obter(achado.id);
}

/** O que a enfermeira completa no puerperal da Aurora (cesárea, lesão, laser e ILIB). */
const PUERPERAL_AURORA = {
  "mamas.lesao.grau": "II",
  "mamas.lesao.grauFinal": "I",
  alimentacaoObservada: "misto",
  estabilidadeHemodinamica: "sim",
  "conclusao.amamentacao": "misto",
  "conclusao.autonomiaFamilia":
    "A família demonstra autonomia e segurança nos cuidados do dia a dia.",
};

/** O que a enfermeira completa no neonatal (o resto vem do checklist). */
const NEONATAL = {
  "genitaliaEliminacoes.evacuacoes": "sim",
  "alimentacao.tipo": "misto",
  "conclusao.aleitamento": "misto",
};

async function prepararAurora() {
  await entrar("Perfil Teste Enfermeira");
  expect((await acaoMontarEvolucao(AURORA, "puerperal")).erro).toBeUndefined();
  expect((await acaoMontarEvolucao(AURORA, "bebe-1")).erro).toBeUndefined();
  const pue = await relatorioDe(AURORA, "puerperal");
  const neo = await relatorioDe(AURORA, "neonatal", 1);
  return { pue, neo };
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaEvolucao();
  reiniciarArmazenamentoMemoria();
  limparCaixaDeSaidaEmailDemo();
  await entrar("Perfil Teste Enfermeira");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("montar o rascunho a partir do checklist", () => {
  it("junta o que o checklist trouxe e lista o que só a enfermeira pode dizer", async () => {
    const { pue, neo } = await prepararAurora();
    expect(pue.status).toBe("rascunho");
    expect(pue.conteudo.conteudo).toBeNull();
    const dados = pue.conteudo.dados;
    expect(obter(dados, "dor.escalaInicial")).toBe(6);
    expect(obter(dados, "dor.escalaFinal")).toBe(0);
    expect(obter(dados, "historico.tipoParto")).toBe("cesarea");
    expect(
      String(obter(dados, "periodo.fim")) >
        String(obter(dados, "periodo.inicio")),
    ).toBe(true);
    expect(pue.errosValidacao).toEqual(
      expect.arrayContaining([
        "Falta preencher: grau da lesão mamilar.",
        "Falta preencher: conclusão sobre a amamentação.",
      ]),
    );
    // frase sem "?." solto no fim
    expect(pue.errosValidacao.join(" ")).not.toMatch(/\?\./);
    expect(neo.status).toBe("rascunho");
    expect(neo.bebeNome).toBe("Bebê Teste Aurora");
    const dadosNeo = neo.conteudo.dados;
    // pesagens do checklist, na ordem, com origem
    const pesagens = obter(dadosNeo, "pesagens") as { origem: string }[];
    expect(pesagens.length).toBeGreaterThanOrEqual(6);
    expect(pesagens[0]?.origem).toBe("alta_hospitalar");
    // a temperatura sai com uma casa decimal, sem resto de ponto flutuante
    expect(
      JSON.stringify(obter(dadosNeo, "estadoGeral.temperatura")),
    ).not.toMatch(/\d\.\d{2,}/);
  });

  it("montar duas vezes não duplica o documento", async () => {
    await acaoMontarEvolucao(AURORA, "puerperal");
    const segunda = await acaoMontarEvolucao(AURORA, "puerperal");
    expect(segunda.sucesso).toMatch(/já tem rascunho/);
    const { evolucoes } = await obterRepositorios();
    const base = await evolucoes.base(AURORA);
    expect(base.relatorios.filter((r) => r.tipo === "puerperal")).toHaveLength(
      1,
    );
  });

  it("família sem médico com contato não passa do rascunho", async () => {
    const r = await acaoMontarEvolucao(CEDRO, "puerperal");
    expect(r.erro).toMatch(/médico com e-mail ou telefone/);
    const { evolucoes } = await obterRepositorios();
    const lista = await evolucoes.listar("abertas");
    expect(
      lista.acompanhamentos.find((a) => a.acompanhamentoId === CEDRO)
        ?.bloqueadoContato,
    ).toBe(true);
  });
});

describe("salvar como o navegador envia", () => {
  it("o puerperal com a lista de orientações em branco monta o conteúdo, sem quebrar", async () => {
    const { pue } = await prepararAurora();
    const r = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formularioComoNavegador(pue, PUERPERAL_AURORA),
    );
    expect(r.erro).toBeUndefined();
    expect(r.pontos).toBeUndefined();
    const salvo = await relatorioDe(AURORA, "puerperal");
    expect(salvo.errosValidacao).toEqual([]);
    expect(salvo.conteudo.conteudo).not.toBeNull();
    expect(
      obter(salvo.conteudo.dados, "orientacoesAlta.itensPersonalizados"),
    ).toEqual([]);
    // e salvar de novo, agora com tudo já preenchido, segue igual
    const de_novo = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formularioComoNavegador(salvo),
    );
    expect(de_novo.erro).toBeUndefined();
    expect(de_novo.pontos).toBeUndefined();
  });

  it("o neonatal com os campos opcionais em branco também salva", async () => {
    const { neo } = await prepararAurora();
    const r = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formularioComoNavegador(neo, NEONATAL),
    );
    expect(r.erro).toBeUndefined();
    expect(r.pontos).toBeUndefined();
    expect(
      (await relatorioDe(AURORA, "neonatal", 1)).conteudo.conteudo,
    ).not.toBeNull();
  });
});

describe("do rascunho ao e-mail com o PDF em anexo", () => {
  it("o acompanhamento do seed gera os dois PDFs, guardados por id, e envia um e-mail a cada médico", async () => {
    const { pue, neo } = await prepararAurora();

    const salvouPue = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        ...PUERPERAL_AURORA,
      }),
    );
    expect(salvouPue.erro).toBeUndefined();
    expect(salvouPue.sucesso).toMatch(/Nenhum ponto a corrigir/);
    const salvouNeo = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: neo.id,
        versao: String(neo.versao),
        ...NEONATAL,
      }),
    );
    expect(salvouNeo.erro).toBeUndefined();

    const puePronto = await relatorioDe(AURORA, "puerperal");
    const neoPronto = await relatorioDe(AURORA, "neonatal", 1);
    expect(puePronto.errosValidacao).toEqual([]);
    expect(neoPronto.errosValidacao).toEqual([]);
    expect(puePronto.podeEnviarRevisao).toBe(true);

    expect(
      (await acaoEnviarParaRevisao(puePronto.id, puePronto.versao)).erro,
    ).toBeUndefined();
    expect(
      (await acaoEnviarParaRevisao(neoPronto.id, neoPronto.versao)).erro,
    ).toBeUndefined();
    // a enfermeira não aprova
    const emRevisao = await relatorioDe(AURORA, "puerperal");
    expect(
      (await acaoAprovarEEnviar(emRevisao.id, emRevisao.versao)).erro,
    ).toMatch(/não permite esta etapa/);

    await entrar("Perfil Teste Coordenacao");
    for (const doc of [
      await relatorioDe(AURORA, "puerperal"),
      await relatorioDe(AURORA, "neonatal", 1),
    ]) {
      expect(doc.podeAprovar).toBe(true);
      const r = await acaoAprovarEEnviar(doc.id, doc.versao);
      expect(r.erro).toBeUndefined();
      expect(r.sucesso).toMatch(/Aprovado e enviado a 1 médico/);
    }

    // PDFs no storage privado, com o nome pelo id do documento
    const armazenamento = obterArmazenamento();
    for (const doc of [puePronto, neoPronto]) {
      const bytes = await armazenamento.ler(`evolucoes/${doc.id}.pdf`);
      expect(bytes).not.toBeNull();
      expect(new TextDecoder().decode(bytes!.subarray(0, 5))).toBe("%PDF-");
      expect(bytes!.byteLength).toBeGreaterThan(3000);
    }

    // conteúdo certo: paciente, dor, lesão e conclusão no puerperal; bebê e peso no neonatal
    const textoPue = textosDoConteudo(
      (await relatorioDe(AURORA, "puerperal")).conteudo
        .conteudo as unknown as ConteudoEvolucao,
    ).join("\n");
    expect(textoPue).toContain("Marina Teste Aurora");
    expect(textoPue).toContain("Escala de dor mantida em 0 desde o D5");
    expect(textoPue).toContain("grau II");
    expect(textoPue).toContain("Enfermeira Teste Lima");
    const textoNeo = textosDoConteudo(
      (await relatorioDe(AURORA, "neonatal", 1)).conteudo
        .conteudo as unknown as ConteudoEvolucao,
    ).join("\n");
    expect(textoNeo).toContain("Bebê Teste Aurora");
    expect(textoNeo).toContain("3.310 g");

    // e-mails: um por documento, para o médico da especialidade certa, com PDF em anexo
    const caixa = caixaDeSaidaEmailDemo();
    expect(caixa).toHaveLength(2);
    const paraObstetra = caixa.find((e) => e.para[0]?.startsWith("helena."));
    const paraPediatra = caixa.find((e) => e.para[0]?.startsWith("rodrigo."));
    expect(paraObstetra).toBeDefined();
    expect(paraPediatra).toBeDefined();
    expect(paraObstetra!.anexos).toEqual([
      expect.objectContaining({
        nomeArquivo: `${puePronto.id}.pdf`,
        tipoConteudo: "application/pdf",
      }),
    ]);
    expect(paraPediatra!.anexos[0]?.nomeArquivo).toBe(`${neoPronto.id}.pdf`);
    expect(paraObstetra!.anexos[0]?.bytes).toBeGreaterThan(3000);

    // assunto sem dado pessoal: nenhum nome da família, da mãe, do bebê nem contato
    for (const email of caixa) {
      expect(email.assunto).toBe("Evolução de enfermagem · Kraamzorg Brasil");
      expect(email.assunto).not.toMatch(
        /Aurora|Marina|Rafael|Bebê|Família|@|\d{8}/,
      );
      for (const anexo of email.anexos) {
        expect(anexo.nomeArquivo).not.toMatch(/Aurora|Marina|Rafael|Bebê/i);
      }
    }

    // depois do envio: enviada, com a tarefa de mandar à família para a coordenação
    const depois = await relatorioDe(AURORA, "puerperal");
    expect(depois.status).toBe("enviado");
    expect(depois.enviadoEm).not.toBeNull();
    expect(
      obterLojaEvolucao().tarefas.filter((t) => t.acompanhamentoId === AURORA),
    ).toHaveLength(1);
  });

  it("gemelares: um puerperal e um neonatal por bebê, cada um com a concordância do sexo", async () => {
    await entrar("Perfil Teste Enfermeira");
    const { evolucoes } = await obterRepositorios();
    const antes = await evolucoes.listar("abertas");
    const brisa = antes.acompanhamentos.find(
      (a) => a.acompanhamentoId === BRISA,
    )!;
    expect(brisa.documentos.map((d) => `${d.tipo}:${d.bebeOrdem}`)).toEqual([
      "puerperal:0",
      "neonatal:1",
      "neonatal:2",
    ]);
    expect((await acaoMontarEvolucao(BRISA, "bebe-1")).erro).toBeUndefined();
    expect((await acaoMontarEvolucao(BRISA, "bebe-2")).erro).toBeUndefined();
    const um = await relatorioDe(BRISA, "neonatal", 1);
    const dois = await relatorioDe(BRISA, "neonatal", 2);
    expect(um.bebeId).not.toBe(dois.bebeId);
    expect(obter(um.conteudo.dados, "bebe.sexo")).toBe("feminino");
    expect(obter(dois.conteudo.dados, "bebe.sexo")).toBe("masculino");
    expect(obter(dois.conteudo.dados, "bebe.pesoNascimentoG")).toBe(3000);
  });
});

describe("conclusão incoerente bloqueia a aprovação", () => {
  it("conclusão de ganho de peso contra a curva impede a revisão e a aprovação", async () => {
    const { neo } = await prepararAurora();
    const r = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: neo.id,
        versao: String(neo.versao),
        ...NEONATAL,
        "conclusao.ganhoPeso": "perda",
      }),
    );
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Ainda há pontos a corrigir/);
    expect(r.pontos?.some((p) => /peso/i.test(p))).toBe(true);

    const salvo = await relatorioDe(AURORA, "neonatal", 1);
    expect(salvo.errosValidacao.length).toBeGreaterThan(0);
    expect(salvo.conteudo.conteudo).toBeNull();
    expect(salvo.podeEnviarRevisao).toBe(false);
    const revisao = await acaoEnviarParaRevisao(salvo.id, salvo.versao);
    expect(revisao.erro).toMatch(/pontos a corrigir/);

    // corrige e passa
    const corrigido = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: salvo.id,
        versao: String(salvo.versao),
        "conclusao.ganhoPeso": "progressivo",
      }),
    );
    expect(corrigido.erro).toBeUndefined();
    expect(corrigido.pontos).toBeUndefined();
    const ok = await relatorioDe(AURORA, "neonatal", 1);
    expect(ok.errosValidacao).toEqual([]);
    expect(ok.podeEnviarRevisao).toBe(true);
  });

  it("a coordenação edita um documento em revisão com conclusão incoerente e a aprovação trava", async () => {
    const { neo } = await prepararAurora();
    await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: neo.id,
        versao: String(neo.versao),
        ...NEONATAL,
      }),
    );
    const pronto = await relatorioDe(AURORA, "neonatal", 1);
    await acaoEnviarParaRevisao(pronto.id, pronto.versao);

    await entrar("Perfil Teste Coordenacao");
    const emRevisao = await relatorioDe(AURORA, "neonatal", 1);
    expect(emRevisao.podeAprovar).toBe(true);
    const edit = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: emRevisao.id,
        versao: String(emRevisao.versao),
        "conclusao.ganhoPeso": "perda",
      }),
    );
    expect(edit.pontos?.length).toBeGreaterThan(0);
    const travado = await relatorioDe(AURORA, "neonatal", 1);
    expect(travado.status).toBe("em_revisao");
    expect(travado.podeAprovar).toBe(false);
    const tentativa = await acaoAprovarEEnviar(travado.id, travado.versao);
    expect(tentativa.erro).toMatch(/pontos a corrigir/);
    expect(caixaDeSaidaEmailDemo()).toHaveLength(0);
  });

  it("salvar com a versão velha avisa que outra pessoa mudou o documento", async () => {
    const { pue } = await prepararAurora();
    const primeiro = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        ...PUERPERAL_AURORA,
      }),
    );
    expect(primeiro.erro).toBeUndefined();
    const velho = await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        "conclusao.autonomiaFamilia": "Outro texto.",
      }),
    );
    expect(velho.erro).toMatch(/Outra pessoa alterou este documento/);
  });

  it("a coordenação devolve com recado e a enfermeira volta a editar", async () => {
    const { pue } = await prepararAurora();
    await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        ...PUERPERAL_AURORA,
      }),
    );
    const pronto = await relatorioDe(AURORA, "puerperal");
    await acaoEnviarParaRevisao(pronto.id, pronto.versao);
    // enquanto está em revisão a enfermeira não edita
    const travada = await relatorioDe(AURORA, "puerperal");
    expect(travada.podeEditar).toBe(false);

    await entrar("Perfil Teste Coordenacao");
    const curto = await acaoDevolverEvolucao(
      estadoInicialEvolucao,
      formulario({ relatorioId: travada.id, motivo: "ok" }),
    );
    expect(curto.erro).toMatch(/pelo menos 5 letras/);
    const devolvido = await acaoDevolverEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: travada.id,
        motivo: "Confira o grau final da lesão antes de mandar.",
      }),
    );
    expect(devolvido.sucesso).toMatch(/Devolvido para a enfermeira/);

    await entrar("Perfil Teste Enfermeira");
    const volta = await relatorioDe(AURORA, "puerperal");
    expect(volta.status).toBe("rascunho");
    expect(volta.notaRevisao).toBe(
      "Confira o grau final da lesão antes de mandar.",
    );
    expect(volta.podeEditar).toBe(true);
  });
});

describe("falha no envio: mostra o motivo e permite reenviar", () => {
  async function aprovadoSemEnviar() {
    const { pue } = await prepararAurora();
    await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        ...PUERPERAL_AURORA,
      }),
    );
    const pronto = await relatorioDe(AURORA, "puerperal");
    await acaoEnviarParaRevisao(pronto.id, pronto.versao);
    await entrar("Perfil Teste Coordenacao");
    return relatorioDe(AURORA, "puerperal");
  }

  it("assunto com nome de paciente é barrado, nada sai e o documento fica em envio com erro", async () => {
    const doc = await aprovadoSemEnviar();
    obterLojaEvolucao().textosEmail.assunto =
      "Evolução de enfermagem de Marina Aurora";
    const r = await acaoAprovarEEnviar(doc.id, doc.versao);
    expect(r.erro).toMatch(/Aprovado, mas o e-mail não saiu/);
    expect(r.erro).toMatch(/dado de paciente/);
    expect(caixaDeSaidaEmailDemo()).toHaveLength(0);
    const falhou = await relatorioDe(AURORA, "puerperal");
    expect(falhou.status).toBe("erro_envio");
    expect(falhou.erroEnvio).toMatch(/dado de paciente/);
    expect(falhou.podeReenviar).toBe(true);

    // corrige o texto no cadastro e reenvia
    obterLojaEvolucao().textosEmail.assunto =
      "Evolução de enfermagem · Kraamzorg Brasil";
    const reenviado = await acaoReenviarEvolucao(doc.id);
    expect(reenviado.erro).toBeUndefined();
    expect(reenviado.sucesso).toMatch(/Reenviado a 1 médico/);
    expect(caixaDeSaidaEmailDemo()).toHaveLength(1);
    expect((await relatorioDe(AURORA, "puerperal")).status).toBe("enviado");
  });

  it("sem coordenação e contato no cadastro do e-mail, o envio não sai e o motivo aparece", async () => {
    const doc = await aprovadoSemEnviar();
    obterLojaEvolucao().emailConfig.contato = "";
    const r = await acaoAprovarEEnviar(doc.id, doc.versao);
    expect(r.erro).toMatch(/Faltam a coordenação e o canal de contato/);
    expect(caixaDeSaidaEmailDemo()).toHaveLength(0);
    expect((await relatorioDe(AURORA, "puerperal")).status).toBe("erro_envio");
  });
});

describe("prazo e acesso", () => {
  it("a lista mostra o prazo em dias úteis e a escalada da coordenação", async () => {
    const { evolucoes } = await obterRepositorios();
    const lista = await evolucoes.listar("abertas");
    const aurora = lista.acompanhamentos.find(
      (a) => a.acompanhamentoId === AURORA,
    )!;
    const estrela = lista.acompanhamentos.find(
      (a) => a.acompanhamentoId === ESTRELA,
    )!;
    expect(aurora.situacao).toBe("no_prazo");
    expect(estrela.situacao).toBe("escalada");
    expect(aurora.prazoAviso > aurora.concluidoEm).toBe(true);
    expect(aurora.prazoEscala >= aurora.prazoAviso).toBe(true);
  });

  it("a prévia em PDF sai do conteúdo salvo, e documento com pontos a corrigir não vira PDF", async () => {
    const { pue } = await prepararAurora();
    const bloqueado = await abrirPdfEvolucao(AURORA, "puerperal", true);
    expect(bloqueado.status).toBe(409);
    await acaoSalvarEvolucao(
      estadoInicialEvolucao,
      formulario({
        relatorioId: pue.id,
        versao: String(pue.versao),
        ...PUERPERAL_AURORA,
      }),
    );
    const previa = await abrirPdfEvolucao(AURORA, "puerperal", true);
    expect(previa.status).toBe(200);
    expect(previa.headers.get("Content-Type")).toBe("application/pdf");
    expect(previa.headers.get("Content-Disposition")).toContain(
      `${pue.id}.pdf`,
    );
    expect(previa.headers.get("Cache-Control")).toContain("no-store");
    const bytes = new Uint8Array(await previa.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    // caminho estranho nunca chega ao banco
    expect(
      (await abrirPdfEvolucao("nao-e-uuid", "puerperal", false)).status,
    ).toBe(404);
    expect((await abrirPdfEvolucao(AURORA, "../etc", false)).status).toBe(404);
  });

  it("comercial não abre evolução", async () => {
    await entrar("Perfil Teste Comercial");
    const r = await acaoMontarEvolucao(AURORA, "puerperal");
    expect(r.erro).toMatch(/não permite esta etapa/);
    expect((await abrirPdfEvolucao(AURORA, "puerperal", true)).status).toBe(
      403,
    );
  });
});
