import "server-only";
import type { Json } from "@/lib/db/types";
import { ErroRepositorio } from "../erros";
import type {
  AcessoFamiliaRepositorio,
  AutorizacaoEnfermeiraPortal,
  AvaliacaoCandidata,
  CanaisMarketing,
  CanalCaptacao,
  CategoriaManual,
  ConfigCopiloto,
  ContagensMarketing,
  ContatoEquipePortal,
  DetalheCandidata,
  DetalheManual,
  EquipeTarefas,
  EspecialidadeMedico,
  EstadoCandidata,
  EstadoParceiro,
  ExportacaoMarketing,
  FamiliaAcessoPortal,
  ItemTrilha,
  LeituraManual,
  ListaParceiros,
  ListaTalentos,
  NomeFerramentaCopiloto,
  OrigemLead,
  ParceiroMedico,
  PerguntaCopiloto,
  PessoaTarefas,
  PortalFamilia,
  PortalFamiliaRepositorio,
  RelacaoRepositorio,
  RelatorioIndicacoes,
  RelatorioMarketing,
  ResultadoAvaliacao,
  ResumoCandidata,
  ResumoManual,
  RoteiroTalentos,
  SituacaoPerguntaCopiloto,
  TarefaEquipe,
  TextosPortal,
  Trilha,
  VisaoTarefasEquipe,
} from "../tipos-relacao";
import { rpcPendente, type ContextoSupabase } from "./comum";
import { numero, numeroOuNulo, objeto, texto } from "./equipe";

/**
 * Relacionamento da fase 3 na real (P47 a P51): as funções do schema api da
 * 0027_relacao.sql, com a sessão de quem está logado. O banco confere papel e
 * AAL dentro de cada função; aqui só o que volta vira os tipos da tela e o
 * que a tela manda vira os argumentos. Os mapeamentos ficam exportados para
 * o teste sem banco (relacao.test.ts).
 */

type Registro = Record<string, Json | undefined>;

const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const bool = (v: Json | undefined): boolean => v === true;
const textoOuVazio = (v: Json | undefined): string => texto(v) ?? "";

function mapaTextos(v: Json | undefined): TextosPortal {
  const saida: TextosPortal = {};
  for (const [chave, valor] of Object.entries(objeto(v))) {
    if (typeof valor === "string") saida[chave] = valor;
  }
  return saida;
}

function mapaNumeros(v: Json | undefined): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(objeto(v))) {
    if (typeof valor === "number") saida[chave] = valor;
  }
  return saida;
}

function mapaTextosCurtos(v: Json | undefined): Record<string, string> | null {
  const o = objeto(v);
  const chaves = Object.keys(o);
  if (chaves.length === 0) return null;
  return mapaTextos(o);
}

// --- P47 -----------------------------------------------------------------------

export function canalDoBanco(valor: Json): CanalCaptacao {
  const c = objeto(valor);
  return {
    id: String(c.id),
    codigo: String(c.codigo),
    nome: String(c.nome),
    origem: String(c.origem) as OrigemLead,
    ativo: bool(c.ativo),
    visitas: numero(c.visitas),
    conversas: numero(c.conversas),
  };
}

export function canaisDoBanco(valor: Json): CanaisMarketing {
  const r = objeto(valor);
  const w = objeto(r.whatsapp);
  return {
    numeroE164: texto(w.numero_e164),
    prefixo: texto(w.prefixo),
    textoModelo: texto(w.texto_modelo),
    canais: lista(r.canais).map(canalDoBanco),
  };
}

function contagensDoBanco(o: Registro): ContagensMarketing {
  return {
    leads: numero(o.leads),
    qualificados: numero(o.qualificados),
    ganhos: numero(o.ganhos),
    contratosPagos: numeroOuNulo(o.contratos_pagos),
    receitaCentavos: numeroOuNulo(o.receita_centavos),
    custoCentavos: numeroOuNulo(o.custo_centavos),
  };
}

export function relatorioMarketingDoBanco(valor: Json): RelatorioMarketing {
  const r = objeto(valor);
  return {
    desde: texto(r.desde),
    ate: texto(r.ate),
    veValores: bool(r.ve_valores),
    soElegiveis: bool(r.so_elegiveis),
    porOrigem: lista(r.por_origem).map((x) => {
      const o = objeto(x);
      return { origem: String(o.origem) as OrigemLead, ...contagensDoBanco(o) };
    }),
    porCanal: lista(r.por_canal).map((x) => {
      const o = objeto(x);
      return {
        canalId: String(o.canal_id),
        codigo: String(o.codigo),
        nome: String(o.nome),
        origem: String(o.origem) as OrigemLead,
        ativo: bool(o.ativo),
        ...contagensDoBanco(o),
      };
    }),
    total: contagensDoBanco(objeto(r.total)),
  };
}

