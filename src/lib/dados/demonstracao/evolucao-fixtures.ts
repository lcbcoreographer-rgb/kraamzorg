import type { Papel } from "@/lib/auth/papeis";
import type {
  ConteudoSalvo,
  StatusEvolucao,
  TipoEvolucao,
} from "../tipos-evolucao";
import type { ConfigPrazo } from "../prazo-evolucao";
import {
  DEFINICAO_DOC2,
  ID_USUARIO_COORDENACAO,
  ID_USUARIO_ENFERMEIRA,
  dadosDeExemplo,
  dataBrasilia,
} from "./assistencial-fixtures";
import { TEXTOS_PADRAO_EVOLUCAO } from "./textos-padrao-evolucao";

/**
 * Dados fictícios da evolução no modo demonstração (P41). Nenhum nome ou
 * contato real: "Família Teste ...", "Bebê Teste ...", e-mails
 * `@exemplo.invalid`. Os registros de cada dia usam o mesmo gerador do
 * checklist (`dadosDeExemplo`), então a evolução se monta sobre dados com a
 * forma do DOC 2 aprovado, sem inventar campo clínico.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

export interface AcompanhamentoDemoEvolucao {
  id: string;
  familiaId: string;
  familiaNome: string;
  diasContratados: number;
  dataAlta: string;
  dataNascimento: string;
  profissionalId: string;
  profissionalUsuarioId: string;
}

export interface RelatorioDemo {
  id: string;
  acompanhamentoId: string;
  tipo: TipoEvolucao;
  bebeId: string | null;
  conteudo: ConteudoSalvo;
  erros: string[];
  status: StatusEvolucao;
  versao: number;
  notaRevisao: string | null;
  profissionalId: string;
  aprovadoEm: string | null;
  aprovadoPor: string | null;
  enviadoEm: string | null;
  destinatarios: { especialidade: string; medicoId: string }[] | null;
  erroEnvio: string | null;
  pdfPath: string | null;
  criadoPor: string;
}

export interface LojaEvolucao {
  hoje: string;
  prazo: ConfigPrazo;
  acompanhamentos: AcompanhamentoDemoEvolucao[];
  pessoas: { familiaId: string; nome: string; idade: number }[];
  bebes: {
    id: string;
    familiaId: string;
    ordem: number;
    nome: string;
    sexo: "feminino" | "masculino";
    tipoParto: "vaginal" | "cesarea";
    dataNascimento: string;
    pesoNascimentoG: number;
    pesoAltaG: number;
  }[];
  medicos: {
    id: string;
    familiaId: string;
    especialidade: "obstetra" | "pediatra";
    nome: string;
    email: string | null;
    telefoneE164: string | null;
  }[];
  profissionais: {
    id: string;
    usuarioId: string;
    nome: string;
    funcao: string;
    conselho: string;
    conselhoUf: string;
    conselhoNumero: string;
  }[];
  visitas: {
    id: string;
    acompanhamentoId: string;
    diaNumero: number;
    data: string;
    dados: Record<string, unknown> | null;
  }[];
  relatorios: RelatorioDemo[];
  textos: Record<string, string>;
  textosEmail: { assunto: string; corpo: string };
  emailConfig: { tratamento?: string; coordenacao?: string; contato?: string };
  funcoes: Record<string, string>;
  orientacoesRotulos: Record<string, string>;
  notificacoes: {
    papel: Papel | null;
    usuarioId: string | null;
    titulo: string;
    criadoEm: string;
  }[];
  tarefas: {
    id: string;
    acompanhamentoId: string;
    familiaId: string;
    acao: string;
    titulo: string;
    papelResponsavel: string;
  }[];
}

function rotulosDeOrientacao(): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const bloco of DEFINICAO_DOC2.blocos) {
    if (bloco.id !== "4" && bloco.id !== "5") continue;
    for (const campo of bloco.campos ?? []) {
      if (campo.tipo === "sim_nao")
        saida[`${bloco.id}.${campo.id}`] = campo.rotulo;
    }
  }
  return saida;
}

interface CasoDemo {
  n: number;
  familia: string;
  gemelar: boolean;
  /** Dias antes de hoje em que o último dia do acompanhamento aconteceu. */
  concluidoHa: number;
  comContatos: boolean;
  /** Lesão mamilar, laser e ILIB nos dias do meio (dá o que preencher na evolução). */
  comLesao: boolean;
}

