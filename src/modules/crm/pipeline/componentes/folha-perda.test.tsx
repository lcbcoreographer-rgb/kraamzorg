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
import { listarPipelineTela } from "../dados";
import { FolhaPerda } from "./folha-perda";

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

describe("FolhaPerda: motivo obrigatório, detalhe opcional (P15 item 2)", () => {
  it("sem escolher motivo, mostra o erro e não muda o estágio", async () => {
    const usuario = userEvent.setup();
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    render(
      <FolhaPerda
        aberta
        aoFechar={() => {}}
        oportunidadeId={cedro!.oportunidadeId}
        pipeline={1}
        nomeFamilia={cedro!.nomeFamilia}
      />,
    );

    await usuario.click(
      screen.getByRole("button", { name: "Marcar como perdido" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "Escolha um motivo. Ele alimenta o relatório de perdas.",
        ),
      ).toBeInTheDocument(),
    );
    const l = obterLoja();
    const oportunidade = l.oportunidades.find(
      (o) => o.id === cedro!.oportunidadeId,
    );
    expect(oportunidade?.estagioP1).toBe("qualificado");
  });

  it("com motivo escolhido, marca como perdida e fecha", async () => {
    const usuario = userEvent.setup();
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    let fechou = false;

    render(
      <FolhaPerda
        aberta
        aoFechar={() => {
          fechou = true;
        }}
        oportunidadeId={cedro!.oportunidadeId}
        pipeline={1}
        nomeFamilia={cedro!.nomeFamilia}
      />,
    );

    await usuario.click(screen.getByLabelText("Preço"));
    await usuario.click(
      screen.getByRole("button", { name: "Marcar como perdido" }),
    );

    await waitFor(() => expect(fechou).toBe(true));
    const l = obterLoja();
    const oportunidade = l.oportunidades.find(
      (o) => o.id === cedro!.oportunidadeId,
    );
    expect(oportunidade?.estagioP1).toBe("perdido");
    expect(oportunidade?.motivoPerda).toBe("preco");
  });
});
