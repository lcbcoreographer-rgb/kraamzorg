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

/**
 * A Autentique de mentira: o teste escolhe como ela responde e se o
 * ambiente é de teste (sandbox) ou de produção.
 */
const assinatura = vi.hoisted(() => ({
  ambienteDeTeste: true,
  comportamento: "ok" as "ok" | "recusa" | "incerto" | "sem_credencial",
  chamadas: [] as {
    nomeDocumento: string;
    tamanho: number;
    testemunha: boolean;
  }[],
}));

vi.mock("@/lib/integracoes/fabrica", async () => {
  const cliente = await import("@/lib/integracoes/autentique/cliente");
  return {
    ErroIntegracaoNaoConfigurada: class extends Error {
      constructor() {
        super("sem credencial");
        this.name = "ErroIntegracaoNaoConfigurada";
      }
    },
    obterAssinatura: () => {
      if (assinatura.comportamento === "sem_credencial") {
        const erro = new Error("sem credencial");
        erro.name = "ErroIntegracaoNaoConfigurada";
        throw erro;
      }
      return {
        get ambienteDeTeste() {
          return assinatura.ambienteDeTeste;
        },
        async criarDocumento(entrada: {
          nomeDocumento: string;
          pdf: Uint8Array;
          testemunha?: unknown;
        }) {
          assinatura.chamadas.push({
            nomeDocumento: entrada.nomeDocumento,
            tamanho: entrada.pdf.length,
            testemunha: Boolean(entrada.testemunha),
          });
          if (assinatura.comportamento === "recusa") {
            throw new cliente.ErroApiAutentique("HTTP 422", true);
          }
          if (assinatura.comportamento === "incerto") {
            throw new cliente.ErroApiAutentique("rede", false);
          }
          return { documentoId: "doc-demo-abcdef01" };
        },
      };
    },
    obterCobrador: () => {
      throw new Error("o cobrador não entra neste teste");
    },
  };
});

import type { SessaoUsuario } from "@/lib/auth/tipos";
import {
  familiaPorNome,
  PACOTES,
  USUARIOS,
  VERSOES_PACOTE,
} from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  obterLojaVenda,
  reiniciarLojaVenda,
} from "@/lib/dados/demonstracao/venda";
import { reiniciarArmazenamentoMemoria } from "@/lib/armazenamento/memoria";
import { obterArmazenamento } from "@/lib/armazenamento";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  acaoEnviarContrato,
  acaoGerarContrato,
  acaoLiberarEnvio,
  acaoSimularAssinatura,
} from "./acoes";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

async function entrar(nome: string, aal: "aal1" | "aal2" = "aal2") {
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
    aal,
    aalPossivel: "aal2",
  });
}

const cedro = familiaPorNome("Cedro").id;

const endereco = {
  cep: "01310100",
  logradouro: "Rua de Teste",
  numero: "100",
  complemento: "",
  bairro: "Bairro de Teste",
  cidade: "São Paulo",
  uf: "SP",
};

