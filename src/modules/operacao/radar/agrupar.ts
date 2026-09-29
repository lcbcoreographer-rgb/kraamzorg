import type {
  OcupacaoSemana,
  Radar,
  RadarFamilia,
  RadarNasceu,
} from "@/lib/dados/tipos-operacao";

/**
 * Preparação do radar de nascimentos para a tela (P36 item 2): filtro por
 * praça, três faixas pela janela da DPP e a lista de pontos de atenção de
 * cada família. Funções puras, testadas sem tela. Nenhum limite mora aqui:
 * a janela, o limite de ocupação e os dias sem contato vêm do banco, que os
 * lê de `parametro`.
 */

export interface PracaDoRadar {
  regiaoId: string;
  regiao: string;
}

export interface RadarAgrupado {
  /** Dentro da janela em torno da DPP: onde a coordenação olha primeiro. */
  naJanela: RadarFamilia[];
  /** Passaram do fim da janela sem nascimento registrado. */
  passaramDaJanela: RadarFamilia[];
  /** Ainda antes da janela. */
  adiante: RadarFamilia[];
}

/** Praças que aparecem no radar, em ordem alfabética, sem repetir. */
export function pracasDoRadar(radar: Radar): PracaDoRadar[] {
  const mapa = new Map<string, string>();
  for (const f of radar.familias) {
    if (f.regiaoId && f.regiao) mapa.set(f.regiaoId, f.regiao);
  }
  for (const o of radar.ocupacao) mapa.set(o.regiaoId, o.regiao);
  return [...mapa.entries()]
    .map(([regiaoId, regiao]) => ({ regiaoId, regiao }))
    .sort((a, b) => a.regiao.localeCompare(b.regiao, "pt-BR"));
}

export function filtrarPorPraca(radar: Radar, regiaoId: string | null): Radar {
  if (!regiaoId) return radar;
  return {
    ...radar,
    familias: radar.familias.filter((f) => f.regiaoId === regiaoId),
    nasceram: radar.nasceram.filter(
      (n: RadarNasceu) => n.regiaoId === regiaoId,
    ),
    ocupacao: radar.ocupacao.filter(
      (o: OcupacaoSemana) => o.regiaoId === regiaoId,
    ),
  };
}

export function agruparRadar(familias: RadarFamilia[]): RadarAgrupado {
  const saida: RadarAgrupado = {
    naJanela: [],
    passaramDaJanela: [],
    adiante: [],
  };
  for (const f of familias) {
    if (f.naJanela) saida.naJanela.push(f);
    else if (f.passouDaJanela) saida.passaramDaJanela.push(f);
    else saida.adiante.push(f);
  }
  return saida;
}

export type TomPonto = "alerta" | "aviso" | "neutro";

export interface PontoDeAtencao {
  chave: string;
  texto: string;
  tom: TomPonto;
}

/**
 * O que a coordenação precisa ver em cada família, em frase curta e na
 * ordem de importância. Sem titular vem primeiro dentro da janela: é a
 * pendência que impede a operação de se preparar.
 */
export function pontosDeAtencao(f: RadarFamilia): PontoDeAtencao[] {
  const pontos: PontoDeAtencao[] = [];
  if (
    !f.titular ||
    ["recusada", "expirada", "cancelada"].includes(f.titular.status)
  ) {
    pontos.push({
      chave: "sem_titular",
      texto:
        f.naJanela || f.passouDaJanela
          ? "Sem titular na janela do parto"
          : "Sem titular",
      tom: f.naJanela || f.passouDaJanela ? "alerta" : "aviso",
    });
  } else if (f.titular.status === "oferecida") {
    pontos.push({
      chave: "titular_sem_resposta",
      texto: "Titular ainda não respondeu",
      tom: "aviso",
    });
  }
  if (
    !f.backup ||
    ["recusada", "expirada", "cancelada"].includes(f.backup.status)
  ) {
    pontos.push({ chave: "sem_backup", texto: "Sem backup", tom: "aviso" });
  } else if (f.backup.status === "oferecida") {
    pontos.push({
      chave: "backup_sem_resposta",
      texto: "Backup ainda não respondeu",
      tom: "neutro",
    });
  }
  if (f.dppSemContato) {
    pontos.push({
      chave: "dpp_sem_contato",
      texto: "Passou da data provável e a família não respondeu",
      tom: "alerta",
    });
  } else if (f.dppSemConfirmacao) {
    pontos.push({
      chave: "dpp_sem_confirmacao",
      texto: "Passou da data provável sem confirmação de nascimento",
      tom: "aviso",
    });
  }
  if (f.checkinPendente) {
    pontos.push({
      chave: "checkin",
      texto: "Check-in da data provável pendente",
      tom: "aviso",
    });
  }
  if (f.semContato && f.diasSemContato !== null) {
    pontos.push({
      chave: "sem_contato",
      texto: `Sem contato há ${f.diasSemContato} ${f.diasSemContato === 1 ? "dia" : "dias"}`,
      tom: "aviso",
    });
  } else if (f.semContato) {
    pontos.push({
      chave: "sem_contato",
      texto: "Sem nenhum contato registrado",
      tom: "aviso",
    });
  }
  return pontos;
}

/** Quantas famílias têm algum ponto de tom alerta: o número da faixa do topo. */
export function contarUrgentes(familias: RadarFamilia[]): number {
  return familias.filter((f) =>
    pontosDeAtencao(f).some((p) => p.tom === "alerta"),
  ).length;
}

export interface LinhaOcupacao {
  regiaoId: string;
  regiao: string;
  semanas: OcupacaoSemana[];
}

/** Ocupação por praça, com as semanas em ordem. */
export function ocupacaoPorPraca(ocupacao: OcupacaoSemana[]): LinhaOcupacao[] {
  const mapa = new Map<string, LinhaOcupacao>();
  for (const o of ocupacao) {
    const linha = mapa.get(o.regiaoId) ?? {
      regiaoId: o.regiaoId,
      regiao: o.regiao,
      semanas: [],
    };
    linha.semanas.push(o);
    mapa.set(o.regiaoId, linha);
  }
  return [...mapa.values()]
    .map((l) => ({
      ...l,
      semanas: l.semanas.sort((a, b) => a.semana.localeCompare(b.semana)),
    }))
    .sort((a, b) => a.regiao.localeCompare(b.regiao, "pt-BR"));
}
