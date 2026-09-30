import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCapturas, listarCapturas } from "@/lib/messaging/captura";

const rpc = vi.fn();
vi.mock("@/lib/db/cliente-servidor", () => ({
  criarClienteServidor: async () => ({ schema: () => ({ rpc }) }),
}));

import {
  criarCatalogoModelos,
  lerJanelaHoras,
  MODELOS_DEMONSTRACAO,
  modeloDoBanco,
} from "./catalogo";
import { criarMensageiroCloudApiDoApp } from "./index";

const livre = async () => ({ pode: true, motivo: "" });

beforeEach(() => {
  rpc.mockReset();
  limparCapturas();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("modeloDoBanco", () => {
  it("lê o jsonb de api.modelo_whatsapp_aprovado", () => {
    expect(
      modeloDoBanco({
        mensagem_chave: "regua_28_34",
        nome_meta: "kz_regua_janela",
        idioma: "pt_BR",
        variaveis: ["nome"],
        valores_padrao: { nome: "tudo bem", lixo: 3 },
        texto: "Oi, {{1}}!",
      }),
    ).toEqual({
      mensagemChave: "regua_28_34",
      nomeMeta: "kz_regua_janela",
      idioma: "pt_BR",
      variaveis: ["nome"],
      valoresPadrao: { nome: "tudo bem" },
      texto: "Oi, {{1}}!",
    });
  });
  it("formato inesperado vira 'sem modelo'", () => {
    expect(modeloDoBanco(null)).toBeNull();
    expect(modeloDoBanco([])).toBeNull();
    expect(modeloDoBanco({ nome_meta: "x" })).toBeNull();
  });
});

describe("catálogo no Supabase", () => {
  beforeEach(() => {
    vi.stubEnv("KZ_DADOS", "");
  });

  it("chama a função de api com a chave e o idioma", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await criarCatalogoModelos().buscarAprovado("regua_28_34", "pt_BR");
    expect(rpc).toHaveBeenCalledWith("modelo_whatsapp_aprovado", {
      p_mensagem_chave: "regua_28_34",
      p_idioma: "pt_BR",
    });
  });

  it("erro do banco, como falta de papel, é falha fechada: nenhum modelo", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(
      await criarCatalogoModelos().buscarAprovado("regua_28_34"),
    ).toBeNull();
  });

  it("lê a janela pela função de api e recusa valor que não é número positivo", async () => {
    rpc.mockResolvedValueOnce({ data: 24, error: null });
    expect(await lerJanelaHoras()).toBe(24);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await lerJanelaHoras()).toBeNull();
    rpc.mockResolvedValueOnce({ data: 0, error: null });
    expect(await lerJanelaHoras()).toBeNull();
    rpc.mockResolvedValueOnce({ data: 24, error: { code: "42501" } });
    expect(await lerJanelaHoras()).toBeNull();
  });
});

describe("cloud_api do app em demonstração, sem credencial (captura de homologação)", () => {
  beforeEach(() => {
    vi.stubEnv("KZ_DADOS", "demonstracao");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
    vi.stubEnv("WHATSAPP_CLOUD_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
  });

  it("dentro da janela captura o texto livre", async () => {
    const m = await criarMensageiroCloudApiDoApp();
    const r = await m.enviar(
      {
        familiaId: "f1",
        categoria: "conteudo",
        destinatario: "familia",
        telefoneOuJid: "+5511900000001",
        texto: "Oi, tudo bem?",
        ultimaMensagemFamiliaEm: new Date(Date.now() - 3_600_000),
      },
      livre,
    );
    expect(r).toMatchObject({ ok: true, capturado: true, via: "texto_livre" });
    expect(listarCapturas()[0]?.corpo).toMatchObject({ type: "text" });
  });

  it("fora da janela captura o modelo aprovado da chave, nunca o texto livre", async () => {
    const m = await criarMensageiroCloudApiDoApp();
    const r = await m.enviar(
      {
        familiaId: "f1",
        categoria: "conteudo",
        destinatario: "familia",
        telefoneOuJid: "+5511900000001",
        texto: "TEXTO LIVRE PROIBIDO",
        ultimaMensagemFamiliaEm: new Date(Date.now() - 50 * 3_600_000),
        modelo: {
          mensagemChave: "followup_d1_pos_pdf",
          variaveis: { nome: "Helena" },
        },
      },
      livre,
    );
    expect(r).toMatchObject({
      ok: true,
      via: "modelo",
      modelo: MODELOS_DEMONSTRACAO[0]?.nomeMeta,
    });
    const corpo = JSON.stringify(listarCapturas()[0]?.corpo);
    expect(corpo).toContain(MODELOS_DEMONSTRACAO[0]?.nomeMeta ?? "");
    expect(corpo).not.toContain("TEXTO LIVRE PROIBIDO");
  });

  it("chave sem modelo aprovado: nada é capturado", async () => {
    const m = await criarMensageiroCloudApiDoApp();
    const r = await m.enviar(
      {
        familiaId: "f1",
        categoria: "conteudo",
        destinatario: "familia",
        telefoneOuJid: "+5511900000001",
        texto: "x",
        ultimaMensagemFamiliaEm: new Date(Date.now() - 50 * 3_600_000),
        modelo: { mensagemChave: "regua_35_mais" },
      },
      livre,
    );
    expect(r).toMatchObject({ ok: false, codigo: "fora_da_janela_sem_modelo" });
    expect(listarCapturas()).toHaveLength(0);
  });
});
