import { NextResponse } from "next/server";
import { ehHomologacao, respostaForaDeHomologacao } from "../../_lib/guarda";
import { ehOperacaoDoFluxo4, obterCalendarioTeste } from "../../_lib/agenda";

/**
 * Google Calendar de teste (P25b, P28) no lugar dos nós do Google Calendar do
 * fluxo 4, quando o config de homologação liga `homologacao.agendaSimulada`.
 * Aceita o n8n sem credencial, de propósito, como `send/text`: o token do
 * Google nunca sai do cofre em homologação. Só existe em homologação; fora
 * dela devolve 403 sem gravar nada.
 *
 * O calendário devolve o mesmo formato do Google (intervalos ocupados, evento
 * com Meet, ou erro). Erro do "Google" vira status HTTP com o código dele
 * (404, 409, 410, 503), e o nó HTTP do n8n o entrega ao fluxo como
 * `{ error: ... }`, igual ao nó do Google Calendar.
 */
export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ operacao: string[] }> },
) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  const { operacao: partes } = await contexto.params;
  const operacao = partes.join("/");
  if (!ehOperacaoDoFluxo4(operacao)) {
    return NextResponse.json(
      { error: `Operação de agenda desconhecida: ${operacao}` },
      { status: 404 },
    );
  }
  let corpo: Record<string, unknown>;
  try {
    corpo = (await requisicao.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido: esperado JSON." },
      { status: 400 },
    );
  }
  try {
    const resposta = obterCalendarioTeste().executarHttp(operacao, corpo);
    return NextResponse.json(resposta);
  } catch (erro) {
    const e = erro as { message?: string; httpCode?: string };
    const codigo = Number(e.httpCode);
    const status =
      Number.isInteger(codigo) && codigo >= 400 && codigo <= 599 ? codigo : 500;
    return NextResponse.json(
      { error: e.message ?? "Erro do calendário de teste" },
      { status },
    );
  }
}
