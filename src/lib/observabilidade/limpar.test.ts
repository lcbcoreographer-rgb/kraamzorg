import { describe, expect, it } from "vitest";
import { opcoesSentry } from "./config";
import {
  limparEvento,
  limparMigalha,
  limparUrl,
  mascararTexto,
  OCULTO,
} from "./limpar";

describe("mascararTexto", () => {
  it("troca e-mail, CPF e telefone em vários formatos", () => {
    const alvo = [
      "helena.teste@exemplo.invalid",
      "529.982.247-25",
      "52998224725",
      "+55 (11) 91234-5678",
      "(11) 1234-5678",
      "5511912345678",
      "11912345678",
    ];
    for (const dado of alvo) {
      const saida = mascararTexto(`erro com ${dado} no meio`);
      expect(saida, dado).toBe(`erro com ${OCULTO} no meio`);
    }
  });
  it("não estraga texto técnico comum", () => {
    expect(mascararTexto("TypeError: x is not a function at line 42:17")).toBe(
      "TypeError: x is not a function at line 42:17",
    );
    expect(mascararTexto("HTTP 500 em 2026-09-30")).toBe(
      "HTTP 500 em 2026-09-30",
    );
  });
});

describe("limparUrl", () => {
  it("tira query string e fragmento", () => {
    expect(
      limparUrl(
        "https://app.exemplo.invalid/familias/abc?nome=Helena&tel=11912345678#topo",
      ),
    ).toBe("https://app.exemplo.invalid/familias/abc");
  });
  it("esconde o token do formulário do contrato e o segredo do webhook", () => {
    expect(limparUrl("/formulario/tok_abcdef123456")).toBe(
      `/formulario/${OCULTO}`,
    );
    expect(limparUrl("/api/webhooks/autentique/segredo-longo")).toBe(
      `/api/webhooks/autentique/${OCULTO}`,
    );
    expect(limparUrl("https://app.exemplo.invalid/formulario/tok/enviar")).toBe(
      `https://app.exemplo.invalid/formulario/${OCULTO}/enviar`,
    );
  });
  it("URL que não dá para ler vira [oculto]", () => {
    expect(limparUrl("http://[")).toBe(OCULTO);
  });
});

describe("limparMigalha", () => {
  it("descarta console e clique, mascara mensagem e reduz dados de rede", () => {
    expect(
      limparMigalha({ category: "console", message: "Helena" }),
    ).toBeNull();
    expect(
      limparMigalha({ category: "ui.click", message: "botão de Helena" }),
    ).toBeNull();
    const fetchBc = limparMigalha({
      category: "fetch",
      message: "falha para helena@exemplo.invalid",
      data: {
        url: "/api/x?cpf=52998224725",
        method: "POST",
        status_code: 500,
        body: "segredo",
      },
    });
    expect(fetchBc).toEqual({
      category: "fetch",
      message: `falha para ${OCULTO}`,
      data: { url: "/api/x", method: "POST", status_code: 500 },
    });
  });
});

describe("limparEvento", () => {
  const bruto = {
    event_id: "abc",
    level: "error",
    environment: "homologacao",
    release: "deadbeef",
    message: "Falha ao enviar para helena@exemplo.invalid",
    server_name: "maquina-da-helena",
    user: {
      id: "u1",
      email: "helena@exemplo.invalid",
      ip_address: "10.0.0.1",
      username: "Helena",
    },
    extra: { mensagem: "Oi, tudo bem? sou a Helena, meu CPF é 529.982.247-25" },
    request: {
      method: "POST",
      url: "https://app.exemplo.invalid/formulario/tok_secreto/enviar?nome=Helena",
      headers: { cookie: "sb=abc", authorization: "Bearer x" },
      cookies: { sb: "abc" },
      data: { cpf: "52998224725", nome: "Helena" },
      query_string: "nome=Helena",
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "não achei a família de +55 11 91234-5678",
          stacktrace: {
            frames: [
              {
                filename: "app/x.ts",
                lineno: 10,
                vars: { nome: "Helena", texto: "mensagem da família" },
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: "console", message: "Helena digitou" },
      {
        category: "navigation",
        message: "/familias/1?nome=Helena",
        data: { from: "/x?nome=a", to: "/y?nome=b" },
      },
    ],
    contexts: {
      runtime: { name: "node" },
      device: { name: "iPhone de Helena" },
      trace: { trace_id: "t" },
    },
    tags: { rota: "/pagamento/recebido", contato: "helena@exemplo.invalid" },
    modules: { pg: "8" },
    sdkProcessingMetadata: {
      normalizedRequest: { headers: { cookie: "sb=abc" } },
    },
  };

  const saida = limparEvento(bruto) as Record<string, unknown>;
  const texto = JSON.stringify(saida);

  it("nenhum dado de pessoa sobrevive no evento inteiro", () => {
    for (const dado of [
      "helena",
      "Helena",
      "@exemplo.invalid",
      "529.982",
      "52998224725",
      "91234-5678",
      "tok_secreto",
      "sb=abc",
      "Bearer",
      "10.0.0.1",
      "mensagem da família",
      "iPhone",
      "maquina-da",
    ]) {
      expect(texto, dado).not.toContain(dado);
    }
  });

  it("mantém o que ajuda a achar o defeito", () => {
    expect(saida.level).toBe("error");
    expect(saida.environment).toBe("homologacao");
    expect(saida.release).toBe("deadbeef");
    expect(saida.request).toEqual({
      method: "POST",
      url: `https://app.exemplo.invalid/formulario/${OCULTO}/enviar`,
    });
    const excecao = (
      saida.exception as {
        values: {
          type: string;
          value: string;
          stacktrace: { frames: Record<string, unknown>[] };
        }[];
      }
    ).values[0]!;
    expect(excecao.type).toBe("Error");
    expect(excecao.value).toBe(`não achei a família de ${OCULTO}`);
    expect(excecao.stacktrace.frames[0]).toEqual({
      filename: "app/x.ts",
      lineno: 10,
    });
    expect(saida.contexts).toEqual({ runtime: { name: "node" } });
    expect((saida.tags as Record<string, string>).rota).toBe(
      "/pagamento/recebido",
    );
  });

  it("migalha de console some e a de navegação perde a query", () => {
    const migalhas = saida.breadcrumbs as { category: string }[];
    expect(migalhas.map((m) => m.category)).toEqual(["navigation"]);
  });

  it("evento estranho passa sem quebrar", () => {
    expect(limparEvento(null)).toBeNull();
    expect(limparEvento("texto")).toBe("texto");
    expect(limparEvento({})).toEqual({});
  });
});

describe("opcoesSentry", () => {
  it("sem DSN ou em desenvolvimento, não liga", () => {
    expect(
      opcoesSentry({
        NEXT_PUBLIC_APP_ENV: "producao",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      opcoesSentry({
        NEXT_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
        NEXT_PUBLIC_APP_ENV: "desenvolvimento",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });
  it("em homologação e produção liga sem PII, sem desempenho e com a limpeza", () => {
    const o = opcoesSentry({
      NEXT_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
      NEXT_PUBLIC_APP_ENV: "producao",
      VERCEL_GIT_COMMIT_SHA: "abc123",
    } as unknown as NodeJS.ProcessEnv);
    expect(o).toMatchObject({
      environment: "producao",
      release: "abc123",
      sendDefaultPii: false,
      tracesSampleRate: 0,
      enabled: true,
    });
    expect(o?.beforeSend({ user: { email: "a@b.co" } })).toEqual({});
    expect(o?.beforeBreadcrumb({ category: "console" })).toBeNull();
  });
});