function registroDoDia(
  dia: number,
  data: string,
  bebeIds: string[],
  caso: CasoDemo,
  cesarea: boolean,
): Record<string, unknown> {
  const evn = [6, 5, 3, 1, 0, 0][dia - 1] ?? 0;
  const pesoBase = [3120, 3150, 3190, 3230, 3270, 3310][dia - 1] ?? 3310;
  const dados = dadosDeExemplo(
    {
      data,
      temperatura: 36.4 + (dia % 3) * 0.2,
      pesoBebe: pesoBase,
      sistolica: 108 + dia * 2,
      diastolica: 70 + dia,
      frequenciaCardiaca: 72 + dia,
      temperaturaBebe: 36.6 + (dia % 2) * 0.2,
    },
    bebeIds,
  );
  dados["2.6"] = {
    dor_mamilos_amamentar: evn > 0,
    evn,
    intervencoes_para_dor: "Compressa morna e pega corrigida",
  };
  if (cesarea) {
    dados["2.2"] = {
      cesarea_sem_sinais_infeccao: true,
      episiotomia_laceracao_sem_alteracoes: true,
      orientacoes_cuidado_reforcadas: true,
    };
  }
  if (caso.comLesao && dia >= 2 && dia <= 4) {
    dados["2.7"] = {
      lesao_mamilar: "esquerda",
      nts: 3,
      interrupcao_adequada_succao: true,
    };
  }
  if (caso.comLesao && (dia === 2 || dia === 3)) {
    dados["2.9"] = {
      fbm_aplicada: dia === 2 ? ["analgesia", "ilib"] : ["reparacao"],
    };
  }
  dados["3.2"] = bebeIds.map((bebeId) => ({
    bebe_id: bebeId,
    troca_fraldas_avaliacao_diurese: {
      resposta: true,
      texto: "Diurese presente",
    },
    coto_umbilical_avaliado: {
      resposta: true,
      texto:
        dia >= 5 ? "em mumificação, seco" : "úmido, sem sinais flogísticos",
    },
  }));
  dados["4"] = {
    massagem_extracao_leite: true,
    correcao_pega_posicao: dia <= 3,
    livre_demanda_reforcada: true,
  };
  dados["5"] = { sono_seguro_orientado: dia === 1 };
  return dados;
}

