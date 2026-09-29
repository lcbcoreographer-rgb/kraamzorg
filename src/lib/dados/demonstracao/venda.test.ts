// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import type { DadosFormularioContrato } from "../tipos-venda";
import { criarRepositoriosDemonstracao } from "./index";
import { USUARIOS, familiaPorNome } from "./fixtures";
import { obterLoja, reiniciarLoja } from "./loja";
import {
  criarFormularioDemonstracao,
  obterLojaVenda,
  reiniciarLojaVenda,
} from "./venda";
import {
  CONDICOES,
  GRAVACAO_GRUTA,
  ID_TRANSFERENCIA_REUNIAO,
  MENSAGENS_VENDA,
  PARAMETROS_VENDA,
} from "./venda-fixtures";

/**
 * Venda na demonstração (P29 e P30): as mesmas regras de 0018_venda.sql
 * que o pgTAP prova no banco (supabase/tests/018_venda.sql), aqui na loja
 * em memória que as telas e o e2e usam. E a paridade com o seed: textos e
 * parâmetros da venda são cópia do supabase/seed.sql.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function usuario(papel: Papel) {
  const achado = USUARIOS.find((u) => u.papeis.includes(papel));
  if (!achado) throw new Error(papel);
  return achado;
}

function repos(papel: Papel, aal: "aal1" | "aal2" = "aal2") {
  const u = usuario(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

const CPF_TESTE = "11144477735";

function dadosValidos(): DadosFormularioContrato {
  const endereco = {
    cep: "01310100",
    logradouro: "Rua de Teste",
    numero: "100",
    complemento: "",
    bairro: "Bairro de Teste",
    cidade: "São Paulo",
    uf: "SP",
  };
  return {
    gestante: {
      nomeCompleto: "Juliana Teste Gruta",
      cpf: CPF_TESTE,
      dataNascimento: "1994-05-17",
      email: "juliana.teste@exemplo.invalid",
      endereco,
    },
    atendimentoNoMesmoEndereco: true,
    enderecoAtendimento: null,
    pagador: null,
    testemunha: null,
    consentimento: { aceito: true, versao: "1-rascunho" },
  };
}

function emDias(dias: number, hora = "15:00") {
  const data = new Date(Date.now() + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
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

describe("sessão de venda (P29)", () => {
  it("marcar a partir da transferência reuniao move o P1, resolve a transferência e cria o lembrete da véspera", async () => {
    const { venda } = repos("comercial", "aal1");
    const transferencia = await venda.obterTransferenciaReuniao(
      ID_TRANSFERENCIA_REUNIAO,
    );
    expect(transferencia?.opcoes).toEqual([
      "quinta à noite",
      "sábado de manhã",
    ]);
    const cedro = familiaPorNome("Cedro").id;
    const [condutor] = await venda.listarCondutores();

    const resultado = await venda.agendarSessao({
      familiaId: cedro,
      agendadaPara: emDias(3, "19:00"),
      conduzidaPor: condutor!.id,
      linkReuniao: "https://meet.exemplo.invalid/cedro",
      handoffId: ID_TRANSFERENCIA_REUNIAO,
    });

    expect(resultado.estagioP1).toBe("sessao_venda_agendada");
    const loja = obterLoja();
    expect(
      loja.oportunidades.find((o) => o.familiaId === cedro)?.estagioP1,
    ).toBe("sessao_venda_agendada");
    expect(
      loja.transferencias.find((t) => t.id === ID_TRANSFERENCIA_REUNIAO)
        ?.status,
    ).toBe("resolvido");
    const lembrete = loja.tarefas.find(
      (t) => t.id === resultado.tarefaLembreteId,
    );
    const payload = lembrete?.payload as Record<string, string>;
    expect(payload.mensagemChave).toBe("lembrete_sessao");
    expect(payload.textoSugerido).toContain("19:00");
    expect(payload.textoSugerido).toContain(
      "https://meet.exemplo.invalid/cedro",
    );
    expect(obterLojaVenda().sessoes.at(-1)?.opcoesInformadas).toBe(
      "quinta à noite ou sábado de manhã",
    );
  });

  it("recusa horário passado, link que não é endereço e segunda conversa marcada", async () => {
    const { venda } = repos("comercial", "aal1");
    const [condutor] = await venda.listarCondutores();
    const pedido = {
      familiaId: familiaPorNome("Cedro").id,
      agendadaPara: emDias(-1),
      conduzidaPor: condutor!.id,
      linkReuniao: "https://meet.exemplo.invalid/x",
    };
    await expect(venda.agendarSessao(pedido)).rejects.toThrow(
      /venda:data_no_passado/,
    );
    await expect(
      venda.agendarSessao({
        ...pedido,
        agendadaPara: emDias(2),
        linkReuniao: "sala 3",
      }),
    ).rejects.toThrow(/venda:link_invalido/);
    await expect(
      venda.agendarSessao({
        ...pedido,
        familiaId: familiaPorNome("Dália").id,
        agendadaPara: emDias(2),
      }),
    ).rejects.toThrow(/venda:sessao_ja_agendada/);
  });

  it("a coordenação vê a agenda mas não marca (PRD 13)", async () => {
    const { venda } = repos("coordenacao");
    expect((await venda.listarSessoes()).length).toBeGreaterThan(0);
    const [condutor] = await venda.listarCondutores();
    await expect(
      venda.agendarSessao({
        familiaId: familiaPorNome("Cedro").id,
        agendadaPara: emDias(2),
        conduzidaPor: condutor!.id,
        linkReuniao: "https://meet.exemplo.invalid/x",
      }),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("gravação: comercial que não conduziu não vê; quem conduziu e a diretoria veem, em AAL2", async () => {
    const comercial = repos("comercial", "aal2").venda;
    const [gruta] = await comercial.listarSessoes({
      sessaoId: GRAVACAO_GRUTA.sessaoId,
    });
    expect(gruta?.podeVerGravacao).toBe(false);
    expect(gruta?.gravacaoRegistrada).toBeNull();
    await expect(
      comercial.obterGravacao(GRAVACAO_GRUTA.sessaoId),
    ).rejects.toThrow(/venda:so_quem_conduziu/);

    const coordenacao = repos("coordenacao", "aal2").venda;
    const gravacao = await coordenacao.obterGravacao(GRAVACAO_GRUTA.sessaoId);
    expect(gravacao?.consentimento).toBe(true);
    expect(gravacao?.transcricao).toBe(GRAVACAO_GRUTA.transcricao);

    const diretoria = repos("diretoria", "aal2").venda;
    expect(
      (await diretoria.obterGravacao(GRAVACAO_GRUTA.sessaoId))?.transcricao,
    ).toBeTruthy();

    await expect(
      repos("coordenacao", "aal1").venda.obterGravacao(GRAVACAO_GRUTA.sessaoId),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("transcrição sem consentimento é recusada; retirar o consentimento apaga tudo", async () => {
    const { venda } = repos("coordenacao", "aal2");
    await venda.registrarGravacao(GRAVACAO_GRUTA.sessaoId, false, null);
    const apagada = await venda.obterGravacao(GRAVACAO_GRUTA.sessaoId);
    expect(apagada?.consentimento).toBe(false);
    expect(apagada?.transcricao).toBeNull();
    await expect(
      venda.salvarResumo(GRAVACAO_GRUTA.sessaoId, {
        duvidas: [],
        objecoes: [],
        planoInteresse: null,
        proximosPassos: [],
        origem: "pessoa",
        modelo: null,
      }),
    ).rejects.toThrow(/venda:sem_transcricao/);
  });

  it("cancelar a conversa marcada devolve o P1 para qualificado e tira o lembrete", async () => {
    const { venda } = repos("comercial", "aal1");
    const dalia = familiaPorNome("Dália").id;
    const [marcada] = await venda.listarSessoes({ familiaId: dalia });
    const resultado = await venda.registrarDesfecho(
      marcada!.id,
      "cancelada",
      null,
    );
    expect(resultado.estagioP1).toBe("qualificado");
    await expect(
      venda.registrarDesfecho(marcada!.id, "realizada", true),
    ).rejects.toThrow(/venda:sessao_nao_agendada/);
  });

  it("não compareceu antes do horário é recusado", async () => {
    const { venda } = repos("comercial", "aal1");
    const [marcada] = await venda.listarSessoes({
      familiaId: familiaPorNome("Dália").id,
    });
    await expect(
      venda.registrarDesfecho(marcada!.id, "nao_compareceu", null),
    ).rejects.toThrow(/venda:sessao_ainda_nao_aconteceu/);
  });
});

describe("proposta e formulário seguro (P30)", () => {
  async function propostaDaGruta(condicaoId: string | null) {
    const { venda } = repos("comercial", "aal2");
    const gruta = familiaPorNome("Gruta").id;
    const oportunidadeId = (await venda.oportunidadeDaFamilia(gruta))!;
    const proposta = await venda.obterProposta(oportunidadeId);
    const essencial = proposta.pacotes.find((p) => p.nome === "Essencial")!;
    const salva = await venda.salvarProposta({
      oportunidadeId,
      pacoteVersaoId: essencial.pacoteVersaoId,
      parcelas: 3,
      condicaoId,
      paraQuem: "propria",
      pagadorPessoaId: null,
      pagadorNome: null,
      descontoPct: 0,
      descontoMotivo: null,
    });
    return { venda, oportunidadeId, salva };
  }

  it("a conta usa o pacote vigente e a taxa da cidade, com o resto dos centavos na primeira parcela", async () => {
    const { salva } = await propostaDaGruta(null);
    expect(salva.conta.totalCentavos).toBe(420000 + 35000);
    expect(salva.conta.parcelaCentavos).toBe(151666);
    expect(salva.conta.primeiraParcelaCentavos).toBe(151668);
    expect(salva.precisaAprovacao).toBe(false);
  });

  it("condição com aprovação barra o link até a diretoria aprovar", async () => {
    const pix = CONDICOES.find((c) => c.requerAprovacao)!;
    const { venda, oportunidadeId, salva } = await propostaDaGruta(pix.id);
    expect(salva.precisaAprovacao).toBe(true);
    expect(salva.conta.descontoCentavos).toBe(21000);
    await expect(venda.gerarLinkFormulario(oportunidadeId)).rejects.toThrow(
      /venda:desconto_sem_aprovacao/,
    );
    await expect(venda.aprovarDesconto(oportunidadeId)).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    await repos("diretoria").venda.aprovarDesconto(oportunidadeId);
    const link = await venda.gerarLinkFormulario(oportunidadeId);
    expect(link.estagioP2).toBe("ganho");
  });

  it("o link vale uma vez: guarda só o hash, abre, recebe e depois vira inválido", async () => {
    const { venda, oportunidadeId } = await propostaDaGruta(null);
    const link = await venda.gerarLinkFormulario(oportunidadeId);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const contrato = obterLojaVenda().contratos.at(-1)!;
    expect(contrato.tokenHash).not.toContain(link.token);
    const tarefa = obterLoja().tarefas.find((t) => t.id === link.tarefaId)!;
    expect(JSON.stringify(tarefa.payload)).not.toContain(link.token);

    const formulario = criarFormularioDemonstracao();
    const abertura = await formulario.abrir(link.token, "203.0.113.10");
    expect(abertura.situacao).toBe("valido");
    if (abertura.situacao !== "valido") return;
    expect(abertura.textos.abertura).toMatch(/^Oi, Juliana\. Perfil pediu/);
    expect(JSON.stringify(abertura)).not.toMatch(
      /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/,
    );

    expect(
      await formulario.enviar(link.token, dadosValidos(), "203.0.113.10"),
    ).toEqual({
      situacao: "recebido",
    });
    expect(contrato.tokenHash).toBeNull();
    expect(
      await formulario.enviar(link.token, dadosValidos(), "203.0.113.10"),
    ).toEqual({
      situacao: "invalido",
    });
    expect((await formulario.abrir(link.token, "203.0.113.10")).situacao).toBe(
      "invalido",
    );
    await expect(venda.gerarLinkFormulario(oportunidadeId)).rejects.toThrow(
      /venda:formulario_ja_recebido/,
    );
  });

  it("link vencido não abre", async () => {
    const { venda, oportunidadeId } = await propostaDaGruta(null);
    const link = await venda.gerarLinkFormulario(oportunidadeId);
    obterLojaVenda().contratos.at(-1)!.expiraEm = new Date(
      Date.now() - 1000,
    ).toISOString();
    const formulario = criarFormularioDemonstracao();
    expect((await formulario.abrir(link.token, "203.0.113.11")).situacao).toBe(
      "invalido",
    );
  });

  it("gerar outro link invalida o anterior", async () => {
    const { venda, oportunidadeId } = await propostaDaGruta(null);
    const primeiro = await venda.gerarLinkFormulario(oportunidadeId);
    const segundo = await venda.gerarLinkFormulario(oportunidadeId);
    const formulario = criarFormularioDemonstracao();
    expect(
      (await formulario.abrir(primeiro.token, "203.0.113.12")).situacao,
    ).toBe("invalido");
    expect(
      (await formulario.abrir(segundo.token, "203.0.113.12")).situacao,
    ).toBe("valido");
  });

  it("muitas tentativas com link errado bloqueiam a origem pela janela do parâmetro", async () => {
    const formulario = criarFormularioDemonstracao();
    for (let i = 0; i < 10; i++) {
      expect(
        (
          await formulario.abrir(
            `link-errado-${"x".repeat(30)}-${i}`,
            "203.0.113.13",
          )
        ).situacao,
      ).toBe("invalido");
    }
    const bloqueada = await formulario.abrir(
      `link-errado-${"x".repeat(30)}`,
      "203.0.113.13",
    );
    expect(bloqueada.situacao).toBe("limite");
    if (bloqueada.situacao === "limite") {
      expect(bloqueada.textos.limite).toContain("15 minutos");
    }
    expect(
      (await formulario.abrir(`link-errado-${"x".repeat(30)}`, "203.0.113.14"))
        .situacao,
    ).toBe("invalido");
  });

  it("CPF inválido volta para corrigir, sem gravar nada", async () => {
    const { venda, oportunidadeId } = await propostaDaGruta(null);
    const link = await venda.gerarLinkFormulario(oportunidadeId);
    const formulario = criarFormularioDemonstracao();
    const dados = dadosValidos();
    dados.gestante.cpf = "11144477700";
    const resultado = await formulario.enviar(
      link.token,
      dados,
      "203.0.113.15",
    );
    expect(resultado).toEqual({
      situacao: "corrigir",
      erros: { "gestante.cpf": "invalido" },
    });
    expect((await formulario.abrir(link.token, "203.0.113.15")).situacao).toBe(
      "valido",
    );
  });
});

describe("paridade com o seed", () => {
  const seed = readFileSync(
    path.join(process.cwd(), "supabase", "seed.sql"),
    "utf8",
  );

  it("os textos da venda são os mesmos do seed, em rascunho", () => {
    for (const mensagem of MENSAGENS_VENDA) {
      const literal = mensagem.texto.replaceAll("'", "''");
      const padrao = new RegExp(
        `\\('${mensagem.chave}', '${mensagem.canal}', 'familia',\\s*'${literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}',[^)]*'rascunho'\\)`,
      );
      expect(seed, mensagem.chave).toMatch(padrao);
    }
  });

  it("os parâmetros da venda são os mesmos do seed", () => {
    for (const [chave, valor] of Object.entries(PARAMETROS_VENDA)) {
      const achado = new RegExp(`\\('${chave}', '([^']+)'`).exec(seed);
      expect(achado, chave).not.toBeNull();
      expect(JSON.parse(achado![1]!), chave).toEqual(valor);
    }
  });
});
