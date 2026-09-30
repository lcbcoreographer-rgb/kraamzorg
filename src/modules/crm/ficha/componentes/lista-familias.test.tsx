// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { faseDaFamilia } from "../lista-familias";
import type { FamiliaListaTela } from "../tipos";
import { ListaFamilias } from "./lista-familias";

function familia(parcial: Partial<FamiliaListaTela>): FamiliaListaTela {
  const base: FamiliaListaTela = {
    id: parcial.nome ?? "id",
    nome: "Família Teste",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    uf: "SP",
    dpp: null,
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    estadoSensivel: "normal",
    naoContatar: false,
    idadeGestacional: null,
    fase: "sem_data",
    tempo: null,
    estagio: "Qualificado",
    proximoPasso: { tipo: "voce", frase: "Com você" },
  };
  const junta = { ...base, ...parcial };
  return { ...junta, fase: faseDaFamilia(junta) };
}

const FAMILIAS = [
  familia({
    nome: "Família Teste Aurora",
    dpp: "2027-05-03",
    tempo: { frase: null, medida: "9s2d" },
  }),
  familia({
    nome: "Família Teste Dália",
    bairro: "Vila Madalena",
    dpp: "2027-01-23",
    tempo: { frase: null, medida: "24s4d" },
  }),
  familia({
    nome: "Família Teste Estrela",
    cidade: "Londrina",
    bairro: "Gleba Palhano",
    dpp: "2027-04-13",
    estadoSensivel: "atencao",
  }),
  familia({
    nome: "Família Teste Bruma",
    estadoSensivel: "bloqueio_total",
    estagio: "Em conversa",
  }),
  familia({
    nome: "Família Teste Lua",
    dpp: "2026-09-15",
    dataNascimento: "2026-09-17",
    dataInicioEfetivo: "2026-09-19",
    tempo: { frase: "Início em", medida: "19/09" },
  }),
];

const link = (nome: RegExp) => screen.queryByRole("link", { name: nome });

describe("ListaFamilias", () => {
  it("agrupa pela fase, com a contagem de cada filtro em pílula", () => {
    render(<ListaFamilias familias={FAMILIAS} />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.id),
    ).toEqual([
      "t-familias-gestando",
      "t-familias-atendimento",
      "t-familias-freio",
    ]);
    const filtros = screen.getByRole("group", {
      name: "Filtrar pela fase da família",
    });
    expect(
      within(filtros).getByRole("button", { name: /^Todas\W+5$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(filtros).getByRole("button", { name: /^Com freio\W+2$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("5 famílias.");
  });

  it("a busca filtra enquanto a pessoa digita, pelo nome ou pelo bairro", async () => {
    const usuario = userEvent.setup();
    render(<ListaFamilias familias={FAMILIAS} />);
    await usuario.type(screen.getByRole("searchbox"), "dalia");
    expect(link(/Família Teste Dália/)).toBeInTheDocument();
    expect(link(/Família Teste Aurora/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostrando 1 de 5 famílias.",
    );

    await usuario.clear(screen.getByRole("searchbox"));
    await usuario.type(screen.getByRole("searchbox"), "palhano");
    expect(link(/Família Teste Estrela/)).toBeInTheDocument();
    expect(link(/Família Teste Dália/)).not.toBeInTheDocument();
  });

  it("o filtro Com freio mostra atenção e bloqueio; a família em bloqueio fica sem estágio", async () => {
    const usuario = userEvent.setup();
    render(<ListaFamilias familias={FAMILIAS} />);
    await usuario.click(screen.getByRole("button", { name: /Com freio/ }));
    expect(link(/Família Teste Estrela/)).toBeInTheDocument();
    const bruma = link(/Família Teste Bruma/)!;
    expect(bruma).toHaveTextContent("Freio em bloqueio total");
    expect(bruma).toHaveTextContent("Só contato humano, pelo nome.");
    expect(bruma).not.toHaveTextContent("Em conversa");
    expect(link(/Família Teste Aurora/)).not.toBeInTheDocument();
  });

  it("filtro sem resultado diz qual filtro está ligado e oferece limpar", async () => {
    const usuario = userEvent.setup();
    render(<ListaFamilias familias={FAMILIAS} />);
    await usuario.click(screen.getByRole("button", { name: /Bebê nasceu/ }));
    expect(
      screen.getByText(/Nenhuma família com o bebê já nascido/),
    ).toBeInTheDocument();
    await usuario.click(
      screen.getByRole("button", { name: "Limpar busca e filtros" }),
    );
    expect(link(/Família Teste Aurora/)).toBeInTheDocument();
  });

  it("telefone vai ao servidor: a busca digitada mostra o botão, e o resultado do servidor vale para a busca da URL", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<ListaFamilias familias={FAMILIAS} />);
    await usuario.type(screen.getByRole("searchbox"), "90000");
    expect(
      screen.getByRole("button", { name: "Buscar pelo telefone" }),
    ).toBeInTheDocument();

    rerender(
      <ListaFamilias
        key="servidor"
        familias={FAMILIAS}
        buscaInicial="90000"
        resultadoBusca={[FAMILIAS[1]!]}
      />,
    );
    expect(link(/Família Teste Dália/)).toBeInTheDocument();
    expect(link(/Família Teste Aurora/)).not.toBeInTheDocument();
  });

  it("ordena por semanas sem sair do grupo", async () => {
    const usuario = userEvent.setup();
    render(<ListaFamilias familias={FAMILIAS} />);
    await usuario.selectOptions(
      screen.getByRole("combobox", { name: /Ordenar por/ }),
      "semanas",
    );
    const gestando = screen
      .getByRole("heading", { name: /Gestando/ })
      .closest("section")!;
    expect(
      within(gestando)
        .getAllByRole("link")
        .map((l) =>
          ["Dália", "Estrela", "Aurora"].find((n) =>
            l.textContent?.includes(`Família Teste ${n}`),
          ),
        ),
    ).toEqual(["Dália", "Estrela", "Aurora"]);
  });
});
