import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { despacharNotificacao } from "@/modules/mensageria/notificacoes/despachar";

export const runtime = "nodejs";

/**
 * Rota interna de notificação (P18 item 4; PRD 6.7 e 23.3): o banco chama
 * por `pg_net` depois de gravar a linha em `notificacao` (RLS de
 * `0007_permissoes.sql` já cobre o canal "app": a tela lê e marca como
 * lida direto pela tabela, sem passar por aqui — `src/modules/mensageria/
 * notificacoes/central.ts`). Esta rota só cuida dos canais que só o
 * servidor do app alcança: "whatsapp_interno" (grupos e plantão pela
 * UAZAPI, categoria "interna", nunca passa pelo freio), "email" (Resend,
 * reserva) e "push" (ainda pendente do P11). Quem decide o texto e os
 * destinos resolvidos (telefone do grupo, e-mail da pessoa) é quem chama;
 * a rota não lê o banco de novo, só despacha o que já veio pronto.
 *
 * Segredo comparado em tempo constante (nunca `===` nem `.includes`, que
 * vazam o tamanho e o prefixo certo por tempo de resposta): os dois lados
 * viram um hash SHA-256 de tamanho fixo antes de `timingSafeEqual`, então
 * nem o comprimento do segredo escapa pela comparação.
 */
const corpoSchema = z.object({
  titulo: z.string().trim().min(1),
  corpo: z.string().trim().optional(),
  canais: z.array(z.enum(["whatsapp_interno", "email", "push"])).min(1),
  whatsappInterno: z.array(z.object({ telefoneOuJid: z.string().trim().min(1) })).optional(),
  emails: z.array(z.email()).optional(),
});

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.INTERNAL_ROUTES_SECRET;
  if (!esperado || !recebido) return false;
  const hashEsperado = createHash("sha256").update(esperado).digest();
  const hashRecebido = createHash("sha256").update(recebido).digest();
  return timingSafeEqual(hashEsperado, hashRecebido);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!segredoValido(request.headers.get("x-kz-interno-secret"))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const bruto = await request.json().catch(() => null);
  const corpo = corpoSchema.safeParse(bruto);
  if (!corpo.success) {
    return NextResponse.json(
      { erro: "corpo inválido", detalhes: corpo.error.issues },
      { status: 400 },
    );
  }

  const resultados = await despacharNotificacao({
    titulo: corpo.data.titulo,
    corpo: corpo.data.corpo ?? null,
    canais: corpo.data.canais,
    whatsappInterno: corpo.data.whatsappInterno,
    emails: corpo.data.emails,
  });

  return NextResponse.json({ resultados });
}
