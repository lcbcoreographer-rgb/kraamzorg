import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import { hojeEmBrasilia, inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import {
  capacidadeSemanal,
  distribuicaoNascimento,
  origemDistribuicao,
  type SemanaRegiao,
} from "@/lib/gestao/capacidade";
import {
  calcularDre,
  calcularInadimplencia,
  calcularLancamentos,
  calcularPagamentoEquipe,
  calcularPrevisao,
  conciliarExtrato,
  evolucoesEnviadas,
  inicioDoMes,
  type DespesaBase,
  type LinhaParaConferir,
} from "@/lib/gestao/financeiro";
import { calcularPainel, type BasePainel } from "@/lib/gestao/painel";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  CapacidadeVisao,
  Conferencia,
  Despesa,
  ExtratoVisao,
  GestaoRepositorio,
  ImportacaoExtrato,
  LinhaExtrato,
  PagamentoEquipe,
  PedidoDespesa,
  ResultadoImportacaoExtrato,
} from "../tipos-gestao";
import { CATEGORIAS_DESPESA } from "../tipos-gestao";
import {
  CONFIG_DISTRIBUICAO,
  ID_ACOMP_PAGO,
  ID_PROF_BETA,
  PARAMETROS_GESTAO,
  criarDadosGestaoDemo,
  type DadosGestaoDemo,
  type DespesaDemoGestao,
} from "./gestao-fixtures";

/**
 * Gestão da Fase 3 no modo demonstração (P45, P46 e P52): as mesmas regras
 * das funções api.* da 0026_gestao.sql sobre uma loja em memória, usando as
 * contas de src/lib/gestao (as mesmas que o teste cruza com o pgTAP 026).
 * A prova de permissão continua sendo o pgTAP; aqui o recorte é o mesmo,
 * simplificado, para as telas e o e2e rodarem sem Supabase.
 */

interface PagoDemo {
  pagoEm: string;
  despesaId: string;
  visitas: number;
  horas: number;
  valorHoraCentavos: number | null;
  valorHorasCentavos: number;
  ajudaDeslocamentoCentavos: number;
  totalCentavos: number;
}

interface LinhaExtratoLoja extends LinhaParaConferir {
  importacaoId: string;
  chave: string;
  criadoEm: string;
}

export interface LojaGestao extends DadosGestaoDemo {
  pagos: Map<string, PagoDemo>;
  idsPagamento: Map<string, string>;
  importacoes: (ImportacaoExtrato & { hash: string })[];
  linhasExtrato: LinhaExtratoLoja[];
  proximo: number;
}

const uuid = (grupo: number, n: number) =>
  `00000000-0000-4000-8b${String(grupo).padStart(2, "0")}-${String(n).padStart(12, "0")}`;

function pagamentoInicial(l: LojaGestao): void {
  // um pagamento já feito, para a tela mostrar os três estados
  const lista = pagamentosCalculados(l);
  const alvo = lista.find(
    (p) =>
      p.acompanhamentoId === ID_ACOMP_PAGO && p.profissionalId === ID_PROF_BETA,
  );
  if (!alvo) return;
  const dia = somarDias(inicioDoMes(l.hoje), -35);
  const despesaId = uuid(1, l.proximo++);
  l.despesas.push({
    id: despesaId,
    data: dia,
    categoria: "equipe_assistencial",
    descricao: "Pagamento da equipe assistencial",
    fornecedor: null,
    valorCentavos: alvo.totalCentavos,
    canal: null,
    pagamentoEquipeId: alvo.id,
    removida: false,
    removidaMotivo: null,
  });
  l.pagos.set(`${alvo.acompanhamentoId}|${alvo.profissionalId}`, {
    pagoEm: dia,
    despesaId,
    visitas: alvo.visitas,
    horas: alvo.horas,
    valorHoraCentavos: alvo.valorHoraCentavos,
    valorHorasCentavos: alvo.valorHorasCentavos,
    ajudaDeslocamentoCentavos: alvo.ajudaDeslocamentoCentavos,
    totalCentavos: alvo.totalCentavos,
  });
}

