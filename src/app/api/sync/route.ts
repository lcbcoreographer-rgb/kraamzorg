import { NextResponse } from "next/server";
import { z } from "zod";
import { vitrineLiberada } from "@/lib/ambiente";
import { obterSessao } from "@/lib/auth/sessao";
import { processarLote } from "@/lib/sync/protocolo";
import { repositorioDaRequisicao } from "@/lib/sync/repositorio-do-servidor";
import type {
  RequisicaoSincronizacao,
  RespostaSincronizacao,
  ResultadoItemSincronizacao,
} from "@/lib/sync/tipos";

const entidadeSchema = z.enum([
  "consulta_prenatal",
  "visita",
  "anexo_audio",
  "alerta_clinico",
  "registro_atendimento",
]);

/** Entidades com gravação real no banco (o resto só sobe fora de produção). */
const ENTIDADES_DE_PRODUCAO: readonly z.infer<typeof entidadeSchema>[] = [
  "visita",
  "registro_atendimento",
  "alerta_clinico",
];

const itemSchema = z.object({
  id: z.string().uuid(),
  usuarioId: z.string().min(1),
  entidade: entidadeSchema,
  entidadeId: z.string().uuid().nullable(),
  campo: z.string().min(1).nullable(),
  payload: z.unknown(),
  versaoBase: z.number().int().nullable(),
  // Data ISO 8601 de verdade: a ordem de aplicação (PRD 15) é decidida por
  // este campo, e um texto qualquer viraria NaN na ordenação.
  criadoNoClienteEm: z.iso.datetime(),
});

// O lote é validado em duas etapas: o envelope inteiro (lista não vazia) e
// depois cada item. Um item inválido recebe "erro" sozinho e não derruba o
// lote: se derrubasse, ele voltaria em todo reenvio e travaria para sempre
// a fila do aparelho, inclusive os itens válidos atrás dele.
const corpoSchema = z.object({
  itens: z.array(z.unknown()).min(1),
});

function idInformado(bruto: unknown): string {
  if (bruto && typeof bruto === "object" && "id" in bruto) {
    const { id } = bruto as { id: unknown };
    if (typeof id === "string") return id;
  }
  return "";
}

/**
 * `POST /api/sync` (PRD 15, invariante 4): idempotente pelo `id` de cada
 * item (gerado no aparelho), aplicado na ordem de criação, conflito
 * resolvido pela coluna `versao` com o original preservado, e registro
 * assistencial que nunca é sobrescrito (divergência vira adendo). A lógica
 * mora em `src/lib/sync/protocolo.ts`, testada direto pelo invariante 4 sem
 * precisar deste servidor HTTP de pé.
 *
 * Autenticação (P07, CRM): a rota lê a sessão do servidor (cookie do
 * Supabase Auth, ou do modo demonstração) e responde JSON com o código
 * HTTP certo, sem redirecionar (quem chama é o motor, por `fetch`). Sem
 * sessão, com perfil desativado ou sem papel: 401. Toda entidade da fila é
 * assistencial, então a sessão precisa estar em AAL2 (PRD 13 e 21.2),
 * mesmo para papel que não é obrigado a ter MFA: sem isso, 403. O
 * `usuarioId` de cada item é conferido contra o da sessão: item de outra
 * pessoa recebe "erro" sozinho, sem derrubar o lote, como o item inválido.
 *
 * Gravação: `visita` (chegada e saída, P38), `registro_atendimento` e
 * `alerta_clinico` (P39 e P40) vão para o banco pelas funções do schema api,
 * com a sessão de quem enviou (`src/lib/sync/repositorio-do-servidor.ts`).
 * Em produção só essas três entidades são aceitas; as outras recebem "erro"
 * no próprio item (a consulta pré-natal sobe por `/api/sync/prenatal`). Fora
 * de produção (`vitrineLiberada()`), o resto continua na memória de processo,
 * para a demonstração do motor (`/dev/sync`).
 */
export async function POST(request: Request) {
  const sessao = await obterSessao();
  if (!sessao || !sessao.ativo || sessao.papeis.length === 0) {
    return NextResponse.json(
      { erro: "Sem sessão. Entre de novo e tente outra vez." },
      { status: 401 },
    );
  }
  if (sessao.aal !== "aal2") {
    return NextResponse.json(
      { erro: "Confirme o código do aplicativo (MFA) e tente de novo." },
      { status: 403 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { erro: "corpo inválido: esperado JSON" },
      { status: 400 },
    );
  }

  const validado = corpoSchema.safeParse(corpo);
  if (!validado.success) {
    return NextResponse.json(
      { erro: "corpo inválido", detalhes: z.treeifyError(validado.error) },
      { status: 400 },
    );
  }

  const validos: RequisicaoSincronizacao["itens"] = [];
  const recusados: ResultadoItemSincronizacao[] = [];
  for (const bruto of validado.data.itens) {
    const item = itemSchema.safeParse(bruto);
    if (item.success && item.data.usuarioId !== sessao.usuarioId) {
      recusados.push({
        id: item.data.id,
        status: "erro",
        erro: "item de outro usuário",
      });
    } else if (
      item.success &&
      !ENTIDADES_DE_PRODUCAO.includes(item.data.entidade) &&
      !vitrineLiberada()
    ) {
      recusados.push({
        id: item.data.id,
        status: "erro",
        erro: "este tipo de registro ainda não sobe por aqui",
      });
    } else if (item.success) {
      validos.push(item.data);
    } else {
      recusados.push({
        id: idInformado(bruto),
        status: "erro",
        erro: "item inválido",
      });
    }
  }

  const resposta =
    validos.length > 0
      ? await processarLote({ itens: validos }, await repositorioDaRequisicao())
      : { resultados: [] };
  return NextResponse.json({
    resultados: [...resposta.resultados, ...recusados],
  } satisfies RespostaSincronizacao);
}