export function exportacaoDoBanco(valor: Json): ExportacaoMarketing {
  const r = objeto(valor);
  return {
    limite: numero(r.limite),
    linhas: lista(r.linhas).map((x) => {
      const l = objeto(x);
      return {
        nomeExibicao: String(l.nome_exibicao),
        dpp: texto(l.dpp),
        gemelar: bool(l.gemelar),
        primeiraGestacao: typeof l.primeira_gestacao === "boolean" ? l.primeira_gestacao : null,
        origem: String(l.origem) as OrigemLead,
        codigoOrigem: texto(l.codigo_origem),
        utm: mapaTextosCurtos(l.utm),
        criadoEm: String(l.criado_em),
      };
    }),
  };
}

// --- P48 -----------------------------------------------------------------------

export function configCopilotoDoBanco(valor: Json): ConfigCopiloto {
  const r = objeto(valor);
  return {
    ativo: bool(r.ativo),
    termosAssistenciais: lista(r.termos_assistenciais).filter(
      (t): t is string => typeof t === "string",
    ),
    perguntaMaxCaracteres: numero(r.pergunta_max_caracteres) || 500,
    orcamentoMensalCentavos: numeroOuNulo(r.orcamento_mensal_centavos),
    mes: textoOuVazio(r.mes),
    perguntasMes: numero(r.perguntas_mes),
    tokensEntradaMes: numero(r.tokens_entrada_mes),
    tokensSaidaMes: numero(r.tokens_saida_mes),
    custoMesCentavos: numero(r.custo_mes_centavos),
  };
}

export function historicoCopilotoDoBanco(valor: Json): PerguntaCopiloto[] {
  return lista(valor).map((x) => {
    const p = objeto(x);
    return {
      id: String(p.id),
      em: String(p.em),
      pergunta: String(p.pergunta),
      ferramenta: texto(p.ferramenta) as NomeFerramentaCopiloto | null,
      situacao: String(p.situacao) as SituacaoPerguntaCopiloto,
      motivo: texto(p.motivo),
      quem: texto(p.quem),
    };
  });
}

/** Argumentos de cada função de leitura do copiloto (nomes do banco). */
export function argumentosFerramenta(
  ferramenta: NomeFerramentaCopiloto,
  p: Record<string, Json>,
): Record<string, unknown> {
  switch (ferramenta) {
    case "copiloto_pipeline":
      return { pipeline: typeof p.pipeline === "number" ? p.pipeline : 1 };
    case "copiloto_ocupacao":
      return {
        semana_desde: typeof p.semana_desde === "string" ? p.semana_desde : null,
        semanas: typeof p.semanas === "number" ? p.semanas : 8,
      };
    default:
      return {
        desde: typeof p.desde === "string" ? p.desde : null,
        ate: typeof p.ate === "string" ? p.ate : null,
      };
  }
}

// --- P49 -----------------------------------------------------------------------

export function acessosFamiliaDoBanco(valor: Json): FamiliaAcessoPortal[] {
  return lista(valor).map((x) => {
    const f = objeto(x);
    return {
      familiaId: String(f.familia_id),
      nomeExibicao: String(f.nome_exibicao),
      estadoSensivel: String(f.estado_sensivel) as FamiliaAcessoPortal["estadoSensivel"],
      pessoas: lista(f.pessoas).map((y) => {
        const p = objeto(y);
        return {
          pessoaId: String(p.pessoa_id),
          papel: String(p.papel),
          primeiroNome: textoOuVazio(p.primeiro_nome),
          temEmail: bool(p.tem_email),
          situacao: String(p.situacao) as FamiliaAcessoPortal["pessoas"][number]["situacao"],
          entrou: bool(p.entrou),
          ultimoAcessoEm: texto(p.ultimo_acesso_em),
        };
      }),
    };
  });
}

