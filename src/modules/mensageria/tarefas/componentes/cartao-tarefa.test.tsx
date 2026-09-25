// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado no modo demonstração");
  },
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

/** Payload que o P20 gravaria; o repositório de demonstração ainda devolve `{}`. */
const payloads = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("@/lib/dados/fabrica", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dados/fabrica")>();
  return {
    ...real,
    obterRepositorios: async () => {
      const repositorios = await real.obterRepositorios();
      return {
        ...repositorios,
        tarefas: {
          ...repositorios.tarefas,
          listarTarefas: async (
            filtro?: Parameters<typeof repositorios.tarefas.listarTarefas>[0],
          ) =>
            (await repositorios.tarefas.listarTarefas(filtro)).map((t) => ({
              ...t,
              payload: (payloads.get(t.id) ?? t.payload) as typeof t.payload,
            })),
        },
      };
    },
  };
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import type { TarefaComFreio } from "../dados";
import { CartaoTarefa } from "./cartao-tarefa";
import { ListaTarefas } from "./lista-tarefas";

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
    aal: "aal2",
    aalPossivel: "aal2",
  };
}

async function logarComo(nome: string) {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe(nome));
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  payloads.clear();
  await logarComo("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function tarefaComWhatsApp(
  sobrepor: Partial<TarefaComFreio> = {},
): TarefaComFreio {
  return {
    id: "tarefa-1",
    tipo: "nutricao_contato",
    titulo: "Follow-up D+3",
    prioridade: "alta",
    status: "aberta",
    venceEm: null,
    familiaId: null,
    nomeFamilia: "Família Teste Estrela",
    responsavelId: null,
    papelResponsavel: "comercial",
    payload: {},
    criadoEm: new Date().toISOString(),
    mensagem: {
      textoSugerido: "Oi, Carla! Tudo bem?",
      telefoneE164: "+5511999998888",
    },
    temAcaoWhatsApp: true,
    podeEnviarMensagem: true,
    motivoBloqueio: null,
    bloqueioSensivel: false,
    prazo: "até 24/09/2026, 17:00",
    ...sobrepor,
  };
}

describe("CartaoTarefa", () => {
  it("mostra o texto sugerido e monta o link do wa.me a partir dele", () => {
    render(<CartaoTarefa tarefa={tarefaComWhatsApp()} />);

    expect(screen.getByLabelText("Texto sugerido")).toHaveValue(
      "Oi, Carla! Tudo bem?",
    );
    const link = screen.getByRole("link", { name: /Abrir no WhatsApp/i });
    expect(link).toHaveAttribute(
      "href",
      "https://wa.me/5511999998888?text=Oi%2C%20Carla!%20Tudo%20bem%3F",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("editar o texto muda o link antes de enviar (nada sai sem tocar em Enviei)", async () => {
    const usuario = userEvent.setup();
    render(<CartaoTarefa tarefa={tarefaComWhatsApp()} />);

    const campo = screen.getByLabelText("Texto sugerido");
    await usuario.clear(campo);
    await usuario.type(campo, "Novo texto");

    const link = screen.getByRole("link", { name: /Abrir no WhatsApp/i });
    expect(link).toHaveAttribute(
      "href",
      "https://wa.me/5511999998888?text=Novo%20texto",
    );
  });

  it('"Voltar ao texto sugerido" só aparece depois de editar e restaura o texto', async () => {
    const usuario = userEvent.setup();
    render(<CartaoTarefa tarefa={tarefaComWhatsApp()} />);
    expect(
      screen.queryByRole("button", { name: "Voltar ao texto sugerido" }),
    ).not.toBeInTheDocument();

    const campo = screen.getByLabelText("Texto sugerido");
    await usuario.type(campo, " Extra");
    await usuario.click(
      screen.getByRole("button", { name: "Voltar ao texto sugerido" }),
    );
    expect(campo).toHaveValue("Oi, Carla! Tudo bem?");
  });

  it('"Enviei" grava a mensagem, conclui a tarefa e a confirmação fica em "Feitas agora"', async () => {
    const { familiaPorNome } =
      await import("@/lib/dados/demonstracao/fixtures");
    const cedro = familiaPorNome("Cedro");
    const loja = obterLoja();
    loja.tarefas.push({
      id: "tarefa-teste-envio",
      tipo: "nutricao_contato",
      titulo: "Follow-up de teste",
      prioridade: "alta",
      status: "aberta",
      venceEm: null,
      familiaId: cedro.id,
      responsavelId: sessaoDe("Perfil Teste Comercial").usuarioId,
      papelResponsavel: null,
      payload: {},
      criadoEm: new Date().toISOString(),
    });
    payloads.set("tarefa-teste-envio", {
      textoSugerido: "Oi, Carla! Tudo bem?",
      telefoneE164: "+5511999998888",
    });
    const antesMensagens = loja.mensagens.length;

    const usuario = userEvent.setup();
    render(
      <ListaTarefas
        grupos={[
          {
            balde: "sem_prazo",
            titulo: "Sem prazo",
            tarefas: [
              tarefaComWhatsApp({
                id: "tarefa-teste-envio",
                titulo: "Follow-up de teste",
                familiaId: cedro.id,
              }),
            ],
          },
        ]}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: "Enviei" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Feitas agora" }),
      ).toHaveTextContent(
        /Contato da régua de nutrição da Família Teste Estrela.*Envio registrado\. A tarefa saiu da sua lista\./,
      );
    });
    // O título do cartão não volta em "Feitas agora" (o e2e confere que ele some).
    expect(screen.queryByText(/Follow-up de teste/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Texto sugerido")).not.toBeInTheDocument();
    expect(loja.mensagens.length).toBe(antesMensagens + 1);
    expect(
      loja.tarefas.find((t) => t.id === "tarefa-teste-envio")?.status,
    ).toBe("concluida");
  });

  it("família em bloqueio_total: sem link nem campo de texto, só o aviso", () => {
    render(
      <CartaoTarefa
        tarefa={tarefaComWhatsApp({
          podeEnviarMensagem: false,
          bloqueioSensivel: true,
          motivoBloqueio:
            "O freio está acionado para essa família. Só contato humano e nominal.",
        })}
      />,
    );

    // Aviso fixo da lista, não anúncio: uma lista com várias famílias em freio
    // não pode disparar um alerta por cartão ao abrir a tela.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("Mensagem pausada para esta família"),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Texto sugerido")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Abrir no WhatsApp/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /O freio está acionado para essa família\. Só contato humano e nominal\./,
      ),
    ).toBeInTheDocument();
  });

  it("tarefa interna (sem WhatsApp) mostra só o botão Concluir", async () => {
    const loja = obterLoja();
    loja.tarefas.push({
      id: "tarefa-interna-teste",
      tipo: "outro",
      titulo: "Justificar o freio",
      prioridade: "alta",
      status: "aberta",
      venceEm: null,
      familiaId: null,
      responsavelId: sessaoDe("Perfil Teste Comercial").usuarioId,
      papelResponsavel: null,
      payload: {},
      criadoEm: new Date().toISOString(),
    });

    const usuario = userEvent.setup();
    render(
      <CartaoTarefa
        tarefa={tarefaComWhatsApp({
          id: "tarefa-interna-teste",
          temAcaoWhatsApp: false,
          mensagem: {},
        })}
      />,
    );

    expect(screen.queryByLabelText("Texto sugerido")).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(
        loja.tarefas.find((t) => t.id === "tarefa-interna-teste")?.status,
      ).toBe("concluida");
    });
  });
});
