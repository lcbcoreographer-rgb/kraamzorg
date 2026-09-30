import { formatarData } from "@/lib/formatacao";
import { estadoPrazo, horaBrasilia } from "../formatacao";
import { MOTIVOS_SENSIVEIS } from "../tipos";
import type {
  ConversaComPausa,
  SituacaoConversa,
  TransferenciaTela,
} from "../tipos";
import type {
  DestinoHandoff,
  MotivoHandoff,
  Prioridade,
  StatusHandoff,
} from "@/lib/dados/tipos";

/**
 * Regras puras da lista de conversas em duas colunas (pedido do dono em
 * 30/09: "estilo WhatsApp Web", com as transferências juntas). Sem React e
 * sem servidor, para o teste unitário ler direto.
 *
 * "Esperando alguém" é a antiga fila de transferências: cada pedido que a
 * Isadora passou para a equipe e ninguém assumiu, na ordem da fila
 * (prioridade, depois o prazo que vence antes). Pedido sem conversa ligada
 * (`handoff.conversa_id` nulo) entra como linha própria.
 */

export type FiltroLista = "todas" | "esperando" | SituacaoConversa;

/**
 * Transferências cuja última mensagem não vira prévia na lista: saúde,
 * perda, estado sensível e mídia que pode ser de saúde (DESIGN.md, 11.8;
 * telas.md C5). A fila e a conversa já avisam.
 */
export const MOTIVOS_SEM_PREVIA: readonly MotivoHandoff[] = [
  "saude",
  "perda",
  "estado_sensivel_escreveu",
  "midia_recebida",
  "audio_nao_transcrito",
];

export const FILTROS_LISTA: readonly FiltroLista[] = [
  "todas",
  "esperando",
  "isadora",
  "equipe",
  "pausada",
  "freio",
  "nao_lead",
];

export function lerFiltro(valor: string | null | undefined): FiltroLista {
  return (FILTROS_LISTA as readonly string[]).includes(valor ?? "")
    ? (valor as FiltroLista)
    : "todas";
}

/** A transferência de uma linha, com o que a lista precisa desenhar. */
export interface TransferenciaDaLinha {
  id: string | null;
  motivo: MotivoHandoff;
  motivoRotulo: string;
  prioridade: Prioridade;
  status: StatusHandoff;
  destino: DestinoHandoff | null;
  criadoEm: string | null;
  slaVenceEm: string | null;
  notificacaoOk: boolean | null;
  pausaVenceu: boolean;
}

export type LinhaLista =
  | {
      tipo: "conversa";
      chave: string;
      conversa: ConversaComPausa;
      transferencia: TransferenciaDaLinha | null;
    }
  | {
      tipo: "pedido";
      chave: string;
      transferencia: TransferenciaDaLinha;
      /** Pedido sem conversa do WhatsApp ligada. */
      pedido: TransferenciaTela;
    };

function daFila(t: TransferenciaTela): TransferenciaDaLinha {
  return {
    id: t.id,
    motivo: t.motivo,
    motivoRotulo: t.motivoRotulo,
    prioridade: t.prioridade,
    status: t.status,
    destino: t.destino,
    criadoEm: t.criadoEm,
    slaVenceEm: t.slaVenceEm,
    notificacaoOk: t.notificacaoOk ?? null,
    pausaVenceu: Boolean(t.pausaVenceu),
  };
}

function daConversa(c: ConversaComPausa): TransferenciaDaLinha | null {
  const t = c.transferenciaAberta;
  if (!t) return null;
  return {
    id: c.transferenciaAbertaId,
    motivo: t.motivo,
    motivoRotulo: t.motivoRotulo,
    prioridade: t.prioridade,
    status: t.status,
    destino: null,
    criadoEm: null,
    slaVenceEm: null,
    notificacaoOk: null,
    pausaVenceu: false,
  };
}

/** Pedido que ninguém pegou ainda. */
export function esperandoAlguem(t: TransferenciaDaLinha | null): boolean {
  return Boolean(t && t.status === "aberto");
}

/**
 * Prioridade máxima esperando alguém fica sempre no topo e nunca some por
 * filtro (fluxos.md, fluxo E, item 1).
 */
export function fixadaNoTopo(linha: LinhaLista): boolean {
  return (
    esperandoAlguem(linha.transferencia) &&
    linha.transferencia?.prioridade === "maxima"
  );
}