export function enfermeirasPortalDoBanco(valor: Json): AutorizacaoEnfermeiraPortal[] {
  return lista(valor).map((x) => {
    const e = objeto(x);
    return {
      profissionalId: String(e.profissional_id),
      nome: String(e.nome),
      autorizaNome: bool(e.autoriza_nome),
      autorizaFoto: bool(e.autoriza_foto),
      temFoto: bool(e.tem_foto),
    };
  });
}

function contatoDoBanco(v: Json | undefined): ContatoEquipePortal {
  const c = objeto(v);
  return {
    nome: texto(c.nome),
    telefoneE164: texto(c.telefone_e164),
    horario: texto(c.horario),
    funcao: texto(c.funcao),
  };
}

export function portalFamiliaDoBanco(valor: Json): PortalFamilia {
  const r = objeto(valor);
  const pessoa = objeto(r.pessoa);
  const primeiroNome = textoOuVazio(pessoa.primeiro_nome);
  if (r.situacao === "contato") {
    return {
      situacao: "contato",
      primeiroNome,
      contato: contatoDoBanco(r.contato),
      textos: mapaTextos(r.textos),
    };
  }
  const datas = objeto(r.datas);
  const prenatal = r.prenatal ? objeto(r.prenatal) : null;
  const acompanhamento = r.acompanhamento ? objeto(r.acompanhamento) : null;
  const enfermeira = r.enfermeira ? objeto(r.enfermeira) : null;
  const pesquisa = r.pesquisa ? objeto(r.pesquisa) : null;
  const evolucoes = objeto(r.evolucoes);
  return {
    situacao: "ok",
    primeiroNome,
    nomeFamilia: textoOuVazio(objeto(r.familia).nome_exibicao),
    gemelar: bool(objeto(r.familia).gemelar),
    datas: {
      dpp: texto(datas.dpp),
      dataNascimento: texto(datas.data_nascimento),
      dataAlta: texto(datas.data_alta),
      dataInicioEfetivo: texto(datas.data_inicio_efetivo),
    },
    contratoAssinadoEm: texto(r.contrato_assinado_em),
    pagamentoConfirmadoEm: texto(r.pagamento_confirmado_em),
    prenatal: prenatal
      ? {
          estado: String(prenatal.estado),
          agendadaPara: texto(prenatal.agendada_para),
          realizadaEm: texto(prenatal.realizada_em),
        }
      : null,
    acompanhamento: acompanhamento
      ? {
          estado: String(acompanhamento.estado),
          diasContratados: numero(acompanhamento.dias_contratados),
          inicioEfetivo: texto(acompanhamento.inicio_efetivo),
          encerramento: texto(acompanhamento.encerramento),
        }
      : null,
    enfermeira: enfermeira
      ? { nome: texto(enfermeira.nome), fotoPath: texto(enfermeira.foto_path) }
      : null,
    visitas: lista(r.visitas).map((x) => {
      const v = objeto(x);
      return {
        dia: numero(v.dia),
        data: String(v.data),
        hora: texto(v.hora)?.slice(0, 5) ?? null,
        feita: bool(v.feita),
      };
    }),
    pesquisa: pesquisa
      ? { enviada: bool(pesquisa.enviada), respondida: bool(pesquisa.respondida) }
      : null,
    evolucoes: {
      ativo: bool(evolucoes.ativo),
      itens: lista(evolucoes.itens).map((x) => {
        const e = objeto(x);
        return { id: String(e.id), tipo: String(e.tipo), enviadoEm: texto(e.enviado_em) };
      }),
    },
    contato: contatoDoBanco(r.contato),
    textos: mapaTextos(r.textos),
  };
}

// --- P50 -----------------------------------------------------------------------

export function parceirosDoBanco(valor: Json): ListaParceiros {
  const r = objeto(valor);
  return {
    aviso: texto(r.aviso),
    relacionamentoDias: numeroOuNulo(r.relacionamento_dias),
    parceiros: lista(r.parceiros).map((x): ParceiroMedico => {
      const p = objeto(x);
      return {
        medicoId: String(p.medico_id),
        nome: String(p.nome),
        especialidade: String(p.especialidade) as EspecialidadeMedico,
        hospital: texto(p.hospital),
        telefoneE164: texto(p.telefone_e164),
        email: texto(p.email),
        estado: String(p.estado) as EstadoParceiro,
        observacao: texto(p.observacao),
        ultimoContatoEm: texto(p.ultimo_contato_em),
        proximoContatoEm: texto(p.proximo_contato_em),
        diasSemContato: numeroOuNulo(p.dias_sem_contato),
        precisaContato: bool(p.precisa_contato),
        indicacoes: numero(p.indicacoes),
        contratos: numero(p.contratos),
        tarefasAbertas: numero(p.tarefas_abertas),
      };
    }),
  };
}

