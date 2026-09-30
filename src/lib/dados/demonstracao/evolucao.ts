import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import { prazosDoAtendimento, situacaoDoPrazo } from "../prazo-evolucao";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AcompanhamentoEvolucao,
  BaseEvolucao,
  DadosEnvioEvolucao,
  DocumentoDaLista,
  EvolucaoDetalhe,
  EvolucaoRepositorio,
  PedidoRegistroEnvio,
  PedidoSalvarEvolucao,
  ResultadoSalvarEvolucao,
  TipoEvolucao,
} from "../tipos-evolucao";
import {
  criarLojaEvolucao,
  type LojaEvolucao,
  type RelatorioDemo,
} from "./evolucao-fixtures";

/**
 * Evolução no modo demonstração (P41): as mesmas regras de
 * 0024_evolucao_ocorrencia_nf.sql sobre uma loja em memória. A prova de
 * permissão e de append-only continua sendo o pgTAP (024); aqui o recorte por
 * papel é o mesmo, simplificado, para as telas e o e2e rodarem sem Supabase.
 * Mesmas recusas, com o mesmo código `evolucao:<código>` na mensagem.
 */

export interface ContextoDemonstracaoEvolucao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

const CHAVE_GLOBAL = "__kraamzorgLojaEvolucao";

export function obterLojaEvolucao(): LojaEvolucao {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaEvolucao>;
  g[CHAVE_GLOBAL] ??= criarLojaEvolucao();
  return g[CHAVE_GLOBAL]!;
}

/** Só para teste: volta a loja ao começo. */
export function reiniciarLojaEvolucao(): void {
  const g = globalThis as unknown as Record<string, LojaEvolucao>;
  g[CHAVE_GLOBAL] = criarLojaEvolucao();
}

function recusa(codigo: string, detalhe = ""): ErroRepositorio {
  return new ErroRepositorio(
    "recusado",
    `evolucao:${codigo} ${detalhe}`.trim(),
  );
}

