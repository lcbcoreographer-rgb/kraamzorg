import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import type { Json } from "@/lib/db/types";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AcessoFamiliaRepositorio,
  AvaliacaoCandidata,
  CanalCaptacao,
  ConfigCopiloto,
  ContagensMarketing,
  CopilotoRepositorio,
  DetalheCandidata,
  DetalheManual,
  EstadoCandidata,
  ExportacaoMarketing,
  FiltroPeriodo,
  ListaParceiros,
  ListaTalentos,
  ManuaisRepositorio,
  MarketingRepositorio,
  NomeFerramentaCopiloto,
  OrigemLead,
  ParceirosRepositorio,
  PerguntaCopiloto,
  RelacaoRepositorio,
  RelatorioIndicacoes,
  RelatorioMarketing,
  ResumoManual,
  RoteiroTalentos,
  TalentosRepositorio,
  TarefasEquipeRepositorio,
  Trilha,
  VisaoTarefasEquipe,
} from "../tipos-relacao";
import { obterLoja } from "./loja";
import {
  hojeDemonstracao,
  novoId,
  obterLojaRelacao,
  type CandidataDemo,
  type LeadDemo,
  type LojaRelacao,
  type ManualDemo,
} from "./relacao-loja";
import { TEXTOS_RELACAO } from "./relacao-seed.gerado";

/**
 * Relacionamento da fase 3 no modo demonstração (P47 a P51): as mesmas
 * interfaces da implementação Supabase, sobre a loja em memória. Imita as
 * permissões de cada função api.* da 0027_relacao.sql (papel e AAL2); a prova
 * de permissão de verdade é o pgTAP 027. As contas e os dados são fictícios.
 */
export interface ContextoRelacaoDemonstracao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

const PRECEDENCIA_EQUIPE = [
  "diretoria",
  "coordenacao",
  "comercial",
  "financeiro",
  "marketing",
  "enfermeira",
];
const TODOS_OS_PAPEIS: Papel[] = [
  "comercial",
  "enfermeira",
  "financeiro",
  "marketing",
  "coordenacao",
  "diretoria",
];

/** Recusa de negócio, no formato que codigoRelacao() lê. */
export function recusarRelacao(codigo: string, detalhe = ""): never {
  throw new ErroRepositorio(
    "recusado",
    `demonstração: relacao:${codigo} ${detalhe}`.trim(),
  );
}

function semPermissao(motivo: string): never {
  throw new ErroRepositorio("sem_permissao", `demonstração: ${motivo}`);
}

const numeroDe = (v: unknown): number | null =>
  typeof v === "number" ? v : null;

/** aaaa-mm-dd do primeiro dia do mês de uma data. */
const primeiroDoMes = (data: string) => `${data.slice(0, 7)}-01`;
const dentro = (dia: string, f: FiltroPeriodo) =>
  (!f.desde || dia >= f.desde) && (!f.ate || dia <= f.ate);
