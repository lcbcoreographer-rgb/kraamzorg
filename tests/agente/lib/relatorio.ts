/**
 * P28 · Relatório do roteiro (PROMPTS.md P28 item 3): resultado por caso e a
 * transcrição de cada um, em Markdown. Só entra o que o sistema mandou nos
 * casos, todos com dados fictícios; o relatório nunca copia conversa real.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { avaliar } from "./regras";
import type {
  Caso,
  Destino,
  Falha,
  RelatorioCaso,
  ResultadoCaso,
  Veredito,
} from "./tipos";

export type ModoDoRelatorio = "ambiente_real" | "simulador_local";

export function vereditosDe(resultado: ResultadoCaso): Veredito[] {
  return avaliar(resultado);
}

export function passou(relatorio: RelatorioCaso): boolean {
  return (
    !relatorio.erro && relatorio.vereditos.every((v) => v.falhas.length === 0)
  );
}

/**
 * Separa o que reprovou de verdade do que é lacuna conhecida do sistema
 * (`Caso.lacunasConhecidas`). `lacunasResolvidas` são lacunas declaradas que
 * agora passam: hora de tirar a declaração.
 */
export function separarFalhas(relatorio: RelatorioCaso): {
  reais: string[];
  lacunas: string[];
  lacunasResolvidas: string[];
} {
  const declaradas = new Map(
    (relatorio.caso.lacunasConhecidas ?? []).map((l) => [l.regra, l.motivo]),
  );
  const reais: string[] = [];
  const lacunas: string[] = [];
  for (const v of relatorio.vereditos) {
    for (const f of v.falhas)
      (declaradas.has(v.regra.id) ? lacunas : reais).push(
        `${v.regra.id}: ${f.detalhe}`,
      );
  }
  if (relatorio.erro) reais.push(`erro na execução: ${relatorio.erro}`);
  const falhando = new Set(
    relatorio.vereditos
      .filter((v) => v.falhas.length > 0)
      .map((v) => v.regra.id),
  );
  const lacunasResolvidas = [...declaradas.keys()].filter(
    (id) => !falhando.has(id),
  );
  return { reais, lacunas, lacunasResolvidas };
}

const ROTULO_DESTINO: Record<Destino, string> = {
  familia: "Isadora para a família",
  grupo: "Aviso ao grupo da equipe",
  plantao: "Aviso ao plantão",
};

