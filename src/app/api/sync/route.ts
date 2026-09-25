import { NextResponse } from "next/server";
import { z } from "zod";
import { vitrineLiberada } from "@/lib/ambiente";
import { processarLote } from "@/lib/sync/protocolo";
import { RepositorioSincronizacaoMemoria } from "@/lib/sync/repositorio-memoria";
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
 * Repositório de processo (ver `src/lib/sync/repositorio.ts` e
 * `docs/sessoes/P12.md`, "Pendências"): sem `src/lib/db` (P01) e sem as
 * tabelas assistenciais escritas por formulário (P34 a P39), ainda não há
 * onde persistir de verdade. Um deploy serverless pode reiniciar este
 * módulo a qualquer chamada; quando o P01 e os formulários existirem,
 * troque esta linha por uma implementação de `RepositorioSincronizacao`
 * que fale com `api.*` (PostgREST só expõe `public` e `api`, PRD 5.2). O
 * motor do aparelho (`src/lib/sync/motor.ts`) e esta rota não mudam.
 */
const repositorio = new RepositorioSincronizacaoMemoria();

/**
 * `POST /api/sync` (PRD 15, invariante 4): idempotente pelo `id` de cada
 * item (gerado no aparelho), aplicado na ordem de criação, conflito
 * resolvido pela coluna `versao` com o original preservado, e registro
 * assistencial que nunca é sobrescrito (divergência vira adendo). A lógica
 * mora em `src/lib/sync/protocolo.ts`, testada direto pelo invariante 4 sem
 * precisar deste servidor HTTP de pé.
 *
 * [confirmar] Autenticação: esta rota ainda não exige sessão (P07 não
 * existe nesta sessão). `usuarioId` vem do corpo, o que um cliente mal
 * intencionado pode forjar. Quando o P07 existir, a rota deve ler o
 * usuário da sessão Supabase (cookie), recusar sem AAL2 quando a entidade
 * for assistencial, e ignorar (ou conferir contra) o `usuarioId` do corpo.
 *
 * Por isso, enquanto a autenticação (P07) e o repositório real não
 * existirem, a rota só responde fora de produção, com a mesma trava de
 * `/dev/sync` (`vitrineLiberada()`): em produção devolve 404, sem ler o
 * corpo. Sem essa trava, um endpoint público aceitaria dado assistencial
 * de qualquer pessoa e o guardaria na memória do processo.
 */
export async function POST(request: Request) {
  if (!vitrineLiberada()) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
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
    if (item.success) {
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
      ? await processarLote({ itens: validos }, repositorio)
      : { resultados: [] };
  return NextResponse.json({
    resultados: [...resposta.resultados, ...recusados],
  } satisfies RespostaSincronizacao);
}
