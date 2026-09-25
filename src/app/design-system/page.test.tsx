import { describe, expect, it, vi, afterEach } from "vitest";

const ORIGINAL_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

afterEach(() => {
  vi.resetModules();
  if (ORIGINAL_APP_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ENV;
  } else {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL_APP_ENV;
  }
  if (ORIGINAL_VERCEL_ENV === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  }
});

/**
 * P10 item 4 (auditoria): prova que a rota chama `notFound()` antes de
 * montar a vitrine quando o ambiente não libera, e que não chama quando
 * libera. `next/navigation` é mockado porque `notFound()` fora de uma
 * requisição real lança um erro especial do Next; aqui só importa que ele
 * tenha sido chamado (ou não).
 */
describe("/design-system, bloqueio por ambiente", () => {
  it("chama notFound quando NEXT_PUBLIC_APP_ENV=producao", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDesignSystem } = await import("./page");
    PaginaDesignSystem();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("chama notFound sem a variável configurada (não libera por omissão)", async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDesignSystem } = await import("./page");
    PaginaDesignSystem();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("chama notFound com um valor digitado errado, como 'production'", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDesignSystem } = await import("./page");
    PaginaDesignSystem();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("chama notFound quando VERCEL_ENV=production, mesmo com NEXT_PUBLIC_APP_ENV liberado", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    process.env.VERCEL_ENV = "production";
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDesignSystem } = await import("./page");
    PaginaDesignSystem();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("não chama notFound em desenvolvimento", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDesignSystem } = await import("./page");
    PaginaDesignSystem();

    expect(notFound).not.toHaveBeenCalled();
  });
});