export function criarLojaEvolucao(): LojaEvolucao {
  const hoje = dataBrasilia(0);
  const casos: CasoDemo[] = [
    {
      n: 1,
      familia: "Família Teste Aurora",
      gemelar: false,
      concluidoHa: 0,
      comContatos: true,
      comLesao: true,
    },
    {
      n: 2,
      familia: "Família Teste Brisa",
      gemelar: true,
      concluidoHa: 0,
      comContatos: true,
      comLesao: false,
    },
    {
      n: 3,
      familia: "Família Teste Cedro",
      gemelar: false,
      concluidoHa: 0,
      comContatos: false,
      comLesao: false,
    },
    {
      n: 4,
      familia: "Família Teste Estrela",
      gemelar: false,
      concluidoHa: 12,
      comContatos: true,
      comLesao: false,
    },
  ];
  const profissional = {
    id: id(500, 1),
    usuarioId: ID_USUARIO_ENFERMEIRA,
    nome: "Enfermeira Teste Lima",
    funcao: "enfermeira_obstetrica",
    conselho: "COREN",
    conselhoUf: "SP",
    conselhoNumero: "TESTE-SP-0001",
  };
  const loja: LojaEvolucao = {
    hoje,
    prazo: { alertaDias: 1, escalaCoordenacaoDias: 2, feriados: [] },
    acompanhamentos: [],
    pessoas: [],
    bebes: [],
    medicos: [],
    profissionais: [profissional],
    visitas: [],
    relatorios: [],
    textos: { ...TEXTOS_PADRAO_EVOLUCAO },
    textosEmail: {
      assunto: "Evolução de enfermagem · Kraamzorg Brasil",
      corpo:
        "Olá, {tratamento} {medico}. Segue em anexo a evolução de enfermagem do acompanhamento domiciliar de {paciente}, realizado de {inicio} a {fim}, aprovada pela coordenação de enfermagem da Kraamzorg Brasil. Em caso de dúvida, fale com {coordenacao} pelo {contato}.",
    },
    emailConfig: {
      tratamento: "Dr(a).",
      coordenacao: "a coordenação de enfermagem",
      contato: "e-mail coordenacao@exemplo.invalid",
    },
    funcoes: {
      enfermeira_obstetrica: "Enfermeira obstetra",
      enfermeira_neonatal: "Enfermeira neonatal",
      coordenacao: "Coordenação de enfermagem",
    },
    orientacoesRotulos: rotulosDeOrientacao(),
    notificacoes: [],
    tarefas: [],
  };

  for (const caso of casos) {
    const familiaId = id(600, caso.n);
    const acompanhamentoId = id(610, caso.n);
    const dias = 6;
    const fim = dataBrasilia(-caso.concluidoHa);
    const dataAlta = dataBrasilia(-caso.concluidoHa - dias - 2);
    const dataNascimento = dataBrasilia(-caso.concluidoHa - dias - 4);
    loja.acompanhamentos.push({
      id: acompanhamentoId,
      familiaId,
      familiaNome: caso.familia,
      diasContratados: dias,
      dataAlta,
      dataNascimento,
      profissionalId: profissional.id,
      profissionalUsuarioId: ID_USUARIO_ENFERMEIRA,
    });
    const sobrenome = caso.familia.replace("Família Teste ", "");
    loja.pessoas.push(
      { familiaId, nome: `Marina Teste ${sobrenome}`, idade: 29 },
      { familiaId, nome: `Rafael Teste ${sobrenome}`, idade: 31 },
    );
    const bebeIds: string[] = [];
    const quantos = caso.gemelar ? 2 : 1;
    for (let i = 1; i <= quantos; i += 1) {
      const bebeId = id(620, caso.n * 10 + i);
      bebeIds.push(bebeId);
      loja.bebes.push({
        id: bebeId,
        familiaId,
        ordem: i,
        nome: `Bebê Teste ${sobrenome}${caso.gemelar ? ` ${i}` : ""}`,
        sexo: i === 1 ? "feminino" : "masculino",
        tipoParto: caso.n === 1 ? "cesarea" : "vaginal",
        dataNascimento,
        pesoNascimentoG: 3300 - (i - 1) * 300,
        pesoAltaG: 3150 - (i - 1) * 300,
      });
    }
    if (caso.comContatos) {
      loja.medicos.push(
        {
          id: id(630, caso.n * 10 + 1),
          familiaId,
          especialidade: "obstetra",
          nome: `Dra. Helena Teste Obstetra ${sobrenome}`,
          email: `helena.${sobrenome.toLowerCase()}@exemplo.invalid`,
          telefoneE164: null,
        },
        {
          id: id(630, caso.n * 10 + 2),
          familiaId,
          especialidade: "pediatra",
          nome: `Dr. Rodrigo Teste Pediatra ${sobrenome}`,
          email: `rodrigo.${sobrenome.toLowerCase()}@exemplo.invalid`,
          telefoneE164: null,
        },
      );
    }
    for (let dia = 1; dia <= dias; dia += 1) {
      const data = dataBrasilia(-caso.concluidoHa - (dias - dia));
      void fim;
      loja.visitas.push({
        id: id(640, caso.n * 100 + dia),
        acompanhamentoId,
        diaNumero: dia,
        data,
        dados: registroDoDia(dia, data, bebeIds, caso, caso.n === 1),
      });
    }
  }
  void ID_USUARIO_COORDENACAO;
  return loja;
}