export function criarEvolucaoDemonstracao(
  contexto: ContextoDemonstracaoEvolucao,
): EvolucaoRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const loja = () => obterLojaEvolucao();

  function exigirSessao(...papeis: Papel[]): string {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige MFA");
    }
    if (papeis.length > 0 && !tem(...papeis)) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem acesso",
      );
    }
    return contexto.usuarioId;
  }

  /** Coordenação e diretoria em todos; enfermeira só nos acompanhamentos em que atende. */
  function acesso(acompanhamentoId: string, escrita: boolean) {
    const l = loja();
    const a = l.acompanhamentos.find((x) => x.id === acompanhamentoId);
    if (!a) throw recusa("acompanhamento_inexistente");
    if (tem("coordenacao")) return a;
    if (tem("diretoria") && !(escrita && !tem("enfermeira"))) return a;
    if (tem("enfermeira") && a.profissionalUsuarioId === contexto.usuarioId) {
      return a;
    }
    throw new ErroRepositorio(
      "sem_permissao",
      "demonstração: acompanhamento fora do seu acesso",
    );
  }

  function relatorio(id: string): RelatorioDemo {
    const r = loja().relatorios.find((x) => x.id === id);
    if (!r) throw recusa("inexistente");
    return r;
  }

  function nomeBebe(bebeId: string | null) {
    return loja().bebes.find((b) => b.id === bebeId) ?? null;
  }

  function temContato(familiaId: string): boolean {
    return loja().medicos.some(
      (m) => m.familiaId === familiaId && (m.email || m.telefoneE164),
    );
  }

  function avisar(
    papel: Papel | null,
    usuarioId: string | null,
    titulo: string,
  ) {
    loja().notificacoes.push({
      papel,
      usuarioId,
      titulo,
      criadoEm: new Date().toISOString(),
    });
  }

  function detalhe(r: RelatorioDemo): EvolucaoDetalhe {
    const l = loja();
    const a = acesso(r.acompanhamentoId, false);
    const bebe = nomeBebe(r.bebeId);
    const coord = tem("coordenacao");
    const prof = l.profissionais.find((p) => p.id === r.profissionalId);
    return {
      id: r.id,
      acompanhamentoId: a.id,
      familiaId: a.familiaId,
      familiaNome: a.familiaNome,
      tipo: r.tipo,
      bebeId: r.bebeId,
      bebeOrdem: bebe?.ordem ?? null,
      bebeNome: bebe?.nome ?? null,
      status: r.status,
      versao: r.versao,
      conteudo: structuredClone(r.conteudo),
      errosValidacao: [...r.erros],
      notaRevisao: r.notaRevisao,
      profissionalId: r.profissionalId,
      profissionalNome: prof?.nome ?? null,
      aprovadoEm: r.aprovadoEm,
      enviadoEm: r.enviadoEm,
      erroEnvio: r.erroEnvio,
      temPdf: r.pdfPath !== null,
      podeEditar:
        r.status === "rascunho" || (coord && r.status === "em_revisao"),
      podeEnviarRevisao: r.status === "rascunho" && r.erros.length === 0,
      podeAprovar: coord && r.status === "em_revisao" && r.erros.length === 0,
      podeReenviar: coord && r.status === "erro_envio",
    };
  }

  function baseDe(acompanhamentoId: string): BaseEvolucao {
    const l = loja();
    const a = acesso(acompanhamentoId, false);
    const visitas = l.visitas
      .filter((v) => v.acompanhamentoId === a.id && v.dados)
      .sort((x, y) => x.diaNumero - y.diaNumero);
    const datas = visitas.map((v) => v.data).sort();
    const prof = l.profissionais.find((p) => p.id === a.profissionalId)!;
    const pessoa = l.pessoas.find((p) => p.familiaId === a.familiaId);
    return structuredClone({
      acompanhamento: {
        id: a.id,
        familiaId: a.familiaId,
        estado: "em_execucao",
        diasContratados: a.diasContratados,
        inicio: datas[0] ?? null,
        fim: datas[datas.length - 1] ?? null,
        concluidoEm: datas[datas.length - 1] ?? null,
        dataAlta: a.dataAlta,
        dataNascimento: a.dataNascimento,
      },
      hoje: l.hoje,
      familiaNome: a.familiaNome,
      paciente: pessoa ? { nome: pessoa.nome, idade: pessoa.idade } : null,
      filiacao: l.pessoas
        .filter((p) => p.familiaId === a.familiaId)
        .map((p) => p.nome),
      bebes: l.bebes
        .filter((b) => b.familiaId === a.familiaId)
        .sort((x, y) => x.ordem - y.ordem)
        .map((b) => ({
          id: b.id,
          ordem: b.ordem,
          nome: b.nome,
          sexo: b.sexo,
          tipoParto: b.tipoParto,
          dataNascimento: b.dataNascimento,
          pesoNascimentoG: b.pesoNascimentoG,
          pesoAltaG: b.pesoAltaG,
        })),
      medicos: l.medicos
        .filter((m) => m.familiaId === a.familiaId)
        .map((m) => ({
          id: m.id,
          especialidade: m.especialidade,
          nome: m.nome,
          temEmail: Boolean(m.email),
          emailMascarado: m.email
            ? m.email.replace(/^(.).*(@.*)$/, "$1***$2")
            : null,
          temContato: Boolean(m.email || m.telefoneE164),
        })),
      profissional: {
        id: prof.id,
        nome: prof.nome,
        funcao: prof.funcao,
        conselho: prof.conselho,
        conselhoUf: prof.conselhoUf,
        conselhoNumero: prof.conselhoNumero,
      },
      funcoes: l.funcoes,
      visitas: visitas.map((v) => ({
        visitaId: v.id,
        diaNumero: v.diaNumero,
        data: v.data,
        profissionalId: a.profissionalId,
        dados: v.dados!,
      })),
      relatorios: l.relatorios
        .filter((r) => r.acompanhamentoId === a.id)
        .map((r) => ({
          id: r.id,
          tipo: r.tipo,
          bebeId: r.bebeId,
          status: r.status,
          versao: r.versao,
          enviadoEm: r.enviadoEm,
        })),
      textos: l.textos,
      orientacoesRotulos: l.orientacoesRotulos,
    });
  }

  return {
    async listar(situacao) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      const l = loja();
      const itens: AcompanhamentoEvolucao[] = [];
      for (const a of l.acompanhamentos) {
        if (
          !tem("coordenacao", "diretoria") &&
          a.profissionalUsuarioId !== contexto.usuarioId
        ) {
          continue;
        }
        const datas = l.visitas
          .filter(
            (v) =>
              v.acompanhamentoId === a.id &&
              v.dados &&
              v.diaNumero === a.diasContratados,
          )
          .map((v) => v.data);
        if (datas.length === 0) continue;
        const concluidoEm = datas.sort().at(-1)!;
        const prazos = prazosDoAtendimento(concluidoEm, l.prazo);
        const bebes = l.bebes
          .filter((b) => b.familiaId === a.familiaId)
          .sort((x, y) => x.ordem - y.ordem);
        const doc = (
          tipo: TipoEvolucao,
          bebeId: string | null,
          ordem: number,
          nome: string | null,
        ): DocumentoDaLista => {
          const r = l.relatorios.find(
            (x) =>
              x.acompanhamentoId === a.id &&
              x.tipo === tipo &&
              x.bebeId === bebeId,
          );
          return {
            tipo,
            bebeId,
            bebeOrdem: ordem,
            bebeNome: nome,
            relatorioId: r?.id ?? null,
            status: r?.status ?? null,
            enviadoEm: r?.enviadoEm ?? null,
            comErros: (r?.erros.length ?? 0) > 0,
          };
        };
        const documentos = [
          doc("puerperal", null, 0, null),
          ...bebes.map((b) => doc("neonatal", b.id, b.ordem, b.nome)),
        ];
        const situacaoAcomp = situacaoDoPrazo(
          l.hoje,
          prazos,
          documentos.map((d) => d.status),
        );
        if (situacao === "abertas" && situacaoAcomp === "concluida") continue;
        itens.push({
          acompanhamentoId: a.id,
          familiaId: a.familiaId,
          familiaNome: a.familiaNome,
          concluidoEm,
          prazoAviso: prazos.aviso,
          prazoEscala: prazos.escala,
          situacao: situacaoAcomp,
          bloqueadoContato: !temContato(a.familiaId),
          profissionalNome:
            l.profissionais.find((p) => p.id === a.profissionalId)?.nome ??
            null,
          documentos,
        });
      }
      itens.sort(
        (x, y) =>
          Number(x.situacao === "concluida") -
            Number(y.situacao === "concluida") ||
          x.concluidoEm.localeCompare(y.concluidoEm),
      );
      return { hoje: l.hoje, acompanhamentos: itens };
    },

    async base(acompanhamentoId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      return baseDe(acompanhamentoId);
    },

    async obter(relatorioId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      return detalhe(relatorio(relatorioId));
    },

    async salvar(
      pedido: PedidoSalvarEvolucao,
    ): Promise<ResultadoSalvarEvolucao> {
      const usuarioId = exigirSessao("enfermeira", "coordenacao");
      const l = loja();
      const a = acesso(pedido.acompanhamentoId, true);
      if ((pedido.tipo === "neonatal") !== (pedido.bebeId !== null)) {
        throw recusa("bebe_por_tipo");
      }
      if (
        pedido.bebeId &&
        !l.bebes.some(
          (b) => b.id === pedido.bebeId && b.familiaId === a.familiaId,
        )
      ) {
        throw recusa("bebe_de_outra_familia");
      }
      if (!temContato(a.familiaId)) throw recusa("contato_medico_pendente");
      const existente = l.relatorios.find(
        (r) =>
          r.acompanhamentoId === a.id &&
          r.tipo === pedido.tipo &&
          r.bebeId === pedido.bebeId,
      );
      if (existente) {
        if (["aprovado", "enviado", "erro_envio"].includes(existente.status)) {
          throw recusa("ja_aprovada");
        }
        if (existente.status === "em_revisao" && !tem("coordenacao")) {
          throw recusa("em_revisao");
        }
        if (
          pedido.versaoBase !== undefined &&
          pedido.versaoBase !== null &&
          pedido.versaoBase !== existente.versao
        ) {
          throw recusa("versao_desatualizada", "o documento mudou");
        }
        existente.conteudo = structuredClone(pedido.conteudo);
        existente.erros = [...pedido.erros];
        existente.versao += 1;
        return {
          id: existente.id,
          versao: existente.versao,
          status: existente.status,
          criado: false,
        };
      }
      const novo: RelatorioDemo = {
        id: crypto.randomUUID(),
        acompanhamentoId: a.id,
        tipo: pedido.tipo,
        bebeId: pedido.bebeId,
        conteudo: structuredClone(pedido.conteudo),
        erros: [...pedido.erros],
        status: "rascunho",
        versao: 1,
        notaRevisao: null,
        profissionalId: a.profissionalId,
        aprovadoEm: null,
        aprovadoPor: null,
        enviadoEm: null,
        destinatarios: null,
        erroEnvio: null,
        pdfPath: null,
        criadoPor: usuarioId,
      };
      l.relatorios.push(novo);
      return { id: novo.id, versao: 1, status: "rascunho", criado: true };
    },

    async enviarParaRevisao(relatorioId, versaoBase) {
      exigirSessao("enfermeira", "coordenacao");
      const r = relatorio(relatorioId);
      acesso(r.acompanhamentoId, true);
      if (r.status !== "rascunho") throw recusa("fora_do_rascunho");
      if (versaoBase !== null && versaoBase !== r.versao) {
        throw recusa("versao_desatualizada", "o documento mudou");
      }
      if (r.erros.length > 0) throw recusa("com_erros");
      r.status = "em_revisao";
      r.notaRevisao = null;
      r.versao += 1;
      avisar(
        "coordenacao",
        null,
        "Evolução de enfermagem aguardando aprovação",
      );
    },

    async devolver(relatorioId, motivo) {
      exigirSessao("coordenacao");
      const r = relatorio(relatorioId);
      if (motivo.trim().length < 5) throw recusa("motivo_curto");
      if (r.status !== "em_revisao") throw recusa("fora_da_revisao");
      r.status = "rascunho";
      r.notaRevisao = motivo.trim().slice(0, 1000);
      r.versao += 1;
      const prof = loja().profissionais.find((p) => p.id === r.profissionalId);
      avisar(
        null,
        prof?.usuarioId ?? null,
        "A coordenação devolveu uma evolução com um recado",
      );
    },

    async aprovar(relatorioId, versaoBase) {
      const usuarioId = exigirSessao("coordenacao");
      const l = loja();
      const r = relatorio(relatorioId);
      const a = l.acompanhamentos.find((x) => x.id === r.acompanhamentoId)!;
      if (r.status !== "em_revisao") throw recusa("fora_da_revisao");
      if (versaoBase !== null && versaoBase !== r.versao) {
        throw recusa("versao_desatualizada", "o documento mudou");
      }
      if (r.erros.length > 0) throw recusa("com_erros");
      const especialidade = r.tipo === "puerperal" ? "obstetra" : "pediatra";
      const medicos = l.medicos.filter(
        (m) =>
          m.familiaId === a.familiaId &&
          m.especialidade === especialidade &&
          m.email,
      );
      if (medicos.length === 0) throw recusa("sem_email_do_medico");
      r.status = "aprovado";
      r.aprovadoPor = usuarioId;
      r.aprovadoEm = new Date().toISOString();
      r.destinatarios = medicos.map((m) => ({ especialidade, medicoId: m.id }));
      r.versao += 1;
    },

    async dadosEnvio(relatorioId): Promise<DadosEnvioEvolucao> {
      exigirSessao("coordenacao");
      const l = loja();
      const r = relatorio(relatorioId);
      if (!["aprovado", "erro_envio"].includes(r.status))
        throw recusa("nao_aprovada");
      const a = l.acompanhamentos.find((x) => x.id === r.acompanhamentoId)!;
      const ids = new Set((r.destinatarios ?? []).map((d) => d.medicoId));
      return {
        relatorioId: r.id,
        tipo: r.tipo,
        status: r.status,
        conteudo: structuredClone(r.conteudo),
        destinatarios: l.medicos
          .filter((m) => ids.has(m.id) && m.email)
          .map((m) => ({
            medicoId: m.id,
            especialidade: m.especialidade,
            nome: m.nome,
            email: m.email!,
          })),
        nomesProibidos: [
          ...l.pessoas
            .filter((p) => p.familiaId === a.familiaId)
            .map((p) => p.nome),
          ...l.bebes
            .filter((b) => b.familiaId === a.familiaId && b.nome)
            .map((b) => b.nome!),
          a.familiaNome,
        ],
        config: { ...l.emailConfig },
        textos: { assunto: l.textosEmail.assunto, corpo: l.textosEmail.corpo },
      };
    },

    async registrarEnvio(pedido: PedidoRegistroEnvio) {
      exigirSessao("coordenacao");
      const l = loja();
      const r = relatorio(pedido.relatorioId);
      if (!["aprovado", "erro_envio"].includes(r.status))
        throw recusa("nao_aprovada");
      if (pedido.erro) {
        r.status = "erro_envio";
        r.erroEnvio = pedido.erro.trim().slice(0, 300);
        r.versao += 1;
        return;
      }
      if (pedido.pdfPath !== `evolucoes/${r.id}.pdf`)
        throw recusa("caminho_invalido");
      if (pedido.enviados.length === 0) throw recusa("sem_destinatario");
      r.status = "enviado";
      r.enviadoEm = new Date().toISOString();
      r.pdfPath = pedido.pdfPath;
      r.erroEnvio = null;
      r.destinatarios = pedido.enviados.map((e) => ({
        especialidade: e.especialidade,
        medicoId: e.medicoId,
      }));
      r.versao += 1;
      const a = l.acompanhamentos.find((x) => x.id === r.acompanhamentoId)!;
      if (
        !l.tarefas.some(
          (t) => t.acompanhamentoId === a.id && t.acao === "evolucao_familia",
        )
      ) {
        l.tarefas.push({
          id: crypto.randomUUID(),
          acompanhamentoId: a.id,
          familiaId: a.familiaId,
          acao: "evolucao_familia",
          titulo: `Enviar a evolução de enfermagem para a família ${a.familiaNome}`,
          papelResponsavel: "coordenacao",
        });
      }
    },

    async caminhoPdf(relatorioId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      const r = relatorio(relatorioId);
      acesso(r.acompanhamentoId, false);
      if (!r.pdfPath) throw recusa("sem_pdf");
      return r.pdfPath;
    },
  };
}
