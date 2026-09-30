import type { ClassificacaoLead, EstagioP1, EstagioP2 } from "../tipos";
import {
  CIDADES,
  ID_COMERCIAL,
  type FamiliaDemonstracao,
  type OportunidadeDemonstracao,
  type PessoaDemonstracao,
} from "./fixtures";

/**
 * Volume extra do modo demonstração, só para testar o CRM com cara de
 * operação de verdade (pipeline cheio, busca, filtros). Liga com
 * KZ_DEMO_VOLUME=grande (o `pnpm dev:demo` já liga). Os testes automáticos
 * rodam sem ele, então nada do que eles conferem muda.
 *
 * Tudo fictício: "Família Teste" com nome de planta ou de paisagem, pessoas
 * "Nome Teste Sobrenome" e telefones na faixa +55 11 90000-09xx, a mesma
 * faixa de teste do seed. Nenhum dado real.
 */

const NOMES_FAMILIA = [
  "Acácia",
  "Alecrim",
  "Amora",
  "Anis",
  "Aroeira",
  "Avelã",
  "Baunilha",
  "Cacau",
  "Caju",
  "Canela",
  "Cereja",
  "Cravo",
  "Figo",
  "Gardênia",
  "Hortelã",
  "Lavanda",
  "Lima",
  "Louro",
  "Magnólia",
  "Malva",
  "Manacá",
  "Nuvem",
  "Oliva",
  "Orvalho",
  "Palmeira",
  "Pitanga",
  "Romã",
  "Sálvia",
  "Semente",
  "Tulipa",
  "Zínia",
  "Açaí",
  "Bambu",
  "Coral",
  "Luar",
  "Sereno",
] as const;

const NOMES_PESSOA = [
  "Ana",
  "Bruna",
  "Carla",
  "Daniela",
  "Elisa",
  "Fabiana",
  "Gabriela",
  "Helena",
  "Isabela",
  "Joana",
  "Larissa",
  "Mariana",
] as const;

const NOMES_PARCEIRO = [
  "Pedro",
  "Lucas",
  "Thiago",
  "André",
  "Diego",
  "Rodrigo",
] as const;

const BAIRROS: Record<keyof typeof CIDADES, readonly string[]> = {
  saoPaulo: [
    "Pinheiros",
    "Moema",
    "Perdizes",
    "Vila Madalena",
    "Brooklin",
    "Tatuapé",
    "Santana",
    "Campo Belo",
  ],
  alphaville: ["Alphaville 1", "Alphaville 10"],
  granjaViana: ["Granja Viana"],
  santoAndre: ["Jardim", "Campestre"],
  saoBernardo: ["Rudge Ramos", "Centro"],
  londrina: ["Gleba Palhano", "Centro", "Bela Suíça"],
};

const CIDADES_CICLO: (keyof typeof CIDADES)[] = [
  "saoPaulo",
  "saoPaulo",
  "saoPaulo",
  "alphaville",
  "londrina",
  "saoPaulo",
  "granjaViana",
  "saoPaulo",
  "londrina",
  "santoAndre",
];

/** Onde cada família gerada cai: pipeline, estágio e semanas até a DPP. */
const DISTRIBUICAO: {
  pipeline: 1 | 2;
  p1: EstagioP1 | null;
  p2: EstagioP2 | null;
}[] = [
  { pipeline: 1, p1: "novo", p2: null },
  { pipeline: 1, p1: "novo", p2: null },
  { pipeline: 1, p1: "em_conversa_ia", p2: null },
  { pipeline: 1, p1: "em_conversa_ia", p2: null },
  { pipeline: 1, p1: "em_conversa_ia", p2: null },
  { pipeline: 1, p1: "qualificado", p2: null },
  { pipeline: 1, p1: "qualificado", p2: null },
  { pipeline: 1, p1: "sessao_venda_agendada", p2: null },
  { pipeline: 1, p1: "sessao_venda_realizada", p2: null },
  { pipeline: 1, p1: "nutricao", p2: null },
  { pipeline: 1, p1: "nao_qualificado", p2: null },
  { pipeline: 2, p1: "sessao_venda_realizada", p2: "proposta_enviada" },
  { pipeline: 2, p1: "sessao_venda_realizada", p2: "em_negociacao" },
];

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

