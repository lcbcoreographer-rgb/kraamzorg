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
import type { ConversaComPausa, TransferenciaTela } from "../../tipos";
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

function transferencia(
  sobrescreve: Partial<TransferenciaTela> & { id: string },
): TransferenciaTela {
  return {
    conversaId: null,
    familiaId: "f1",
    nomeFamilia: null,
    motivo: "contratar",
    motivoRotulo: "Quer contratar",
    destino: "comercial",
    prioridade: "normal",
    resumo: "Resumo da Isadora.",
    status: "aberto",
    slaVenceEm: null,
    notificacaoOk: true,
    assumidoPor: null,
    assumidoEm: null,
    criadoEm: "2026-09-24T12:00:00.000Z",
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

  it("família com freio: Isadora desligada, sem ações na lista e sem prévia (DESIGN.md 11.8)", () => {
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
    // A linha inteira abre a conversa (com cuidado: a prévia fica fechada).
    expect(
      screen.getByRole("link", { name: /Família Teste Bruma/ }),
    ).toHaveAttribute("href", "/conversas/c9");
    expect(
      screen.getByText("Prévia fechada. Só a equipe responde, pelo nome."),
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

  it("como no WhatsApp Web, a lista não tem ações: a linha inteira abre a conversa, que traz assumir, pausar e a triagem", () => {
    render(
      <ListaConversas
        conversas={[
          conversa({
            id: "c1",
            nomeFamilia: "Família Teste Ipê",
            situacao: "isadora",
            ultimaMensagem: { conteudo: "Oi, tudo bem?", enviadoPor: "ia" },
          }),
        ]}
      />,
    );
    const linha = screen.getByRole("link", { name: /Família Teste Ipê/ });
    expect(linha).toHaveAttribute("href", "/conversas/c1");
    expect(linha).toHaveTextContent("Isadora: Oi, tudo bem?");
    expect(linha).toHaveTextContent("Isadora conduzindo");
    for (const nome of [
      "Assumir conversa",
      "Pausar a Isadora",
      "Marcar como não lead",
    ]) {
      expect(
        screen.queryByRole("button", { name: nome }),
      ).not.toBeInTheDocument();
    }
  });
});

const FILA: TransferenciaTela[] = [
  transferencia({
    id: "t-perda",
    conversaId: "c9",
    motivo: "perda",
    motivoRotulo: "Perda gestacional",
    prioridade: "maxima",
    destino: "coordenacao_clinica",
    criadoEm: "2026-09-24T14:13:00.000Z",
    slaVenceEm: "2026-09-24T14:43:00.000Z",
  }),
  transferencia({
    id: "t-reuniao",
    conversaId: null,
    familiaId: "f7",
    nomeFamilia: "Família Teste Cedro",
    motivo: "reuniao",
    motivoRotulo: "Quer a conversa com a coordenação",
    prioridade: "alta",
    resumo: "Opções que passou: quinta à noite ou sábado de manhã.",
  }),
  transferencia({
    id: "t-condicao",
    conversaId: "c3",
    motivo: "condicao_comercial",
    motivoRotulo: "Pediu condição especial",
    prioridade: "normal",
    notificacaoOk: false,
  }),
  transferencia({
    id: "t-assumida",
    conversaId: "c2",
    motivo: "contratar",
    motivoRotulo: "Quer contratar",
    status: "assumido",
  }),
];

const COM_FILA: ConversaComPausa[] = [
  ...CONVERSAS,
  conversa({
    id: "c9",
    nomeFamilia: "Família Teste Bruma",
    situacao: "freio",
    estadoSensivel: "bloqueio_total",
  }),
];

describe("ListaConversas com as transferências juntas (pedido do dono em 30/09)", () => {
  it("'Esperando alguém' é a antiga fila: na ordem da fila, com o pedido sem conversa e sem as já assumidas", async () => {
    const usuario = userEvent.setup();
    render(<ListaConversas conversas={COM_FILA} fila={FILA} />);

    const esperando = screen.getByRole("button", { name: /Esperando alguém/ });
    expect(esperando).toHaveTextContent("3");
    await usuario.click(esperando);

    const linhas = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(linhas).toEqual([
      "/conversas/c9?filtro=esperando",
      "/conversas/transferencia/t-reuniao?filtro=esperando",
      "/conversas/c3?filtro=esperando",
    ]);
    expect(screen.queryByText("Família Teste Dália")).not.toBeInTheDocument();
    // A falha do aviso ao grupo aparece na linha, como na fila.
    expect(screen.getByText("Aviso não saiu")).toBeInTheDocument();
  });

  it("a perda mostra a hora do relato e com quem está, sem prazo e sem vermelho (DESIGN.md 11.8)", () => {
    render(<ListaConversas conversas={COM_FILA} fila={FILA} />);
    const linha = screen.getByRole("link", { name: /Família Teste Bruma/ });
    expect(linha).toHaveTextContent(
      /recebida às 11:13, com a coordenação clínica/i,
    );
    expect(linha).not.toHaveTextContent(/vence em|venceu/);
    expect(linha.querySelector(".text-alerta, .bg-alerta-lavado")).toBeNull();
  });

  it("o prazo vai para o canto da linha, com a frase inteira para o leitor de tela", () => {
    render(
      <ListaConversas
        conversas={COM_FILA}
        fila={[
          transferencia({
            id: "t-condicao",
            conversaId: "c3",
            motivo: "condicao_comercial",
            motivoRotulo: "Pediu condição especial",
            prioridade: "normal",
            slaVenceEm: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          }),
        ]}
      />,
    );
    const linha = screen.getByRole("link", { name: /Família Teste Estrela/ });
    expect(linha).toHaveTextContent("vence em 3 h");
  });

  it("prioridade máxima esperando alguém fica no topo em qualquer filtro (fluxos.md, fluxo E)", async () => {
    const usuario = userEvent.setup();
    render(<ListaConversas conversas={COM_FILA} fila={FILA} />);

    await usuario.click(screen.getByRole("button", { name: /Com a Isadora/ }));
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs[0]).toBe("/conversas/c9?filtro=isadora");
    expect(hrefs).toContain("/conversas/c1?filtro=isadora");
    expect(
      screen.getByText("Prioridade máxima: fica no topo em qualquer filtro."),
    ).toBeInTheDocument();
  });

  it("'Com a equipe' junta a Isadora fora da conversa e as transferências já assumidas", async () => {
    const usuario = userEvent.setup();
    render(<ListaConversas conversas={COM_FILA} fila={FILA} />);
    await usuario.click(screen.getByRole("button", { name: /Com a equipe/ }));
    expect(screen.getByText("Família Teste Dália")).toBeInTheDocument();
    expect(screen.getByText(/Quer contratar, assumida/)).toBeInTheDocument();
  });

  it("filtro controlado pela URL avisa a troca e marca a conversa aberta", async () => {
    const usuario = userEvent.setup();
    const aoTrocarFiltro = vi.fn();
    render(
      <ListaConversas
        conversas={COM_FILA}
        fila={FILA}
        filtro="todas"
        aoTrocarFiltro={aoTrocarFiltro}
        selecionada="c3"
      />,
    );
    expect(
      screen.getByRole("link", { name: /Família Teste Estrela/ }),
    ).toHaveAttribute("aria-current", "page");
    await usuario.click(screen.getByRole("button", { name: /Pausadas/ }));
    expect(aoTrocarFiltro).toHaveBeenCalledWith("pausada");
  });

  it("busca por nome, sem acento, e pelos números do telefone", async () => {
    const usuario = userEvent.setup();
    render(<ListaConversas conversas={COM_FILA} fila={FILA} />);
    const busca = screen.getByRole("searchbox", {
      name: "Buscar conversa por nome ou telefone",
    });

    await usuario.type(busca, "dalia");
    expect(screen.getByText("Família Teste Dália")).toBeInTheDocument();
    expect(screen.queryByText("Família Teste Ipê")).not.toBeInTheDocument();

    await usuario.clear(busca);
    await usuario.type(busca, "0029");
    expect(screen.getByText("+55 11 90000-0029")).toBeInTheDocument();
    expect(screen.queryByText("Família Teste Dália")).not.toBeInTheDocument();

    await usuario.clear(busca);
    await usuario.type(busca, "ninguém assim");
    expect(
      screen.getByText("Nenhuma conversa com esse nome ou telefone"),
    ).toBeInTheDocument();
  });
});
