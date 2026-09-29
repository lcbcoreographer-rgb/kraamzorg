/**
 * P28 · Fachada tipada para os módulos .mjs do n8n (build, config, simulador
 * e nomes dos nós). Os arquivos do n8n são JavaScript ESM com estilo próprio e
 * ficam como estão; aqui só se declara o que o roteiro usa deles.
 *
 * O carregamento é por `import()` dinâmico de verdade: o Playwright compila os
 * testes como CommonJS, e um `import` estático de .mjs viraria `require`.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Objeto } from "../lib/tipos";

export interface No {
  name: string;
  type: string;
  parameters: Objeto;
}

export interface Fluxo {
  nodes: No[];
  connections: Objeto;
}

export interface ContextoDeExecucao {
  contexto: unknown;
  marcarExecutado: (nome: string) => void;
}

export type Servico = (
  parametros: Objeto,
  item: Objeto,
  ctx: ContextoDeExecucao,
) => unknown;

export interface ResultadoDaSimulacao {
  saida: Objeto[];
  ordem: string[];
  rodou: (nome: string) => boolean;
}

export interface N8n {
  gerarFluxos(
    config: unknown,
    ambiente: string,
  ): { fluxo1: Fluxo; fluxo2: Fluxo; fluxo3: Fluxo };
  carregarConfig(
    ambiente: string,
    diretorio: string,
    opcoes: { log: () => void },
  ): Promise<{ config: unknown }>;
  simularFluxo(
    fluxo: Fluxo,
    opcoes: {
      entrada: unknown;
      servicos: Record<string, Servico>;
      gatilho?: string | null;
    },
  ): ResultadoDaSimulacao;
  avaliarParametro(valor: unknown, escopo: unknown): unknown;
  erroNoInteiro(mensagem: string): Error;
  escopoDeFerramenta(
    contexto: unknown,
    fromAi: (chave: string) => unknown,
  ): unknown;
  NOS: Record<string, string>;
  NOS_FLUXO2: Record<string, string>;
}

// No Playwright, `new Function` impede o compilador de trocar o import() por require().
// No Vitest, o import() comum é o que funciona (a máquina virtual dele exige o próprio callback).
const importarPuro = new Function("endereco", "return import(endereco)") as (
  endereco: string,
) => Promise<Record<string, unknown>>;
const importar = (endereco: string): Promise<Record<string, unknown>> =>
  process.env["VITEST"]
    ? import(/* @vite-ignore */ endereco)
    : importarPuro(endereco);

let emCache: Promise<N8n> | null = null;

export function carregarN8n(): Promise<N8n> {
  emCache ??= (async () => {
    // Os testes rodam da raiz do repositório (pnpm), no Vitest e no Playwright.
    const raiz = path.join(process.cwd(), "n8n");
    const carregar = (relativo: string) =>
      importar(pathToFileURL(path.join(raiz, relativo)).href);
    const [build, config, simulador, fluxo3, fluxo2] = await Promise.all([
      carregar("build.mjs"),
      carregar("src/lib/config.mjs"),
      carregar("src/lib/simulador.mjs"),
      carregar("src/fluxo-3-agente-isadora.mjs"),
      carregar("src/fluxo-2-pausar-notificar.mjs"),
    ]);
    return {
      gerarFluxos: build["gerarFluxos"],
      carregarConfig: config["carregarConfig"],
      simularFluxo: simulador["simularFluxo"],
      avaliarParametro: simulador["avaliarParametro"],
      erroNoInteiro: simulador["erroNoInteiro"],
      escopoDeFerramenta: simulador["escopoDeFerramenta"],
      NOS: fluxo3["NOS"],
      NOS_FLUXO2: fluxo2["NOS"],
    } as unknown as N8n;
  })();
  return emCache;
}
