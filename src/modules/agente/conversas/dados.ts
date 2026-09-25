import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { FiltroConversas } from "@/lib/dados/tipos";
import { paraConversaComPausa } from "../formatacao";
import { pausaMotivoDemonstracao, resumoConversasReais } from "../repositorio";
import { ROTULO_MOTIVO_HANDOFF } from "../tipos";
import type { ConversaComPausa } from "../tipos";

/** Transferências cuja última mensagem não vira prévia na lista. */
const MOTIVOS_SEM_PREVIA: readonly string[] = [
  "saude",
  "perda",
  "estado_sensivel_escreveu",
  "midia_recebida",
  "audio_nao_transcrito",
];

/**
 * Lista de conversas (P27 item 1, protótipo `comercial-conversas.html`,
 * C5): em que mão está cada uma, com filtro por situação. A contagem de
 * cada filtro vem de pedir a lista completa uma vez (o volume de conversas
 * de uma operação deste porte cabe inteiro na tela, como o protótipo já
 * assume ao trazer "todas" como aba inicial).
 */
export async function listarConversasTela(
  agora: Date = new Date(),
): Promise<ConversaComPausa[]> {
  const { agente, familias } = await obterRepositorios();
  const [conversas, transferenciasAbertas] = await Promise.all([
    agente.listarConversas({ limite: 200 }),
    agente.listarTransferencias({ status: ["aberto", "assumido"] }),
  ]);

  // Freio da família dona de cada conversa (PRD 8.3): a lista não pode
  // convidar ninguém a assumir ou pausar a Isadora numa família em
  // bloqueio total (crítica do CRM, P0 item 3).
  const idsFamilia = [
    ...new Set(
      conversas
        .map((c) => c.familiaId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const estadoSensivelPorFamilia = new Map(
    idsFamilia.length > 0
      ? (await familias.listarFamilias({ ids: idsFamilia })).map((f) => [
          f.id,
          f.estadoSensivel,
        ])
      : [],
  );

  // Mensagem de saúde, de perda ou de estado sensível não aparece como
  // prévia nesta lista (DESIGN.md, telas.md C5): a fila e a conversa já
  // avisam. O mesmo vale para qualquer família em freio (P0 item 3).
  const motivosSensiveisPorConversa = new Set(
    transferenciasAbertas
      .filter((t) => MOTIVOS_SEM_PREVIA.includes(t.motivo))
      .map((t) => t.conversaId)
      .filter((id): id is string => Boolean(id)),
  );

  // Demonstração: a loja está em memória, ler cada conversa custa nada.
  // Supabase real: uma consulta só traz o motivo da pausa e a última
  // mensagem de todas as conversas (`resumoConversasReais`), sem ler o
  // histórico inteiro de cada uma.
  let motivos: Record<string, string | null>;
  let ultimas: Record<string, ConversaComPausa["ultimaMensagem"]>;
  if (modoDados() === "demonstracao") {
    motivos = Object.fromEntries(
      conversas.map((c) => [c.id, pausaMotivoDemonstracao(c.id)]),
    );
    const lidas = await Promise.all(
      conversas.map(async (c) => {
        const ultima = (await agente.mensagensDaConversa(c.id)).at(-1);
        return [
          c.id,
          ultima
            ? { conteudo: ultima.conteudo, enviadoPor: ultima.enviadoPor }
            : null,
        ] as const;
      }),
    );
    ultimas = Object.fromEntries(lidas);
  } else {
    const resumo = await resumoConversasReais(conversas.map((c) => c.id));
    motivos = Object.fromEntries(
      conversas.map((c) => [c.id, resumo[c.id]?.pausaMotivo ?? null]),
    );
    ultimas = Object.fromEntries(
      conversas.map((c) => [c.id, resumo[c.id]?.ultima ?? null]),
    );
  }

  const previas = conversas.map((c) => {
    const estado = c.familiaId
      ? (estadoSensivelPorFamilia.get(c.familiaId) ?? "normal")
      : "normal";
    return motivosSensiveisPorConversa.has(c.id) || estado !== "normal"
      ? null
      : (ultimas[c.id] ?? null);
  });

  const abertaPorConversa = new Map(
    transferenciasAbertas
      .filter((t) => t.conversaId)
      .map((t) => [
        t.conversaId as string,
        {
          motivo: t.motivo,
          motivoRotulo: ROTULO_MOTIVO_HANDOFF[t.motivo],
          prioridade: t.prioridade,
          status: t.status,
        },
      ]),
  );

  return conversas.map((c, i) =>
    paraConversaComPausa(
      c,
      motivos[c.id] ?? null,
      previas[i] ?? null,
      agora,
      abertaPorConversa.get(c.id) ?? null,
      c.familiaId
        ? (estadoSensivelPorFamilia.get(c.familiaId) ?? "normal")
        : "normal",
    ),
  );
}

export type { FiltroConversas };
