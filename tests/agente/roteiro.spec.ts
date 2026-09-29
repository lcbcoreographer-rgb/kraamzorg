/**
 * P28 · Homologação automatizada da Isadora (PRD 11.5, Apêndice C).
 *
 * Manda ao webhook do fluxo 3 de homologação payloads iguais aos da UAZAPI
 * (texto, áudio com transcrição simulada, foto com legenda, CPF, figurinha),
 * uma conversa nova por caso, com `envioSimulado` ligado, e confere:
 *
 * - o que a Isadora, o grupo da equipe e o plantão receberam (captura da
 *   UAZAPI em `/api/teste/uazapi`);
 * - o estado no banco (transferências, marcos, pausa, freio, modo);
 * - o conteúdo (valores só da tabela, apresentação antes do valor, sem
 *   travessão, sem pedido de documento, sem promessa).
 *
 * Confere regra, não frase: a voz da Isadora mudou na 4.2-rc4.
 *
 * Sem as variáveis do ambiente (`hml/ambiente.ts`), os casos são pulados com a
 * lista do que falta. O aceite de 24 de 24 só vale rodando aqui, contra o
 * ambiente real. Como rodar: docs/homologacao/isadora-MODELO.md.
 *
 *   pnpm e2e:homologacao
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { CASOS, TOTAL_DO_APENDICE } from "./lib/casos";
import { regrasUniversais } from "./lib/regras";
import {
  carregarRelatorios,
  gerarRelatorio,
  montarRelatorioDoCaso,
  passou,
  salvarRelatorio,
  separarFalhas,
} from "./lib/relatorio";
import { ErroDePreCondicao } from "./lib/preparo";
import type { RelatorioCaso, ResultadoCaso } from "./lib/tipos";
import { DIRETORIO_DOS_CASOS, lerAmbiente } from "./hml/ambiente";
import { ExecutorReal } from "./hml/driver-webhook";

const leitura = lerAmbiente();
const ambiente = leitura.ok ? leitura.ambiente : null;
const ordemDosCasos = CASOS.map((c) => c.id);
// Contra o servidor simulado local (global-setup-simulado.ts), o roteiro prova o executor, não a Isadora:
// a lacuna declarada não derruba a rodada e o aceite de 24 de 24 não se aplica.
const simulado = process.env["KZ_HML_SIMULADO"] === "1";

test.describe("catálogo do roteiro", () => {
  test("tem os 24 casos do Apêndice C, na ordem, e as regras têm identificador único", () => {
    const apendice = CASOS.filter((c) => c.grupo === "apendice");
    expect(apendice).toHaveLength(TOTAL_DO_APENDICE);
    expect(apendice.map((c) => c.rotulo)).toEqual(
      Array.from({ length: TOTAL_DO_APENDICE }, (_, i) => String(i + 1)),
    );
    expect(new Set(CASOS.map((c) => c.id)).size).toBe(CASOS.length);
    for (const caso of CASOS) {
      const ids = [...regrasUniversais(), ...caso.regras].map((r) => r.id);
      expect(new Set(ids).size, `regras repetidas em ${caso.id}`).toBe(
        ids.length,
      );
    }
  });
});

test.describe("roteiro da Isadora contra a homologação", () => {
  test.skip(!ambiente, leitura.ok ? "" : leitura.motivo);

  let executor: ExecutorReal | undefined;

  test.beforeAll(async () => {
    if (!ambiente) return;
    executor = new ExecutorReal(ambiente);
    await executor.iniciar();
  });

  test.afterAll(async () => {
    await executor?.encerrar();
    // O Playwright troca de processo depois de um teste que falha: o relatório junta os arquivos por caso.
    const relatorios = carregarRelatorios(DIRETORIO_DOS_CASOS, ordemDosCasos);
    if (!ambiente || relatorios.length === 0) return;
    const data = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    const destino =
      ambiente.relatorio ??
      path.join("test-results", "homologacao", `isadora-${data}.md`);
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(
      destino,
      gerarRelatorio(relatorios, {
        modo: simulado ? "simulador_local" : "ambiente_real",
        data: data.split("-").reverse().join("/"),
      }),
      "utf8",
    );
  });

  for (const caso of CASOS.filter((c) =>
    (c.ambientes ?? ["real", "local"]).includes("real"),
  )) {
    test(`${caso.id} · ${caso.titulo}`, async () => {
      test.setTimeout(caso.demorado ? 75 * 60_000 : 10 * 60_000);
      test.skip(
        caso.demorado === true && ambiente?.pularFollowup === true,
        "KZ_HML_PULAR_FOLLOWUP=1: o caso do follow-up espera o agendador de 30 minutos e foi pulado de propósito. O aceite de 24 de 24 exige rodá-lo.",
      );
      if (!executor) throw new Error("executor não iniciado");

      let resultado: ResultadoCaso | undefined;
      let erro: string | undefined;
      try {
        resultado = await executor.executar(caso);
      } catch (e) {
        erro =
          e instanceof ErroDePreCondicao
            ? `Pré-condição do ambiente: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
      }
      if (!resultado) throw new Error(erro ?? "sem resultado");
      const relatorio: RelatorioCaso = montarRelatorioDoCaso(
        caso,
        resultado,
        erro,
      );
      salvarRelatorio(DIRETORIO_DOS_CASOS, relatorio);
      const { reais, lacunas, lacunasResolvidas } = separarFalhas(relatorio);
      if (simulado) {
        expect(
          { reais, lacunasResolvidas },
          `Falhas do caso ${caso.id}`,
        ).toEqual({ reais: [], lacunasResolvidas: [] });
      } else {
        expect({ reais, lacunas }, `Falhas do caso ${caso.id}`).toEqual({
          reais: [],
          lacunas: [],
        });
      }
    });
  }

  test("aceite: 24 de 24 no Apêndice C", () => {
    test.skip(
      simulado,
      "Servidor simulado: o aceite de 24 de 24 só vale no ambiente de homologação real.",
    );
    const apendice = carregarRelatorios(
      DIRETORIO_DOS_CASOS,
      ordemDosCasos,
    ).filter((r) => r.caso.grupo === "apendice");
    const reprovados = apendice.filter((r) => !passou(r)).map((r) => r.caso.id);
    expect({ rodados: apendice.length, reprovados }).toEqual({
      rodados: TOTAL_DO_APENDICE,
      reprovados: [],
    });
  });
});
