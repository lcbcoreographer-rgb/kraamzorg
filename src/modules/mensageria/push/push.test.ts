// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  inscricoesDemonstracao,
  obterRepositorioInscricaoPush,
  reiniciarInscricoesDemonstracao,
  type InscricaoPush,
} from "./repositorio";
import { enviarPushParaUsuarios, PAYLOAD_GENERICO } from "./servidor";

const insc = (n: number): InscricaoPush => ({
  endpoint: `https://push.exemplo.invalid/${n}`,
  chaves: { p256dh: "p", auth: "a" },
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "publica");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
  vi.stubEnv("VAPID_SUBJECT", "mailto:avisos@exemplo.invalid");
  vi.stubEnv("KZ_DADOS", "demonstracao");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
  reiniciarInscricoesDemonstracao();
});
afterEach(() => vi.unstubAllEnvs());

describe("aviso genérico", () => {
  it("nunca leva nome, família nem conteúdo, e abre na raiz", () => {
    expect(PAYLOAD_GENERICO.url).toBe("/");
    expect(JSON.stringify(PAYLOAD_GENERICO)).not.toMatch(
      /família|paciente|bebê|\d{4}/i,
    );
    expect(JSON.stringify(PAYLOAD_GENERICO)).not.toMatch(/[—–]/);
  });
});

describe("enviarPushParaUsuarios", () => {
  it("manda o aviso genérico para cada aparelho da pessoa", async () => {
    const enviarUm = vi.fn(async () => undefined);
    const r = await enviarPushParaUsuarios(["u1"], {
      listar: async () => [insc(1), insc(2)],
      enviarUm,
    });
    expect(r).toMatchObject({ ok: true, enviados: 2, expirados: 0 });
    expect(enviarUm).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(
        String(
          (enviarUm.mock.calls as unknown as [InscricaoPush, string][])[0]?.[1],
        ),
      ),
    ).toEqual(PAYLOAD_GENERICO);
  });

  it("apaga a inscrição que o serviço devolve como expirada (410 e 404) e segue com as outras", async () => {
    const expirar = vi.fn(async () => undefined);
    const enviarUm = vi.fn(async (i: InscricaoPush) => {
      if (i.endpoint.endsWith("/1"))
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (i.endpoint.endsWith("/2"))
        throw Object.assign(new Error("nf"), { statusCode: 404 });
    });
    const r = await enviarPushParaUsuarios(["u1"], {
      listar: async () => [insc(1), insc(2), insc(3)],
      expirar,
      enviarUm,
    });
    expect(r).toMatchObject({ ok: true, enviados: 1, expirados: 2 });
    expect(expirar).toHaveBeenCalledWith("https://push.exemplo.invalid/1");
    expect(expirar).toHaveBeenCalledWith("https://push.exemplo.invalid/2");
  });

  it("erro que não é de expiração não apaga a inscrição", async () => {
    const expirar = vi.fn();
    const enviarUm = vi.fn(async () => {
      throw Object.assign(new Error("falha"), { statusCode: 500 });
    });
    const r = await enviarPushParaUsuarios(["u1"], {
      listar: async () => [insc(1)],
      expirar,
      enviarUm,
    });
    expect(r.ok).toBe(false);
    expect(expirar).not.toHaveBeenCalled();
  });

  it("sem VAPID, sem pessoa, sem aparelho ou com o banco fora: não envia e diz por quê", async () => {
    const enviarUm = vi.fn();
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await enviarPushParaUsuarios(["u1"], { enviarUm })).motivo).toMatch(
      /VAPID/,
    );
    vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
    expect((await enviarPushParaUsuarios([], { enviarUm })).motivo).toMatch(
      /Sem pessoa/,
    );
    expect(
      (
        await enviarPushParaUsuarios(["u1"], {
          listar: async () => [],
          enviarUm,
        })
      ).motivo,
    ).toMatch(/não ligou/);
    expect(
      (
        await enviarPushParaUsuarios(["u1"], {
          listar: async () => {
            throw new Error("banco");
          },
          enviarUm,
        })
      ).motivo,
    ).toMatch(/Não deu para ler/);
    expect(enviarUm).not.toHaveBeenCalled();
  });
});

describe("repositório de inscrições (demonstração)", () => {
  it("registra, atualiza pelo mesmo endereço e só o dono remove", async () => {
    const repo = obterRepositorioInscricaoPush();
    await repo.registrar("u1", insc(1));
    await repo.registrar("u1", {
      ...insc(1),
      chaves: { p256dh: "novo", auth: "a" },
    });
    expect(inscricoesDemonstracao("u1")).toHaveLength(1);
    expect(inscricoesDemonstracao("u1")[0]?.chaves.p256dh).toBe("novo");
    await repo.remover("u2", insc(1).endpoint);
    expect(inscricoesDemonstracao()).toHaveLength(1);
    await repo.remover("u1", insc(1).endpoint);
    expect(inscricoesDemonstracao()).toHaveLength(0);
  });
});
