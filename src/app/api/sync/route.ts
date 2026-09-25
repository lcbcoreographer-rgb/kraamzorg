import { NextResponse } from "next/server";
import { z } from "zod";
import { processarLote } from "@/lib/sync/protocolo";
import { RepositorioSincronizacaoMemoria } from "@/lib/sync/repositorio-memoria";
import type { RequisicaoSincronizacao } from "@/lib/sync/tipos";

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
  criadoNoClienteEm: z.string().min(1),
});

const corpoSchema = z.object({
  itens: z.array(itemSchema).min(1),
});

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
 */
export async function POST(request: Request) {
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

  const requisicao: RequisicaoSincronizacao = validado.data;
  const resposta = await processarLote(requisicao, repositorio);
  return NextResponse.json(resposta);
}
