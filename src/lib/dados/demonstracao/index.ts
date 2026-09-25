import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import type { Json } from "@/lib/db/types";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AgenteRepositorio,
  ConfiguracoesRepositorio,
  FamiliasRepositorio,
  FichaRepositorio,
  Repositorios,
  TarefasRepositorio,
  UsuariosRepositorio,
} from "../repositorios";
import type {
  EstadoSensivel,
  EstagioP1,
  EstagioP2,
  ResultadoFreio,
  ResumoFamilia,
} from "../tipos";
import { PACOTES, REGIOES, TRANSICOES, VERSOES_PACOTE } from "./fixtures";
import { cartaoDemonstracao, obterLoja, type LojaDemonstracao } from "./loja";

/**
 * Implementação de demonstração: as mesmas interfaces, sobre a loja em
 * memória. Imita a RLS de forma simplificada (PRD 13): cada papel vê o que
 * a matriz permite, papel com MFA sem AAL2 não vê nada, evento restrito só
 * para coordenação e diretoria. Serve para as telas rodarem e serem
 * testadas; a prova de permissão continua sendo o pgTAP do banco.
 */
export interface ContextoDemonstracao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

const ORDEM_ESTADO: EstadoSensivel[] = [
  "normal",
  "atencao",
  "bloqueio_total",
  "encerrado_sensivel",
];
const ORDEM_PRIORIDADE = { normal: 0, alta: 1, maxima: 2 } as const;
const ESTAGIOS_COM_CONTRATO: EstagioP2[] = [
  "contrato_gerado",
  "aguardando_assinatura",
  "assinado",
  "cobranca_gerada",
  "pagamento_confirmado",
  "nota_fiscal_emitida",
  "consulta_prenatal_agendada",
  "consulta_realizada",
  "enfermeira_designada",
  "aguardando_nascimento",
  "bebe_nasceu",
  "aguardando_alta",
  "atendimento_liberado",
  "distrato",
];

