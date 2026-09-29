import { NextResponse } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { processarItensPrenatal } from "@/lib/sync/prenatal";
import type {
  ItemSincronizacaoEntrada,
  RespostaSincronizacao,
  ResultadoItemSincronizacao,
} from "@/lib/sync/tipos";

const itemSchema = z.object({
  id: z.string().uuid(),
  usuarioId: z.string().min(1),
  entidade: z.literal("consulta_prenatal"),
  entidadeId: z.string().uuid(),
  campo: z.string().min(1).max(200),
  payload: z.unknown(),
  versaoBase: z.number().int().nullable(),
  criadoNoClienteEm: z.iso.datetime(),
});

// O lote é validado em duas etapas, como em /api/sync: item inválido recebe
// "erro" sozinho e não derruba os válidos.
const corpoSchema = z.object({ itens: z.array(z.unknown()).min(1) });

function idInformado(bruto: unknown): string {
  if (bruto && typeof bruto === "object" && "id" in bruto) {
    const { id } = bruto as { id: unknown };
    if (typeof id === "string") return id;
  }
  return "";
}

/**
 * `POST /api/sync/prenatal` (P35, PRD 15): a fila offline da entrevista do
 * DOC 1. Diferente de `/api/sync`, esta rota grava de verdade (funções do
 * schema api pelo repositório da sessão) e por isso roda também em
 * produção. Sessão e AAL2 como na outra rota (dado assistencial, PRD 13 e
 * 21.2); o `usuarioId` de cada item precisa ser o da sessão; e a função do
 * banco confere de novo o papel (coordenação ou diretoria) e o AAL2.
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
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const validos: ItemSincronizacaoEntrada[] = [];
  const recusados: ResultadoItemSincronizacao[] = [];
  for (const bruto of validado.data.itens) {
    const item = itemSchema.safeParse(bruto);
    if (item.success && item.data.usuarioId !== sessao.usuarioId) {
      recusados.push({
        id: item.data.id,
        status: "erro",
        erro: "item de outro usuário",
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

  let resultados: ResultadoItemSincronizacao[] = [];
  if (validos.length > 0) {
    try {
      const { operacao } = await obterRepositorios();
      resultados = await processarItensPrenatal(validos, operacao);
    } catch {
      // Banco fora do ar: nada foi aplicado; o aparelho tenta de novo.
      return NextResponse.json({ erro: "indisponível" }, { status: 503 });
    }
  }
  return NextResponse.json({
    resultados: [...resultados, ...recusados],
  } satisfies RespostaSincronizacao);
}
