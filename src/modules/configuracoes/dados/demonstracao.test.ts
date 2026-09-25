// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { ErroRepositorio } from "@/lib/dados/erros";
import { criarConfiguracoesModuloDemonstracao } from "./demonstracao";
import { reiniciarLojaConfiguracoes } from "./loja";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function ambiente(valores: Partial<Record<keyof typeof ORIGINAL, string>>) {
  process.env.KZ_DADOS = valores.KZ_DADOS ?? ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV =
    valores.NEXT_PUBLIC_APP_ENV ?? ORIGINAL.NEXT_PUBLIC_APP_ENV;
}

const DIRETORIA_ID = "diretoria-teste";
const COORDENACAO_ID = "coordenacao-teste";

function repoDiretoria() {
  return criarConfiguracoesModuloDemonstracao({
    usuarioId: DIRETORIA_ID,
    papeis: ["diretoria"],
  });
}
function repoCoordenacao() {
  return criarConfiguracoesModuloDemonstracao({
    usuarioId: COORDENACAO_ID,
    papeis: ["coordenacao"],
  });
}
function repoComercial() {
  return criarConfiguracoesModuloDemonstracao({
    usuarioId: "comercial-teste",
    papeis: ["comercial"],
  });
}

beforeEach(() => {
  ambiente({
    KZ_DADOS: "demonstracao",
    NEXT_PUBLIC_APP_ENV: "desenvolvimento",
  });
  reiniciarLoja();
  reiniciarLojaConfiguracoes();
});

afterEach(() => {
  ambiente(ORIGINAL as Record<string, string>);
});