export function criarLojaGestao(hoje: string): LojaGestao {
  const dados = criarDadosGestaoDemo(hoje);
  const l: LojaGestao = {
    ...dados,
    pagos: new Map(),
    idsPagamento: new Map(),
    importacoes: [],
    linhasExtrato: [],
    proximo: 1,
  };
  pagamentoInicial(l);
  return l;
}

let loja: LojaGestao | null = null;

export function obterLojaGestao(): LojaGestao {
  if (!loja) loja = criarLojaGestao(hojeEmBrasilia());
  return loja;
}

/** Recomeça a loja (testes). `hoje` fixa a data usada para montar os dados. */
export function reiniciarLojaGestao(hoje?: string): void {
  loja = hoje ? criarLojaGestao(hoje) : null;
}

/** Só no modo demonstração: marca como enviadas todas as evoluções do acompanhamento. */
export function simularEnvioEvolucaoDemonstracao(
  acompanhamentoId: string,
): void {
  garantirDemonstracaoPermitida();
  const a = obterLojaGestao().acompanhamentos.find(
    (x) => x.id === acompanhamentoId,
  );
  if (!a)
    throw new ErroRepositorio("nao_encontrado", "acompanhamento inexistente");
  for (const r of a.relatorios) r.enviado = true;
}

// --- Regras compartilhadas ---------------------------------------------------------------

export function recusar(codigo: string, detalhe = ""): never {
  throw new ErroRepositorio("recusado", `gestao:${codigo} ${detalhe}`.trim());
}

function semPermissao(detalhe: string): never {
  throw new ErroRepositorio("sem_permissao", `demonstração: ${detalhe}`);
}

function pagamentosCalculados(l: LojaGestao): PagamentoEquipe[] {
  const saida: PagamentoEquipe[] = [];
  for (const a of l.acompanhamentos) {
    const porProf = new Map<string, number>();
    for (const v of a.visitas)
      porProf.set(v.profissionalId, (porProf.get(v.profissionalId) ?? 0) + 1);
    const enviadas = evolucoesEnviadas(a.relatorios, a.bebes);
    for (const [profId, visitas] of porProf) {
      const pr = l.profissionais.find((p) => p.id === profId);
      if (!pr) continue;
      const chave = `${a.id}|${profId}`;
      if (!l.idsPagamento.has(chave)) {
        l.idsPagamento.set(chave, uuid(2, l.idsPagamento.size + 1));
      }
      const idPag = l.idsPagamento.get(chave) as string;
      const pago = l.pagos.get(chave);
      const base = {
        id: idPag,
        acompanhamentoId: a.id,
        profissionalId: profId,
        profissionalNome: pr.nome,
        familiaNome: a.familiaNome,
        estadoAcompanhamento: a.estado,
      };
      if (pago) {
        saida.push({
          ...base,
          visitas: pago.visitas,
          horas: pago.horas,
          valorHoraCentavos: pago.valorHoraCentavos,
          valorHorasCentavos: pago.valorHorasCentavos,
          ajudaDeslocamentoCentavos: pago.ajudaDeslocamentoCentavos,
          totalCentavos: pago.totalCentavos,
          status: "pago",
          motivoBloqueio: null,
          pagoEm: pago.pagoEm,
        });
        continue;
      }
      const c = calcularPagamentoEquipe({
        visitas,
        horasPorVisita: a.horasPorVisita,
        valorHoraProfissionalCentavos: pr.valorHoraCentavos,
        ajudaDeslocamentoProfissionalCentavos: pr.ajudaDeslocamentoCentavos,
        evolucoesEnviadas: enviadas,
        parametros: PARAMETROS_GESTAO.pagamentoEquipe,
      });
      saida.push({
        ...base,
        visitas,
        horas: c.horas,
        valorHoraCentavos: c.valorHoraCentavos,
        valorHorasCentavos: c.valorHorasCentavos,
        ajudaDeslocamentoCentavos: c.ajudaDeslocamentoCentavos,
        totalCentavos: c.totalCentavos,
        status: c.status,
        motivoBloqueio: c.motivoBloqueio,
        pagoEm: null,
      });
    }
  }
  return saida;
}