const arredondar = (n: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

export function criarRelacaoDemonstracao(
  contexto: ContextoRelacaoDemonstracao,
): RelacaoRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const loja = () => obterLojaRelacao();

  /** Como privado.autorizar: sessão, papel e (quando o papel ou a função pede) AAL2. */
  function autorizar(papeis: Papel[], exigeAal2 = false): string {
    if (!contexto.usuarioId) semPermissao("sem sessão");
    if (!tem(...papeis)) semPermissao("papel sem acesso a esta função");
    if (contexto.aal !== "aal2" && (exigeAal2 || exigeMfa(contexto.papeis))) {
      semPermissao("esta função exige MFA (AAL2)");
    }
    return contexto.usuarioId;
  }
  const nomeDoUsuario = (usuarioId: string) =>
    obterLoja().usuarios.find((u) => u.id === usuarioId)?.nome ??
    "Pessoa da equipe";

  // --- P47 --------------------------------------------------------------------------

  function veValores(): boolean {
    if (tem("diretoria", "financeiro")) return true;
    const p = loja().parametros.marketing as
      { ve_receita?: boolean } | undefined;
    return tem("marketing") && p?.ve_receita === true;
  }

  function contagens(
    leads: LeadDemo[],
    pagos: { contratoId: string; valorCentavos: number }[],
    custo: number,
    ve: boolean,
  ): ContagensMarketing {
    return {
      leads: leads.length,
      qualificados: leads.filter((l) => l.qualificado || l.ganho).length,
      ganhos: leads.filter((l) => l.ganho).length,
      contratosPagos: ve ? new Set(pagos.map((p) => p.contratoId)).size : null,
      receitaCentavos: ve
        ? pagos.reduce((s, p) => s + p.valorCentavos, 0)
        : null,
      custoCentavos: ve ? custo : null,
    };
  }

  const marketing: MarketingRepositorio = {
    async canais() {
      autorizar(["marketing", "diretoria"]);
      const l = loja();
      const cfg = l.parametros.captacao as Record<string, Json>;
      return {
        numeroE164: (cfg.numero_whatsapp_e164 as string) ?? null,
        prefixo: (cfg.prefixo as string) ?? null,
        textoModelo:
          TEXTOS_RELACAO.find((t) => t.chave === "captacao_whatsapp")?.texto ??
          null,
        canais: [...l.canais]
          .sort(
            (a, b) =>
              Number(b.ativo) - Number(a.ativo) ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          )
          .map((c): CanalCaptacao => ({ ...c })),
      };
    },

    async salvarCanal(p) {
      autorizar(["marketing", "diretoria"]);
      const l = loja();
      const codigo = p.codigo.trim().toUpperCase();
      const nome = p.nome.trim();
      if (!/^[A-Z0-9]{3,12}$/.test(codigo)) recusarRelacao("codigo_invalido");
      if (nome.length < 2 || nome.length > 80) recusarRelacao("nome_invalido");
      if (p.origem === "desconhecida") recusarRelacao("origem_invalida");
      if (l.canais.some((c) => c.codigo === codigo && c.id !== p.id)) {
        recusarRelacao("codigo_em_uso");
      }
      if (!p.id) {
        const novo = {
          id: novoId(l, 1),
          codigo,
          nome,
          origem: p.origem,
          ativo: p.ativo,
          visitas: 0,
          conversas: 0,
        };
        l.canais.push(novo);
        return { ...novo };
      }
      const atual = l.canais.find((c) => c.id === p.id);
      if (!atual) recusarRelacao("canal_inexistente");
      if (
        atual.codigo !== codigo &&
        (atual.visitas > 0 || atual.conversas > 0)
      ) {
        recusarRelacao("codigo_ja_usado");
      }
      Object.assign(atual, { codigo, nome, origem: p.origem, ativo: p.ativo });
      return { ...atual };
    },

    async salvarCusto(p) {
      autorizar(["financeiro", "diretoria"], true);
      const l = loja();
      if (!Number.isInteger(p.valorCentavos) || p.valorCentavos < 0) {
        recusarRelacao("valor_invalido", "centavos, zero ou mais");
      }
      if (!l.canais.some((c) => c.id === p.canalId))
        recusarRelacao("canal_inexistente");
      const mes = primeiroDoMes(p.mes);
      const atual = l.custos.find(
        (c) => c.canalId === p.canalId && c.mes === mes,
      );
      if (atual) atual.valorCentavos = p.valorCentavos;
      else
        l.custos.push({
          canalId: p.canalId,
          mes,
          valorCentavos: p.valorCentavos,
        });
    },

    async relatorio(f): Promise<RelatorioMarketing> {
      autorizar(["marketing", "diretoria", "financeiro"]);
      const l = loja();
      const ve = veValores();
      const todas = tem("diretoria", "financeiro", "comercial");
      const visiveis = l.leads.filter((x) => todas || x.elegivel);
      const leads = visiveis.filter((x) => dentro(x.criadoEm, f));
      const pagos = visiveis.flatMap((x) =>
        x.pagamentos
          .filter((p) => dentro(p.data, f))
          .map((p) => ({ ...p, origem: x.origem, codigo: x.codigoOrigem })),
      );
      const mesA = f.desde ? primeiroDoMes(f.desde) : null;
      const mesB = f.ate ? primeiroDoMes(f.ate) : null;
      const custos = l.custos
        .filter((c) => (!mesA || c.mes >= mesA) && (!mesB || c.mes <= mesB))
        .map((c) => ({
          ...c,
          canal: l.canais.find((k) => k.id === c.canalId)!,
        }));

      const origens = [
        ...new Set<OrigemLead>([
          ...leads.map((x) => x.origem),
          ...pagos.map((p) => p.origem),
          ...custos.map((c) => c.canal.origem),
        ]),
      ].sort();
      return {
        desde: f.desde ?? null,
        ate: f.ate ?? null,
        veValores: ve,
        soElegiveis: !todas,
        porOrigem: origens.map((origem) => ({
          origem,
          ...contagens(
            leads.filter((x) => x.origem === origem),
            pagos.filter((p) => p.origem === origem),
            custos
              .filter((c) => c.canal.origem === origem)
              .reduce((s, c) => s + c.valorCentavos, 0),
            ve,
          ),
        })),
        porCanal: [...l.canais]
          .sort((a, b) =>
            (a.nome + a.codigo).localeCompare(b.nome + b.codigo, "pt-BR"),
          )
          .map((k) => ({
            canalId: k.id,
            codigo: k.codigo,
            nome: k.nome,
            origem: k.origem,
            ativo: k.ativo,
            ...contagens(
              leads.filter((x) => x.codigoOrigem === k.codigo),
              pagos.filter((p) => p.codigo === k.codigo),
              custos
                .filter((c) => c.canalId === k.id)
                .reduce((s, c) => s + c.valorCentavos, 0),
              ve,
            ),
          })),
        total: contagens(
          leads,
          pagos,
          custos.reduce((s, c) => s + c.valorCentavos, 0),
          ve,
        ),
      };
    },

    async exportar(f): Promise<ExportacaoMarketing> {
      autorizar(["marketing", "diretoria"]);
      const cfg = loja().parametros.captacao as Record<string, Json>;
      const limite = numeroDe(cfg.exportar_max) ?? 5000;
      const linhas = loja()
        .leads.filter((x) => x.elegivel && dentro(x.criadoEm, f))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, limite)
        .map((x) => ({
          nomeExibicao: x.nome,
          dpp: x.dpp,
          gemelar: x.gemelar,
          primeiraGestacao: x.primeiraGestacao,
          origem: x.origem,
          codigoOrigem: x.codigoOrigem,
          utm: x.utm,
          criadoEm: x.criadoEm,
        }));
      return { linhas, limite };
    },
  };

  // --- P48 --------------------------------------------------------------------------

  function configCopiloto(): ConfigCopiloto {
    const l = loja();
    const cfg = l.parametros.copiloto as Record<string, Json>;
    const mes = primeiroDoMes(hojeDemonstracao());
    const doMes = l.perguntas.filter(
      (p) => p.em.slice(0, 7) === mes.slice(0, 7),
    );
    const entrada = doMes.reduce((s, p) => s + p.tokensEntrada, 0);
    const saida = doMes.reduce((s, p) => s + p.tokensSaida, 0);
    const precoE = numeroDe(cfg.preco_entrada_centavos_por_milhao) ?? 0;
    const precoS = numeroDe(cfg.preco_saida_centavos_por_milhao) ?? 0;
    return {
      ativo: cfg.ativo === true,
      termosAssistenciais: Array.isArray(cfg.termos_assistenciais)
        ? cfg.termos_assistenciais.filter(
            (t): t is string => typeof t === "string",
          )
        : [],
      perguntaMaxCaracteres: numeroDe(cfg.pergunta_max_caracteres) ?? 500,
      orcamentoMensalCentavos: numeroDe(cfg.orcamento_mensal_centavos),
      mes,
      perguntasMes: doMes.length,
      tokensEntradaMes: entrada,
      tokensSaidaMes: saida,
      custoMesCentavos: Math.ceil(
        (entrada * precoE + saida * precoS) / 1_000_000,
      ),
    };
  }

  /** Cada ferramenta com o papel e o AAL que a função api.* exige. */
  function executarFerramenta(
    ferramenta: NomeFerramentaCopiloto,
    p: Record<string, Json>,
  ): Json {
    const l = loja();
    const desde = typeof p.desde === "string" ? p.desde : null;
    const ate = typeof p.ate === "string" ? p.ate : null;
    const filtro = { desde, ate };
    switch (ferramenta) {
      case "copiloto_pipeline": {
        autorizar(["comercial", "diretoria"]);
        const pipeline = typeof p.pipeline === "number" ? p.pipeline : 1;
        if (pipeline !== 1 && pipeline !== 2) {
          recusarRelacao("pipeline_invalido", "use 1 ou 2");
        }
        const contagem = new Map<string, number>();
        for (const o of obterLoja().oportunidades) {
          if (o.pipeline !== pipeline) continue;
          const estagio = pipeline === 1 ? o.estagioP1 : o.estagioP2;
          if (!estagio) continue;
          contagem.set(estagio, (contagem.get(estagio) ?? 0) + 1);
        }
        const estagios = [...contagem.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([estagio, oportunidades]) => ({ estagio, oportunidades }));
        return {
          pipeline,
          total: estagios.reduce((s, e) => s + e.oportunidades, 0),
          estagios,
        };
      }
      case "copiloto_conversao": {
        autorizar(["comercial", "diretoria"]);
        const leads = l.leads.filter((x) => dentro(x.criadoEm, filtro));
        const n = leads.length;
        const qual = leads.filter((x) => x.qualificado || x.ganho).length;
        const ganhos = leads.filter((x) => x.ganho).length;
        return {
          desde,
          ate,
          leads: n,
          qualificados: qual,
          sessoes_realizadas: leads.filter((x) => x.sessaoRealizada).length,
          ganhos,
          perdidos: leads.filter((x) => x.perdido).length,
          taxa_qualificacao_pct: n > 0 ? arredondar((100 * qual) / n, 1) : null,
          taxa_ganho_pct: n > 0 ? arredondar((100 * ganhos) / n, 1) : null,
        };
      }
      case "copiloto_receita": {
        autorizar(["financeiro", "diretoria"], true);
        const pagos = l.leads.flatMap((x) =>
          x.pagamentos.filter((q) => dentro(q.data, filtro)),
        );
        const porMes = new Map<string, number>();
        for (const q of pagos) {
          const mes = primeiroDoMes(q.data);
          porMes.set(mes, (porMes.get(mes) ?? 0) + q.valorCentavos);
        }
        return {
          desde,
          ate,
          pago_centavos: pagos.reduce((s, q) => s + q.valorCentavos, 0),
          contratos_pagos: new Set(pagos.map((q) => q.contratoId)).size,
          em_aberto_centavos: l.cobrancasAbertas.emAbertoCentavos,
          vencido_centavos: l.cobrancasAbertas.vencidoCentavos,
          por_mes: [...porMes.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, pago_centavos]) => ({ mes, pago_centavos })),
        };
      }
      case "copiloto_ocupacao": {
        autorizar(["comercial", "coordenacao", "diretoria"]);
        const semanas = Math.min(
          Math.max(typeof p.semanas === "number" ? p.semanas : 8, 1),
          26,
        );
        const inicio =
          typeof p.semana_desde === "string"
            ? p.semana_desde
            : segundaDaSemana(hojeDemonstracao());
        const cfg = obterLoja().parametros.find(
          (x) => x.chave === "capacidade_alerta_pct",
        )?.valor;
        return {
          de: inicio,
          semanas,
          alerta_pct: typeof cfg === "number" ? cfg : 85,
          itens: ocupacaoDemonstracao(inicio, semanas),
        };
      }
      case "copiloto_leads_origem": {
        autorizar(["comercial", "diretoria"]);
        const por = new Map<
          string,
          { leads: number; qualificados: number; ganhos: number }
        >();
        for (const x of l.leads.filter((y) => dentro(y.criadoEm, filtro))) {
          const atual = por.get(x.origem) ?? {
            leads: 0,
            qualificados: 0,
            ganhos: 0,
          };
          atual.leads += 1;
          if (x.qualificado || x.ganho) atual.qualificados += 1;
          if (x.ganho) atual.ganhos += 1;
          por.set(x.origem, atual);
        }
        return {
          desde,
          ate,
          itens: [...por.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([origem, v]) => ({ origem, ...v })),
        };
      }
    }
  }

  const copiloto: CopilotoRepositorio = {
    async config() {
      autorizar(["comercial", "diretoria"]);
      return configCopiloto();
    },
    async registrar(p) {
      const usuarioId = autorizar(["comercial", "diretoria"]);
      if (!p.pergunta.trim()) recusarRelacao("pergunta_vazia");
      const l = loja();
      const pergunta = {
        id: novoId(l, 13),
        usuarioId,
        quem: nomeDoUsuario(usuarioId),
        em: new Date().toISOString(),
        pergunta: p.pergunta.trim().slice(0, 1000),
        ferramenta: p.ferramenta,
        situacao: p.situacao,
        motivo: p.motivo?.slice(0, 80) ?? null,
        tokensEntrada: Math.max(p.tokensEntrada, 0),
        tokensSaida: Math.max(p.tokensSaida, 0),
      };
      l.perguntas.push(pergunta);
      return pergunta.id;
    },
    async historico(limite) {
      const usuarioId = autorizar(["comercial", "diretoria"]);
      const diretoria = tem("diretoria");
      return [...loja().perguntas]
        .filter((p) => diretoria || p.usuarioId === usuarioId)
        .sort((a, b) => b.em.localeCompare(a.em))
        .slice(0, Math.min(Math.max(limite, 1), 100))
        .map((p): PerguntaCopiloto => ({
          id: p.id,
          em: p.em,
          pergunta: p.pergunta,
          ferramenta: p.ferramenta as NomeFerramentaCopiloto | null,
          situacao: p.situacao as PerguntaCopiloto["situacao"],
          motivo: p.motivo,
          quem: diretoria ? p.quem : null,
        }));
    },
    async executar(ferramenta, parametros) {
      return executarFerramenta(ferramenta, parametros);
    },
  };

  // --- P49 · equipe -------------------------------------------------------------------

  const PAPEIS_DO_PORTAL = ["mae", "parceiro", "acompanhante", "responsavel"];

  const acessoFamilia: AcessoFamiliaRepositorio = {
    async listar(familiaId) {
      autorizar(["comercial", "coordenacao", "diretoria"]);
      const l = loja();
      return l.familiasPortal
        .filter(
          (f) =>
            f.contratoAssinadoEm && (!familiaId || f.familiaId === familiaId),
        )
        .sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"))
        .map((f) => ({
          familiaId: f.familiaId,
          nomeExibicao: f.nomeExibicao,
          estadoSensivel: f.estadoSensivel,
          pessoas: l.pessoasPortal
            .filter(
              (p) =>
                p.familiaId === f.familiaId &&
                PAPEIS_DO_PORTAL.includes(p.papel),
            )
            .map((p) => ({
              pessoaId: p.pessoaId,
              papel: p.papel,
              primeiroNome: p.nome.split(" ")[0] ?? p.nome,
              temEmail: Boolean(p.email),
              situacao: !p.acesso
                ? ("sem_acesso" as const)
                : p.acesso.ativo
                  ? ("liberado" as const)
                  : ("suspenso" as const),
              entrou: Boolean(p.acesso?.ultimoAcessoEm),
              ultimoAcessoEm: p.acesso?.ultimoAcessoEm ?? null,
            })),
        }));
    },

    async liberar(pessoaId) {
      autorizar(["comercial", "coordenacao", "diretoria"]);
      const l = loja();
      const pessoa = l.pessoasPortal.find((p) => p.pessoaId === pessoaId);
      if (!pessoa) recusarRelacao("pessoa_inexistente");
      const familia = l.familiasPortal.find(
        (f) => f.familiaId === pessoa.familiaId,
      )!;
      if (
        familia.estadoSensivel === "bloqueio_total" ||
        familia.estadoSensivel === "encerrado_sensivel"
      ) {
        recusarRelacao(
          "freio",
          "nenhum convite sai para uma família em estado sensível",
        );
      }
      if (!PAPEIS_DO_PORTAL.includes(pessoa.papel))
        recusarRelacao("papel_sem_portal");
      if (!pessoa.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pessoa.email)) {
        recusarRelacao(
          "sem_email",
          "a pessoa não tem e-mail válido no cadastro",
        );
      }
      if (!familia.contratoAssinadoEm) recusarRelacao("sem_contrato_assinado");
      if (pessoa.acesso?.ativo) {
        return { acessoId: pessoa.pessoaId, jaLiberado: true, tarefaId: null };
      }
      pessoa.acesso = {
        ativo: true,
        ultimoAcessoEm: pessoa.acesso?.ultimoAcessoEm ?? null,
      };

      // O convite sai por uma pessoa da equipe, pela tarefa com o texto sugerido
      // de mensagem_modelo (portal_convite), como a tarefa real.
      const modelo = TEXTOS_RELACAO.find((t) => t.chave === "portal_convite");
      const endereco = (l.parametros.portal_familia as Record<string, Json>)
        .endereco as string;
      const primeiroNome = pessoa.nome.split(" ")[0] ?? pessoa.nome;
      const tarefaId = novoId(l, 14);
      obterLoja().tarefas.push({
        id: tarefaId,
        tipo: "enviar_guia",
        titulo: `Enviar à ${primeiroNome} o acesso ao portal`,
        prioridade: "normal",
        status: "aberta",
        venceEm: new Date(Date.now() + 24 * 3600_000).toISOString(),
        familiaId: null,
        responsavelId: contexto.usuarioId,
        papelResponsavel: null,
        payload: {
          mensagemChave: "portal_convite",
          categoria: "operacional",
          textoSugerido: (modelo?.texto ?? "")
            .replaceAll("{nome}", primeiroNome)
            .replaceAll("{endereco}", endereco),
        },
        criadoEm: new Date().toISOString(),
      });
      return { acessoId: pessoa.pessoaId, jaLiberado: false, tarefaId };
    },

    async suspender(pessoaId) {
      autorizar(["comercial", "coordenacao", "diretoria"]);
      const pessoa = loja().pessoasPortal.find((p) => p.pessoaId === pessoaId);
      if (!pessoa?.acesso?.ativo) recusarRelacao("sem_acesso_ativo");
      pessoa.acesso.ativo = false;
    },

    async enfermeiras() {
      autorizar(["coordenacao", "diretoria"]);
      return loja().profissionaisPortal.map((e) => ({
        profissionalId: e.profissionalId,
        nome: e.nome,
        autorizaNome: e.autorizaNome,
        autorizaFoto: e.autorizaFoto,
        temFoto: e.fotoPath !== null,
      }));
    },

    async salvarAutorizacao(p) {
      autorizar(["enfermeira", "coordenacao", "diretoria"]);
      const e = loja().profissionaisPortal.find(
        (x) => x.profissionalId === p.profissionalId,
      );
      if (!e) recusarRelacao("profissional_inexistente");
      if (
        p.fotoPath &&
        !new RegExp(
          `^profissionais/${e.profissionalId}/foto\\.(jpg|jpeg|png|webp)$`,
        ).test(p.fotoPath)
      ) {
        recusarRelacao(
          "foto_invalida",
          "o caminho da foto usa o id da profissional, nunca o nome",
        );
      }
      e.autorizaNome = p.autorizaNome;
      e.autorizaFoto = p.autorizaFoto;
      if (p.fotoPath) e.fotoPath = p.fotoPath;
    },
  };

  // --- P50 --------------------------------------------------------------------------

  function leadDaFamilia(l: LojaRelacao, familiaId: string): LeadDemo | null {
    const existente = l.leads.find((x) => x.id === familiaId);
    if (existente) return existente;
    // Família da lista principal do modo demonstração: entra no relatório de
    // origem quando a indicação é registrada.
    const familia = obterLoja().familias.find((f) => f.id === familiaId);
    if (!familia) return null;
    const novo: LeadDemo = {
      id: familia.id,
      nome: familia.nome,
      origem: "desconhecida",
      codigoOrigem: null,
      utm: null,
      criadoEm: hojeDemonstracao(),
      qualificado: false,
      ganho: false,
      perdido: false,
      sessaoRealizada: false,
      elegivel: true,
      dpp: familia.dpp,
      gemelar: familia.gemelar,
      primeiraGestacao: null,
      pagamentos: [],
    };
    l.leads.push(novo);
    return novo;
  }

  const parceiros: ParceirosRepositorio = {
    async listar(): Promise<ListaParceiros> {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      const hoje = hojeDemonstracao();
      const cfg = l.parametros.indicacoes as Record<string, Json>;
      return {
        aviso:
          TEXTOS_RELACAO.find((t) => t.chave === "parceiros_aviso_vedacao")
            ?.texto ?? null,
        relacionamentoDias: numeroDe(cfg.relacionamento_dias),
        parceiros: [...l.parceiros]
          .sort(
            (a, b) =>
              a.estado.localeCompare(b.estado) ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          )
          .map((m) => {
            const dele = l.indicacoes.filter((i) => i.medicoId === m.medicoId);
            const dias = m.ultimoContatoEm
              ? Math.floor(
                  (Date.parse(`${hoje}T00:00:00Z`) -
                    Date.parse(`${m.ultimoContatoEm.slice(0, 10)}T00:00:00Z`)) /
                    86_400_000,
                )
              : null;
            return {
              medicoId: m.medicoId,
              nome: m.nome,
              especialidade: m.especialidade,
              hospital: m.hospital,
              telefoneE164: m.telefoneE164,
              email: m.email,
              estado: m.estado,
              observacao: m.observacao,
              ultimoContatoEm: m.ultimoContatoEm,
              proximoContatoEm: m.proximoContatoEm,
              diasSemContato: dias,
              precisaContato:
                (m.estado === "prospeccao" || m.estado === "ativo") &&
                m.proximoContatoEm !== null &&
                m.proximoContatoEm <= hoje,
              indicacoes: dele.length,
              contratos: dele.filter(
                (i) => l.leads.find((x) => x.id === i.familiaId)?.ganho,
              ).length,
              tarefasAbertas: l.tarefasParceiro.filter(
                (t) => t.medicoId === m.medicoId && t.status === "aberta",
              ).length,
            };
          }),
      };
    },

    async salvar(p) {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      const nome = p.nome.trim();
      if (nome.length < 2 || nome.length > 120) recusarRelacao("nome_invalido");
      const digitos = p.telefone.replace(/\D/g, "");
      if (p.telefone.trim() && (digitos.length < 8 || digitos.length > 15)) {
        recusarRelacao("telefone_invalido");
      }
      if (
        p.email.trim() &&
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())
      ) {
        recusarRelacao("email_invalido");
      }
      const telefoneE164 = p.telefone.trim()
        ? p.telefone.trim().startsWith("+")
          ? `+${digitos}`
          : digitos.length <= 11
            ? `+55${digitos}`
            : `+${digitos}`
        : null;
      const campos = {
        nome,
        especialidade: p.especialidade,
        hospital: p.hospital.trim() || null,
        telefoneE164,
        email: p.email.trim() || null,
        estado: p.estado,
        observacao: p.observacao.trim() || null,
        proximoContatoEm: p.proximoContatoEm,
      };
      if (!p.medicoId) {
        const medicoId = novoId(l, 7);
        l.parceiros.push({ medicoId, ultimoContatoEm: null, ...campos });
        return medicoId;
      }
      const atual = l.parceiros.find((m) => m.medicoId === p.medicoId);
      if (!atual) recusarRelacao("parceiro_inexistente");
      Object.assign(atual, campos);
      return atual.medicoId;
    },

    async registrarContato(medicoId, observacao) {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      const m = l.parceiros.find((x) => x.medicoId === medicoId);
      if (!m) recusarRelacao("parceiro_inexistente");
      const dias =
        numeroDe(
          (l.parametros.indicacoes as Record<string, Json>).relacionamento_dias,
        ) ?? 60;
      const proximo = new Date(`${hojeDemonstracao()}T12:00:00Z`);
      proximo.setUTCDate(proximo.getUTCDate() + dias);
      m.ultimoContatoEm = new Date().toISOString();
      m.proximoContatoEm = proximo.toISOString().slice(0, 10);
      if (m.estado === "prospeccao") m.estado = "ativo";
      if (observacao.trim()) m.observacao = observacao.trim();
      return m.proximoContatoEm;
    },

    async criarTarefa(medicoId, titulo, venceEm) {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      if (!l.parceiros.some((m) => m.medicoId === medicoId))
        recusarRelacao("parceiro_inexistente");
      const t = titulo.trim();
      if (t.length < 3 || t.length > 120) recusarRelacao("titulo_invalido");
      const tarefa = {
        id: novoId(l, 15),
        medicoId,
        titulo: t,
        venceEm,
        status: "aberta" as const,
      };
      l.tarefasParceiro.push(tarefa);
      obterLoja().tarefas.push({
        id: tarefa.id,
        tipo: "outro",
        titulo: t,
        prioridade: "normal",
        status: "aberta",
        venceEm: venceEm ? `${venceEm}T12:00:00-03:00` : null,
        familiaId: null,
        responsavelId: contexto.usuarioId,
        papelResponsavel: null,
        payload: { acao: "relacionamento_medico", medico_id: medicoId },
        criadoEm: new Date().toISOString(),
      });
      return tarefa.id;
    },

    async registrarIndicacao(p) {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      if (Boolean(p.medicoId) === Boolean(p.familiaPromotoraId)) {
        recusarRelacao(
          "indicacao_invalida",
          "informe o médico parceiro ou a família promotora, só um",
        );
      }
      const lead = leadDaFamilia(l, p.familiaId);
      if (!lead) recusarRelacao("familia_inexistente");
      if (l.indicacoes.some((i) => i.familiaId === lead.id))
        recusarRelacao("indicacao_ja_registrada");
      if (p.medicoId && !l.parceiros.some((m) => m.medicoId === p.medicoId)) {
        recusarRelacao("parceiro_inexistente");
      }
      if (p.familiaPromotoraId) {
        if (p.familiaPromotoraId === lead.id)
          recusarRelacao("promotora_e_indicada");
        if (!leadDaFamilia(l, p.familiaPromotoraId))
          recusarRelacao("promotora_inexistente");
      }
      l.indicacoes.push({
        id: novoId(l, 8),
        familiaId: lead.id,
        medicoId: p.medicoId,
        familiaPromotoraId: p.familiaPromotoraId,
        observacao: p.observacao.trim() || null,
        criadaEm: new Date().toISOString(),
      });
      lead.origem = p.medicoId ? "indicacao_medica" : "indicacao_cliente";
      return { origem: lead.origem };
    },

    async relatorio(f): Promise<RelatorioIndicacoes> {
      autorizar(["comercial", "diretoria"]);
      const l = loja();
      const doPeriodo = l.indicacoes.filter((i) =>
        dentro(i.criadaEm.slice(0, 10), f),
      );
      const qual = (familiaId: string) => {
        const x = l.leads.find((y) => y.id === familiaId);
        return Boolean(x && (x.qualificado || x.ganho));
      };
      const ganho = (familiaId: string) =>
        Boolean(l.leads.find((y) => y.id === familiaId)?.ganho);
      const resumo = (lista: typeof doPeriodo) => ({
        indicacoes: lista.length,
        qualificadas: lista.filter((i) => qual(i.familiaId)).length,
        contratos: lista.filter((i) => ganho(i.familiaId)).length,
      });
      return {
        desde: f.desde ?? null,
        ate: f.ate ?? null,
        total: doPeriodo.length,
        porMedico: l.parceiros
          .filter((m) => doPeriodo.some((i) => i.medicoId === m.medicoId))
          .map((m) => ({
            medicoId: m.medicoId,
            nome: m.nome,
            especialidade: m.especialidade,
            ...resumo(doPeriodo.filter((i) => i.medicoId === m.medicoId)),
          }))
          .sort(
            (a, b) =>
              b.indicacoes - a.indicacoes ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          ),
        porPromotora: [
          ...new Set(
            doPeriodo.map((i) => i.familiaPromotoraId).filter(Boolean),
          ),
        ]
          .map((id) => {
            const f2 = l.leads.find((x) => x.id === id);
            return {
              familiaId: id as string,
              nomeExibicao: f2?.nome ?? "Família",
              ...resumo(doPeriodo.filter((i) => i.familiaPromotoraId === id)),
            };
          })
          .sort(
            (a, b) =>
              b.indicacoes - a.indicacoes ||
              a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"),
          ),
      };
    },
  };

  // --- P51 · tarefas por equipe --------------------------------------------------------

  const tarefasEquipe: TarefasEquipeRepositorio = {
    async visao(): Promise<VisaoTarefasEquipe> {
      autorizar(["coordenacao", "diretoria"], true);
      const principal = obterLoja();
      const agora = Date.now();
      const linhas = principal.tarefas.map((t) => {
        const responsavel = principal.usuarios.find(
          (u) => u.id === t.responsavelId,
        );
        const equipe =
          t.papelResponsavel ??
          [...(responsavel?.papeis ?? [])].sort(
            (a, b) =>
              PRECEDENCIA_EQUIPE.indexOf(a) - PRECEDENCIA_EQUIPE.indexOf(b),
          )[0] ??
          "sem_equipe";
        const aberta = t.status === "aberta" || t.status === "em_andamento";
        const vencida =
          aberta && t.venceEm !== null && Date.parse(t.venceEm) < agora;
        return { t, responsavel, equipe: equipe as string, aberta, vencida };
      });
      const equipes = [...new Set(linhas.map((x) => x.equipe))].sort();
      return {
        equipes: equipes.map((equipe) => {
          const dela = linhas.filter((x) => x.equipe === equipe);
          return {
            equipe,
            abertas: dela.filter((x) => x.aberta).length,
            emAndamento: dela.filter((x) => x.t.status === "em_andamento")
              .length,
            vencidas: dela.filter((x) => x.vencida).length,
            semResponsavel: dela.filter((x) => x.aberta && !x.t.responsavelId)
              .length,
            concluidas7d: 0,
          };
        }),
        pessoas: [
          ...new Set(
            linhas
              .filter((x) => x.responsavel && x.aberta)
              .map((x) => x.responsavel!.id),
          ),
        ]
          .map((uid) => {
            const dele = linhas.filter(
              (x) => x.responsavel?.id === uid && x.aberta,
            );
            return {
              usuarioId: uid,
              nome: dele[0]!.responsavel!.nome,
              equipe: dele[0]!.equipe,
              abertas: dele.length,
              vencidas: dele.filter((x) => x.vencida).length,
            };
          })
          .sort(
            (a, b) =>
              b.vencidas - a.vencidas ||
              b.abertas - a.abertas ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          ),
        tarefas: linhas
          .filter((x) => x.aberta)
          .sort(
            (a, b) =>
              Number(b.vencida) - Number(a.vencida) ||
              ["normal", "alta", "maxima"].indexOf(b.t.prioridade) -
                ["normal", "alta", "maxima"].indexOf(a.t.prioridade) ||
              (a.t.venceEm ?? "9").localeCompare(b.t.venceEm ?? "9"),
          )
          .slice(0, 200)
          .map((x) => ({
            id: x.t.id,
            titulo: x.t.titulo,
            tipo: x.t.tipo,
            prioridade: x.t.prioridade,
            status: x.t.status,
            venceEm: x.t.venceEm,
            vencida: x.vencida,
            equipe: x.equipe,
            responsavel: x.responsavel?.nome ?? null,
            familia:
              principal.familias.find((f) => f.id === x.t.familiaId)?.nome ??
              null,
          })),
      };
    },
  };

  // --- P51 · manuais e trilhas ------------------------------------------------------------

  const gestao = () => tem("coordenacao", "diretoria");
  const visivel = (m: ManualDemo) =>
    gestao() ||
    m.papeisAlvo.length === 0 ||
    m.papeisAlvo.some((p) => contexto.papeis.includes(p as Papel));
  const atual = (m: ManualDemo) => m.versoes[m.versoes.length - 1]!;
  const leu = (versaoId: string, usuarioId: string | null) =>
    loja().leituras.some(
      (x) => x.versaoId === versaoId && x.usuarioId === usuarioId,
    );

  const manuais: ManuaisRepositorio = {
    async listar() {
      autorizar(TODOS_OS_PAPEIS);
      const l = loja();
      return [...l.manuais]
        .filter((m) => (m.ativo || gestao()) && visivel(m))
        .sort(
          (a, b) =>
            a.categoria.localeCompare(b.categoria) ||
            a.titulo.localeCompare(b.titulo, "pt-BR"),
        )
        .map((m): ResumoManual => ({
          id: m.id,
          titulo: m.titulo,
          categoria: m.categoria,
          papeisAlvo: [...m.papeisAlvo],
          ativo: m.ativo,
          versao: atual(m).versao,
          versaoId: atual(m).id,
          publicadaEm: atual(m).publicadaEm,
          lido: leu(atual(m).id, contexto.usuarioId),
          confirmacoes: gestao()
            ? l.leituras.filter((x) => x.versaoId === atual(m).id).length
            : null,
        }));
    },

    async obter(manualId): Promise<DetalheManual | null> {
      autorizar(TODOS_OS_PAPEIS);
      const m = loja().manuais.find((x) => x.id === manualId);
      if (!m || !visivel(m) || (!m.ativo && !gestao())) return null;
      const v = atual(m);
      return {
        id: m.id,
        titulo: m.titulo,
        categoria: m.categoria,
        papeisAlvo: [...m.papeisAlvo],
        ativo: m.ativo,
        versao: v.versao,
        versaoId: v.id,
        conteudo: v.conteudo,
        publicadaEm: v.publicadaEm,
        lido: leu(v.id, contexto.usuarioId),
        historico: [...m.versoes].reverse().map((h) => ({
          versao: h.versao,
          publicadaEm: h.publicadaEm,
          resumoMudanca: h.resumoMudanca,
        })),
      };
    },

    async salvar(p) {
      autorizar(["coordenacao", "diretoria"], true);
      const l = loja();
      const titulo = p.titulo.trim();
      const conteudo = p.conteudo.trim();
      if (titulo.length < 3 || titulo.length > 120)
        recusarRelacao("titulo_invalido");
      if (!conteudo || conteudo.length > 50_000)
        recusarRelacao("conteudo_invalido");
      if (p.categoria !== "manual" && p.categoria !== "protocolo")
        recusarRelacao("categoria_invalida");
      const resumo = p.resumoMudanca.trim() || null;
      const agora = new Date().toISOString();
      if (!p.manualId) {
        const m: ManualDemo = {
          id: novoId(l, 9),
          titulo,
          categoria: p.categoria,
          papeisAlvo: [...p.papeisAlvo],
          ativo: p.ativo,
          versoes: [
            {
              id: novoId(l, 10),
              versao: 1,
              conteudo,
              resumoMudanca: resumo,
              publicadaEm: agora,
            },
          ],
        };
        l.manuais.push(m);
        return { manualId: m.id, versao: 1, novaVersao: true };
      }
      const m = l.manuais.find((x) => x.id === p.manualId);
      if (!m) recusarRelacao("manual_inexistente");
      Object.assign(m, {
        titulo,
        categoria: p.categoria,
        papeisAlvo: [...p.papeisAlvo],
        ativo: p.ativo,
      });
      const v = atual(m);
      if (v.conteudo === conteudo)
        return { manualId: m.id, versao: v.versao, novaVersao: false };
      if (!resumo)
        recusarRelacao(
          "resumo_obrigatorio",
          "diga em uma frase o que mudou nesta versão",
        );
      m.versoes.push({
        id: novoId(l, 10),
        versao: v.versao + 1,
        conteudo,
        resumoMudanca: resumo,
        publicadaEm: agora,
      });
      return { manualId: m.id, versao: v.versao + 1, novaVersao: true };
    },

    async confirmarLeitura(versaoId) {
      const usuarioId = autorizar(TODOS_OS_PAPEIS);
      const l = loja();
      const m = l.manuais.find((x) => x.versoes.some((v) => v.id === versaoId));
      if (!m) recusarRelacao("versao_inexistente");
      if (!m.ativo || !visivel(m)) recusarRelacao("manual_inexistente");
      if (atual(m).id !== versaoId)
        recusarRelacao(
          "versao_antiga",
          "há uma versão mais nova; leia e confirme a atual",
        );
      if (!leu(versaoId, usuarioId)) {
        l.leituras.push({ versaoId, usuarioId, em: new Date().toISOString() });
      }
    },

    async leituras(manualId) {
      autorizar(["coordenacao", "diretoria"], true);
      const l = loja();
      const m = l.manuais.find((x) => x.id === manualId);
      if (!m) recusarRelacao("manual_inexistente");
      const v = atual(m);
      return {
        manualId: m.id,
        versao: v.versao,
        pessoas: obterLoja()
          .usuarios.filter(
            (u) =>
              u.ativo &&
              (m.papeisAlvo.length === 0 ||
                u.papeis.some((p) => m.papeisAlvo.includes(p))),
          )
          .map((u) => {
            const leitura = l.leituras.find(
              (x) => x.versaoId === v.id && x.usuarioId === u.id,
            );
            return {
              usuarioId: u.id,
              nome: u.nome,
              confirmou: Boolean(leitura),
              confirmadaEm: leitura?.em ?? null,
            };
          })
          .sort(
            (a, b) =>
              Number(a.confirmou) - Number(b.confirmou) ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          ),
      };
    },

    async trilhas(): Promise<Trilha[]> {
      autorizar(TODOS_OS_PAPEIS);
      const l = loja();
      const principal = obterLoja();
      return [...l.trilhas]
        .filter(
          (t) =>
            (t.ativa || gestao()) && (gestao() || tem(t.papelAlvo as Papel)),
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((t) => {
          const ms = t.manualIds
            .map((mid) => l.manuais.find((m) => m.id === mid))
            .filter((m): m is ManualDemo => Boolean(m && m.ativo));
          return {
            id: t.id,
            nome: t.nome,
            papelAlvo: t.papelAlvo,
            ativa: t.ativa,
            itens: ms.map((m, i) => ({
              ordem: i + 1,
              manualId: m.id,
              titulo: m.titulo,
              versao: atual(m).versao,
              versaoId: atual(m).id,
              lido: leu(atual(m).id, contexto.usuarioId),
            })),
            equipe: gestao()
              ? principal.usuarios
                  .filter(
                    (u) => u.ativo && u.papeis.includes(t.papelAlvo as Papel),
                  )
                  .map((u) => ({
                    usuarioId: u.id,
                    nome: u.nome,
                    feitos: ms.filter((m) => leu(atual(m).id, u.id)).length,
                    total: ms.length,
                  }))
              : null,
          };
        });
    },

    async salvarTrilha(p) {
      autorizar(["coordenacao", "diretoria"], true);
      const l = loja();
      const nome = p.nome.trim();
      if (nome.length < 3 || nome.length > 120) recusarRelacao("nome_invalido");
      if (
        new Set(p.manualIds).size !== p.manualIds.length ||
        p.manualIds.some((id) => !l.manuais.some((m) => m.id === id))
      ) {
        recusarRelacao(
          "manuais_invalidos",
          "lista com manual repetido ou inexistente",
        );
      }
      if (!p.trilhaId) {
        const t = {
          id: novoId(l, 11),
          nome,
          papelAlvo: p.papelAlvo,
          ativa: p.ativa,
          manualIds: [...p.manualIds],
        };
        l.trilhas.push(t);
        return t.id;
      }
      const t = l.trilhas.find((x) => x.id === p.trilhaId);
      if (!t) recusarRelacao("trilha_inexistente");
      Object.assign(t, {
        nome,
        papelAlvo: p.papelAlvo,
        ativa: p.ativa,
        manualIds: [...p.manualIds],
      });
      return t.id;
    },
  };

  // --- P51 · banco de talentos --------------------------------------------------------------

  function roteiro(): RoteiroTalentos {
    return loja().parametros.talentos_roteiro as unknown as RoteiroTalentos;
  }
  const exigirTalentos = () => autorizar(["coordenacao", "diretoria"], true);
  const resumoMedia = (c: CandidataDemo) => {
    const medias = c.avaliacoes
      .map((a) => a.media)
      .filter((m): m is number => m !== null);
    return medias.length
      ? arredondar(medias.reduce((s, m) => s + m, 0) / medias.length, 2)
      : null;
  };

  const talentos: TalentosRepositorio = {
    async roteiro() {
      exigirTalentos();
      return structuredClone(roteiro());
    },

    async listar(estado): Promise<ListaTalentos> {
      exigirTalentos();
      const l = loja();
      const pagina = l.parametros.talentos_pagina_publica as Record<
        string,
        Json
      >;
      return {
        paginaPublicaAtiva: pagina.ativa === true,
        candidatas: [...l.candidatas]
          .filter((c) => !estado || c.estado === estado)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
          .map((c) => ({
            id: c.id,
            nome: c.nome,
            cidade: c.cidade,
            origem: c.origem,
            estado: c.estado,
            criadoEm: c.criadoEm,
            avaliacoes: c.avaliacoes.length,
            mediaGeral: resumoMedia(c),
          })),
      };
    },

    async obter(candidataId): Promise<DetalheCandidata | null> {
      exigirTalentos();
      const c = loja().candidatas.find((x) => x.id === candidataId);
      if (!c) return null;
      const { avaliacoes, ...resto } = c;
      return {
        ...resto,
        roteiro: structuredClone(roteiro()),
        avaliacoes: avaliacoes.map(({ candidataId: _c, ...a }) => a),
      };
    },

    async salvar(p) {
      exigirTalentos();
      const l = loja();
      const nome = p.nome.trim();
      if (nome.length < 3 || nome.length > 120) recusarRelacao("nome_invalido");
      const digitos = p.telefone.replace(/\D/g, "");
      if (p.telefone.trim() && (digitos.length < 8 || digitos.length > 15))
        recusarRelacao("telefone_invalido");
      if (p.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim()))
        recusarRelacao("email_invalido");
      if (!p.telefone.trim() && !p.email.trim())
        recusarRelacao("sem_contato", "informe telefone ou e-mail");
      const campos = {
        nome,
        telefoneE164: p.telefone.trim()
          ? digitos.length <= 11
            ? `+55${digitos}`
            : `+${digitos}`
          : null,
        email: p.email.trim() || null,
        cidade: p.cidade.trim() || null,
        conselho: p.conselho.trim() || null,
        apresentacao: p.apresentacao.trim() || null,
        observacoes: p.observacoes.trim() || null,
      };
      if (!p.candidataId) {
        const c: CandidataDemo = {
          id: novoId(l, 12),
          ...campos,
          origem: "coordenacao",
          estado: "nova",
          criadoEm: new Date().toISOString(),
          avaliacoes: [],
        };
        l.candidatas.push(c);
        return c.id;
      }
      const c = l.candidatas.find((x) => x.id === p.candidataId);
      if (!c) recusarRelacao("candidata_inexistente");
      Object.assign(c, campos);
      return c.id;
    },

    async mudarEstado(candidataId, estado: EstadoCandidata) {
      exigirTalentos();
      const c = loja().candidatas.find((x) => x.id === candidataId);
      if (!c) recusarRelacao("candidata_inexistente");
      c.estado = estado;
    },

    async avaliar(p) {
      const usuarioId = exigirTalentos();
      const l = loja();
      const c = l.candidatas.find((x) => x.id === p.candidataId);
      if (!c) recusarRelacao("candidata_inexistente");
      const r = roteiro();
      const criterios = new Set(r.criterios.map((x) => x.id));
      const perguntas = new Set(
        r.blocos.flatMap((b) => b.perguntas.map((q) => q.id)),
      );
      for (const [chave, nota] of Object.entries(p.notas)) {
        if (!criterios.has(chave)) recusarRelacao("criterio_invalido");
        if (
          !Number.isInteger(nota) ||
          nota < r.escala.min ||
          nota > r.escala.max
        ) {
          recusarRelacao(
            "nota_invalida",
            `a nota fica entre ${r.escala.min} e ${r.escala.max}`,
          );
        }
      }
      for (const [chave, resposta] of Object.entries(p.respostas)) {
        if (!perguntas.has(chave)) recusarRelacao("pergunta_invalida");
        if (resposta.length > 2000)
          recusarRelacao("resposta_invalida", "texto de até 2000 caracteres");
      }
      const valores = Object.values(p.notas);
      const media = valores.length
        ? arredondar(valores.reduce((s, n) => s + n, 0) / valores.length, 2)
        : null;
      const nova: AvaliacaoCandidata & { candidataId: string } = {
        id: novoId(l, 16),
        candidataId: c.id,
        avaliadorId: usuarioId,
        avaliador: nomeDoUsuario(usuarioId),
        em: new Date().toISOString(),
        roteiroVersao: r.versao,
        respostas: { ...p.respostas },
        notas: { ...p.notas },
        observacoes: p.observacoes.trim() || null,
        criteriosAvaliados: valores.length,
        media,
      };
      const existente = c.avaliacoes.findIndex(
        (a) => a.avaliadorId === usuarioId,
      );
      if (existente >= 0) {
        nova.id = c.avaliacoes[existente]!.id;
        c.avaliacoes[existente] = nova;
      } else c.avaliacoes.push(nova);
      return {
        avaliacaoId: nova.id,
        criteriosAvaliados: valores.length,
        criteriosTotal: r.criterios.length,
        completa: valores.length === r.criterios.length,
        media,
      };
    },
  };

  return {
    marketing,
    copiloto,
    acessoFamilia,
    parceiros,
    tarefasEquipe,
    manuais,
    talentos,
  };
}

