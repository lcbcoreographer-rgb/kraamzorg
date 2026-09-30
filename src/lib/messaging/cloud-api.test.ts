import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCapturas, listarCapturas } from "./captura";
import {
  criarMensageiroCloudApi,
  dentroDaJanela,
  renderizarModelo,
  type CatalogoModelos,
  type ModeloAprovado,
} from "./cloud-api";
import type { PedidoEnvio, VerificadorFreio } from "./tipos";

/**
 * P18b, aceite: envio dentro e fora da janela, com o modelo aprovado certo
 * escolhido fora dela, e nenhum texto livre fora da janela. Credencial de
 * sandbox simulada: `fetchImpl` no lugar da rede da Meta.
 */

const AGORA = new Date("2026-09-30T15:00:00-03:00");
const horasAtras = (h: number) =>
  new Date(AGORA.getTime() - h * 3_600_000).toISOString();

const MODELO_PDF: ModeloAprovado = {
  mensagemChave: "followup_d1_pos_pdf",
  nomeMeta: "kz_retorno_apresentacao",
  idioma: "pt_BR",
  variaveis: ["nome"],
  valoresPadrao: { nome: "tudo bem" },
  texto: "Oi, {{1}} 😊 Conseguiu ver a apresentação com calma?",
};
const MODELO_ABERTURA: ModeloAprovado = {
  mensagemChave: "followup_d1_pos_abertura",
  nomeMeta: "kz_retorno_conversa",
  idioma: "pt_BR",
  variaveis: [],
  valoresPadrao: {},
  texto: "Oi! Vi que você entrou em contato com a Kraamzorg Brasil.",
};

const catalogo: CatalogoModelos = {
  buscarAprovado: vi.fn(
    async (chave: string) =>
      [MODELO_PDF, MODELO_ABERTURA].find((m) => m.mensagemChave === chave) ??
      null,
  ),
};

const livre: VerificadorFreio = vi.fn(async () => ({ pode: true, motivo: "" }));

function pedido(extra: Partial<PedidoEnvio> = {}): PedidoEnvio {
  return {
    familiaId: "familia-1",
    categoria: "conteudo",
    destinatario: "familia",
    telefoneOuJid: "+5511900000001",
    texto: "TEXTO LIVRE QUE NÃO PODE SAIR FORA DA JANELA",
    ultimaMensagemFamiliaEm: horasAtras(50),
    modelo: {
      mensagemChave: "followup_d1_pos_pdf",
      variaveis: { nome: "Helena" },
    },
    ...extra,
  };
}

function respostaOk(id = "wamid.ABC") {
  return new Response(JSON.stringify({ messages: [{ id }] }), { status: 200 });
}

function mensageiro(fetchImpl: typeof fetch) {
  return criarMensageiroCloudApi({
    credenciais: { token: "token-de-teste", phoneNumberId: "1234567890" },
    urlBase: "https://graph.exemplo.invalid",
    versaoGraph: "v0.0",
    janelaHoras: 24,
    catalogo,
    fetchImpl,
    agora: () => AGORA,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  limparCapturas();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dentroDaJanela", () => {
  it("conta a janela desde a última mensagem da família", () => {
    expect(dentroDaJanela(horasAtras(2), 24, AGORA)).toBe(true);
    expect(dentroDaJanela(horasAtras(23.9), 24, AGORA)).toBe(true);
    expect(dentroDaJanela(horasAtras(24.1), 24, AGORA)).toBe(false);
    expect(dentroDaJanela(horasAtras(50), 24, AGORA)).toBe(false);
  });
  it("sem data, sem parâmetro ou com data inválida, conta como fora", () => {
    expect(dentroDaJanela(null, 24, AGORA)).toBe(false);
    expect(dentroDaJanela(undefined, 24, AGORA)).toBe(false);
    expect(dentroDaJanela(horasAtras(1), null, AGORA)).toBe(false);
    expect(dentroDaJanela(horasAtras(1), 0, AGORA)).toBe(false);
    expect(dentroDaJanela("não é data", 24, AGORA)).toBe(false);
  });
  it("data no futuro não abre a janela", () => {
    expect(dentroDaJanela(horasAtras(-3), 24, AGORA)).toBe(false);
  });
});

describe("renderizarModelo", () => {
  it("troca as variáveis na ordem", () => {
    expect(renderizarModelo("Oi, {{1}} e {{2}}!", ["A", "B"])).toBe(
      "Oi, A e B!",
    );
  });
});

describe("cloud_api dentro da janela de 24 horas", () => {
  it("envia texto livre pela Graph API com o token no cabeçalho", async () => {
    const buscar = vi.fn(async () => respostaOk("wamid.LIVRE"));
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({
        ultimaMensagemFamiliaEm: horasAtras(2),
        texto: "Oi, tudo bem?",
      }),
      livre,
    );

    expect(r).toMatchObject({
      ok: true,
      canal: "cloud_api",
      modo: "enviado",
      via: "texto_livre",
      idExterno: "wamid.LIVRE",
      texto: "Oi, tudo bem?",
    });
    const [url, init] = buscar.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://graph.exemplo.invalid/v0.0/1234567890/messages");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer token-de-teste",
    );
    const corpo = JSON.parse(String(init.body));
    expect(corpo).toMatchObject({
      messaging_product: "whatsapp",
      to: "5511900000001",
      type: "text",
      text: { body: "Oi, tudo bem?" },
    });
    expect(corpo.template).toBeUndefined();
  });
});

