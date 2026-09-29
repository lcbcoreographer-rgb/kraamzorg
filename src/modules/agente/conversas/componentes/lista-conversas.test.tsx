// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/sessao", () => ({
  obterSessao: async () => null,
  exigirSessao: async () => {
    throw new Error("sem sessão no teste");
  },
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConversaComPausa } from "../../tipos";
import { ListaConversas } from "./lista-conversas";

function conversa(
  sobrescreve: Partial<ConversaComPausa> & { id: string },
): ConversaComPausa {
  return {
    familiaId: null,
    nomeFamilia: null,
    nomeContato: "Contato Teste",
    telefoneE164: "+5511900000000",
    classificacao: "lead",
    agentePausadoAte: null,
    agenteEncerradoEm: null,
    agenteEncerradoMotivo: null,
    ultimaEntradaEm: null,
    ultimaSaidaEm: null,
    transferenciaAbertaId: null,
    pausaMotivo: null,
    situacao: "isadora",
    ultimaMensagem: null,
    transferenciaAberta: null,
    estadoSensivel: "normal",
    ...sobrescreve,
  };
}

const CONVERSAS: ConversaComPausa[] = [
  conversa({ id: "c1", nomeFamilia: "Família Teste Ipê", situacao: "isadora" }),
  conversa({
    id: "c2",
    nomeFamilia: "Família Teste Dália",
    situacao: "equipe",
    agenteEncerradoEm: "2026-09-24T14:02:00.000Z",
  }),
  conversa({
    id: "c3",
    nomeFamilia: "Família Teste Estrela",
    situacao: "pausada",
    agentePausadoAte: "2026-09-25T00:00:00.000Z",
  }),
  conversa({
    id: "c4",
    nomeContato: "+55 11 90000-0029",
    situacao: "nao_lead",
    classificacao: "fornecedor",
  }),
];

describe("ListaConversas (filtro por situação, C5)", () => {
  it("mostra todas as conversas na aba 'Todas', com a contagem certa", () => {
    render(<ListaConversas conversas={CONVERSAS} />);
    expect(screen.getByText("Família Teste Ipê")).toBeInTheDocument();
    expect(screen.getByText("Família Teste Dália")).toBeInTheDocument();
    expect(screen.getByText("Família Teste Estrela")).toBeInTheDocument();
    const aba = screen.getByRole("button", { name: /Todas/ });
    expect(aba).toHaveTextContent("4");
    expect(aba).toHaveAttribute("aria-pressed", "true");
  });

  it("trocar para 'Com a equipe' mostra só as conversas assumidas", async () => {
    const usuario = userEvent.setup();
    render(<ListaConversas conversas={CONVERSAS} />);

    await usuario.click(screen.getByRole("button", { name: /Com a equipe/ }));

    expect(screen.getByText("Família Teste Dália")).toBeInTheDocument();
    expect(screen.queryByText("Família Teste Ipê")).not.toBeInTheDocument();
    expect(screen.queryByText("Família Teste Estrela")).not.toBeInTheDocument();
  });

  it("filtro sem nenhuma conversa mostra o estado vazio explicando o porquê", async () => {
    const usuario = userEvent.setup();
    render(
      <ListaConversas
        conversas={CONVERSAS.filter((c) => c.situacao !== "nao_lead")}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /Não lead/ }));

    expect(
      screen.getByText("Nenhuma conversa de não lead"),
    ).toBeInTheDocument();
  });

  it("família com freio: Isadora desligada, sem assumir, sem pausar, sem triagem e sem prévia (DESIGN.md 11.8)", () => {
    render(
      <ListaConversas
        conversas={[
          conversa({
            id: "c9",
            nomeFamilia: "Família Teste Bruma",
            situacao: "freio",
            estadoSensivel: "bloqueio_total",
            ultimaMensagem: {
              conteudo: "Mensagem que não aparece na lista",
              enviadoPor: "cliente",
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Freio: Isadora desligada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir com cuidado" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assumir conversa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mais ações/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Mensagem que não aparece na lista"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Com freio/ })).toHaveTextContent(
      "1",
    );
  });

  it("uma ação visível por cartão; pausar e triagem ficam em 'Mais ações' (DESIGN.md 11.5)", () => {
    render(
      <ListaConversas
        conversas={[
          conversa({
            id: "c1",
            nomeFamilia: "Família Teste Ipê",
            situacao: "isadora",
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Assumir conversa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mais ações para Família Teste Ipê",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pausar a Isadora" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar como não lead" }),
    ).not.toBeInTheDocument();
  });
});
