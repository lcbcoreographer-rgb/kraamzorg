import { diferencaEmDias, inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import type {
  CoberturaBackup,
  FaixaNascimento,
  NivelCapacidade,
  OrigemDistribuicao,
  SemanaCapacidade,
} from "@/lib/dados/tipos-gestao";

/**
 * Capacidade probabilística (P45, PRD 10.2, Fase 3): a mesma conta de
 * privado.capacidade_semanal (0026_gestao.sql), para o modo demonstração e
 * para a prova cruzada dos dois lados. Nada aqui inventa número: o limite de
 * alerta, a probabilidade de sobrevenda, as visitas por dia, a reserva de
 * backup e as faixas do nascimento entram por parâmetro (`parametro` no banco).
 */

export interface ConfigDistribuicao {
  versao: string | null;
  descricao: string | null;
  /** Partos próprios necessários para trocar a referência pelo histórico. */
  historicoMinimo: number;
  /** Dias entre o nascimento e o início do atendimento (alta). */
  deslocamentoInicioDias: number;
  faixas: FaixaNascimento[];
}

export interface PartoHistorico {
  dpp: string;
  nascimento: string;
}

export interface PesoDia {
  deslocamento: number;
  peso: number;
}

export interface ParametrosCapacidade {
  alertaPct: number;
  sobrevendaProbPct: number;
  visitasPorDia: number;
  reservaProfissionais: number;
}

export interface ContratoCapacidade {
  familiaId: string;
  regiaoId: string;
  dias: number;
  /** Início conhecido (fato): inicio_efetivo, data_inicio_efetivo ou data_alta. */
  inicioFato: string | null;
  dpp: string | null;
  dataNascimento: string | null;
}

export interface RegiaoEntrada {
  id: string;
  nome: string;
  limiteFamilias: number;
}

export interface ProfissionalCapacidade {
  regioes: string[];
  bloqueios: { inicio: string; fim: string }[];
}

export interface Cenario {
  familiaId: string;
  regiaoId: string;
  dias: number;
  inicio: string;
  peso: number;
}

/** Distribuição do número de sucessos entre eventos independentes. pmf[k] = P(N = k). */
export function poissonBinomial(probabilidades: number[]): number[] {
  let pmf = [1];
  for (const bruto of probabilidades) {
    const p = Math.min(Math.max(bruto, 0), 1);
    const novo = new Array<number>(pmf.length + 1).fill(0);
    pmf.forEach((massa, k) => {
      novo[k] = (novo[k] ?? 0) + massa * (1 - p);
      novo[k + 1] = (novo[k + 1] ?? 0) + massa * p;
    });
    pmf = novo;
  }
  return pmf;
}

/**
 * Distribuição do nascimento em relação à DPP, por dia, somando 1. Com partos
 * próprios suficientes (historicoMinimo), vale o histórico; senão, as faixas
 * de referência do parâmetro, cada faixa espalhada por igual entre os seus dias.
 */
export function distribuicaoNascimento(
  config: ConfigDistribuicao,
  historico: PartoHistorico[] = [],
): PesoDia[] {
  const contarNaFaixa = (f: FaixaNascimento) =>
    historico.filter((h) => {
      const d = diferencaEmDias(h.dpp, h.nascimento);
      return d >= f.de && d <= f.ate;
    }).length;
  const emFaixas = historico.filter((h) => {
    const d = diferencaEmDias(h.dpp, h.nascimento);
    return config.faixas.some((f) => d >= f.de && d <= f.ate);
  }).length;
  const usaHistorico =
    config.historicoMinimo > 0 && emFaixas >= config.historicoMinimo;

  const brutos: PesoDia[] = [];
  for (const f of config.faixas) {
    const pesoFaixa = usaHistorico ? contarNaFaixa(f) : f.peso;
    const porDia = pesoFaixa / (f.ate - f.de + 1);
    if (porDia <= 0) continue;
    for (let d = f.de; d <= f.ate; d += 1) {
      brutos.push({ deslocamento: d, peso: porDia });
    }
  }
  const total = brutos.reduce((soma, x) => soma + x.peso, 0);
  if (total <= 0) return [];
  return brutos.map((x) => ({ ...x, peso: x.peso / total }));
}

/** De onde vem a distribuição em uso, para a tela mostrar. */
export function origemDistribuicao(
  config: ConfigDistribuicao,
  historico: PartoHistorico[] = [],
): OrigemDistribuicao {
  const emFaixas = historico.filter((h) => {
    const d = diferencaEmDias(h.dpp, h.nascimento);
    return config.faixas.some((f) => d >= f.de && d <= f.ate);
  }).length;
  return {
    modelo: "probabilistico",
    fonte:
      config.historicoMinimo > 0 && emFaixas >= config.historicoMinimo
        ? "historico"
        : "referencia",
    versao: config.versao,
    descricao: config.descricao,
    historicoN: emFaixas,
    historicoMinimo: config.historicoMinimo,
    faixas: config.faixas,
  };
}

/**
 * Inícios possíveis do atendimento de cada contrato, com o peso de cada um
 * (soma 1 por família). Fato vence estimativa: início conhecido (peso 1);
 * nascimento registrado (nascimento mais o deslocamento); DPP (distribuição
 * condicionada a o nascimento ainda não ter acontecido).
 */
export function cenarios(
  contratos: ContratoCapacidade[],
  dist: PesoDia[],
  hoje: string,
  deslocamentoInicio: number,
): Cenario[] {
  const saida: Cenario[] = [];
  for (const c of contratos) {
    const base = { familiaId: c.familiaId, regiaoId: c.regiaoId, dias: c.dias };
    if (c.inicioFato) {
      saida.push({ ...base, inicio: c.inicioFato, peso: 1 });
    } else if (c.dataNascimento) {
      saida.push({
        ...base,
        inicio: somarDias(c.dataNascimento, deslocamentoInicio),
        peso: 1,
      });
    } else if (c.dpp && dist.length > 0) {
      const dpp = c.dpp;
      const vivos = dist.filter((d) => somarDias(dpp, d.deslocamento) >= hoje);
      if (vivos.length === 0) {
        saida.push({
          ...base,
          inicio: somarDias(hoje, deslocamentoInicio),
          peso: 1,
        });
      } else {
        const total = vivos.reduce((soma, d) => soma + d.peso, 0);
        for (const d of vivos) {
          saida.push({
            ...base,
            inicio: somarDias(dpp, d.deslocamento + deslocamentoInicio),
            peso: d.peso / total,
          });
        }
      }
    }
  }
  return saida;
}

function arredondar(valor: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

export interface SemanaRegiao extends SemanaCapacidade {
  regiaoId: string;
  regiao: string;
  limiteFamilias: number;
}

export interface EntradaCapacidade {
  contratos: ContratoCapacidade[];
  regioes: RegiaoEntrada[];
  profissionais: ProfissionalCapacidade[];
  dist: PesoDia[];
  hoje: string;
  /** Primeiro e último dia do recorte; as semanas são as segundas-feiras entre eles. */
  de: string;
  ate: string;
  deslocamentoInicio: number;
  parametros: ParametrosCapacidade;
  /** Restringe a uma região. */
  regiaoId?: string | null;
}

/** Capacidade por região e semana. Mesmas regras de privado.capacidade_semanal. */
export function capacidadeSemanal(e: EntradaCapacidade): SemanaRegiao[] {
  const { parametros: p } = e;
  const semanas: string[] = [];
  for (
    let s = inicioDaSemana(e.de);
    s <= inicioDaSemana(e.ate);
    s = somarDias(s, 7)
  ) {
    semanas.push(s);
  }

  const regioes = e.regioes
    .filter((r) => r.limiteFamilias > 0)
    .filter((r) => !e.regiaoId || r.id === e.regiaoId)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // probabilidade e dias esperados por família e semana
  const porFamilia = new Map<
    string,
    { regiaoId: string; p: number; dias: number }
  >();
  for (const cn of cenarios(
    e.contratos,
    e.dist,
    e.hoje,
    e.deslocamentoInicio,
  )) {
    const contagem = new Map<string, number>();
    for (let d = 0; d < cn.dias; d += 1) {
      const sem = inicioDaSemana(somarDias(cn.inicio, d));
      contagem.set(sem, (contagem.get(sem) ?? 0) + 1);
    }
    for (const [sem, dias] of contagem) {
      const chave = `${cn.familiaId}|${sem}`;
      const atual = porFamilia.get(chave) ?? {
        regiaoId: cn.regiaoId,
        p: 0,
        dias: 0,
      };
      atual.p += cn.peso;
      atual.dias += cn.peso * dias;
      porFamilia.set(chave, atual);
    }
  }
  const porRegiaoSemana = new Map<
    string,
    { ps: number[]; fam: number; dias: number }
  >();
  for (const [chave, v] of porFamilia) {
    const sem = chave.split("|")[1] ?? "";
    const k = `${v.regiaoId}|${sem}`;
    const atual = porRegiaoSemana.get(k) ?? { ps: [], fam: 0, dias: 0 };
    const pFam = Math.min(v.p, 1);
    atual.ps.push(pFam);
    atual.fam += pFam;
    atual.dias += v.dias;
    porRegiaoSemana.set(k, atual);
  }

  const saida: SemanaRegiao[] = [];
  for (const r of regioes) {
    const pros = e.profissionais.filter((x) => x.regioes.includes(r.id));
    for (const sem of semanas) {
      const a = porRegiaoSemana.get(`${r.id}|${sem}`) ?? {
        ps: [],
        fam: 0,
        dias: 0,
      };
      const pmf = poissonBinomial(a.ps);
      let acum = 0;
      let p90: number | null = null;
      let excesso = 0;
      pmf.forEach((massa, k) => {
        acum += massa;
        if (p90 === null && acum >= 0.9 - 1e-9) p90 = k;
        if (k > r.limiteFamilias) excesso += massa;
      });
      const familiasP90 = p90 ?? pmf.length - 1;

      let livres = 0;
      for (const pr of pros) {
        let bloqueados = 0;
        for (let k = 0; k < 7; k += 1) {
          const dia = somarDias(sem, k);
          if (pr.bloqueios.some((b) => dia >= b.inicio && dia <= b.fim)) {
            bloqueados += 1;
          }
        }
        livres += 7 - bloqueados;
      }
      const capacidadeEquipe = Math.floor((livres * p.visitasPorDia) / 7);
      const cobertura: CoberturaBackup =
        capacidadeEquipe < familiasP90
          ? "insuficiente"
          : capacidadeEquipe <
              familiasP90 + p.reservaProfissionais * p.visitasPorDia
            ? "sem_reserva"
            : "ok";
      const ocupacao = arredondar((100 * a.dias) / (r.limiteFamilias * 7), 1);
      const nivel: NivelCapacidade =
        100 * excesso >= p.sobrevendaProbPct
          ? "sobrevenda"
          : ocupacao >= p.alertaPct || cobertura !== "ok"
            ? "atencao"
            : "folga";
      saida.push({
        regiaoId: r.id,
        regiao: r.nome,
        limiteFamilias: r.limiteFamilias,
        semana: sem,
        ocupacaoPct: ocupacao,
        familiasEsperadas: arredondar(a.fam, 2),
        familiasP90,
        probExcessoPct: arredondar(100 * excesso, 1),
        profissionaisAtivas: pros.length,
        capacidadeEquipe,
        cobertura,
        nivel,
      });
    }
  }
  return saida;
}