describe("cloud_api fora da janela de 24 horas", () => {
  it("envia o modelo aprovado certo, com o parâmetro na ordem, e nunca o texto livre", async () => {
    const buscar = vi.fn(async () => respostaOk("wamid.MODELO"));
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido(),
      livre,
    );

    expect(r).toMatchObject({
      ok: true,
      via: "modelo",
      modelo: "kz_retorno_apresentacao",
      idExterno: "wamid.MODELO",
      texto: "Oi, Helena 😊 Conseguiu ver a apresentação com calma?",
    });
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(init.body));
    expect(corpo).toMatchObject({
      type: "template",
      template: {
        name: "kz_retorno_apresentacao",
        language: { code: "pt_BR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Helena" }] },
        ],
      },
    });
    expect(corpo.text).toBeUndefined();
    expect(String(init.body)).not.toContain("TEXTO LIVRE");
  });

  it("escolhe o modelo da chave pedida (o certo, não qualquer aprovado)", async () => {
    const buscar = vi.fn(async () => respostaOk());
    await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ modelo: { mensagemChave: "followup_d1_pos_abertura" } }),
      livre,
    );
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(init.body));
    expect(corpo.template.name).toBe("kz_retorno_conversa");
    expect(corpo.template.components).toBeUndefined();
    expect(catalogo.buscarAprovado).toHaveBeenCalledWith(
      "followup_d1_pos_abertura",
      "pt_BR",
    );
  });

  it("usa o valor padrão do cadastro quando o pedido não traz a variável", async () => {
    const buscar = vi.fn(async () => respostaOk());
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ modelo: { mensagemChave: "followup_d1_pos_pdf" } }),
      livre,
    );
    expect(r).toMatchObject({
      ok: true,
      texto: expect.stringContaining("Oi, tudo bem 😊"),
    });
  });

  it("limpa quebra de linha do parâmetro (a Meta recusa)", async () => {
    const buscar = vi.fn(async () => respostaOk());
    await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({
        modelo: {
          mensagemChave: "followup_d1_pos_pdf",
          variaveis: { nome: "Hel\nena\t" },
        },
      }),
      livre,
    );
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(
      JSON.parse(String(init.body)).template.components[0].parameters[0].text,
    ).toBe("Hel ena");
  });

  it("sem modelo indicado, não envia nada, nem o texto livre", async () => {
    const buscar = vi.fn();
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ modelo: undefined }),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "fora_da_janela_sem_modelo" });
    expect(buscar).not.toHaveBeenCalled();
    expect(listarCapturas()).toHaveLength(0);
  });

  it("modelo sem aprovação no cadastro: não envia nada", async () => {
    const buscar = vi.fn();
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ modelo: { mensagemChave: "regua_28_34" } }),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "fora_da_janela_sem_modelo" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("sem saber quando a família escreveu, trata como fora da janela", async () => {
    const buscar = vi.fn(async () => respostaOk());
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ ultimaMensagemFamiliaEm: null }),
      livre,
    );
    expect(r).toMatchObject({ ok: true, via: "modelo" });
  });

  it("sem o parâmetro da janela, tudo é fora da janela: mesmo a conversa de agora sai por modelo", async () => {
    const buscar = vi.fn(async () => respostaOk());
    const semJanela = criarMensageiroCloudApi({
      credenciais: { token: "t", phoneNumberId: "1" },
      janelaHoras: null,
      catalogo,
      fetchImpl: buscar as unknown as typeof fetch,
      agora: () => AGORA,
    });
    const r = await semJanela.enviar(
      pedido({ ultimaMensagemFamiliaEm: horasAtras(0.1) }),
      livre,
    );
    expect(r).toMatchObject({ ok: true, via: "modelo" });
  });

  it("variável sem valor e sem padrão: não envia", async () => {
    const buscar = vi.fn();
    const semPadrao: CatalogoModelos = {
      buscarAprovado: async () => ({ ...MODELO_PDF, valoresPadrao: {} }),
    };
    const m = criarMensageiroCloudApi({
      credenciais: { token: "t", phoneNumberId: "1" },
      janelaHoras: 24,
      catalogo: semPadrao,
      fetchImpl: buscar as unknown as typeof fetch,
      agora: () => AGORA,
    });
    const r = await m.enviar(
      pedido({ modelo: { mensagemChave: "followup_d1_pos_pdf" } }),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "parametro_sem_valor" });
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("cloud_api e o freio", () => {
  it("freio fechado não chega à rede, dentro ou fora da janela", async () => {
    const buscar = vi.fn();
    const fechado: VerificadorFreio = async () => ({
      pode: false,
      motivo: "O freio está em bloqueio total.",
      codigo: "freio_bloqueio_total",
    });
    for (const horas of [2, 50]) {
      const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
        pedido({ ultimaMensagemFamiliaEm: horasAtras(horas) }),
        fechado,
      );
      expect(r).toMatchObject({ ok: false, codigo: "freio_bloqueio_total" });
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("consulta o freio com o canal cloud_api (o banco dispensa 'conversa iniciada pela família' só nele)", async () => {
    const verificar = vi.fn(async () => ({ pode: true, motivo: "" }));
    await mensageiro((async () =>
      respostaOk()) as unknown as typeof fetch).enviar(pedido(), verificar);
    expect(verificar).toHaveBeenCalledWith({
      familiaId: "familia-1",
      categoria: "conteudo",
      canal: "cloud_api",
    });
  });

  it("aviso a grupo interno não sai pela Cloud API e não consulta o freio", async () => {
    const buscar = vi.fn();
    const verificar = vi.fn();
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ destinatario: "equipe", categoria: "interna" }),
      verificar,
    );
    expect(r).toMatchObject({ ok: false, codigo: "grupo_nao_suportado" });
    expect(verificar).not.toHaveBeenCalled();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("cloud_api e as respostas da Meta", () => {
  it("traduz o erro de janela da Meta sem repetir o texto dela", async () => {
    const buscar = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 131047, message: "para +5511900000001 ..." },
          }),
          { status: 400 },
        ),
    );
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido({ ultimaMensagemFamiliaEm: horasAtras(2) }),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "meta_fora_da_janela" });
    expect(JSON.stringify(r)).not.toContain("+5511900000001");
  });

  it("falha de rede vira resposta, não exceção", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("rede");
    });
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido(),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "rede" });
  });

  it("resposta sem id não conta como enviada", async () => {
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await mensageiro(buscar as unknown as typeof fetch).enviar(
      pedido(),
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "resposta_sem_id" });
  });
});