describe("parâmetros: só a diretoria, com histórico", () => {
  it("comercial não lê nem grava parâmetros", async () => {
    const comercial = repoComercial();
    expect(await comercial.historicoParametro("agente_followup_horas")).toEqual(
      [],
    );
    await expect(
      comercial.atualizarParametro("agente_followup_horas", 72),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("a diretoria atualiza um parâmetro e o histórico registra antes e depois", async () => {
    const diretoria = repoDiretoria();
    await diretoria.atualizarParametro("agente_followup_horas", 72);
    const historico = await diretoria.historicoParametro(
      "agente_followup_horas",
    );
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({
      valorAntes: 48,
      valorDepois: 72,
      usuarioId: DIRETORIA_ID,
    });
  });

  it("parâmetro inexistente dá nao_encontrado, nunca cria em silêncio", async () => {
    const diretoria = repoDiretoria();
    await expect(
      diretoria.atualizarParametro("chave_que_nao_existe", 1),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });
});

describe("pacotes e versões: preço novo sempre cria versão, a antiga não é editada", () => {
  it("criar uma versão nova fecha a vigente e mantém o id da antiga", async () => {
    const diretoria = repoDiretoria();
    const [essencial] = await diretoria.listarPacotesComVersoes();
    const vigenteAntes = essencial!.versoes.find(
      (v) => v.vigenciaFim === null,
    )!;
    const idAntigo = vigenteAntes.id;
    const valorAntigo = vigenteAntes.valorCentavos;

    const nova = await diretoria.criarVersaoPacote({
      pacoteId: essencial!.id,
      valorCentavos: valorAntigo + 10000,
      horasPorVisita: 4,
      parcelasMaxSemJuros: 3,
      destaque: null,
      vigenciaInicio: "2026-10-01",
      inclui: [],
      naoInclui: [],
    });

    const depois = await diretoria.listarPacotesComVersoes();
    const pacoteDepois = depois.find((p) => p.id === essencial!.id)!;
    const antiga = pacoteDepois.versoes.find((v) => v.id === idAntigo)!;
    const atual = pacoteDepois.versoes.find((v) => v.id === nova.id)!;

    // A versão antiga continua com o mesmo id e o mesmo preço: um contrato
    // que a referenciasse não muda (PRD 13, aceite do P13).
    expect(antiga.valorCentavos).toBe(valorAntigo);
    expect(antiga.vigenciaFim).toBe("2026-09-30");
    expect(atual.valorCentavos).toBe(valorAntigo + 10000);
    expect(atual.vigenciaFim).toBeNull();
  });

  it("coordenação não vê pacotes nem preços", async () => {
    const coordenacao = repoCoordenacao();
    expect(await coordenacao.listarPacotesComVersoes()).toEqual([]);
  });
});

describe("mensagens: rascunho para aprovado, com o aprovador registrado", () => {
  it("aprovar grava quem aprovou e muda o status", async () => {
    const diretoria = repoDiretoria();
    const antes = (await diretoria.listarMensagensDetalhe()).find(
      (m) => m.chave === "followup_d3",
    );
    expect(antes?.status).toBe("rascunho");
    expect(antes?.aprovadoPor).toBeNull();

    await diretoria.aprovarMensagem("followup_d3");

    const depois = (await diretoria.listarMensagensDetalhe()).find(
      (m) => m.chave === "followup_d3",
    );
    expect(depois?.status).toBe("aprovado");
    expect(depois?.aprovadoPor).toBe(DIRETORIA_ID);
    expect(depois?.aprovadoEm).not.toBeNull();
  });

  it("editar uma mensagem aprovada volta para rascunho e limpa o aprovador", async () => {
    const diretoria = repoDiretoria();
    await diretoria.aprovarMensagem("followup_d3");
    await diretoria.salvarRascunhoMensagem("followup_d3", {
      texto: "Novo texto de teste, sem travessão.",
      canal: "whatsapp",
      destinatario: "familia",
      variaveis: ["nome"],
    });
    const depois = (await diretoria.listarMensagensDetalhe()).find(
      (m) => m.chave === "followup_d3",
    );
    expect(depois?.status).toBe("rascunho");
    expect(depois?.aprovadoPor).toBeNull();
  });
});

describe("termos de alerta: coordenação e diretoria, o resto sem acesso", () => {
  it("coordenação cria e atualiza termo de alerta", async () => {
    const coordenacao = repoCoordenacao();
    const novo = await coordenacao.criarTermoAlerta({
      termo: "tontura forte",
      acao: "handoff_saude",
      mensagemChave: "alerta_saude",
      ativo: true,
    });
    await coordenacao.atualizarTermoAlerta(novo.id, { ativo: false });
    const lista = await coordenacao.listarTermosAlerta();
    expect(lista.find((t) => t.id === novo.id)?.ativo).toBe(false);
  });

  it("comercial não lê nem grava termos de alerta", async () => {
    const comercial = repoComercial();
    expect(await comercial.listarTermosAlerta()).toEqual([]);
    await expect(
      comercial.criarTermoAlerta({
        termo: "x",
        acao: "handoff_saude",
        mensagemChave: "alerta_saude",
        ativo: true,
      }),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
});

describe("faixas da régua: só a diretoria edita", () => {
  it("a diretoria muda a mensagem de uma faixa", async () => {
    const diretoria = repoDiretoria();
    const [faixa] = await diretoria.listarFaixasRegua();
    await diretoria.atualizarFaixaRegua(faixa!.id, {
      objetivo: "Novo objetivo de teste",
    });
    const depois = await diretoria.listarFaixasRegua();
    expect(depois.find((f) => f.id === faixa!.id)?.objetivo).toBe(
      "Novo objetivo de teste",
    );
  });

  it("coordenação não vê as faixas da régua no módulo de configurações", async () => {
    const coordenacao = repoCoordenacao();
    expect(await coordenacao.listarFaixasRegua()).toEqual([]);
  });
});

describe("condições comerciais e regiões: só a diretoria", () => {
  it("cria e lista uma condição comercial nova", async () => {
    const diretoria = repoDiretoria();
    await diretoria.criarCondicaoComercial({
      nome: "Teste 10% à vista",
      tipo: "desconto_pct",
      valor: 10,
      requerAprovacao: true,
      ativa: true,
      observacao: null,
    });
    const lista = await diretoria.listarCondicoesComerciais();
    expect(lista.some((c) => c.nome === "Teste 10% à vista")).toBe(true);
  });

  it("atualizar região inexistente dá nao_encontrado", async () => {
    const diretoria = repoDiretoria();
    await expect(
      diretoria.atualizarRegiao("id-que-nao-existe", { ativa: false }),
    ).rejects.toBeInstanceOf(ErroRepositorio);
  });
});
