// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { criarRepositoriosDemonstracao } from "@/lib/dados/demonstracao";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import {
  obterLojaRelacao,
  reiniciarLojaRelacao,
} from "@/lib/dados/demonstracao/relacao-loja";
import { formatarMoeda } from "@/lib/formatacao";
import { ROTULO_ORIGEM } from "@/modules/relacao/rotulos";
import { criarModeloDemonstracao } from "./modelo-demonstracao";
import {
  perguntarAoCopiloto,
  termoAssistencial,
  type EscolhaDoModelo,
  type ModeloCopiloto,
} from "./orquestrador";

/**
 * Aceite do P48: dez perguntas com resposta certa (conferida contra um
 * cálculo independente sobre as mesmas fixtures), pergunta assistencial
 * recusada ao comercial, desligado sem modelo, função inventada que nunca
 * executa e orçamento do mês. O modelo é o dublê de demonstração; o contrato
 * do modelo de verdade é coberto em modelo-openai.test.ts.
 */

const HOJE = "2026-09-30";

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

function repos(papel: Papel) {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal: "aal2",
  });
}

async function perguntar(
  papel: Papel,
  pergunta: string,
  modelo: ModeloCopiloto | null = criarModeloDemonstracao(),
) {
  return perguntarAoCopiloto({
    pergunta,
    hoje: HOJE,
    papeis: [papel],
    repositorio: repos(papel).relacao.copiloto,
    modelo,
  });
}

/** Fatos de uma resposta certa; falha com a resposta inteira se não foi respondida. */
async function fatosDe(papel: Papel, pergunta: string): Promise<string> {
  const r = await perguntar(papel, pergunta);
  if (r.situacao !== "respondida") {
    throw new Error(`${pergunta} -> ${JSON.stringify(r)}`);
  }
  return r.fatos.join(" ");
}

// Cálculo independente sobre as fixtures (não passa pela função do repositório).
const leads = () => obterLojaRelacao().leads;
const mes = (l: { criadoEm: string }, prefixo: string) =>
  l.criadoEm.startsWith(prefixo);

describe("dez perguntas com resposta certa (P48)", () => {
  it("1. quantos leads entraram em setembro", async () => {
    const n = leads().filter((l) => mes(l, "2026-09")).length;
    const fatos = await fatosDe(
      "diretoria",
      "Quantos leads entraram em setembro?",
    );
    expect(fatos).toContain(`${n} leads entraram de 01/09/2026 a 30/09/2026`);
  });

  it("2. quantos leads entraram em agosto", async () => {
    const n = leads().filter((l) => mes(l, "2026-08")).length;
    const fatos = await fatosDe(
      "comercial",
      "Quantos leads tivemos em agosto?",
    );
    expect(fatos).toContain(`${n} leads entraram de 01/08/2026 a 31/08/2026`);
  });

  it("3. quantos qualificados em agosto", async () => {
    const agosto = leads().filter((l) => mes(l, "2026-08"));
    const qual = agosto.filter((l) => l.qualificado || l.ganho).length;
    const fatos = await fatosDe(
      "diretoria",
      "Qual a taxa de conversão de agosto, quantos qualificados?",
    );
    expect(fatos).toContain(`${qual} qualificados`);
  });

  it("4. quantos contratos fechados em agosto", async () => {
    const ganhos = leads().filter((l) => mes(l, "2026-08") && l.ganho).length;
    const fatos = await fatosDe(
      "diretoria",
      "Quantos contratos fechamos dos leads de agosto?",
    );
    expect(fatos).toContain(`${ganhos} com contrato`);
  });

  it("5. quantos perdidos em agosto", async () => {
    const perdidos = leads().filter(
      (l) => mes(l, "2026-08") && l.perdido,
    ).length;
    expect(perdidos).toBeGreaterThan(0);
    const fatos = await fatosDe(
      "diretoria",
      "Quantos leads perdidos em agosto na conversão?",
    );
    expect(fatos).toContain(`${perdidos} perdido`);
  });

  it("6. receita de setembro", async () => {
    const soma = leads()
      .flatMap((l) => l.pagamentos)
      .filter((p) => p.data.startsWith("2026-09"))
      .reduce((s, p) => s + p.valorCentavos, 0);
    const fatos = await fatosDe("diretoria", "Qual foi a receita de setembro?");
    expect(fatos).toContain(formatarMoeda(soma));
  });

  it("7. receita do ano inteiro, por mês", async () => {
    const pagamentos = leads().flatMap((l) => l.pagamentos);
    const total = pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
    const fatos = await fatosDe("diretoria", "Qual a receita deste ano?");
    expect(fatos).toContain(formatarMoeda(total));
    expect(fatos).toContain("Por mês:");
  });

  it("8. o que está em aberto e vencido", async () => {
    const { emAbertoCentavos, vencidoCentavos } =
      obterLojaRelacao().cobrancasAbertas;
    const fatos = await fatosDe(
      "diretoria",
      "Quanto está em aberto e vencido nas cobranças?",
    );
    expect(fatos).toContain(
      `Em aberto: ${formatarMoeda(emAbertoCentavos)}; vencido: ${formatarMoeda(vencidoCentavos)}.`,
    );
  });

  it("9. leads por origem em setembro", async () => {
    const setembro = leads().filter((l) => mes(l, "2026-09"));
    const meta = setembro.filter((l) => l.origem === "meta_ads").length;
    const fatos = await fatosDe(
      "diretoria",
      "De onde vieram os leads de setembro, por origem?",
    );
    expect(fatos).toContain(`${setembro.length} leads entraram`);
    expect(fatos).toContain(`${ROTULO_ORIGEM.meta_ads} ${meta} (`);
  });

  it("10. pipeline 1 tem o total das oportunidades do estágio", async () => {
    const r = await perguntar("comercial", "Como está o pipeline de entrada?");
    expect(r.situacao).toBe("respondida");
    if (r.situacao !== "respondida") return;
    expect(r.ferramenta).toBe("copiloto_pipeline");
    expect(r.fatos[0]).toMatch(
      /^O pipeline 1 \(entrada e qualificação\) tem \d+ oportunidades?\.$/,
    );
  });
});

