import { garantirDemonstracaoPermitida } from "@/lib/dados/modo";
import { TRANSFERENCIAS } from "@/lib/dados/demonstracao/fixtures";
import type {
  ClassificacaoNaoLead,
  ConfiguracaoAgente,
  ItemBaseConhecimento,
  ModoAgente,
  UltimaIngestao,
} from "./tipos";

/**
 * Loja em memória do modo demonstração, só para o que este módulo
 * acrescenta e a loja da fundação (`src/lib/dados/demonstracao/loja.ts`)
 * não guarda: modo do agente e números de teste (a fundação seleciona por
 * `agente_modo`/`agente_whitelist` só como leitura de `configuracoes`, sem
 * escrita), base de conhecimento (schema `agente`, fora do que
 * `LojaDemonstracao` cobre) e o texto da pausa manual de uma conversa
 * (`conversa.agente_pausa_motivo`, que `ResumoConversa` não expõe).
 *
 * Mesmo padrão de `loja.ts`: nasce fictícia, vive em `globalThis` para
 * sobreviver à recarga de módulo do `next dev`, e só roda em desenvolvimento
 * (`garantirDemonstracaoPermitida`).
 */
export interface LojaAgenteExtra {
  criadaEm: number;
  modo: ModoAgente;
  numerosTeste: string[];
  configAtualizadaEm: string | null;
  followupHoras: number;
  followupAtualizadoEm: string | null;
  baseConhecimento: ItemBaseConhecimento[];
  ultimaIngestao: UltimaIngestao | null;
  /** conversaId -> texto da pausa manual ("Assumida por Otávio Lemos às 15:26."). */
  pausaMotivo: Record<string, string>;
  /** transferenciaId -> desfecho escolhido em "Marcar como resolvida". */
  desfecho: Record<string, string>;
  /** transferenciaId -> false quando o aviso ao grupo falhou (faixa vermelha). */
  notificacaoOk: Record<string, boolean>;
}

const CHAVE_GLOBAL = "__kraamzorgLojaAgenteExtra";

function isoDaqui(agora: number, minutos: number): string {
  return new Date(agora + minutos * 60_000).toISOString();
}

function itensIniciais(agora: number): ItemBaseConhecimento[] {
  const base: Omit<ItemBaseConhecimento, "atualizadoEm">[] = [
    {
      id: "bc-institucional",
      tipo: "institucional",
      titulo: "O que é a Kraamzorg Brasil",
      texto:
        "Cuidado pós-parto em casa nos primeiros dias com o bebê, com enfermeira especializada, seguindo o método kraamzorg holandês adaptado para o Brasil.",
      fonte: "Apresentação 2026, p.2",
      status: "aprovado",
      aprovadoPor: "Leonardo (diretoria)",
      aprovadoEm: isoDaqui(agora, -30 * 24 * 60),
    },
    {
      id: "bc-faq-dias",
      tipo: "faq",
      titulo: "Diferença entre 6 e 12 dias",
      texto:
        "O Essencial acompanha 6 dias e o Imersão 12 dias corridos a partir do início efetivo, sempre com visitas diárias da mesma enfermeira de referência.",
      fonte: "FAQ homologada",
      status: "aprovado",
      aprovadoPor: "Leonardo (diretoria)",
      aprovadoEm: isoDaqui(agora, -30 * 24 * 60),
    },
    {
      id: "bc-objecao-doula",
      tipo: "objecao",
      titulo: "Substitui doula?",
      texto:
        "Não. A doula acompanha o parto e o preparo; a Kraamzorg cuida da rotina em casa depois que a família volta para casa com o bebê.",
      fonte: "Treinamento 24/09",
      status: "rascunho",
      aprovadoPor: null,
      aprovadoEm: null,
    },
    {
      id: "bc-cobertura-sp",
      tipo: "cobertura",
      titulo: "Área atendida",
      texto:
        "Hoje o atendimento cobre a cidade de São Paulo e Londrina. Fora dessas praças, a Isadora explica que ainda não há cobertura.",
      fonte: "Apresentação 2026, p.4",
      status: "rascunho",
      aprovadoPor: null,
      aprovadoEm: null,
    },
  ];
  return base.map((item) => ({
    ...item,
    atualizadoEm: isoDaqui(agora, -30 * 24 * 60),
  }));
}

function criarLojaExtra(agora = Date.now()): LojaAgenteExtra {
  return {
    criadaEm: agora,
    modo: "teste",
    numerosTeste: ["+5511900000001", "+5511900000002"],
    configAtualizadaEm: isoDaqui(agora, -7 * 24 * 60),
    followupHoras: 48,
    followupAtualizadoEm: isoDaqui(agora, -4 * 24 * 60),
    baseConhecimento: itensIniciais(agora),
    ultimaIngestao: {
      em: isoDaqui(agora, -2 * 24 * 60),
      ok: true,
      itens: 2,
      erro: null,
    },
    pausaMotivo: {},
    desfecho: {},
    // Uma transferência nasce com o aviso ao grupo falhado (faixa vermelha,
    // protótipo `comercial-inicio.html`), para o estado ter exemplo na
    // demonstração. As demais seguem "notificacaoOk: true" (loja.ts).
    notificacaoOk: Object.fromEntries(
      TRANSFERENCIAS.filter((t) => t.motivo === "condicao_comercial").map(
        (t) => [t.id, false],
      ),
    ),
  };
}

/** A loja do processo. Lança erro fora de desenvolvimento (`modo.ts`). */
export function obterLojaExtra(): LojaAgenteExtra {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<
    string,
    LojaAgenteExtra | undefined
  >;
  global[CHAVE_GLOBAL] ??= criarLojaExtra();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta a loja ao estado inicial. */
export function reiniciarLojaExtra(agora?: number): LojaAgenteExtra {
  const global = globalThis as unknown as Record<
    string,
    LojaAgenteExtra | undefined
  >;
  global[CHAVE_GLOBAL] = criarLojaExtra(agora);
  return global[CHAVE_GLOBAL];
}

export function configuracaoDaLoja(l: LojaAgenteExtra): ConfiguracaoAgente {
  return {
    modo: l.modo,
    numerosTeste: [...l.numerosTeste],
    atualizadoEm: l.configAtualizadaEm,
  };
}

export const CLASSIFICACOES_NAO_LEAD: readonly ClassificacaoNaoLead[] = [
  "candidata",
  "fornecedor",
  "consultorio",
];