export function criarRepositoriosDemonstracao(
  contexto: ContextoDemonstracao,
): Repositorios {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  /** RLS restritiva do MFA: papel com MFA em AAL1 não enxerga linha nenhuma. */
  const bloqueadoPorMfa = () =>
    exigeMfa(contexto.papeis) && contexto.aal !== "aal2";
  const loja = () => obterLoja();

  function exigirSessao(): string {
    if (!contexto.usuarioId || bloqueadoPorMfa()) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: sessão sem permissão",
      );
    }
    return contexto.usuarioId;
  }

  /** Quem lê família: comercial, coordenação, diretoria; financeiro só com contrato. */
  function familiasVisiveis(l: LojaDemonstracao) {
    if (bloqueadoPorMfa()) return [];
    if (tem("comercial", "coordenacao", "diretoria")) return l.familias;
    if (tem("financeiro")) {
      const comContrato = new Set(
        l.oportunidades
          .filter(
            (o) => o.estagioP2 && ESTAGIOS_COM_CONTRATO.includes(o.estagioP2),
          )
          .map((o) => o.familiaId),
      );
      return l.familias.filter((f) => comContrato.has(f.id));
    }
    return [];
  }

  function resumo(f: LojaDemonstracao["familias"][number]): ResumoFamilia {
    return {
      id: f.id,
      nome: f.nome,
      bairro: f.bairro,
      cidade: f.cidade.nome,
      uf: f.cidade.uf,
      dpp: f.dpp,
      dataNascimento: f.dataNascimento,
      estadoSensivel: f.estadoSensivel,
      naoContatar: f.naoContatar,
      gemelar: f.gemelar,
    };
  }

  function registrarEvento(
    l: LojaDemonstracao,
    familiaId: string,
    tipo: string,
    titulo: string,
    restrito: boolean,
  ) {
    l.eventos.push({
      id: l.proximoEvento++,
      familiaId,
      tipo,
      titulo,
      restrito,
      criadoEm: new Date().toISOString(),
      dados: {},
    });
  }

  const familias: FamiliasRepositorio = {
    async listarPipeline(filtro) {
      const l = loja();
      const visiveis = new Set(
        tem("comercial", "coordenacao", "diretoria")
          ? familiasVisiveis(l).map((f) => f.id)
          : [],
      );
      const busca = filtro.busca?.trim().toLowerCase();
      const digitos = filtro.busca?.replace(/\D/g, "");
      return l.oportunidades
        .filter(
          (o) => o.pipeline === filtro.pipeline && visiveis.has(o.familiaId),
        )
        .filter((o) =>
          !filtro.estagio
            ? true
            : filtro.pipeline === 1
              ? o.estagioP1 === filtro.estagio
              : o.estagioP2 === filtro.estagio,
        )
        .filter(
          (o) =>
            !filtro.classificacao || o.classificacao === filtro.classificacao,
        )
        .filter(
          (o) =>
            !filtro.responsavelId || o.responsavelId === filtro.responsavelId,
        )
        .map((o) => cartaoDemonstracao(l, o))
        .filter((c) => {
          if (filtro.regiaoId) {
            const familia = l.familias.find((f) => f.id === c.familiaId);
            if (familia?.cidade.regiaoId !== filtro.regiaoId) return false;
          }
          if (!busca) return true;
          if (c.nomeFamilia.toLowerCase().includes(busca)) return true;
          return Boolean(
            digitos &&
            digitos.length >= 4 &&
            l.pessoas.some(
              (p) =>
                p.familiaId === c.familiaId && p.telefoneE164.includes(digitos),
            ),
          );
        });
    },

    async contarPorEstagio(pipeline) {
      const cartoes = await familias.listarPipeline({ pipeline });
      const contagem: Partial<Record<EstagioP1 | EstagioP2, number>> = {};
      for (const c of cartoes) {
        const estagio = pipeline === 1 ? c.estagioP1 : c.estagioP2;
        if (estagio) contagem[estagio] = (contagem[estagio] ?? 0) + 1;
      }
      return contagem;
    },

    async listarFamilias(filtro = {}) {
      const l = loja();
      const busca = filtro.busca?.trim().toLowerCase();
      const digitos = filtro.busca?.replace(/\D/g, "") ?? "";
      // Nome da família ou telefone de alguém da família (a partir de 4
      // dígitos, qualquer formato), como a busca do pipeline.
      const porTelefone = (familiaId: string) =>
        digitos.length >= 4 &&
        l.pessoas.some(
          (p) => p.familiaId === familiaId && p.telefoneE164.includes(digitos),
        );
      const ids = filtro.ids ? new Set(filtro.ids) : null;
      return familiasVisiveis(l)
        .filter((f) => !ids || ids.has(f.id))
        .filter(
          (f) =>
            !busca || f.nome.toLowerCase().includes(busca) || porTelefone(f.id),
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, filtro.limite ?? 200)
        .map(resumo);
    },

    async transicionar(pedido) {
      const usuarioId = exigirSessao();
      if (!tem("comercial", "diretoria", "coordenacao")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: papel sem transição",
        );
      }
      const l = loja();
      const oportunidade = l.oportunidades.find(
        (o) => o.id === pedido.entidadeId,
      );
      if (
        !oportunidade ||
        (pedido.maquina !== "p1" && pedido.maquina !== "p2")
      ) {
        throw new ErroRepositorio(
          "nao_encontrado",
          "demonstração: oportunidade inexistente",
        );
      }
      const de =
        pedido.maquina === "p1"
          ? oportunidade.estagioP1
          : oportunidade.estagioP2;
      const permitida = TRANSICOES.some(
        (t) =>
          t.maquina === pedido.maquina && t.de === de && t.para === pedido.para,
      );
      if (!permitida) {
        throw new ErroRepositorio(
          "recusado",
          `demonstração: transição ${de} para ${pedido.para} não permitida`,
        );
      }
      if (pedido.maquina === "p1")
        oportunidade.estagioP1 = pedido.para as EstagioP1;
      else oportunidade.estagioP2 = pedido.para as EstagioP2;
      registrarEvento(
        l,
        oportunidade.familiaId,
        "estagio",
        `Estágio mudou para ${pedido.para}`,
        false,
      );
      void usuarioId;
      return {
        maquina: pedido.maquina,
        entidade_id: pedido.entidadeId,
        de,
        para: pedido.para,
      };
    },
  };

  function freioResposta(dados: Record<string, Json>): ResultadoFreio {
    return { ok: true, resposta: { ok: true, ...dados } };
  }

  const ficha: FichaRepositorio = {
    async obterFicha(familiaId) {
      const l = loja();
      const familia = familiasVisiveis(l).find((f) => f.id === familiaId);
      if (!familia) return null;
      const oportunidade = l.oportunidades.find(
        (o) => o.familiaId === familiaId,
      );
      return {
        familia: {
          ...resumo(familia),
          dataAlta: familia.dataAlta,
          dataInicioEfetivo: familia.dataInicioEfetivo,
          estadoSensivelEm: familia.estadoSensivelEm,
          primeiraGestacao: familia.primeiraGestacao,
        },
        pessoas: l.pessoas
          .filter((p) => p.familiaId === familiaId)
          .sort(
            (a, b) => Number(b.contatoPrincipal) - Number(a.contatoPrincipal),
          )
          .map(({ familiaId: _familiaId, ...p }) => p),
        oportunidade: oportunidade ? cartaoDemonstracao(l, oportunidade) : null,
      };
    },

    async linhaDoTempo(familiaId) {
      const l = loja();
      if (!familiasVisiveis(l).some((f) => f.id === familiaId)) return [];
      const veRestrito = tem("coordenacao", "diretoria");
      return l.eventos
        .filter((e) => e.familiaId === familiaId && (veRestrito || !e.restrito))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map(({ familiaId: _familiaId, ...e }) => e);
    },

    async dadosContrato(pessoaId, completo) {
      exigirSessao();
      if (!tem("comercial", "financeiro", "diretoria")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: dados de contrato",
        );
      }
      if (completo && contexto.aal !== "aal2") {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: dados completos exigem AAL2",
        );
      }
      const pessoa = loja().pessoas.find((p) => p.id === pessoaId);
      if (!pessoa)
        throw new ErroRepositorio("nao_encontrado", "demonstração: pessoa");
      return {
        pessoa_id: pessoaId,
        cpf: completo ? "000.000.000-00" : "***.000.000-**",
        endereco_residencial: {
          logradouro: "Rua Fictícia das Acácias",
          numero: completo ? "120" : null,
        },
      };
    },

    async acionarFreio(familiaId, estado, motivo) {
      const usuarioId = exigirSessao();
      const l = loja();
      const familia = familiasVisiveis(l).find((f) => f.id === familiaId);
      if (!familia)
        throw new ErroRepositorio("nao_encontrado", "demonstração: família");
      const de = familia.estadoSensivel;
      if (ORDEM_ESTADO.indexOf(estado) < ORDEM_ESTADO.indexOf(de)) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: o freio só sobe",
        );
      }
      if (estado === de)
        return freioResposta({
          familia_id: familiaId,
          de,
          para: estado,
          alterado: false,
        });
      familia.estadoSensivel = estado;
      familia.estadoSensivelEm = new Date().toISOString();
      l.freios[familiaId] = { por: usuarioId, em: Date.now(), de };
      registrarEvento(l, familiaId, "freio", "Freio acionado", true);
      // Como privado.acionar_freio (0009): o prazo do "Desfazer" volta na
      // resposta (agora + parametro.freio_desfazer_segundos), porque o
      // comercial, que é quem mais aciona, não lê `parametro`.
      const segundosDesfazer = l.parametros.find(
        (p) => p.chave === "freio_desfazer_segundos",
      )?.valor;
      const desfazerAte =
        typeof segundosDesfazer === "number" && segundosDesfazer > 0
          ? new Date(Date.now() + segundosDesfazer * 1000).toISOString()
          : null;
      if (!motivo) {
        l.tarefas.push({
          id: crypto.randomUUID(),
          tipo: "outro",
          titulo: `Justificar o freio da ${familia.nome}`,
          prioridade: "alta",
          status: "aberta",
          venceEm: null,
          familiaId,
          responsavelId: usuarioId,
          papelResponsavel: null,
          payload: { acao: "justificar_freio", estado },
          criadoEm: new Date().toISOString(),
        });
      }
      return freioResposta({
        familia_id: familiaId,
        de,
        para: estado,
        alterado: true,
        desfazer_ate: desfazerAte,
      });
    },

    async desfazerFreio(familiaId) {
      const usuarioId = exigirSessao();
      const l = loja();
      const registro = l.freios[familiaId];
      const parametro = l.parametros.find(
        (p) => p.chave === "freio_desfazer_segundos",
      );
      const segundos =
        typeof parametro?.valor === "number" ? parametro.valor : 0;
      const familia = l.familias.find((f) => f.id === familiaId);
      if (
        !registro ||
        !familia ||
        registro.por !== usuarioId ||
        Date.now() - registro.em > segundos * 1000
      ) {
        throw new ErroRepositorio(
          "recusado",
          "demonstração: o prazo do Desfazer passou",
        );
      }
      const para = registro.de;
      const de = familia.estadoSensivel;
      familia.estadoSensivel = para;
      delete l.freios[familiaId];
      registrarEvento(
        l,
        familiaId,
        "freio",
        "Freio desfeito por quem acionou",
        true,
      );
      return freioResposta({ familia_id: familiaId, de, para, alterado: true });
    },

    async justificarFreio(familiaId, motivo) {
      exigirSessao();
      if (!motivo.trim())
        throw new ErroRepositorio(
          "recusado",
          "demonstração: justificativa vazia",
        );
      const l = loja();
      const tarefa = l.tarefas.find(
        (t) =>
          t.familiaId === familiaId &&
          t.titulo.startsWith("Justificar o freio") &&
          t.status === "aberta",
      );
      if (tarefa) tarefa.status = "concluida";
      registrarEvento(l, familiaId, "freio", "Freio justificado", true);
      return freioResposta({ familia_id: familiaId, justificado: true });
    },

    async reverterFreio(familiaId, estado, justificativa) {
      exigirSessao();
      if (!tem("coordenacao", "diretoria")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: reverter exige coordenação ou diretoria",
        );
      }
      // privado.reverter_freio (0009) exige AAL2 mesmo de quem já passou
      // pela RLS, e só desce o freio: subir é acionar.
      if (contexto.aal !== "aal2") {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: a reversão exige MFA (AAL2)",
        );
      }
      if (!justificativa.trim())
        throw new ErroRepositorio(
          "recusado",
          "demonstração: justificativa vazia",
        );
      const l = loja();
      const familia = l.familias.find((f) => f.id === familiaId);
      if (!familia)
        throw new ErroRepositorio("nao_encontrado", "demonstração: família");
      const de = familia.estadoSensivel;
      if (ORDEM_ESTADO.indexOf(estado) >= ORDEM_ESTADO.indexOf(de)) {
        throw new ErroRepositorio(
          "recusado",
          `demonstração: reverter só desce o freio (${de} para ${estado})`,
        );
      }
      familia.estadoSensivel = estado;
      familia.estadoSensivelEm =
        estado === "normal" ? null : new Date().toISOString();
      registrarEvento(
        l,
        familiaId,
        "freio",
        "Freio revertido pela coordenação",
        true,
      );
      return freioResposta({
        familia_id: familiaId,
        de,
        para: estado,
        alterado: true,
      });
    },
  };

  const tarefas: TarefasRepositorio = {
    async listarTarefas(filtro = {}) {
      if (bloqueadoPorMfa() || !contexto.usuarioId) return [];
      const l = loja();
      return l.tarefas
        .filter(
          (t) =>
            t.responsavelId === contexto.usuarioId ||
            (t.responsavelId === null &&
              t.papelResponsavel !== null &&
              tem(t.papelResponsavel)) ||
            tem("diretoria"),
        )
        .filter(
          (t) => !filtro.status?.length || filtro.status.includes(t.status),
        )
        .filter((t) => !filtro.familiaId || t.familiaId === filtro.familiaId)
        .filter((t) => !filtro.minhas || t.responsavelId === contexto.usuarioId)
        .sort(
          (a, b) =>
            ORDEM_PRIORIDADE[b.prioridade] - ORDEM_PRIORIDADE[a.prioridade] ||
            (a.venceEm ?? "9").localeCompare(b.venceEm ?? "9"),
        )
        .map((t) => ({
          ...t,
          nomeFamilia:
            l.familias.find((f) => f.id === t.familiaId)?.nome ?? null,
        }));
    },

    async concluirTarefa(tarefaId) {
      const usuarioId = exigirSessao();
      const tarefa = loja().tarefas.find((t) => t.id === tarefaId);
      if (!tarefa)
        throw new ErroRepositorio("nao_encontrado", "demonstração: tarefa");
      const pode =
        tarefa.responsavelId === usuarioId ||
        (tarefa.responsavelId === null &&
          tarefa.papelResponsavel !== null &&
          tem(tarefa.papelResponsavel)) ||
        tem("diretoria");
      if (!pode)
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: tarefa de outra pessoa",
        );
      tarefa.status = "concluida";
    },
  };

  const configuracoes: ConfiguracoesRepositorio = {
    async lerParametro(chave) {
      if (!tem("diretoria") || bloqueadoPorMfa()) return null;
      return loja().parametros.find((p) => p.chave === chave) ?? null;
    },
    async listarParametros() {
      if (!tem("diretoria") || bloqueadoPorMfa()) return [];
      return [...loja().parametros].sort((a, b) =>
        a.chave.localeCompare(b.chave),
      );
    },
    async obterMensagemModelo(chave) {
      if (bloqueadoPorMfa() || contexto.papeis.length === 0) return null;
      return loja().mensagensModelo.find((m) => m.chave === chave) ?? null;
    },
    async listarMensagensModelo(filtro = {}) {
      if (bloqueadoPorMfa() || contexto.papeis.length === 0) return [];
      return loja().mensagensModelo.filter(
        (m) => !filtro.destinatario || m.destinatario === filtro.destinatario,
      );
    },
    async listarPacotesVigentes(data) {
      return VERSOES_PACOTE.filter(
        (v) =>
          v.vigenciaInicio <= data &&
          (v.vigenciaFim === null || v.vigenciaFim >= data),
      ).flatMap((v) => {
        const pacote = PACOTES.find((p) => p.pacoteId === v.pacoteId);
        return pacote
          ? [
              {
                pacoteId: pacote.pacoteId,
                versaoId: v.versaoId,
                nome: pacote.nome,
                dias: pacote.dias,
                gemelar: pacote.gemelar,
                valorCentavos: v.valorCentavos,
                parcelasMaxSemJuros: v.parcelasMaxSemJuros,
                vigenciaInicio: v.vigenciaInicio,
              },
            ]
          : [];
      });
    },
    async listarRegioes() {
      return REGIOES.map((r) => ({ ...r }));
    },
  };

  const veConversas = () =>
    tem("comercial", "coordenacao", "diretoria") && !bloqueadoPorMfa();

  const agente: AgenteRepositorio = {
    async listarConversas(filtro = {}) {
      if (!veConversas()) return [];
      const l = loja();
      const agora = new Date().toISOString();
      const ehLead = (c: (typeof l.conversas)[number]) =>
        ["lead", "cliente", "nao_classificado"].includes(c.classificacao);
      return l.conversas
        .filter((c) => !filtro.familiaId || c.familiaId === filtro.familiaId)
        .filter((c) => {
          switch (filtro.situacao) {
            case "isadora":
              return (
                ehLead(c) &&
                !c.agenteEncerradoEm &&
                (!c.agentePausadoAte || c.agentePausadoAte < agora)
              );
            case "equipe":
              return Boolean(c.agenteEncerradoEm);
            case "pausada":
              return Boolean(c.agentePausadoAte && c.agentePausadoAte > agora);
            case "nao_lead":
              return !ehLead(c);
            default:
              return true;
          }
        })
        .sort((a, b) =>
          (b.ultimaEntradaEm ?? "").localeCompare(a.ultimaEntradaEm ?? ""),
        )
        .slice(0, filtro.limite ?? 100)
        .map((c) => ({
          ...c,
          nomeFamilia:
            l.familias.find((f) => f.id === c.familiaId)?.nome ?? null,
          transferenciaAbertaId:
            l.transferencias.find(
              (t) =>
                t.conversaId === c.id &&
                (t.status === "aberto" || t.status === "assumido"),
            )?.id ?? null,
        }));
    },

    async mensagensDaConversa(conversaId) {
      if (!veConversas()) return [];
      return loja()
        .mensagens.filter((m) => m.conversaId === conversaId)
        .sort((a, b) => a.enviadaEm.localeCompare(b.enviadaEm))
        .map(({ conversaId: _conversaId, ...m }) => m);
    },

    async listarTransferencias(filtro = {}) {
      if (!veConversas()) return [];
      const l = loja();
      return l.transferencias
        .filter(
          (t) => !filtro.status?.length || filtro.status.includes(t.status),
        )
        .filter((t) => !filtro.destino || t.destino === filtro.destino)
        .sort(
          (a, b) =>
            ORDEM_PRIORIDADE[b.prioridade] - ORDEM_PRIORIDADE[a.prioridade] ||
            (a.slaVenceEm ?? "9").localeCompare(b.slaVenceEm ?? "9"),
        )
        .map((t) => ({
          ...t,
          nomeFamilia:
            l.familias.find((f) => f.id === t.familiaId)?.nome ?? null,
        }));
    },

    async assumirTransferencia(transferenciaId) {
      const usuarioId = exigirSessao();
      if (!veConversas())
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: transferências",
        );
      const t = loja().transferencias.find((x) => x.id === transferenciaId);
      if (!t || t.status !== "aberto") {
        throw new ErroRepositorio(
          "recusado",
          "demonstração: já assumida ou resolvida",
        );
      }
      t.status = "assumido";
      t.assumidoPor = usuarioId;
      t.assumidoEm = new Date().toISOString();
    },
  };

  const usuarios: UsuariosRepositorio = {
    async listarUsuarios() {
      if (!tem("diretoria") || bloqueadoPorMfa()) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: só a diretoria vê as sessões",
        );
      }
      const l = loja();
      return l.usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        papeis: [...u.papeis],
        ativo: u.ativo,
        ultimoAcessoEm: new Date(l.criadaEm).toISOString(),
      }));
    },

    async convidarUsuario(pedido) {
      if (!tem("diretoria") || bloqueadoPorMfa())
        return { ok: false, erro: "sem_permissao" };
      const l = loja();
      const email = pedido.email.trim().toLowerCase();
      if (l.usuarios.some((u) => u.email === email))
        return { ok: false, erro: "email_em_uso" };
      const novo = {
        id: crypto.randomUUID(),
        nome: pedido.nome.trim(),
        email,
        papeis: [...pedido.papeis],
        ativo: true,
        mfaCadastrado: false,
      };
      l.usuarios.push(novo);
      return { ok: true, usuarioId: novo.id };
    },

    async revogarSessoes(usuarioId) {
      if (!tem("diretoria") || bloqueadoPorMfa()) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: só a diretoria revoga sessões",
        );
      }
      const l = loja();
      if (!l.usuarios.some((u) => u.id === usuarioId)) {
        throw new ErroRepositorio("nao_encontrado", "demonstração: usuário");
      }
      l.sessoesRevogadasEm[usuarioId] = Date.now();
    },
  };

  return { familias, ficha, tarefas, configuracoes, agente, usuarios };
}