describe("limites do copiloto (P48)", () => {
  it("pergunta sobre registro assistencial é recusada ao comercial antes de qualquer modelo", async () => {
    const escolher = vi.fn();
    const modelo: ModeloCopiloto = { escolher, redigir: vi.fn() };
    const r = await perguntar(
      "comercial",
      "Qual o peso do bebê da Aurora no checklist de ontem?",
      modelo,
    );
    expect(r).toMatchObject({ situacao: "recusada", motivo: "assistencial" });
    expect(escolher).not.toHaveBeenCalled();
    // E a tentativa fica no log.
    const historico = await repos("diretoria").relacao.copiloto.historico(10);
    expect(historico[0]).toMatchObject({
      situacao: "recusada",
      motivo: "assistencial",
    });
  });

  it("a mesma recusa vale para a diretoria", async () => {
    const r = await perguntar(
      "diretoria",
      "Mostre o prontuário e a evolução de uma família",
    );
    expect(r).toMatchObject({ situacao: "recusada", motivo: "assistencial" });
  });

  it("comercial não vê receita: recusa por permissão, não por erro", async () => {
    const r = await perguntar("comercial", "Qual foi a receita de setembro?");
    expect(r).toMatchObject({ situacao: "recusada", motivo: "sem_permissao" });
  });

  it("sem modelo (sem chave) o copiloto está desligado e não chama nada", async () => {
    const r = await perguntar(
      "diretoria",
      "Quantos leads entraram em setembro?",
      null,
    );
    expect(r.situacao).toBe("desligado");
  });

  it("função inventada pelo modelo nunca executa", async () => {
    const executar = vi.spyOn(repos("diretoria").relacao.copiloto, "executar");
    const inventa: ModeloCopiloto = {
      async escolher(): Promise<EscolhaDoModelo> {
        return {
          tipo: "ferramenta",
          ferramenta: "assistencial.ler_checklist",
          parametros: {},
          uso: { entrada: 1, saida: 1 },
        };
      },
      redigir: vi.fn(),
    };
    const r = await perguntarAoCopiloto({
      pergunta: "Quantos leads entraram em setembro?",
      hoje: HOJE,
      papeis: ["diretoria"],
      repositorio: {
        ...repos("diretoria").relacao.copiloto,
        executar,
      },
      modelo: inventa,
    });
    expect(r).toMatchObject({ situacao: "recusada", motivo: "fora_do_escopo" });
    expect(executar).not.toHaveBeenCalled();
  });

  it("pergunta vazia e pergunta longa demais são recusadas com uma frase clara", async () => {
    expect(await perguntar("diretoria", "   ")).toMatchObject({
      situacao: "recusada",
      motivo: "vazia",
    });
    const longa = await perguntar("diretoria", "a ".repeat(400));
    expect(longa).toMatchObject({ situacao: "recusada", motivo: "longa" });
  });

  it("orçamento do mês esgotado: não chama o modelo e diz o que fazer", async () => {
    const copiloto = repos("diretoria").relacao.copiloto;
    const config = await copiloto.config();
    expect(config.orcamentoMensalCentavos).not.toBeNull();
    const escolher = vi.fn();
    const r = await perguntarAoCopiloto({
      pergunta: "Quantos leads entraram em setembro?",
      hoje: HOJE,
      papeis: ["diretoria"],
      repositorio: {
        ...copiloto,
        config: async () => ({
          ...config,
          custoMesCentavos: config.orcamentoMensalCentavos ?? 0,
        }),
      },
      modelo: { escolher, redigir: vi.fn() },
    });
    expect(r.situacao).toBe("orcamento");
    expect(escolher).not.toHaveBeenCalled();
  });

  it("o custo do mês aparece na configuração e cresce com o uso", async () => {
    const copiloto = repos("diretoria").relacao.copiloto;
    const antes = await copiloto.config();
    await copiloto.registrar({
      pergunta: "Quantos leads entraram em setembro?",
      ferramenta: "copiloto_conversao",
      parametros: {},
      situacao: "respondida",
      tokensEntrada: 2_000_000,
      tokensSaida: 1_000_000,
    });
    const depois = await copiloto.config();
    expect(depois.perguntasMes).toBe(antes.perguntasMes + 1);
    expect(depois.custoMesCentavos).toBeGreaterThan(antes.custoMesCentavos);
  });
});

describe("termoAssistencial", () => {
  it("ignora acento, caixa e pontuação", () => {
    const termos = ["prontuario", "peso do bebe"];
    expect(termoAssistencial("Abra o PRONTUÁRIO, por favor", termos)).toBe(
      "prontuario",
    );
    expect(termoAssistencial("qual o peso do bebê?", termos)).toBe(
      "peso do bebe",
    );
    expect(
      termoAssistencial("quantos leads vieram do Instagram?", termos),
    ).toBeNull();
  });
});