// --- Auxiliares de data e ocupação -------------------------------------------------------------

/** Segunda-feira da semana de uma data (aaaa-mm-dd). */
export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dia - 1));
  return d.toISOString().slice(0, 10);
}

const OCUPACAO_SP = [22.5, 31, 46.5, 58, 71.5, 86, 64, 40.5];
const OCUPACAO_LONDRINA = [10, 19, 28.5, 33, 52.5, 61, 47.5, 30];

/** Ocupação projetada fictícia por praça e semana, a partir da segunda dada. */
export function ocupacaoDemonstracao(inicio: string, semanas: number): Json[] {
  const itens: Json[] = [];
  for (let i = 0; i < semanas; i += 1) {
    const d = new Date(`${inicio}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * i);
    const semana = d.toISOString().slice(0, 10);
    const k = i % OCUPACAO_SP.length;
    itens.push(
      {
        regiao: "Londrina",
        semana,
        ocupacao_pct: OCUPACAO_LONDRINA[k]!,
        familias: Math.round((OCUPACAO_LONDRINA[k]! * 21) / 100 / 2),
        capacidade_dias: 21,
      },
      {
        regiao: "São Paulo",
        semana,
        ocupacao_pct: OCUPACAO_SP[k]!,
        familias: Math.round((OCUPACAO_SP[k]! * 35) / 100 / 2),
        capacidade_dias: 35,
      },
    );
  }
  return itens;
}