function despesasBase(l: LojaGestao): DespesaBase[] {
  return l.despesas.map((d) => ({
    id: d.id,
    data: d.data,
    categoria: d.categoria,
    descricao: d.descricao,
    valorCentavos: d.valorCentavos,
    removida: d.removida,
    pagamentoEquipeId: d.pagamentoEquipeId,
  }));
}

function capacidadeDaLoja(l: LojaGestao, semanas: number): SemanaRegiao[] {
  const de = inicioDaSemana(l.hoje);
  return capacidadeSemanal({
    contratos: l.contratosCapacidade,
    regioes: l.regioes,
    profissionais: l.profissionais.map((p) => ({
      regioes: p.regioes,
      bloqueios: p.bloqueios,
    })),
    dist: distribuicaoNascimento(CONFIG_DISTRIBUICAO, []),
    hoje: l.hoje,
    de,
    ate: somarDias(de, semanas * 7 - 1),
    deslocamentoInicio: CONFIG_DISTRIBUICAO.deslocamentoInicioDias,
    parametros: {
      alertaPct: PARAMETROS_GESTAO.capacidadeAlertaPct,
      sobrevendaProbPct: PARAMETROS_GESTAO.sobrevendaProbPct,
      visitasPorDia: PARAMETROS_GESTAO.visitasPorDia,
      reservaProfissionais: PARAMETROS_GESTAO.backupReservaProfissionais,
    },
  });
}

export interface ContextoGestaoDemonstracao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

