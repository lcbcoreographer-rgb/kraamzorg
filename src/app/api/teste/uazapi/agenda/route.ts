import { NextResponse } from "next/server";
import {
  controleAutorizado,
  ehHomologacao,
  respostaForaDeHomologacao,
  respostaSemSegredo,
} from "../_lib/guarda";
import { obterCalendarioTeste, reiniciarCalendarioTeste } from "../_lib/agenda";

/** Id dos eventos que o roteiro cria como se fossem de outra pessoa. */
const PREFIXO_ALHEIO = "alheio";

/**
 * Painel de controle do calendário de teste (P28): o roteiro de homologação
 * faz aqui o que a Edilaine faria no Google (ocupar um horário, mover ou
 * apagar o evento da Isadora, derrubar o calendário) e lê o que a Isadora
 * chamou, na ordem, para provar que a agenda foi consultada na sugestão, na
 * escolha e antes de criar. Exige o segredo das rotas internas
 * (`_lib/guarda.ts`); os caminhos que o n8n chama estão em
 * `agenda/[...operacao]`.
 */

interface ComandoDoRoteiro {
  comando?: string;
  calendarId?: string;
  eventoId?: string;
  inicio?: string;
  fim?: string;
  operacao?: string;
  mensagem?: string;
  codigo?: number;
  valor?: boolean;
}

export async function GET(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  const url = new URL(requisicao.url);
  const calendarId = url.searchParams.get("calendarId") ?? "";
  const calendario = obterCalendarioTeste();
  return NextResponse.json({
    // Os eventos que o teste cria "de outra pessoa" (id `alheio...`) não são chamada da Isadora.
    chamadas: calendario.chamadas.filter(
      (c) => !String(c["id"] ?? "").startsWith(PREFIXO_ALHEIO),
    ),
    eventos: calendarId ? calendario.eventos(calendarId) : [],
  });
}

export async function POST(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  let corpo: ComandoDoRoteiro;
  try {
    corpo = (await requisicao.json()) as ComandoDoRoteiro;
  } catch {
    return NextResponse.json(
      { erro: "Corpo inválido: esperado JSON." },
      { status: 400 },
    );
  }
  const calendario = obterCalendarioTeste();
  const { comando, calendarId, eventoId, inicio, fim } = corpo;
  try {
    switch (comando) {
      case "ocupar":
        if (!calendarId || !inicio || !fim)
          throw new Error("ocupar precisa de calendarId, inicio e fim");
        calendario.ocupar(calendarId, inicio, fim);
        break;
      case "liberar_tudo":
        calendario.liberarTudo();
        break;
      case "criar_evento_alheio": {
        if (!calendarId || !inicio || !fim)
          throw new Error(
            "criar_evento_alheio precisa de calendarId, inicio e fim",
          );
        const id = `${PREFIXO_ALHEIO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        calendario.executarHttp("eventos", {
          calendar_id: calendarId,
          id,
          summary: "Compromisso pessoal (evento de outra pessoa)",
          start: inicio,
          end: fim,
          attendees: [],
        });
        return NextResponse.json({ ok: true, id });
      }
      case "mover":
        if (!calendarId || !eventoId || !inicio || !fim)
          throw new Error(
            "mover precisa de calendarId, eventoId, inicio e fim",
          );
        calendario.moverPelaEdilaine(calendarId, eventoId, inicio, fim);
        break;
      case "apagar":
        if (!calendarId || !eventoId)
          throw new Error("apagar precisa de calendarId e eventoId");
        calendario.apagarPelaEdilaine(calendarId, eventoId);
        break;
      case "fora_do_ar":
        calendario.ficarForaDoAr(corpo.valor !== false);
        break;
      case "falhar_proxima":
        calendario.falharProxima(
          corpo.operacao ?? "*",
          corpo.mensagem,
          corpo.codigo,
        );
        break;
      default:
        return NextResponse.json(
          { erro: `Comando desconhecido: ${String(comando)}` },
          { status: 400 },
        );
    }
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Comando inválido" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  reiniciarCalendarioTeste();
  return NextResponse.json({ ok: true });
}