function dataDaqui(agora: number, dias: number): string {
  return new Date(agora + dias * 86_400_000).toISOString().slice(0, 10);
}

function classificar(score: number): ClassificacaoLead {
  if (score >= 70) return "quente";
  if (score >= 45) return "morno";
  return "frio";
}

export interface VolumeDemonstracao {
  familias: FamiliaDemonstracao[];
  pessoas: PessoaDemonstracao[];
  oportunidades: OportunidadeDemonstracao[];
}

/** Liga o volume extra só quando o ambiente pede. */
export function volumeGrandeLigado(): boolean {
  return process.env.KZ_DEMO_VOLUME === "grande";
}

export function gerarVolume(agora: number): VolumeDemonstracao {
  const familias: FamiliaDemonstracao[] = [];
  const pessoas: PessoaDemonstracao[] = [];
  const oportunidades: OportunidadeDemonstracao[] = [];
  let telefone = 901;

  NOMES_FAMILIA.forEach((sobrenome, i) => {
    const n = i + 1;
    const destino = DISTRIBUICAO[i % DISTRIBUICAO.length]!;
    const cidadeChave = CIDADES_CICLO[i % CIDADES_CICLO.length]!;
    const bairros = BAIRROS[cidadeChave];
    // DPP entre 3 e 26 semanas à frente, espalhada
    const diasAteDpp = 21 + ((i * 37) % 160);
    const score = 25 + ((i * 29) % 70);
    const familiaId = id(60, n);

    familias.push({
      id: familiaId,
      nome: `Família Teste ${sobrenome}`,
      bairro: bairros[i % bairros.length]!,
      cidade: CIDADES[cidadeChave],
      dpp: dataDaqui(agora, diasAteDpp),
      dataNascimento: null,
      dataAlta: null,
      dataInicioEfetivo: null,
      gemelar: i % 11 === 7,
      primeiraGestacao: i % 3 !== 0,
      estadoSensivel: "normal",
      estadoSensivelEm: null,
      naoContatar: false,
    });

    pessoas.push({
      id: id(80, telefone),
      familiaId,
      papel: "mae",
      nome: `${NOMES_PESSOA[i % NOMES_PESSOA.length]} Teste ${sobrenome}`,
      telefoneE164: `+5511900000${telefone}`,
      email: null,
      contatoPrincipal: true,
    });
    telefone += 1;
    if (i % 4 === 1) {
      pessoas.push({
        id: id(80, telefone),
        familiaId,
        papel: "parceiro",
        nome: `${NOMES_PARCEIRO[i % NOMES_PARCEIRO.length]} Teste ${sobrenome}`,
        telefoneE164: `+5511900000${telefone}`,
        email: null,
        contatoPrincipal: false,
      });
      telefone += 1;
    }

    const recebeuApresentacao = destino.p1 !== "novo";
    oportunidades.push({
      id: id(70, n),
      familiaId,
      pipeline: destino.pipeline,
      estagioP1: destino.p1,
      estagioP2: destino.p2,
      score,
      classificacao: classificar(score),
      pdfEnviadoEm: recebeuApresentacao
        ? new Date(agora - ((i % 9) + 1) * 86_400_000).toISOString()
        : null,
      cadenciaEtapa: destino.p1 === "em_conversa_ia" ? i % 3 : 0,
      motivoPerda: null,
      responsavelId: ID_COMERCIAL,
      proximoContatoEm: null,
    });
  });

  return { familias, pessoas, oportunidades };
}