export function relatorioIndicacoesDoBanco(valor: Json): RelatorioIndicacoes {
  const r = objeto(valor);
  return {
    desde: texto(r.desde),
    ate: texto(r.ate),
    total: numero(r.total),
    porMedico: lista(r.por_medico).map((x) => {
      const m = objeto(x);
      return {
        medicoId: String(m.medico_id),
        nome: String(m.nome),
        especialidade: String(m.especialidade) as EspecialidadeMedico,
        indicacoes: numero(m.indicacoes),
        qualificadas: numero(m.qualificadas),
        contratos: numero(m.contratos),
      };
    }),
    porPromotora: lista(r.por_promotora).map((x) => {
      const f = objeto(x);
      return {
        familiaId: String(f.familia_id),
        nomeExibicao: String(f.nome_exibicao),
        indicacoes: numero(f.indicacoes),
        qualificadas: numero(f.qualificadas),
        contratos: numero(f.contratos),
      };
    }),
  };
}

// --- P51 -----------------------------------------------------------------------

export function tarefasEquipeDoBanco(valor: Json): VisaoTarefasEquipe {
  const r = objeto(valor);
  return {
    equipes: lista(r.equipes).map((x): EquipeTarefas => {
      const e = objeto(x);
      return {
        equipe: String(e.equipe),
        abertas: numero(e.abertas),
        emAndamento: numero(e.em_andamento),
        vencidas: numero(e.vencidas),
        semResponsavel: numero(e.sem_responsavel),
        concluidas7d: numero(e.concluidas_7d),
      };
    }),
    pessoas: lista(r.pessoas).map((x): PessoaTarefas => {
      const p = objeto(x);
      return {
        usuarioId: String(p.usuario_id),
        nome: String(p.nome),
        equipe: String(p.equipe),
        abertas: numero(p.abertas),
        vencidas: numero(p.vencidas),
      };
    }),
    tarefas: lista(r.tarefas).map((x): TarefaEquipe => {
      const t = objeto(x);
      return {
        id: String(t.id),
        titulo: String(t.titulo),
        tipo: String(t.tipo),
        prioridade: String(t.prioridade) as TarefaEquipe["prioridade"],
        status: String(t.status),
        venceEm: texto(t.vence_em),
        vencida: bool(t.vencida),
        equipe: String(t.equipe),
        responsavel: texto(t.responsavel),
        familia: texto(t.familia),
      };
    }),
  };
}

const papeis = (v: Json | undefined): string[] =>
  lista(v).filter((p): p is string => typeof p === "string");

export function manuaisDoBanco(valor: Json): ResumoManual[] {
  return lista(valor).map((x) => {
    const m = objeto(x);
    return {
      id: String(m.id),
      titulo: String(m.titulo),
      categoria: String(m.categoria) as CategoriaManual,
      papeisAlvo: papeis(m.papeis_alvo),
      ativo: bool(m.ativo),
      versao: numero(m.versao),
      versaoId: String(m.versao_id),
      publicadaEm: String(m.publicada_em),
      lido: bool(m.lido),
      confirmacoes: numeroOuNulo(m.confirmacoes),
    };
  });
}

export function manualDoBanco(valor: Json): DetalheManual {
  const m = objeto(valor);
  return {
    id: String(m.id),
    titulo: String(m.titulo),
    categoria: String(m.categoria) as CategoriaManual,
    papeisAlvo: papeis(m.papeis_alvo),
    ativo: bool(m.ativo),
    versao: numero(m.versao),
    versaoId: String(m.versao_id),
    conteudo: textoOuVazio(m.conteudo),
    publicadaEm: String(m.publicada_em),
    lido: bool(m.lido),
    historico: lista(m.historico).map((x) => {
      const h = objeto(x);
      return {
        versao: numero(h.versao),
        publicadaEm: String(h.publicada_em),
        resumoMudanca: texto(h.resumo_mudanca),
      };
    }),
  };
}

export function leiturasDoBanco(valor: Json): LeituraManual {
  const r = objeto(valor);
  return {
    manualId: String(r.manual_id),
    versao: numero(r.versao),
    pessoas: lista(r.pessoas).map((x) => {
      const p = objeto(x);
      return {
        usuarioId: String(p.usuario_id),
        nome: String(p.nome),
        confirmou: bool(p.confirmou),
        confirmadaEm: texto(p.confirmada_em),
      };
    }),
  };
}

