// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let cabecalhos = new Headers({ "x-forwarded-for": "203.0.113.20, 10.0.0.1" });
vi.mock("next/headers", () => ({
  headers: async () => cabecalhos,
  cookies: async () => {
    throw new Error("o formulário público não lê cookie");
  },
}));

import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  obterLojaVenda,
  reiniciarLojaVenda,
} from "@/lib/dados/demonstracao/venda";
import { criarRepositoriosDemonstracao } from "@/lib/dados/demonstracao";
import { USUARIOS, familiaPorNome } from "@/lib/dados/demonstracao/fixtures";
import { TURNSTILE_TESTE } from "@/lib/integracoes/turnstile/cliente";
import { enviarFormularioContrato } from "./acoes";
import { origemDaRequisicao } from "./origem";

/**
 * Ação do formulário público (P30): Turnstile, releitura do link no banco,
 * validação e gravação, na demonstração. E o aceite: o CPF nunca aparece
 * em log (console), na resposta nem em mensagem de erro.
 */

const ORIGINAL = { ...process.env };
const CPF = "11144477735";

function valores(cpf = "111.444.777-35") {
  return {
    "gestante.nomeCompleto": "Juliana Teste Gruta",
    "gestante.cpf": cpf,
    "gestante.dataNascimento": "17/05/1994",
    "gestante.email": "juliana.teste@exemplo.invalid",
    "gestante.cep": "01310-100",
    "gestante.logradouro": "Rua de Teste",
    "gestante.numero": "100",
    "gestante.bairro": "Bairro de Teste",
    "gestante.cidade": "São Paulo",
    "gestante.uf": "SP",
    atendimentoMesmoEndereco: "sim",
    consentimento: "sim",
  };
}

async function tokenDaGruta(): Promise<string> {
  const comercial = USUARIOS.find((u) => u.papeis.includes("comercial"))!;
  const { venda } = criarRepositoriosDemonstracao({
    usuarioId: comercial.id,
    papeis: [...comercial.papeis],
    aal: "aal2",
  });
  const oportunidadeId = (await venda.oportunidadeDaFamilia(
    familiaPorNome("Gruta").id,
  ))!;
  const proposta = await venda.obterProposta(oportunidadeId);
  await venda.salvarProposta({
    oportunidadeId,
    pacoteVersaoId: proposta.pacotes[0]!.pacoteVersaoId,
    parcelas: 1,
    condicaoId: null,
    paraQuem: "propria",
    pagadorPessoaId: null,
    pagadorNome: null,
    descontoPct: 0,
    descontoMotivo: null,
  });
  return (await venda.gerarLinkFormulario(oportunidadeId)).token;
}

let espioes: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  cabecalhos = new Headers({ "x-forwarded-for": "203.0.113.20, 10.0.0.1" });
  reiniciarLoja();
  reiniciarLojaVenda();
  espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

function consoleSemCpf() {
  for (const espiao of espioes) {
    const escrito = JSON.stringify(espiao.mock.calls);
    expect(escrito).not.toContain(CPF);
    expect(escrito).not.toContain("111.444.777-35");
  }
}

describe("enviarFormularioContrato", () => {
  it("recebe uma vez; a segunda vez o link já não vale", async () => {
    const token = await tokenDaGruta();
    const pedido = {
      token,
      valores: valores(),
      verificacao: "XXXX.DUMMY.TOKEN.XXXX",
    };
    expect(await enviarFormularioContrato(pedido)).toEqual({
      situacao: "recebido",
    });
    expect(await enviarFormularioContrato(pedido)).toEqual({
      situacao: "invalido",
    });
    consoleSemCpf();
  });

  it("sem o token do Turnstile nada chega ao banco", async () => {
    const token = await tokenDaGruta();
    const resultado = await enviarFormularioContrato({
      token,
      valores: valores(),
      verificacao: null,
    });
    expect(resultado).toEqual({ situacao: "verificacao", motivo: "sem_token" });
    expect(obterLojaVenda().contratos.at(-1)?.tokenHash).not.toBeNull();
  });

  it("Turnstile recusado (chave de teste que sempre recusa)", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY =
      TURNSTILE_TESTE.siteSempreAceita;
    process.env.TURNSTILE_SECRET_KEY = TURNSTILE_TESTE.segredoSempreRecusa;
    const token = await tokenDaGruta();
    expect(
      await enviarFormularioContrato({
        token,
        valores: valores(),
        verificacao: "x",
      }),
    ).toEqual({ situacao: "verificacao", motivo: "recusado" });
  });

  it("CPF errado volta para a etapa certa com a frase, sem repetir o número", async () => {
    const token = await tokenDaGruta();
    const resultado = await enviarFormularioContrato({
      token,
      valores: valores("111.444.777-00"),
      verificacao: "x",
    });
    expect(resultado.situacao).toBe("corrigir");
    if (resultado.situacao === "corrigir") {
      expect(resultado.etapa).toBe("voce");
      expect(JSON.stringify(resultado)).not.toMatch(/111|444|777/);
    }
    consoleSemCpf();
  });

  it("pedido fora do formato vira link inválido, sem exceção", async () => {
    expect(
      await enviarFormularioContrato({
        token: "",
        valores: valores(),
        verificacao: "x",
      }),
    ).toEqual({ situacao: "invalido" });
    expect(
      await enviarFormularioContrato({
        token: "t".repeat(43),
        valores: { "gestante.cpf": "x".repeat(5000) },
        verificacao: "x",
      }),
    ).toEqual({ situacao: "invalido" });
  });

  it("falha inesperada vira 'erro' sem registrar nada no console", async () => {
    const token = await tokenDaGruta();
    const loja = obterLojaVenda();
    // Contrato corrompido: o repositório lança ao ler.
    Object.defineProperty(loja, "contratos", {
      get() {
        throw new Error(`falha com ${CPF}`);
      },
    });
    expect(
      await enviarFormularioContrato({
        token,
        valores: valores(),
        verificacao: "x",
      }),
    ).toEqual({ situacao: "erro" });
    consoleSemCpf();
  });
});

describe("origemDaRequisicao", () => {
  it("usa o primeiro IP do x-forwarded-for e recusa o que não é IP", () => {
    expect(
      origemDaRequisicao(
        new Headers({ "x-forwarded-for": "203.0.113.20, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.20");
    expect(
      origemDaRequisicao(new Headers({ "x-real-ip": "2001:db8::1" })),
    ).toBe("2001:db8::1");
    expect(
      origemDaRequisicao(new Headers({ "x-forwarded-for": "<script>" })),
    ).toBeNull();
    expect(origemDaRequisicao(new Headers())).toBeNull();
  });
});
