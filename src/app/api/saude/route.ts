import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import { avaliarSaude, type DadosSaude } from "@/lib/observabilidade/saude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saúde do sistema (P14 item 7, PRD 21.4): confere o cron das 7h (recálculo
 * diário), os jobs do agendador, os webhooks e as últimas falhas, pelas datas
 * e contagens de `public.saude_sistema` (só service_role, só números).
 *
 * Aberta, para o monitor de disponibilidade chamar sem credencial: devolve só
 * `{ estado, verificadoEm }`, 200 para `ok` e `atencao`, 503 para `falha`.
 * Com o cabeçalho `x-kz-interno-secret` certo (`INTERNAL_ROUTES_SECRET`,
 * comparado em tempo constante), devolve também cada verificação com o
 * motivo. Nunca há nome, telefone ou mensagem na resposta, nem no log.
 */
function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.INTERNAL_ROUTES_SECRET;
  if (!esperado || !recebido) return false;
  const a = createHash("sha256").update(esperado).digest();
  const b = createHash("sha256").update(recebido).digest();
  return timingSafeEqual(a, b);
}

async function lerDados(): Promise<DadosSaude | null> {
  try {
    const cliente = criarClienteServico("saude_sistema");
    const { data, error } = await cliente.rpc("saude_sistema");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    return data as DadosSaude;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const saude = avaliarSaude(await lerDados());
  const verificadoEm = new Date().toISOString();
  const detalhado = segredoValido(request.headers.get("x-kz-interno-secret"));
  const corpo = detalhado
    ? { estado: saude.estado, verificadoEm, verificacoes: saude.verificacoes }
    : { estado: saude.estado, verificadoEm };
  return Response.json(corpo, {
    status: saude.estado === "falha" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