describe("cloud_api sem credencial", () => {
  const semCredencial = () =>
    criarMensageiroCloudApi({
      credenciais: null,
      janelaHoras: 24,
      catalogo,
      agora: () => AGORA,
    });

  it("em homologação captura o que enviaria, com o modelo escolhido", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "preview");
    const buscar = vi.spyOn(globalThis, "fetch");
    const r = await semCredencial().enviar(pedido(), livre);
    expect(r).toMatchObject({
      ok: true,
      capturado: true,
      via: "modelo",
      modelo: "kz_retorno_apresentacao",
    });
    expect(buscar).not.toHaveBeenCalled();
    const capturas = listarCapturas();
    expect(capturas).toHaveLength(1);
    expect(capturas[0]?.corpo).toMatchObject({ type: "template" });
    buscar.mockRestore();
  });

  it("em homologação captura o texto livre dentro da janela", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    await semCredencial().enviar(
      pedido({ ultimaMensagemFamiliaEm: horasAtras(1), texto: "Oi" }),
      livre,
    );
    expect(listarCapturas()[0]?.corpo).toMatchObject({
      type: "text",
      text: { body: "Oi" },
    });
  });

  it("em produção, sem credencial, falha e não captura nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "producao");
    const r = await semCredencial().enviar(pedido(), livre);
    expect(r).toMatchObject({ ok: false, codigo: "nao_configurado" });
    expect(listarCapturas()).toHaveLength(0);
  });

  it("deploy de produção na Vercel nunca captura, mesmo com o app configurado errado", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "production");
    const r = await semCredencial().enviar(pedido(), livre);
    expect(r).toMatchObject({ ok: false, codigo: "nao_configurado" });
  });
});

it("declara o canal certo", () => {
  expect(criarMensageiroCloudApi().canal).toBe("cloud_api");
});