function escapar(texto: string): string {
  return texto.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function contagem(vereditos: Veredito[], origem: "sistema" | "modelo") {
  const doTipo = vereditos.filter((v) => v.regra.origem === origem);
  return {
    total: doTipo.length,
    falhas: doTipo.filter((v) => v.falhas.length > 0).length,
  };
}

export function resumoPorOrigem(relatorios: RelatorioCaso[]) {
  const todos = relatorios.flatMap((r) => r.vereditos);
  return {
    sistema: contagem(todos, "sistema"),
    modelo: contagem(todos, "modelo"),
  };
}

export function gerarRelatorio(
  relatorios: RelatorioCaso[],
  meta: { modo: ModoDoRelatorio; data: string; observacao?: string },
): string {
  const apendice = relatorios.filter((r) => r.caso.grupo === "apendice");
  const aprovadosNoApendice = apendice.filter(passou).length;
  const extras = relatorios.filter((r) => r.caso.grupo !== "apendice");
  const linhas: string[] = [];

  linhas.push(`# Homologação da Isadora · ${meta.data}`);
  linhas.push("");
  linhas.push(
    meta.modo === "ambiente_real"
      ? "Execução no ambiente de homologação: webhook do fluxo 3, captura da UAZAPI e banco de homologação. Modelo de verdade."
      : "Execução no simulador do fluxo 3 sobre o banco local, com o modelo roteirizado. Prova o encanamento do sistema, não o modelo. O aceite de 28 de 28 só vale no ambiente de homologação.",
  );
  if (meta.observacao) linhas.push("", meta.observacao);
  linhas.push("");
  linhas.push(
    `Apêndice C: ${aprovadosNoApendice} de ${apendice.length} casos passaram. Extras: ${extras.filter(passou).length} de ${extras.length}.`,
  );
  const porOrigem = resumoPorOrigem(relatorios);
  linhas.push(
    `Regras do sistema com falha: ${porOrigem.sistema.falhas} de ${porOrigem.sistema.total}. Regras que dependem do modelo com falha: ${porOrigem.modelo.falhas} de ${porOrigem.modelo.total}.`,
  );
  linhas.push("");
  linhas.push("| Caso | Título | Resultado | Falhas |");
  linhas.push("| :-- | :-- | :-- | :-- |");
  for (const r of relatorios) {
    const falhas =
      r.vereditos.flatMap((v) => v.falhas).length + (r.erro ? 1 : 0);
    linhas.push(
      `| ${r.caso.id} (${r.caso.rotulo}) | ${escapar(r.caso.titulo)} | ${passou(r) ? "passou" : "reprovou"} | ${falhas} |`,
    );
  }

  for (const r of relatorios) {
    linhas.push("", `## ${r.caso.id} · ${r.caso.titulo}`, "");
    linhas.push(`Resultado: ${passou(r) ? "passou" : "reprovou"}.`);
    if (r.caso.nota) linhas.push("", `Nota: ${r.caso.nota}`);
    if (r.erro) linhas.push("", `Erro na execução: ${r.erro}`);
    linhas.push("", "Transcrição:", "");
    for (const t of r.resultado.turnos) {
      if (t.enviado)
        linhas.push(`- Turno ${t.turno}, a família: ${escapar(t.enviado)}`);
      for (const e of t.envios) {
        const conteudo =
          e.tipo === "documento" ? `[documento] ${e.arquivo ?? ""}` : e.texto;
        linhas.push(`  - ${ROTULO_DESTINO[e.destino]}: ${escapar(conteudo)}`);
      }
      if (t.envios.length === 0) linhas.push("  - Nada foi enviado.");
    }
    linhas.push("", "Regras:", "");
    for (const v of r.vereditos) {
      const lacuna = r.caso.lacunasConhecidas?.find(
        (l) => l.regra === v.regra.id,
      );
      const marca =
        v.falhas.length === 0 ? "ok" : lacuna ? "lacuna conhecida" : "falhou";
      linhas.push(
        `- ${marca} · ${v.regra.id} (${v.regra.origem}, ${v.regra.gravidade}): ${v.regra.descricao}`,
      );
      for (const f of v.falhas) linhas.push(`  - ${detalhe(f)}`);
      if (lacuna && v.falhas.length > 0)
        linhas.push(`  - Lacuna: ${lacuna.motivo}`);
    }
  }
  linhas.push("");
  return linhas.join("\n");
}

function detalhe(falha: Falha): string {
  return escapar(falha.detalhe);
}

export function montarRelatorioDoCaso(
  caso: Caso,
  resultado: ResultadoCaso,
  erro?: string,
): RelatorioCaso {
  return { caso, resultado, vereditos: vereditosDe(resultado), erro };
}

// ---------------------------------------------------------------------------
// Persistência por caso
// ---------------------------------------------------------------------------
// O Playwright troca de processo depois de um teste que falha, então o que ficou
// na memória se perde. Cada caso grava o próprio resultado num arquivo; o
// relatório e o teste de aceite juntam os arquivos. As funções das regras não
// entram no JSON, e nada disso é preciso para ler o relatório.

export function salvarRelatorio(
  diretorio: string,
  relatorio: RelatorioCaso,
): void {
  mkdirSync(diretorio, { recursive: true });
  writeFileSync(
    path.join(diretorio, `${relatorio.caso.id}.json`),
    JSON.stringify(relatorio),
    "utf8",
  );
}

export function carregarRelatorios(
  diretorio: string,
  ordem: string[],
): RelatorioCaso[] {
  let arquivos: string[];
  try {
    arquivos = readdirSync(diretorio).filter((a) => a.endsWith(".json"));
  } catch {
    return [];
  }
  const lidos = arquivos.map(
    (a) =>
      JSON.parse(
        readFileSync(path.join(diretorio, a), "utf8"),
      ) as RelatorioCaso,
  );
  return lidos.sort(
    (a, b) => ordem.indexOf(a.caso.id) - ordem.indexOf(b.caso.id),
  );
}
