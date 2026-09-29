// @vitest-environment node
/**
 * P28 · Roteiro da Isadora no simulador do fluxo 3, sobre o banco local.
 *
 * Roda os 24 casos do Apêndice C e os extras que o sistema consegue provar
 * sem modelo de verdade (ver `execucao-local.ts` para o que é real e o que é
 * de mentira). Precisa do Postgres local de `supabase/sem-docker`:
 *
 *   supabase/sem-docker/scripts/iniciar.sh && scripts/resetar.sh
 *   KZ_HOMOLOG_PGPORT=54393 pnpm vitest run tests/agente/local
 *
 * Sem `KZ_HOMOLOG_PGPORT`, a suíte é pulada com a mensagem abaixo, para
 * `pnpm test` continuar verde em máquina sem banco. Com a variável, a suíte
 * exige o banco no ar: banco que não responde é falha, nunca pulo.
 *
 * Com `KZ_HOMOLOG_RELATORIO=<caminho>`, grava o relatório com as transcrições.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CASOS, TOTAL_DO_APENDICE } from "../lib/casos";
import {
  gerarRelatorio,
  montarRelatorioDoCaso,
  separarFalhas,
} from "../lib/relatorio";
import type { RelatorioCaso, ResultadoCaso } from "../lib/tipos";
import { CASOS_SO_SIMULADOR } from "./casos-so-simulador";
import { ExecutorLocal } from "./execucao-local";
import { conexaoLocalDoAmbiente, linhasPsql } from "./ponte-psql";

// Cada caso chama o psql dezenas de vezes; sob carga (pnpm test inteiro) passa dos 5 s padrão do Vitest.
const TEMPO_POR_CASO = 120_000;

const conexao = conexaoLocalDoAmbiente();

if (!conexao) {
  console.info(
    "[roteiro local da Isadora] pulado: defina KZ_HOMOLOG_PGPORT (porta do Postgres de supabase/sem-docker, ex.: 54393) para rodar os casos contra o banco local.",
  );
}

describe.skipIf(!conexao)(
  "roteiro da Isadora no simulador do fluxo 3 (banco local)",
  () => {
    const relatorios: RelatorioCaso[] = [];
    let executor: ExecutorLocal;

    beforeAll(async () => {
      if (!conexao) return;
      // Falha clara se o banco não responder.
      linhasPsql(conexao, "postgres", "select 1 as ok");
      executor = new ExecutorLocal(conexao);
      await executor.iniciar();
    });

    afterAll(async () => {
      await executor?.encerrar();
      const destino = process.env["KZ_HOMOLOG_RELATORIO"];
      if (destino && relatorios.length > 0) {
        mkdirSync(path.dirname(destino), { recursive: true });
        const texto = gerarRelatorio(relatorios, {
          modo: "simulador_local",
          data: new Date().toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          observacao:
            "Banco local de supabase/sem-docker com o seed sintético. O modelo é roteirizado: as regras marcadas como do modelo provam que o sistema aceita e encaminha a resposta certa, não que a Isadora a escreveria.",
        });
        writeFileSync(destino, texto, "utf8");
      }
    });

    const casosLocais = CASOS.filter((c) =>
      (c.ambientes ?? ["real", "local"]).includes("local"),
    );

    it("o Apêndice C tem os 24 casos", () => {
      expect(CASOS.filter((c) => c.grupo === "apendice")).toHaveLength(
        TOTAL_DO_APENDICE,
      );
    });

    for (const caso of casosLocais) {
      it(
        `${caso.id} · ${caso.titulo}`,
        async () => {
          let resultado: ResultadoCaso | undefined;
          let erro: string | undefined;
          try {
            resultado = await executor.executar(caso);
          } catch (e) {
            erro = e instanceof Error ? e.message : String(e);
            resultado = (e as { resultadoParcial?: ResultadoCaso })
              .resultadoParcial;
          }
          if (!resultado) throw new Error(erro ?? "sem resultado");
          const relatorio = montarRelatorioDoCaso(caso, resultado, erro);
          relatorios.push(relatorio);
          const { reais, lacunasResolvidas } = separarFalhas(relatorio);
          // Lacuna declarada que passou a passar: tira de casos.ts (lacunasConhecidas).
          expect({ reais, lacunasResolvidas }).toEqual({
            reais: [],
            lacunasResolvidas: [],
          });
        },
        TEMPO_POR_CASO,
      );
    }

    for (const especial of CASOS_SO_SIMULADOR) {
      it(
        `${especial.caso.id} · ${especial.caso.titulo}`,
        async () => {
          let resultado: ResultadoCaso | undefined;
          let erro: string | undefined;
          try {
            resultado = await executor.executar(especial.caso, especial.opcoes);
          } catch (e) {
            erro = e instanceof Error ? e.message : String(e);
            resultado = (e as { resultadoParcial?: ResultadoCaso })
              .resultadoParcial;
          }
          if (!resultado) throw new Error(erro ?? "sem resultado");
          const relatorio = montarRelatorioDoCaso(
            especial.caso,
            resultado,
            erro,
          );
          relatorios.push(relatorio);
          expect(separarFalhas(relatorio).reais).toEqual([]);
        },
        TEMPO_POR_CASO,
      );
    }

    it("nenhum texto que saiu tem travessão, palavra evitada ou valor fora da tabela, em todos os casos juntos", () => {
      const universais = relatorios
        .flatMap((r) =>
          r.vereditos.filter(
            (v) => v.regra.id.startsWith("U0") || v.regra.id.startsWith("U1"),
          ),
        )
        .filter((v) => v.falhas.length > 0);
      expect(universais).toEqual([]);
    });
  },
);
