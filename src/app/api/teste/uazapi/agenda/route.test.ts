// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST, DELETE } from "./route";
import { POST as postOperacao } from "./[...operacao]/route";
import { reiniciarCalendarioTeste } from "../_lib/agenda";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_SEGREDO = process.env.INTERNAL_ROUTES_SECRET;
const ORIGINAL_VERCEL = process.env.VERCEL_ENV;
const SEGREDO = "segredo-de-teste-da-agenda";
const CALENDARIO = "EXEMPLO-calendario@group.calendar.google.invalid";

function controle(
  metodo: "GET" | "POST" | "DELETE",
  corpo?: unknown,
  segredo = SEGREDO,
) {
  return new Request(
    `http://localhost/api/teste/uazapi/agenda?calendarId=${CALENDARIO}`,
    {
      method: metodo,
      headers: {
        "content-type": "application/json",
        ...(segredo ? { "x-kz-interno-secret": segredo } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    },
  );
}

async function chamar(operacao: string, corpo: unknown) {
  return postOperacao(
    new Request(`http://localhost/api/teste/uazapi/agenda/${operacao}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ operacao: operacao.split("/") }) },
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = "homologacao";
  process.env.INTERNAL_ROUTES_SECRET = SEGREDO;
  delete process.env.VERCEL_ENV;
  reiniciarCalendarioTeste();
});

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_ENV;
  process.env.INTERNAL_ROUTES_SECRET = ORIGINAL_SEGREDO;
  if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL;
});

describe("calendário de teste da Isadora (P25b, P28)", () => {
  it("fora de homologação, tudo recusa com 403 e nada é gravado", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
    expect((await GET(controle("GET"))).status).toBe(403);
    expect(
      (await POST(controle("POST", { comando: "liberar_tudo" }))).status,
    ).toBe(403);
    expect((await chamar("livre-ocupado", {})).status).toBe(403);
  });

  it("o painel exige o segredo das rotas internas; o caminho do n8n não", async () => {
    expect((await GET(controle("GET", undefined, ""))).status).toBe(401);
    expect(
      (await POST(controle("POST", { comando: "liberar_tudo" }, "errado")))
        .status,
    ).toBe(401);
    expect((await DELETE(controle("DELETE", undefined, ""))).status).toBe(401);
    const semSegredo = await chamar("livre-ocupado", {
      calendar_id: CALENDARIO,
      time_min: "2026-10-01T00:00:00-03:00",
      time_max: "2026-10-02T00:00:00-03:00",
    });
    expect(semSegredo.status).toBe(200);
  });

  it("devolve os intervalos ocupados que a Edilaine marcou, cria evento com Meet e devolve os erros do Google como status", async () => {
    expect(
      (
        await POST(
          controle("POST", {
            comando: "ocupar",
            calendarId: CALENDARIO,
            inicio: "2026-10-02T14:00:00-03:00",
            fim: "2026-10-02T14:30:00-03:00",
          }),
        )
      ).status,
    ).toBe(200);
    const ocupados = (await (
      await chamar("livre-ocupado", {
        calendar_id: CALENDARIO,
        time_min: "2026-10-02T00:00:00-03:00",
        time_max: "2026-10-03T00:00:00-03:00",
      })
    ).json()) as Array<{ start: string; end: string }>;
    expect(ocupados).toHaveLength(1);

    const criado = await chamar("eventos", {
      calendar_id: CALENDARIO,
      id: "kraam00000000000000000000000000000001",
      summary: "Reunião inicial Kraamzorg",
      start: "2026-10-03T09:00:00-03:00",
      end: "2026-10-03T09:30:00-03:00",
      attendees: ["carla@exemplo.invalid"],
    });
    expect(criado.status).toBe(200);
    const evento = (await criado.json()) as { hangoutLink: string; id: string };
    expect(evento.hangoutLink).toMatch(/^https:\/\/meet\.google\.com\//);

    const repetido = await chamar("eventos", {
      calendar_id: CALENDARIO,
      id: evento.id,
      start: "2026-10-03T10:00:00-03:00",
      end: "2026-10-03T10:30:00-03:00",
    });
    expect(repetido.status).toBe(409);

    const apagar = await POST(
      controle("POST", {
        comando: "apagar",
        calendarId: CALENDARIO,
        eventoId: evento.id,
      }),
    );
    expect(apagar.status).toBe(200);
    const lido = (await (
      await chamar("eventos/obter", {
        calendar_id: CALENDARIO,
        evento_id: evento.id,
      })
    ).json()) as { status: string };
    expect(lido.status).toBe("cancelled");

    await POST(controle("POST", { comando: "fora_do_ar" }));
    const fora = await chamar("livre-ocupado", {
      calendar_id: CALENDARIO,
      time_min: "2026-10-02T00:00:00-03:00",
      time_max: "2026-10-03T00:00:00-03:00",
    });
    expect(fora.status).toBe(503);

    const painel = (await (await GET(controle("GET"))).json()) as {
      chamadas: Array<{ operacao: string }>;
    };
    expect(painel.chamadas.map((c) => c.operacao)).toContain("criar");
  });

  it("evento de outra pessoa criado pelo roteiro existe no calendário mas não conta como chamada da Isadora", async () => {
    const resposta = await POST(
      controle("POST", {
        comando: "criar_evento_alheio",
        calendarId: CALENDARIO,
        inicio: "2026-10-03T13:00:00-03:00",
        fim: "2026-10-03T13:30:00-03:00",
      }),
    );
    const { id } = (await resposta.json()) as { id: string };
    expect(id).toMatch(/^alheio/);
    const painel = (await (await GET(controle("GET"))).json()) as {
      chamadas: unknown[];
      eventos: Array<{ id: string }>;
    };
    expect(painel.chamadas).toHaveLength(0);
    expect(painel.eventos.map((e) => e.id)).toContain(id);
  });

  it("operação desconhecida e comando desconhecido recusam", async () => {
    expect((await chamar("outra-coisa", {})).status).toBe(404);
    expect(
      (await POST(controle("POST", { comando: "inventado" }))).status,
    ).toBe(400);
  });
});