export function trilhasDoBanco(valor: Json): Trilha[] {
  return lista(valor).map((x) => {
    const t = objeto(x);
    return {
      id: String(t.id),
      nome: String(t.nome),
      papelAlvo: String(t.papel_alvo),
      ativa: bool(t.ativa),
      itens: lista(t.itens).map((y): ItemTrilha => {
        const i = objeto(y);
        return {
          ordem: numero(i.ordem),
          manualId: String(i.manual_id),
          titulo: String(i.titulo),
          versao: numero(i.versao),
          versaoId: String(i.versao_id),
          lido: bool(i.lido),
        };
      }),
      equipe: Array.isArray(t.equipe)
        ? t.equipe.map((y) => {
            const p = objeto(y);
            return {
              usuarioId: String(p.usuario_id),
              nome: String(p.nome),
              feitos: numero(p.feitos),
              total: numero(p.total),
            };
          })
        : null,
    };
  });
}

export function roteiroDoBanco(valor: Json): RoteiroTalentos {
  const r = objeto(valor);
  const escala = objeto(r.escala);
  return {
    versao: textoOuVazio(r.versao),
    escala: { min: numero(escala.min) || 1, max: numero(escala.max) || 5 },
    blocos: lista(r.blocos).map((b) => {
      const bloco = objeto(b);
      return {
        id: String(bloco.id),
        nome: String(bloco.nome),
        perguntas: lista(bloco.perguntas).map((q) => {
          const p = objeto(q);
          return { id: String(p.id), texto: String(p.texto) };
        }),
      };
    }),
    criterios: lista(r.criterios).map((c) => {
      const cr = objeto(c);
      return { id: String(cr.id), nome: String(cr.nome) };
    }),
  };
}

export function talentosDoBanco(valor: Json): ListaTalentos {
  const r = objeto(valor);
  return {
    paginaPublicaAtiva: bool(r.pagina_publica_ativa),
    candidatas: lista(r.candidatas).map((x): ResumoCandidata => {
      const c = objeto(x);
      return {
        id: String(c.id),
        nome: String(c.nome),
        cidade: texto(c.cidade),
        origem: String(c.origem),
        estado: String(c.estado) as EstadoCandidata,
        criadoEm: String(c.criado_em),
        avaliacoes: numero(c.avaliacoes),
        mediaGeral: typeof c.media_geral === "number" ? c.media_geral : c.media_geral ? Number(c.media_geral) : null,
      };
    }),
  };
}

export function candidataDoBanco(valor: Json): DetalheCandidata {
  const c = objeto(valor);
  return {
    id: String(c.id),
    nome: String(c.nome),
    telefoneE164: texto(c.telefone_e164),
    email: texto(c.email),
    cidade: texto(c.cidade),
    conselho: texto(c.conselho),
    apresentacao: texto(c.apresentacao),
    origem: String(c.origem),
    estado: String(c.estado) as EstadoCandidata,
    observacoes: texto(c.observacoes),
    criadoEm: String(c.criado_em),
    roteiro: roteiroDoBanco(c.roteiro as Json),
    avaliacoes: lista(c.avaliacoes).map((x): AvaliacaoCandidata => {
      const a = objeto(x);
      return {
        id: String(a.id),
        avaliadorId: String(a.avaliador_id),
        avaliador: texto(a.avaliador),
        em: String(a.em),
        roteiroVersao: textoOuVazio(a.roteiro_versao),
        respostas: mapaTextos(a.respostas),
        notas: mapaNumeros(a.notas),
        observacoes: texto(a.observacoes),
        criteriosAvaliados: numero(a.criterios_avaliados),
        media: typeof a.media === "number" ? a.media : a.media ? Number(a.media) : null,
      };
    }),
  };
}

export function avaliacaoDoBanco(valor: Json): ResultadoAvaliacao {
  const r = objeto(valor);
  return {
    avaliacaoId: String(r.avaliacao_id),
    criteriosAvaliados: numero(r.criterios_avaliados),
    criteriosTotal: numero(r.criterios_total),
    completa: bool(r.completa),
    media: typeof r.media === "number" ? r.media : r.media ? Number(r.media) : null,
  };
}

// --- Fábricas --------------------------------------------------------------------