export function criarGestaoDemonstracao(
  contexto: ContextoGestaoDemonstracao,
): GestaoRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const bloqueadoPorMfa = () =>
    exigeMfa(contexto.papeis) && contexto.aal !== "aal2";

  function exigir(nome: string, ...papeis: Papel[]): LojaGestao {
    if (!contexto.usuarioId || bloqueadoPorMfa() || !tem(...papeis)) {
      semPermissao(`${nome} não é do seu papel`);
    }
    return obterLojaGestao();
  }
  const exigirFinanceiro = (nome: string) =>
    exigir(nome, "financeiro", "diretoria");
  const mesDe = (l: LojaGestao, mes?: string | null) =>
    inicioDoMes(mes && /^\d{4}-\d{2}-\d{2}$/.test(mes) ? mes : l.hoje);

  return {
    async capacidade(semanas) {
      const l = exigir("capacidade", "coordenacao", "diretoria");
      const n = semanas ?? PARAMETROS_GESTAO.capacidadeSemanasPainel;
      if (!Number.isInteger(n) || n < 1 || n > 26) recusar("semanas_invalidas");
      const linhas = capacidadeDaLoja(l, n);
      const regioes = l.regioes
        .filter((r) => linhas.some((x) => x.regiaoId === r.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((r) => ({
          regiaoId: r.id,
          regiao: r.nome,
          limiteFamilias: r.limiteFamilias,
          semanas: linhas
            .filter((x) => x.regiaoId === r.id)
            .map(
              ({ regiaoId: _r, regiao: _n, limiteFamilias: _l, ...semana }) =>
                semana,
            ),
        }));
      const alertas = linhas
        .filter((x) => x.nivel !== "folga")
        .sort(
          (a, b) =>
            Number(b.nivel === "sobrevenda") -
              Number(a.nivel === "sobrevenda") ||
            a.semana.localeCompare(b.semana) ||
            a.regiao.localeCompare(b.regiao, "pt-BR"),
        )
        .map((x) => ({
          regiaoId: x.regiaoId,
          regiao: x.regiao,
          semana: x.semana,
          nivel: x.nivel,
          probExcessoPct: x.probExcessoPct,
          ocupacaoPct: x.ocupacaoPct,
          cobertura: x.cobertura,
        }));
      const visao: CapacidadeVisao = {
        geradoEm: new Date().toISOString(),
        semanas: n,
        distribuicao: origemDistribuicao(CONFIG_DISTRIBUICAO, []),
        limites: {
          alertaPct: PARAMETROS_GESTAO.capacidadeAlertaPct,
          sobrevendaProbPct: PARAMETROS_GESTAO.sobrevendaProbPct,
        },
        regioes,
        alertas,
      };
      return visao;
    },

    async dre(mes) {
      const l = exigirFinanceiro("dre");
      return calcularDre(
        l.cobrancas,
        despesasBase(l),
        mesDe(l, mes),
        PARAMETROS_GESTAO.financeiro.serieMeses,
      );
    },

    async lancamentos(mes) {
      const l = exigirFinanceiro("lançamentos");
      return calcularLancamentos(l.cobrancas, despesasBase(l), mesDe(l, mes));
    },

    async despesas(mes) {
      const l = exigirFinanceiro("despesas");
      const m = mesDe(l, mes);
      const fim = inicioDoMes(somarDias(m, 32));
      const lista: Despesa[] = l.despesas
        .filter((d) => !d.removida && d.data >= m && d.data < fim)
        .sort(
          (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
        )
        .map((d) => ({
          id: d.id,
          data: d.data,
          categoria: d.categoria,
          descricao: d.descricao,
          fornecedor: d.fornecedor,
          valorCentavos: d.valorCentavos,
          canal: d.canal,
          daEquipe: d.pagamentoEquipeId !== null,
        }));
      return {
        mes: m,
        categorias: [...CATEGORIAS_DESPESA],
        despesas: lista,
        totalCentavos: lista.reduce((s, d) => s + d.valorCentavos, 0),
      };
    },

    async salvarDespesa(pedido: PedidoDespesa) {
      const l = exigirFinanceiro("lançar despesa");
      const descricao = pedido.descricao.trim();
      const fornecedor = pedido.fornecedor?.trim() || null;
      if (!pedido.data || !CATEGORIAS_DESPESA.includes(pedido.categoria))
        recusar("dados_incompletos");
      if (pedido.data > l.hoje) recusar("data_futura");
      if (descricao === "" || descricao.length > 200)
        recusar("descricao_invalida");
      if (
        !Number.isInteger(pedido.valorCentavos) ||
        pedido.valorCentavos <= 0 ||
        pedido.valorCentavos > PARAMETROS_GESTAO.financeiro.despesaMaxCentavos
      ) {
        recusar("valor_invalido");
      }
      if (pedido.canal && pedido.categoria !== "marketing_anuncios")
        recusar("canal_so_no_marketing");

      if (!pedido.id) {
        const nova: DespesaDemoGestao = {
          id: uuid(3, l.proximo++),
          data: pedido.data,
          categoria: pedido.categoria,
          descricao,
          fornecedor,
          valorCentavos: pedido.valorCentavos,
          canal: pedido.canal ?? null,
          pagamentoEquipeId: null,
          removida: false,
          removidaMotivo: null,
        };
        l.despesas.push(nova);
        return { id: nova.id };
      }
      const atual = l.despesas.find((d) => d.id === pedido.id);
      if (!atual) recusar("despesa_inexistente");
      if (atual.removida) recusar("despesa_removida");
      if (atual.pagamentoEquipeId) recusar("despesa_da_equipe");
      Object.assign(atual, {
        data: pedido.data,
        categoria: pedido.categoria,
        descricao,
        fornecedor,
        valorCentavos: pedido.valorCentavos,
        canal: pedido.canal ?? null,
      });
      return { id: atual.id };
    },

    async removerDespesa(despesaId, motivo) {
      const l = exigirFinanceiro("remover despesa");
      const m = motivo.trim();
      if (m.length < 10 || m.length > 300) recusar("motivo_invalido");
      const atual = l.despesas.find((d) => d.id === despesaId);
      if (!atual) recusar("despesa_inexistente");
      if (atual.removida) recusar("despesa_removida");
      if (atual.pagamentoEquipeId) recusar("despesa_da_equipe");
      atual.removida = true;
      atual.removidaMotivo = m;
    },

    async inadimplencia() {
      const l = exigirFinanceiro("inadimplência");
      return calcularInadimplencia(l.cobrancas, l.hoje, [
        ...PARAMETROS_GESTAO.financeiro.faixasInadimplenciaDias,
      ]);
    },

    async previsaoRecebimentos() {
      const l = exigirFinanceiro("previsão de recebimentos");
      return calcularPrevisao(
        l.cobrancas,
        l.hoje,
        PARAMETROS_GESTAO.financeiro.previsaoMeses,
      );
    },

    async pagamentosEquipe(mes) {
      const l = exigirFinanceiro("pagamento da equipe");
      const m = mesDe(l, mes);
      const fim = inicioDoMes(somarDias(m, 32));
      const todos = pagamentosCalculados(l);
      const doMes = (p: PagamentoEquipe) =>
        p.pagoEm !== null && p.pagoEm >= m && p.pagoEm < fim;
      const soma = (f: (p: PagamentoEquipe) => boolean) =>
        todos.filter(f).reduce((s, p) => s + p.totalCentavos, 0);
      const qtd = (f: (p: PagamentoEquipe) => boolean) =>
        todos.filter(f).length;
      const ordem = { bloqueado: 0, liberado: 1, pago: 2 } as const;
      return {
        resumo: {
          mes: m,
          bloqueadoCentavos: soma((p) => p.status === "bloqueado"),
          bloqueadoQtd: qtd((p) => p.status === "bloqueado"),
          liberadoCentavos: soma((p) => p.status === "liberado"),
          liberadoQtd: qtd((p) => p.status === "liberado"),
          pagoNoMesCentavos: soma((p) => p.status === "pago" && doMes(p)),
          pagoNoMesQtd: qtd((p) => p.status === "pago" && doMes(p)),
        },
        pagamentos: todos
          .filter((p) => p.status !== "pago" || doMes(p))
          .sort(
            (a, b) =>
              Number(a.status === "pago") - Number(b.status === "pago") ||
              ordem[a.status] - ordem[b.status] ||
              a.id.localeCompare(b.id),
          ),
      };
    },

    async pagarEquipe(pagamentoId, data) {
      const l = exigirFinanceiro("pagar a equipe");
      const alvo = pagamentosCalculados(l).find((p) => p.id === pagamentoId);
      if (!alvo) recusar("pagamento_inexistente");
      if (alvo.status === "pago") recusar("pagamento_ja_pago");
      const dia = data ?? l.hoje;
      if (dia > l.hoje) recusar("data_futura");
      if (alvo.status !== "liberado")
        recusar("pagamento_bloqueado", alvo.motivoBloqueio ?? "");
      const despesaId = uuid(3, l.proximo++);
      l.despesas.push({
        id: despesaId,
        data: dia,
        categoria: "equipe_assistencial",
        descricao: "Pagamento da equipe assistencial",
        fornecedor: null,
        valorCentavos: alvo.totalCentavos,
        canal: null,
        pagamentoEquipeId: alvo.id,
        removida: false,
        removidaMotivo: null,
      });
      l.pagos.set(`${alvo.acompanhamentoId}|${alvo.profissionalId}`, {
        pagoEm: dia,
        despesaId,
        visitas: alvo.visitas,
        horas: alvo.horas,
        valorHoraCentavos: alvo.valorHoraCentavos,
        valorHorasCentavos: alvo.valorHorasCentavos,
        ajudaDeslocamentoCentavos: alvo.ajudaDeslocamentoCentavos,
        totalCentavos: alvo.totalCentavos,
      });
      return {
        pagamentoId: alvo.id,
        despesaId,
        totalCentavos: alvo.totalCentavos,
        pagoEm: dia,
      };
    },

    async meusPagamentos() {
      const l = exigir("pagamentos próprios", "enfermeira");
      const prof = l.profissionais.find(
        (p) => p.usuarioId === contexto.usuarioId,
      );
      if (!prof) return [];
      return pagamentosCalculados(l)
        .filter((p) => p.profissionalId === prof.id)
        .map((p) => ({ ...p, familiaNome: null }));
    },

    async importarExtrato(
      arquivoHash,
      formato,
      linhas,
    ): Promise<ResultadoImportacaoExtrato> {
      const l = exigirFinanceiro("importar extrato");
      if (!/^[0-9a-f]{64}$/.test(arquivoHash)) recusar("arquivo_invalido");
      if (formato !== "ofx" && formato !== "csv") recusar("formato_invalido");
      if (linhas.length === 0) recusar("extrato_vazio");
      if (linhas.length > PARAMETROS_GESTAO.financeiro.extratoMaxLinhas) {
        recusar(
          "extrato_grande_demais",
          String(PARAMETROS_GESTAO.financeiro.extratoMaxLinhas),
        );
      }
      const existente = l.importacoes.find((i) => i.hash === arquivoHash);
      let importacao = existente;
      let novas = 0;
      if (!importacao) {
        importacao = {
          id: uuid(4, l.proximo++),
          hash: arquivoHash,
          formato,
          linhas: linhas.length,
          linhasNovas: 0,
          periodoInicio: null,
          periodoFim: null,
          importadoEm: new Date().toISOString(),
          conferidas: 0,
          sugeridas: 0,
          semCorrespondencia: 0,
        };
        const vistos = new Map<string, number>();
        const chavesExistentes = new Set(l.linhasExtrato.map((x) => x.chave));
        for (const [i, e] of linhas.entries()) {
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(e.data) ||
            !Number.isInteger(e.valorCentavos) ||
            e.valorCentavos === 0
          ) {
            recusar("linha_invalida", String(i + 1));
          }
          const descricao = e.descricao.trim().slice(0, 200);
          const documento = e.documento?.trim().slice(0, 80) || null;
          const base = `${e.data}|${e.valorCentavos}|${descricao}|${documento ?? ""}`;
          const n = (vistos.get(base) ?? 0) + 1;
          vistos.set(base, n);
          const chave = `${base}:${n}`;
          importacao.periodoInicio =
            !importacao.periodoInicio || e.data < importacao.periodoInicio
              ? e.data
              : importacao.periodoInicio;
          importacao.periodoFim =
            !importacao.periodoFim || e.data > importacao.periodoFim
              ? e.data
              : importacao.periodoFim;
          if (chavesExistentes.has(chave)) continue;
          l.linhasExtrato.push({
            id: uuid(5, l.proximo++),
            importacaoId: importacao.id,
            chave,
            criadoEm: importacao.importadoEm,
            data: e.data,
            valorCentavos: e.valorCentavos,
            descricao,
            documento,
            situacao: "sem_correspondencia",
            cobrancaId: null,
            despesaId: null,
          });
          novas += 1;
        }
        importacao.linhasNovas = novas;
        l.importacoes.push(importacao);
      }
      const conferencia = conciliarExtrato(
        l.linhasExtrato.filter((x) => x.importacaoId === importacao.id),
        l.cobrancas,
        despesasBase(l),
        {
          janelaDias: PARAMETROS_GESTAO.financeiro.janelaExtratoDias,
          janelaSugestaoDias: PARAMETROS_GESTAO.financeiro.janelaSugestaoDias,
        },
      );
      return {
        importacaoId: importacao.id,
        jaImportado: Boolean(existente),
        linhas: importacao.linhas,
        linhasNovas: importacao.linhasNovas,
        conferencia,
      };
    },

    async reconciliarExtrato(importacaoId): Promise<Conferencia> {
      const l = exigirFinanceiro("conferir extrato");
      return conciliarExtrato(
        l.linhasExtrato.filter(
          (x) => !importacaoId || x.importacaoId === importacaoId,
        ),
        l.cobrancas,
        despesasBase(l),
        {
          janelaDias: PARAMETROS_GESTAO.financeiro.janelaExtratoDias,
          janelaSugestaoDias: PARAMETROS_GESTAO.financeiro.janelaSugestaoDias,
        },
      );
    },

    async extrato(importacaoId): Promise<ExtratoVisao> {
      const l = exigirFinanceiro("extrato");
      const importacoes: ImportacaoExtrato[] = [...l.importacoes]
        .reverse()
        .map(({ hash: _hash, ...i }) => {
          const linhas = l.linhasExtrato.filter((x) => x.importacaoId === i.id);
          return {
            ...i,
            conferidas: linhas.filter((x) => x.situacao === "conferida").length,
            sugeridas: linhas.filter((x) => x.situacao === "sugerida").length,
            semCorrespondencia: linhas.filter(
              (x) => x.situacao === "sem_correspondencia",
            ).length,
          };
        });
      const linhas: LinhaExtrato[] = l.linhasExtrato
        .filter((x) => importacaoId && x.importacaoId === importacaoId)
        .sort(
          (a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
        )
        .map((x) => {
          const c = l.cobrancas.find((k) => k.id === x.cobrancaId);
          const d = l.despesas.find((k) => k.id === x.despesaId);
          return {
            id: x.id,
            importacaoId: x.importacaoId,
            data: x.data,
            valorCentavos: x.valorCentavos,
            descricao: x.descricao,
            situacao: x.situacao,
            cobrancaId: x.cobrancaId,
            cobrancaParcela: c?.parcela ?? null,
            cobrancaSituacao: c?.status ?? null,
            familiaNome: c?.familiaNome ?? null,
            despesaId: x.despesaId,
            despesaDescricao: d?.descricao ?? null,
          };
        });
      return { importacoes, linhas };
    },

    async painelExecutivo(mes) {
      const l = exigir("painel executivo", "diretoria");
      const origemDaFamilia = new Map(l.familias.map((f) => [f.id, f]));
      const base: BasePainel = {
        hoje: l.hoje,
        leads: l.familias.map((f) => ({
          familiaId: f.id,
          origem: f.origem,
          codigoOrigem: f.codigoOrigem,
          criadoEm: f.criadoEm,
          mesclada: f.mesclada,
        })),
        sessoes: l.sessoes,
        contratos: l.contratos,
        cobrancas: l.cobrancas.map((c) => ({
          ...c,
          origem: origemDaFamilia.get(c.familiaId)?.origem ?? "desconhecida",
          codigoOrigem: origemDaFamilia.get(c.familiaId)?.codigoOrigem ?? null,
        })),
        despesas: l.despesas.map((d) => ({
          id: d.id,
          data: d.data,
          categoria: d.categoria,
          descricao: d.descricao,
          valorCentavos: d.valorCentavos,
          removida: d.removida,
          canal: d.canal,
        })),
        acompanhamentos: l.acompanhamentos.map((a) => ({
          familiaId: a.familiaId,
          estado: a.estado,
          inicioEfetivo: a.inicioEfetivo,
        })),
        visitas: l.visitas,
        ocorrenciasAbertas: l.ocorrenciasAbertas,
        pesquisas: l.pesquisas.map((p) => ({
          respondidaEm: p.respondidaEm,
          nps: p.nps,
          classificacao: p.classificacao,
          depoimentoAutorizado: p.depoimentoAutorizado,
        })),
        capacidade: capacidadeDaLoja(
          l,
          PARAMETROS_GESTAO.capacidadeSemanasPainel,
        ).map((c) => ({
          regiao: c.regiao,
          semana: c.semana,
          ocupacaoPct: c.ocupacaoPct,
          probExcessoPct: c.probExcessoPct,
          cobertura: c.cobertura,
          nivel: c.nivel,
        })),
        metas: { ...PARAMETROS_GESTAO.metas },
        congelamento: { ...PARAMETROS_GESTAO.congelamento },
      };
      return calcularPainel(
        base,
        mesDe(l, mes),
        {
          npsAmostraMinima: PARAMETROS_GESTAO.painel.npsAmostraMinima,
          faixasInadimplenciaDias: [
            ...PARAMETROS_GESTAO.financeiro.faixasInadimplenciaDias,
          ],
          previsaoMeses: PARAMETROS_GESTAO.financeiro.previsaoMeses,
          capacidadeSemanas: PARAMETROS_GESTAO.capacidadeSemanasPainel,
          serieMeses: PARAMETROS_GESTAO.financeiro.serieMeses,
        },
        new Date().toISOString(),
      );
    },
  };
}