/** Deixa a Família Teste Cedro com o formulário recebido, pronta para gerar. */
function prepararRecebido(recebido = true) {
  const l = obterLoja();
  const lv = obterLojaVenda();
  const o = l.oportunidades.find((x) => x.familiaId === cedro)!;
  o.pipeline = 2;
  o.estagioP2 = "ganho";
  const mae = l.pessoas.find(
    (p) => p.familiaId === cedro && p.papel === "mae",
  )!;
  mae.email = "beatriz.teste@exemplo.invalid";
  lv.dadosContrato[mae.id] = {
    cpf: "11144477735",
    dataNascimento: "1994-05-17",
    endereco,
  };
  lv.enderecoAtendimento[cedro] = endereco;
  const pacote = PACOTES.find((p) => p.nome === "Essencial")!;
  const versao = VERSOES_PACOTE.find(
    (v) => v.pacoteId === pacote.pacoteId && v.vigenciaFim === null,
  )!;
  const id = crypto.randomUUID();
  lv.contratos.push({
    id,
    familiaId: cedro,
    pacoteVersaoId: versao.versaoId,
    contratantePessoaId: mae.id,
    pagadorPessoaId: null,
    testemunhaPessoaId: null,
    valorCentavos: 420000,
    taxaCentavos: 0,
    descontoCentavos: 0,
    parcelas: 3,
    templateVersao: "C-11 antigo",
    tokenHash: recebido ? null : "hash-do-link",
    expiraEm: new Date(Date.now() - 3_600_000).toISOString(),
    status: "aguardando_dados",
    criadoEm: new Date().toISOString(),
  });
  return id;
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaVenda();
  reiniciarArmazenamentoMemoria();
  assinatura.ambienteDeTeste = true;
  assinatura.comportamento = "ok";
  assinatura.chamadas = [];
  await entrar("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

async function etapa() {
  const { contratos } = await obterRepositorios();
  return (await contratos.obterSituacao(cedro)).contrato?.etapa;
}

describe("gerar o contrato", () => {
  it("sem o formulário recebido, diz o que falta e não gera nada", async () => {
    const id = prepararRecebido(false);
    const r = await acaoGerarContrato(cedro, id);
    expect(r.erro).toMatch(/ainda não mandou os dados/);
    expect(await etapa()).toBe("formulario_vencido");
  });

  it("gera o PDF, guarda com nome pelo id e passa para 'gerado'; pode gerar de novo", async () => {
    const id = prepararRecebido();
    const r = await acaoGerarContrato(cedro, id);
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Contrato gerado/);
    expect(await etapa()).toBe("gerado");
    const arquivo = await obterArmazenamento().abrir(`contratos/${id}.pdf`, 60);
    expect(arquivo?.tipo).toBe("bytes");
    if (arquivo?.tipo === "bytes") {
      expect(new TextDecoder().decode(arquivo.bytes.subarray(0, 4))).toBe(
        "%PDF",
      );
    }
    expect((await acaoGerarContrato(cedro, id)).erro).toBeUndefined();
  });

  it("sem MFA ou com o papel errado, o banco recusa com uma frase", async () => {
    const id = prepararRecebido();
    await entrar("Perfil Teste Comercial", "aal1");
    expect((await acaoGerarContrato(cedro, id)).erro).toMatch(
      /não permite esta etapa/,
    );
    await entrar("Perfil Teste Financeiro");
    expect((await acaoGerarContrato(cedro, id)).erro).toMatch(
      /não permite esta etapa/,
    );
  });

  it("dado que não é id é recusado antes de qualquer coisa", async () => {
    expect((await acaoGerarContrato("x", "y")).erro).toMatch(/Atualize a tela/);
  });
});

describe("enviar para a Autentique", () => {
  async function ateGerado() {
    const id = prepararRecebido();
    await acaoGerarContrato(cedro, id);
    return id;
  }

  it("envia o PDF gerado, conclui no banco e move o P2; enviar de novo é recusado", async () => {
    const id = await ateGerado();
    const r = await acaoEnviarContrato(cedro, id);
    expect(r.erro).toBeUndefined();
    expect(r.sucesso).toMatch(/Contrato enviado/);
    expect(await etapa()).toBe("aguardando_assinatura");
    expect(assinatura.chamadas).toHaveLength(1);
    expect(assinatura.chamadas[0]?.nomeDocumento).not.toMatch(/Cedro|Beatriz/);
    expect(assinatura.chamadas[0]?.tamanho).toBeGreaterThan(1000);
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /Gere o contrato antes de enviar/,
    );
    expect(assinatura.chamadas).toHaveLength(1);
  });

  it("a Autentique recusou de vez: nada foi criado lá, a reserva é desfeita e dá para tentar de novo", async () => {
    const id = await ateGerado();
    assinatura.comportamento = "recusa";
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /A Autentique recusou o documento/,
    );
    expect(await etapa()).toBe("gerado");
    assinatura.comportamento = "ok";
    expect((await acaoEnviarContrato(cedro, id)).erro).toBeUndefined();
  });

  it("falha incerta (rede): a reserva fica, o segundo clique não cria outro documento e 'Liberar o envio' destrava", async () => {
    const id = await ateGerado();
    assinatura.comportamento = "incerto";
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /Não deu para saber se a Autentique recebeu/,
    );
    expect(await etapa()).toBe("envio_em_andamento");
    assinatura.comportamento = "ok";
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /envio já está em andamento/,
    );
    expect(assinatura.chamadas).toHaveLength(1);

    expect((await acaoLiberarEnvio(cedro, id)).sucesso).toMatch(/liberado/);
    expect(await etapa()).toBe("gerado");
    expect((await acaoEnviarContrato(cedro, id)).erro).toBeUndefined();
  });

  it("modelo provisório fora do ambiente de teste: recusa, não envia e não deixa reserva", async () => {
    const id = await ateGerado();
    assinatura.ambienteDeTeste = false;
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /ainda é provisório/,
    );
    expect(assinatura.chamadas).toHaveLength(0);
    expect(await etapa()).toBe("gerado");
  });

  it("sem credencial da Autentique: frase clara e sem reserva", async () => {
    const id = await ateGerado();
    assinatura.comportamento = "sem_credencial";
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /ainda não foi configurada/,
    );
    expect(await etapa()).toBe("gerado");
  });

  it("PDF que sumiu do armazenamento: pede para gerar de novo e libera a reserva", async () => {
    const id = await ateGerado();
    reiniciarArmazenamentoMemoria();
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /Gere o contrato de novo/,
    );
    expect(await etapa()).toBe("gerado");
  });

  it("financeiro não envia o contrato", async () => {
    const id = await ateGerado();
    await entrar("Perfil Teste Financeiro");
    expect((await acaoEnviarContrato(cedro, id)).erro).toMatch(
      /não permite esta etapa/,
    );
  });
});

describe("simular a assinatura (só demonstração)", () => {
  it("faz o que o webhook faria: assinado, cobrança e link", async () => {
    const id = prepararRecebido();
    await acaoGerarContrato(cedro, id);
    await acaoEnviarContrato(cedro, id);
    const r = await acaoSimularAssinatura(cedro, id);
    expect(r.erro).toBeUndefined();
    expect(await etapa()).toBe("assinado");
    const lv = obterLojaVenda();
    expect(
      lv.cobrancas.find((c) => c.contratoId === id)?.linkPagamento,
    ).toMatch(/^https:\/\//);
  });

  it("contrato que não foi enviado não assina", async () => {
    const id = prepararRecebido();
    await acaoGerarContrato(cedro, id);
    expect((await acaoSimularAssinatura(cedro, id)).erro).toMatch(
      /Não foi possível simular/,
    );
  });

  it("fora da demonstração a ação não faz nada", async () => {
    const id = prepararRecebido();
    process.env.KZ_DADOS = "";
    expect((await acaoSimularAssinatura(cedro, id)).erro).toBe(
      "Esta ação existe só na demonstração.",
    );
  });
});