export function criarRelacaoSupabase({ cliente }: ContextoSupabase): RelacaoRepositorio {
  const rpc = (funcao: string, args: Record<string, unknown> = {}) =>
    rpcPendente(cliente, funcao, args);
  const uuidOuNulo = (v: string | null | undefined) => v || null;
  const textoOuNulo = (v: string | null | undefined) => (v && v.trim() ? v : null);

  const acessoFamilia: AcessoFamiliaRepositorio = {
    async listar(familiaId) {
      return acessosFamiliaDoBanco(await rpc("portal_familia_acessos", { familia_id: uuidOuNulo(familiaId) }));
    },
    async liberar(pessoaId) {
      const r = objeto(await rpc("portal_familia_liberar", { pessoa_id: pessoaId }));
      return {
        acessoId: String(r.acesso_id),
        jaLiberado: bool(r.ja_liberado),
        tarefaId: texto(r.tarefa_id),
      };
    },
    async suspender(pessoaId) {
      await rpc("portal_familia_suspender", { pessoa_id: pessoaId });
    },
    async enfermeiras() {
      return enfermeirasPortalDoBanco(await rpc("profissionais_portal"));
    },
    async salvarAutorizacao(p) {
      await rpc("profissional_portal_salvar", {
        profissional_id: p.profissionalId,
        autoriza_nome: p.autorizaNome,
        autoriza_foto: p.autorizaFoto,
        foto_path: textoOuNulo(p.fotoPath),
      });
    },
  };

  return {
    marketing: {
      async canais() {
        return canaisDoBanco(await rpc("marketing_canais"));
      },
      async salvarCanal(p) {
        return canalDoBanco(
          (await rpc("marketing_canal_salvar", {
            id: uuidOuNulo(p.id),
            codigo: p.codigo,
            nome: p.nome,
            origem: p.origem,
            ativo: p.ativo,
          })) as Json,
        ) satisfies CanalCaptacao;
      },
      async salvarCusto(p) {
        await rpc("marketing_custo_salvar", {
          canal_id: p.canalId,
          mes: p.mes,
          valor_centavos: p.valorCentavos,
        });
      },
      async relatorio(f) {
        return relatorioMarketingDoBanco(
          await rpc("marketing_relatorio", { desde: f.desde ?? null, ate: f.ate ?? null }),
        );
      },
      async exportar(f) {
        return exportacaoDoBanco(
          await rpc("marketing_exportar", { desde: f.desde ?? null, ate: f.ate ?? null }),
        );
      },
    },
    copiloto: {
      async config() {
        return configCopilotoDoBanco(await rpc("copiloto_config"));
      },
      async registrar(p) {
        const r = objeto(
          await rpc("copiloto_registrar", {
            pergunta: p.pergunta,
            ferramenta: p.ferramenta,
            parametros: p.parametros,
            situacao: p.situacao,
            motivo: p.motivo ?? null,
            tokens_entrada: p.tokensEntrada,
            tokens_saida: p.tokensSaida,
          }),
        );
        return String(r.id);
      },
      async historico(limite) {
        return historicoCopilotoDoBanco(await rpc("copiloto_historico", { limite }));
      },
      async executar(ferramenta, parametros) {
        return rpc(ferramenta, argumentosFerramenta(ferramenta, parametros));
      },
    },
    acessoFamilia,
    parceiros: {
      async listar() {
        return parceirosDoBanco(await rpc("parceiros_listar"));
      },
      async salvar(p) {
        const r = objeto(
          await rpc("parceiro_salvar", {
            medico_id: uuidOuNulo(p.medicoId),
            nome: p.nome,
            especialidade: p.especialidade,
            telefone: textoOuNulo(p.telefone),
            email: textoOuNulo(p.email),
            hospital: textoOuNulo(p.hospital),
            estado: p.estado,
            observacao: textoOuNulo(p.observacao),
            proximo_contato_em: textoOuNulo(p.proximoContatoEm),
          }),
        );
        return String(r.medico_id);
      },
      async registrarContato(medicoId, observacao) {
        const r = objeto(
          await rpc("parceiro_contato_registrar", {
            medico_id: medicoId,
            observacao: textoOuNulo(observacao),
          }),
        );
        return texto(r.proximo_contato_em);
      },
      async criarTarefa(medicoId, titulo, venceEm) {
        const r = objeto(
          await rpc("parceiro_tarefa_criar", { medico_id: medicoId, titulo, vence_em: textoOuNulo(venceEm) }),
        );
        return String(r.tarefa_id);
      },
      async registrarIndicacao(p) {
        const r = objeto(
          await rpc("indicacao_registrar", {
            familia_id: p.familiaId,
            medico_id: uuidOuNulo(p.medicoId),
            familia_promotora_id: uuidOuNulo(p.familiaPromotoraId),
            observacao: textoOuNulo(p.observacao),
          }),
        );
        return { origem: String(r.origem) as OrigemLead };
      },
      async relatorio(f) {
        return relatorioIndicacoesDoBanco(
          await rpc("indicacoes_relatorio", { desde: f.desde ?? null, ate: f.ate ?? null }),
        );
      },
    },
    tarefasEquipe: {
      async visao() {
        return tarefasEquipeDoBanco(await rpc("tarefas_por_equipe"));
      },
    },
    manuais: {
      async listar() {
        return manuaisDoBanco(await rpc("manuais_listar"));
      },
      async obter(manualId) {
        try {
          return manualDoBanco(await rpc("manual_obter", { manual_id: manualId }));
        } catch (erro) {
          if (erro instanceof ErroRepositorio && erro.codigo === "recusado") return null;
          throw erro;
        }
      },
      async salvar(p) {
        const r = objeto(
          await rpc("manual_salvar", {
            manual_id: uuidOuNulo(p.manualId),
            titulo: p.titulo,
            categoria: p.categoria,
            papeis_alvo: p.papeisAlvo,
            conteudo: p.conteudo,
            resumo_mudanca: textoOuNulo(p.resumoMudanca),
            ativo: p.ativo,
          }),
        );
        return {
          manualId: String(r.manual_id),
          versao: numero(r.versao),
          novaVersao: bool(r.nova_versao),
        };
      },
      async confirmarLeitura(versaoId) {
        await rpc("manual_confirmar_leitura", { versao_id: versaoId });
      },
      async leituras(manualId) {
        return leiturasDoBanco(await rpc("manual_leituras", { manual_id: manualId }));
      },
      async trilhas() {
        return trilhasDoBanco(await rpc("trilhas_listar"));
      },
      async salvarTrilha(p) {
        const r = objeto(
          await rpc("trilha_salvar", {
            trilha_id: uuidOuNulo(p.trilhaId),
            nome: p.nome,
            papel_alvo: p.papelAlvo,
            ativa: p.ativa,
            manual_ids: p.manualIds,
          }),
        );
        return String(r.trilha_id);
      },
    },
    talentos: {
      async roteiro() {
        return roteiroDoBanco(await rpc("talentos_roteiro"));
      },
      async listar(estado) {
        return talentosDoBanco(await rpc("talentos_listar", { estado: estado ?? null }));
      },
      async obter(candidataId) {
        try {
          return candidataDoBanco(await rpc("talento_obter", { candidata_id: candidataId }));
        } catch (erro) {
          if (erro instanceof ErroRepositorio && erro.codigo === "recusado") return null;
          throw erro;
        }
      },
      async salvar(p) {
        const r = objeto(
          await rpc("talento_salvar", {
            candidata_id: uuidOuNulo(p.candidataId),
            nome: p.nome,
            telefone: textoOuNulo(p.telefone),
            email: textoOuNulo(p.email),
            cidade: textoOuNulo(p.cidade),
            conselho: textoOuNulo(p.conselho),
            apresentacao: textoOuNulo(p.apresentacao),
            observacoes: textoOuNulo(p.observacoes),
          }),
        );
        return String(r.candidata_id);
      },
      async mudarEstado(candidataId, estado) {
        await rpc("talento_estado", { candidata_id: candidataId, estado });
      },
      async avaliar(p) {
        return avaliacaoDoBanco(
          await rpc("talento_avaliar", {
            candidata_id: p.candidataId,
            respostas: p.respostas,
            notas: p.notas,
            observacoes: textoOuNulo(p.observacoes),
          }),
        );
      },
    },
  };
}

/** Portal da família: a conta da própria família, com a sessão dela (RLS). */
export function criarPortalFamiliaSupabase({
  cliente,
}: ContextoSupabase): PortalFamiliaRepositorio {
  return {
    async obter() {
      try {
        return portalFamiliaDoBanco(await rpcPendente(cliente, "portal_familia", {}));
      } catch (erro) {
        if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") return null;
        throw erro;
      }
    },
  };
}