export function transferenciaSensivel(t: TransferenciaDaLinha | null): boolean {
  return Boolean(t && MOTIVOS_SENSIVEIS.includes(t.motivo));
}

/**
 * Monta as linhas: uma por conversa, com a transferência aberta que a
 * fila traz (prazo, aviso ao grupo); mais uma linha por pedido sem
 * conversa. A fila vem ordenada pelo repositório.
 */
export function montarLinhas(
  conversas: readonly ConversaComPausa[],
  fila: readonly TransferenciaTela[] = [],
): { linhas: LinhaLista[]; ordemFila: Map<string, number> } {
  const porConversa = new Map<string, TransferenciaTela>();
  const ordemFila = new Map<string, number>();
  fila.forEach((t, i) => {
    if (t.conversaId && !porConversa.has(t.conversaId)) {
      porConversa.set(t.conversaId, t);
    }
    ordemFila.set(t.conversaId ? `c:${t.conversaId}` : `p:${t.id}`, i);
  });

  const linhas: LinhaLista[] = conversas.map((conversa) => {
    const naFila = porConversa.get(conversa.id);
    return {
      tipo: "conversa",
      chave: `c:${conversa.id}`,
      conversa,
      transferencia: naFila ? daFila(naFila) : daConversa(conversa),
    };
  });
  for (const t of fila) {
    if (t.conversaId) continue;
    linhas.push({
      tipo: "pedido",
      chave: `p:${t.id}`,
      transferencia: daFila(t),
      pedido: t,
    });
  }
  return { linhas, ordemFila };
}

function combina(linha: LinhaLista, filtro: FiltroLista): boolean {
  if (filtro === "todas") return linha.tipo === "conversa";
  if (filtro === "esperando") return esperandoAlguem(linha.transferencia);
  if (linha.tipo === "pedido") {
    // Pedido sem conversa já assumido: está com a equipe.
    return filtro === "equipe" && linha.transferencia.status === "assumido";
  }
  if (filtro === "equipe") {
    // Com a equipe: a Isadora saiu da conversa (humano_comercial) ou alguém
    // já assumiu a transferência (a antiga coluna "Com a equipe" da fila).
    return (
      linha.conversa.situacao === "equipe" ||
      linha.transferencia?.status === "assumido"
    );
  }
  return linha.conversa.situacao === filtro;
}

/** "sônia" acha "Sônia"; sem acento e sem caixa. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function nomeDaLinha(linha: LinhaLista): string {
  if (linha.tipo === "pedido") {
    return linha.pedido.nomeFamilia ?? "Contato sem família";
  }
  const c = linha.conversa;
  return c.nomeFamilia ?? c.nomeContato ?? c.telefoneE164 ?? "Contato sem nome";
}

export function nomeDaConversa(c: ConversaComPausa): string {
  return c.nomeFamilia ?? c.nomeContato ?? c.telefoneE164 ?? "Contato sem nome";
}

function casaBusca(linha: LinhaLista, busca: string): boolean {
  const termo = normalizar(busca.trim());
  if (!termo) return true;
  const campos =
    linha.tipo === "pedido"
      ? [nomeDaLinha(linha), linha.transferencia.motivoRotulo]
      : [
          nomeDaLinha(linha),
          linha.conversa.nomeContato ?? "",
          linha.conversa.telefoneE164 ?? "",
        ];
  const digitos = termo.replace(/\D/g, "");
  return campos.some((campo) => {
    if (normalizar(campo).includes(termo)) return true;
    return digitos.length >= 3 && campo.replace(/\D/g, "").includes(digitos);
  });
}

export interface ResultadoLista {
  /** Prioridade máxima esperando alguém, sempre no topo. */
  fixadas: LinhaLista[];
  /** As linhas do filtro, sem repetir as fixadas. */
  linhas: LinhaLista[];
  contagem: Record<FiltroLista, number>;
}

