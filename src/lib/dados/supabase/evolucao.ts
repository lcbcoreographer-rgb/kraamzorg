import "server-only";
import type { Json } from "@/lib/db/types";
import type {
  AcompanhamentoEvolucao,
  BaseEvolucao,
  ConteudoSalvo,
  DadosEnvioEvolucao,
  DocumentoDaLista,
  DocumentoExistente,
  EvolucaoDetalhe,
  EvolucaoRepositorio,
  ListaEvolucoes,
  ResultadoSalvarEvolucao,
  SituacaoEvolucao,
  StatusEvolucao,
  TipoEvolucao,
} from "../tipos-evolucao";
import { rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Evolução na real (P41): funções do schema api da
 * 0024_evolucao_ocorrencia_nf.sql. Papel, AAL e família conferidos por
 * dentro de cada função; a leitura grava log de auditoria no banco.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const numero = (v: Json | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;
const numeroOuNulo = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : null;
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const textos = (v: Json | undefined): string[] =>
  lista(v).filter((x): x is string => typeof x === "string");

function mapaDeTextos(v: Json | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(objeto(v))) {
    if (typeof valor === "string") saida[chave] = valor;
  }
  return saida;
}

export function listaEvolucoesDoBanco(valor: Json): ListaEvolucoes {
  const r = objeto(valor);
  return {
    hoje: texto(r.hoje) ?? "",
    acompanhamentos: lista(r.acompanhamentos).map((a): AcompanhamentoEvolucao => {
      const x = objeto(a);
      return {
        acompanhamentoId: String(x.acompanhamento_id),
        familiaId: String(x.familia_id),
        familiaNome: String(x.familia_nome ?? ""),
        concluidoEm: texto(x.concluido_em) ?? "",
        prazoAviso: texto(x.prazo_aviso) ?? "",
        prazoEscala: texto(x.prazo_escala) ?? "",
        situacao: (texto(x.situacao) ?? "no_prazo") as SituacaoEvolucao,
        bloqueadoContato: x.bloqueado_contato === true,
        profissionalNome: texto(x.profissional_nome),
        documentos: lista(x.documentos).map((d): DocumentoDaLista => {
          const y = objeto(d);
          return {
            tipo: (texto(y.tipo) ?? "puerperal") as TipoEvolucao,
            bebeId: texto(y.bebe_id),
            bebeOrdem: numero(y.bebe_ordem),
            bebeNome: texto(y.bebe_nome),
            relatorioId: texto(y.relatorio_id),
            status: texto(y.status) as StatusEvolucao | null,
            enviadoEm: texto(y.enviado_em),
            comErros: y.com_erros === true,
          };
        }),
      };
    }),
  };
}

export function baseDoBanco(valor: Json): BaseEvolucao {
  const r = objeto(valor);
  const a = objeto(r.acompanhamento);
  const p = r.paciente ? objeto(r.paciente) : null;
  const prof = r.profissional ? objeto(r.profissional) : null;
  return {
    acompanhamento: {
      id: String(a.id),
      familiaId: String(a.familia_id),
      estado: String(a.estado ?? ""),
      diasContratados: numero(a.dias_contratados),
      inicio: texto(a.inicio),
      fim: texto(a.fim),
      concluidoEm: texto(a.concluido_em),
      dataAlta: texto(a.data_alta),
      dataNascimento: texto(a.data_nascimento),
    },
    hoje: texto(r.hoje) ?? "",
    familiaNome: String(r.familia_nome ?? ""),
    paciente: p
      ? { nome: String(p.nome ?? ""), idade: numeroOuNulo(p.idade) }
      : null,
    filiacao: textos(r.filiacao),
    bebes: lista(r.bebes).map((b) => {
      const x = objeto(b);
      return {
        id: String(x.id),
        ordem: numero(x.ordem) || 1,
        nome: texto(x.nome),
        sexo: texto(x.sexo) as BaseEvolucao["bebes"][number]["sexo"],
        tipoParto: texto(x.tipo_parto) as BaseEvolucao["bebes"][number]["tipoParto"],
        dataNascimento: texto(x.data_nascimento),
        pesoNascimentoG: numeroOuNulo(x.peso_nascimento_g),
        pesoAltaG: numeroOuNulo(x.peso_alta_g),
      };
    }),
    medicos: lista(r.medicos).map((m) => {
      const x = objeto(m);
      return {
        id: String(x.id),
        especialidade: (texto(x.especialidade) ??
          "outro") as BaseEvolucao["medicos"][number]["especialidade"],
        nome: String(x.nome ?? ""),
        temEmail: x.tem_email === true,
        emailMascarado: texto(x.email_mascarado),
        temContato: x.tem_contato === true,
      };
    }),
    profissional: prof
      ? {
          id: String(prof.id),
          nome: String(prof.nome ?? ""),
          funcao: String(prof.funcao ?? ""),
          conselho: texto(prof.conselho),
          conselhoUf: texto(prof.conselho_uf),
          conselhoNumero: texto(prof.conselho_numero),
        }
      : null,
    funcoes: mapaDeTextos(r.funcoes),
    visitas: lista(r.visitas).map((v) => {
      const x = objeto(v);
      return {
        visitaId: String(x.visita_id),
        diaNumero: numero(x.dia_numero),
        data: texto(x.data) ?? "",
        profissionalId: String(x.profissional_id),
        dados: objeto(x.dados) as Record<string, unknown>,
      };
    }),
    relatorios: lista(r.relatorios).map((d): DocumentoExistente => {
      const x = objeto(d);
      return {
        id: String(x.id),
        tipo: (texto(x.tipo) ?? "puerperal") as TipoEvolucao,
        bebeId: texto(x.bebe_id),
        status: (texto(x.status) ?? "rascunho") as StatusEvolucao,
        versao: numero(x.versao) || 1,
        enviadoEm: texto(x.enviado_em),
      };
    }),
    textos: mapaDeTextos(r.textos),
    orientacoesRotulos: mapaDeTextos(r.rotulos_orientacoes),
  };
}

function conteudoSalvo(valor: Json | undefined): ConteudoSalvo {
  const x = objeto(valor);
  return {
    dados: objeto(x.dados) as Record<string, unknown>,
    conteudo: x.conteudo ? (objeto(x.conteudo) as Record<string, unknown>) : null,
  };
}

export function detalheDoBanco(valor: Json): EvolucaoDetalhe {
  const x = objeto(valor);
  return {
    id: String(x.id),
    acompanhamentoId: String(x.acompanhamento_id),
    familiaId: String(x.familia_id),
    familiaNome: String(x.familia_nome ?? ""),
    tipo: (texto(x.tipo) ?? "puerperal") as TipoEvolucao,
    bebeId: texto(x.bebe_id),
    bebeOrdem: numeroOuNulo(x.bebe_ordem),
    bebeNome: texto(x.bebe_nome),
    status: (texto(x.status) ?? "rascunho") as StatusEvolucao,
    versao: numero(x.versao) || 1,
    conteudo: conteudoSalvo(x.conteudo),
    errosValidacao: textos(x.erros_validacao),
    notaRevisao: texto(x.nota_revisao),
    profissionalId: String(x.profissional_id),
    profissionalNome: texto(x.profissional_nome),
    aprovadoEm: texto(x.aprovado_em),
    enviadoEm: texto(x.enviado_em),
    erroEnvio: texto(x.erro_envio),
    temPdf: x.tem_pdf === true,
    podeEditar: x.pode_editar === true,
    podeEnviarRevisao: x.pode_enviar_revisao === true,
    podeAprovar: x.pode_aprovar === true,
    podeReenviar: x.pode_reenviar === true,
  };
}

export function envioDoBanco(valor: Json): DadosEnvioEvolucao {
  const x = objeto(valor);
  const config = objeto(x.config);
  const t = objeto(x.textos);
  return {
    relatorioId: String(x.relatorio_id),
    tipo: (texto(x.tipo) ?? "puerperal") as TipoEvolucao,
    status: (texto(x.status) ?? "aprovado") as StatusEvolucao,
    conteudo: conteudoSalvo(x.conteudo),
    destinatarios: lista(x.destinatarios).map((d) => {
      const y = objeto(d);
      return {
        medicoId: String(y.medico_id),
        especialidade: (texto(y.especialidade) ??
          "outro") as DadosEnvioEvolucao["destinatarios"][number]["especialidade"],
        nome: String(y.nome ?? ""),
        email: String(y.email ?? ""),
      };
    }),
    nomesProibidos: textos(x.nomes_proibidos),
    config: {
      tratamento: texto(config.tratamento) ?? undefined,
      coordenacao: texto(config.coordenacao) ?? undefined,
      contato: texto(config.contato) ?? undefined,
    },
    textos: {
      assunto: texto(t.email_evolucao_assunto),
      corpo: texto(t.email_evolucao_corpo),
    },
  };
}

export function criarEvolucaoSupabase(
  contexto: ContextoSupabase,
): EvolucaoRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown>) =>
    rpcPendente(contexto.cliente, funcao, args);
  return {
    async listar(situacao) {
      return listaEvolucoesDoBanco(await chamar("evolucoes", { p_situacao: situacao }));
    },
    async base(acompanhamentoId) {
      return baseDoBanco(
        await chamar("base_evolucao", { p_acompanhamento_id: acompanhamentoId }),
      );
    },
    async obter(relatorioId) {
      return detalheDoBanco(await chamar("evolucao", { p_relatorio_id: relatorioId }));
    },
    async salvar(pedido): Promise<ResultadoSalvarEvolucao> {
      const r = objeto(
        await chamar("salvar_evolucao", {
          p_acompanhamento_id: pedido.acompanhamentoId,
          p_tipo: pedido.tipo,
          p_bebe_id: pedido.bebeId,
          p_conteudo: pedido.conteudo as unknown as Json,
          p_erros: pedido.erros,
          p_versao_base: pedido.versaoBase ?? null,
        }),
      );
      return {
        id: String(r.id),
        versao: numero(r.versao) || 1,
        status: (texto(r.status) ?? "rascunho") as StatusEvolucao,
        criado: r.criado === true,
      };
    },
    async enviarParaRevisao(relatorioId, versaoBase) {
      await chamar("enviar_evolucao_para_revisao", {
        p_relatorio_id: relatorioId,
        p_versao_base: versaoBase,
      });
    },
    async devolver(relatorioId, motivo) {
      await chamar("devolver_evolucao", { p_relatorio_id: relatorioId, p_motivo: motivo });
    },
    async aprovar(relatorioId, versaoBase) {
      await chamar("aprovar_evolucao", {
        p_relatorio_id: relatorioId,
        p_versao_base: versaoBase,
      });
    },
    async dadosEnvio(relatorioId) {
      return envioDoBanco(
        await chamar("dados_envio_evolucao", { p_relatorio_id: relatorioId }),
      );
    },
    async registrarEnvio(pedido) {
      await chamar("registrar_envio_evolucao", {
        p_relatorio_id: pedido.relatorioId,
        p_pdf_path: pedido.pdfPath,
        p_enviados: pedido.enviados.map((e) => ({
          especialidade: e.especialidade,
          medico_id: e.medicoId,
          enviado_em: e.enviadoEm,
        })),
        p_erro: pedido.erro ?? null,
      });
    },
    async caminhoPdf(relatorioId) {
      const r = objeto(await chamar("pdf_evolucao", { p_relatorio_id: relatorioId }));
      return String(r.pdf_path);
    },
  };
}
