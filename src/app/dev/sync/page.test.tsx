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
 * P12 item 5: `/dev/sync` existe só fora de produção, no mesmo padrão de
 * `/design-system` (P10 item 4, ver o teste espelho em
 * src/app/design-system/page.test.tsx).
 */
describe("/dev/sync, bloqueio por ambiente", () => {
  it("chama notFound quando NEXT_PUBLIC_APP_ENV=producao", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDevSync } = await import("./page");
    PaginaDevSync();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("chama notFound sem a variável configurada (não libera por omissão)", async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDevSync } = await import("./page");
    PaginaDevSync();

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("não chama notFound em desenvolvimento", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDevSync } = await import("./page");
    PaginaDevSync();

    expect(notFound).not.toHaveBeenCalled();
  });

  it("chama notFound quando VERCEL_ENV=production, mesmo com NEXT_PUBLIC_APP_ENV liberado", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "homologacao";
    process.env.VERCEL_ENV = "production";
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));

    const { notFound } = await import("next/navigation");
    const { default: PaginaDevSync } = await import("./page");
    PaginaDevSync();

    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
