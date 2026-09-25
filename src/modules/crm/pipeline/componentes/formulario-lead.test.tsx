// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error(
      "cookies() não deveria ser chamado neste teste (modo demonstração)",
    );
  },
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { FormularioLead } from "./formulario-lead";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
    exigirSessao: async () => {
      if (!sessaoAtual) throw new Error("sem sessão no teste");
      return sessaoAtual;
    },
    __definirSessao: (s: SessaoUsuario | null) => {
      sessaoAtual = s;
    },
  };
});

function sessaoDe(nome: string): SessaoUsuario {
  const usuario = USUARIOS.find((u) => u.nome === nome);
  if (!usuario) throw new Error(nome);
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal: "aal1",
    aalPossivel: "aal2",
  };
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe("Perfil Teste Comercial"));
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("FormularioLead: cadastro manual de lead (P15 item 4)", () => {
  it("abre pelo botão, preenche e cadastra a família em Novo", async () => {
    const usuario = userEvent.setup();
    render(<FormularioLead />);

    await usuario.click(screen.getByRole("button", { name: "Cadastrar lead" }));
    await usuario.type(
      screen.getByLabelText("Nome da família"),
      "Família Teste Dialogo",
    );
    await usuario.type(screen.getByLabelText("Nome do contato"), "Renata");
    await usuario.type(
      screen.getByLabelText("Telefone do contato"),
      "11966665555",
    );

    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Cadastrar lead" }),
      ).not.toBeInTheDocument();
    });

    const l = obterLoja();
    const familia = l.familias.find((f) => f.nome === "Família Teste Dialogo");
    expect(familia).toBeTruthy();
    const oportunidade = l.oportunidades.find(
      (o) => o.familiaId === familia!.id,
    );
    expect(oportunidade?.estagioP1).toBe("novo");
    expect(oportunidade?.pipeline).toBe(1);
    const pessoa = l.pessoas.find((p) => p.familiaId === familia!.id);
    expect(pessoa?.telefoneE164).toBe("+5511966665555");
  });

  it("sem telefone, o navegador barra o envio (campo obrigatório) e nada é cadastrado", async () => {
    const usuario = userEvent.setup();
    render(<FormularioLead />);

    await usuario.click(screen.getByRole("button", { name: "Cadastrar lead" }));
    await usuario.type(
      screen.getByLabelText("Nome da família"),
      "Família Teste Sem Telefone",
    );
    await usuario.type(screen.getByLabelText("Nome do contato"), "Renata");
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(screen.getByLabelText("Telefone do contato")).toBeInvalid();
    const l = obterLoja();
    expect(
      l.familias.some((f) => f.nome === "Família Teste Sem Telefone"),
    ).toBe(false);
  });

  it("com telefone que o servidor recusa (fora do formato), mostra o erro", async () => {
    const usuario = userEvent.setup();
    render(<FormularioLead />);

    await usuario.click(screen.getByRole("button", { name: "Cadastrar lead" }));
    await usuario.type(
      screen.getByLabelText("Nome da família"),
      "Família Teste Telefone Curto",
    );
    await usuario.type(screen.getByLabelText("Nome do contato"), "Renata");
    await usuario.type(
      screen.getByLabelText("Telefone do contato"),
      "123456789",
    );
    await usuario.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    const l = obterLoja();
    expect(
      l.familias.some((f) => f.nome === "Família Teste Telefone Curto"),
    ).toBe(false);
  });
});
