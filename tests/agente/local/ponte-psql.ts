/**
 * P28 · Ponte síncrona para o Postgres local (supabase/sem-docker), via psql.
 *
 * O simulador do fluxo 3 é síncrono (`n8n/src/lib/simulador.mjs`), então os
 * nós Postgres precisam de uma resposta na hora. `psql` resolve isso sem
 * dependência nova: cada chamada abre uma conexão como o papel pedido
 * (`n8n_agente` para o que o fluxo faz de verdade, `postgres` para o preparo
 * e a leitura do roteiro) e devolve as linhas como JSON.
 *
 * Só fala com 127.0.0.1. Recusa qualquer outro host: este arquivo nunca deve
 * encostar em homologação nem em produção.
 */
import { execFileSync } from "node:child_process";
import { envelopar } from "../lib/sql";
import type { Consulta } from "../lib/sql";
import type { Objeto } from "../lib/tipos";

export interface ConexaoLocal {
  porta: number;
  banco: string;
}

export function conexaoLocalDoAmbiente(): ConexaoLocal | null {
  const porta = Number(process.env["KZ_HOMOLOG_PGPORT"] ?? "");
  if (!Number.isInteger(porta) || porta <= 0) return null;
  return { porta, banco: process.env["KZ_HOMOLOG_PGDATABASE"] ?? "kraamzorg" };
}

export function linhasPsql(
  conexao: ConexaoLocal,
  usuario: string,
  sql: string,
): Objeto[] {
  let saida: string;
  try {
    saida = execFileSync(
      "psql",
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(conexao.porta),
        "-U",
        usuario,
        "-d",
        conexao.banco,
        "-X",
        "-A",
        "-t",
        "-q",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        envelopar(sql),
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
  } catch (erro) {
    const detalhe = (erro as { stderr?: string }).stderr ?? String(erro);
    throw new Error(detalhe.trim().split("\n")[0] || "psql falhou");
  }
  const texto = saida.trim();
  return texto === "" ? [] : (JSON.parse(texto) as Objeto[]);
}

/** Consulta do roteiro (leitura e preparo), como superusuário local. */
export function consultaLocal(conexao: ConexaoLocal): Consulta {
  return { linhas: async (sql) => linhasPsql(conexao, "postgres", sql) };
}
