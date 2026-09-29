/**
 * P28 · Sobe o servidor de homologação simulado e aponta o roteiro para ele.
 *
 * É o que `playwright.homologacao-simulada.config.ts` usa como `globalSetup`.
 * Serve para exercitar o `roteiro.spec.ts` inteiro, com o executor de
 * homologação de verdade (HTTP, captura, banco), enquanto o n8n de
 * homologação não existe. Precisa do Postgres local (`KZ_HOMOLOG_PGPORT`).
 *
 * As variáveis `KZ_HML_*` abaixo são só de loopback. Um aceite nunca sai daqui.
 */
import { rmSync } from "node:fs";
import { DIRETORIO_DOS_CASOS } from "../hml/ambiente";
import { conexaoLocalDoAmbiente } from "./ponte-psql";
import { iniciarServidorSimulado } from "./servidor-simulado";
import type { ServidorSimulado } from "./servidor-simulado";

const SEGREDO = "segredo-so-do-servidor-simulado";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const conexao = conexaoLocalDoAmbiente();
  if (!conexao) {
    throw new Error(
      "Defina KZ_HOMOLOG_PGPORT (porta do Postgres de supabase/sem-docker) para rodar o roteiro contra o servidor simulado.",
    );
  }
  rmSync(DIRETORIO_DOS_CASOS, { recursive: true, force: true });
  const servidor: ServidorSimulado = await iniciarServidorSimulado(conexao, {
    segredo: SEGREDO,
  });

  process.env["KZ_HML_SIMULADO"] = "1";
  process.env["KZ_HML_AMBIENTE"] = "homologacao";
  process.env["KZ_HML_WEBHOOK_URL"] = servidor.webhookUrl;
  process.env["KZ_HML_APP_URL"] = servidor.url;
  process.env["KZ_HML_INTERNAL_ROUTES_SECRET"] = SEGREDO;
  process.env["KZ_HML_INSTANCIA"] = "kraamzorg-exemplo";
  process.env["KZ_HML_DATABASE_URL"] =
    `postgres://postgres@127.0.0.1:${conexao.porta}/${conexao.banco}`;
  process.env["KZ_HML_INTERVALO_SEGUNDOS"] = "0.4";
  process.env["KZ_HML_ESTABILIDADE_SEGUNDOS"] = "1";
  process.env["KZ_HML_ESPERA_SILENCIO_SEGUNDOS"] = "2";
  process.env["KZ_HML_ESPERA_MAXIMA_SEGUNDOS"] = "60";
  process.env["KZ_HML_ESPERA_FOLLOWUP_MINUTOS"] = "2";

  return async () => {
    await servidor.fechar();
  };
}