export function filtrarLinhas(
  todas: readonly LinhaLista[],
  filtro: FiltroLista,
  busca = "",
  ordemFila: Map<string, number> = new Map(),
): ResultadoLista {
  const contagem = Object.fromEntries(
    FILTROS_LISTA.map((f) => [f, todas.filter((l) => combina(l, f)).length]),
  ) as Record<FiltroLista, number>;

  const visiveis = todas.filter((l) => casaBusca(l, busca));
  const ordenar = (lista: LinhaLista[]) =>
    filtro === "esperando"
      ? [...lista].sort(
          (a, b) =>
            (ordemFila.get(a.chave) ?? Number.MAX_SAFE_INTEGER) -
            (ordemFila.get(b.chave) ?? Number.MAX_SAFE_INTEGER),
        )
      : lista;

  const fixadas = ordenar(visiveis.filter(fixadaNoTopo));
  const chavesFixadas = new Set(fixadas.map((l) => l.chave));
  const linhas = ordenar(
    visiveis.filter((l) => !chavesFixadas.has(l.chave) && combina(l, filtro)),
  );
  return { fixadas, linhas, contagem };
}

/** A linha fixada é do filtro atual? (Para dizer por que ela está ali.) */
export function linhaDoFiltro(linha: LinhaLista, filtro: FiltroLista): boolean {
  return combina(linha, filtro);
}

const PALAVRAS_FORA = new Set([
  "familia",
  "teste",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

/**
 * Iniciais do avatar ("Família Teste Aurora" vira "A", "Marina Alves" vira
 * "MA"). Telefone ou nome sem letra devolve vazio, e o avatar mostra o
 * ícone de pessoa.
 */
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return "";
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p))
    .filter((p) => !PALAVRAS_FORA.has(normalizar(p)));
  return palavras
    .slice(0, 2)
    .map((p) => (p.match(/\p{L}/u)?.[0] ?? "").toUpperCase())
    .join("");
}

function diaBrasilia(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

/**
 * Hora da última mensagem na linha, como no WhatsApp: a hora quando é
 * hoje, "ontem", e a data curta antes disso.
 */
export function quandoNaLista(
  iso: string | null,
  agora: Date = new Date(),
): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const hoje = diaBrasilia(agora);
  if (diaBrasilia(data) === hoje) return horaBrasilia(iso);
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  if (diaBrasilia(data) === diaBrasilia(ontem)) return "ontem";
  return (formatarData(data) ?? "").slice(0, 5);
}

/**
 * Prazo curto para o canto da linha, como o contador de não lidas do
 * WhatsApp: "38 min", "3 h", "venceu". O resto da frase ("vence em",
 * "há 8 min") vai para o leitor de tela, e a frase inteira continua na
 * faixa da conversa aberta.
 */
export function prazoCurto(
  slaVenceEm: string | null,
  agora: Date = new Date(),
): { antes: string; visivel: string; depois: string } | null {
  if (!slaVenceEm) return null;
  const vence = new Date(slaVenceEm);
  if (Number.isNaN(vence.getTime())) return null;
  const minutos = Math.round((vence.getTime() - agora.getTime()) / 60_000);
  const quanto = (m: number) =>
    m < 60
      ? `${Math.max(m, 1)} min`
      : m < 24 * 60
        ? `${Math.round(m / 60)} h`
        : `${Math.round(m / (24 * 60))} d`;
  if (minutos < 0) {
    return { antes: "", visivel: "venceu", depois: ` há ${quanto(-minutos)}` };
  }
  return { antes: "vence em ", visivel: quanto(minutos), depois: "" };
}

/** Separador de dia no fio de mensagens: "Hoje", "Ontem" ou a data. */
export function rotuloDoDia(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  if (diaBrasilia(data) === diaBrasilia(agora)) return "Hoje";
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  if (diaBrasilia(data) === diaBrasilia(ontem)) return "Ontem";
  return formatarData(data) ?? "";
}

/**
 * O que a navegação conta no item Conversas: quantas conversas esperam
 * alguém, e se alguma pede atenção agora (prazo vencido ou relato de
 * saúde). Perda e estado sensível nunca pintam o contador de vermelho
 * (DESIGN.md, seção 8).
 */
export function contagemParaNavegacao(
  fila: readonly Pick<
    TransferenciaTela,
    "status" | "prioridade" | "motivo" | "criadoEm" | "slaVenceEm"
  >[],
  agora: Date = new Date(),
): { esperando: number; urgente: boolean } {
  const abertas = fila.filter((t) => t.status === "aberto");
  const urgente = abertas.some(
    (t) =>
      !MOTIVOS_SENSIVEIS.includes(t.motivo) &&
      (t.prioridade === "maxima" ||
        estadoPrazo(t.criadoEm, t.slaVenceEm, agora) === "vencido"),
  );
  return { esperando: abertas.length, urgente };
}
