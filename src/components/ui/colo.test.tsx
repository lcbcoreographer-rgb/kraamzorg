import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ILUSTRACOES, CadernoDeVisita } from "@/components/ilustracoes";
import { AnelProgresso } from "./anel-progresso";
import { BarraProgresso } from "./barra-progresso";
import { CartaoResumo } from "./cartao-resumo";
import { Comemoracao } from "./comemoracao";
import { EstadoVazio } from "./estado-vazio";

/**
 * Componentes da direção "Colo" [v4.4] (DESIGN.md, seção 2): o que cada um
 * promete para quem usa, sem olhar pixel.
 */
describe("direção Colo", () => {
  it("anel: um segmento por etapa, no estado de cada uma, e fora do leitor de tela", () => {
    const { container } = render(
      <AnelProgresso segmentos={["feito", "atual", "futuro", "futuro"]} />,
    );
    const estados = [...container.querySelectorAll("circle")].map((c) =>
      c.getAttribute("data-estado"),
    );
    expect(estados).toEqual(["feito", "atual", "futuro", "futuro"]);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("barra: a frase é o que se lê; completa, troca pela frase de completa", () => {
    const { rerender } = render(
      <BarraProgresso
        valor={5}
        total={9}
        texto="5 de 9 respondidas"
        textoCompleta="Tudo respondido nesta etapa"
      />,
    );
    expect(screen.getByText("5 de 9 respondidas")).toBeInTheDocument();
    rerender(
      <BarraProgresso
        valor={9}
        total={9}
        texto="9 de 9 respondidas"
        textoCompleta="Tudo respondido nesta etapa"
      />,
    );
    expect(screen.getByText("Tudo respondido nesta etapa")).toBeInTheDocument();
  });

  it("cartão-resumo com link: o cartão inteiro é o link, com número e rótulo no nome", () => {
    render(
      <CartaoResumo
        tom="areia"
        icone={<svg />}
        valor={4}
        rotulo="tarefas para hoje"
        contexto="nenhuma atrasada"
        href="/tarefas"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tarefas");
    expect(link).toHaveTextContent("4tarefas para hojenenhuma atrasada");
  });

  it("ilustração sem título é decorativa; com título vira imagem com nome", () => {
    const { container, rerender } = render(<CadernoDeVisita />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    rerender(<CadernoDeVisita titulo="Caderno de visita" />);
    expect(
      screen.getByRole("img", { name: "Caderno de visita" }),
    ).toBeInTheDocument();
  });

  it("as dez ilustrações do catálogo desenham só com cor de token (classe), nunca cor solta", () => {
    expect(Object.keys(ILUSTRACOES)).toHaveLength(10);
    for (const { Componente } of Object.values(ILUSTRACOES)) {
      const { container, unmount } = render(<Componente />);
      for (const el of container.querySelectorAll("path")) {
        expect(el.getAttribute("fill") ?? "none").toBe("none");
        expect(el.getAttribute("stroke")).toBeNull();
      }
      unmount();
    }
  });

  it("comemoração anuncia o título uma vez e deixa a ação fora do status", () => {
    render(
      <Comemoracao
        titulo="Checklist do D4 completo."
        texto="Falta só a sua assinatura."
        acao={<button type="button">Assinar registro do D4</button>}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Checklist do D4 completo.");
    expect(status).not.toContainElement(
      screen.getByRole("button", { name: "Assinar registro do D4" }),
    );
  });

  it("estado vazio mostra a ilustração no bloco; o tracejado continua sem ela", () => {
    const { rerender, container } = render(
      <EstadoVazio
        titulo="Nenhuma visita marcada para hoje"
        texto="Quando a coordenação marcar uma visita, ela aparece aqui."
        ilustracao={<CadernoDeVisita />}
      />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(
      <EstadoVazio
        variante="tracejado"
        titulo="Ainda sem registro"
        texto="Nada aconteceu neste dia ainda."
        ilustracao={<CadernoDeVisita />}
      />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});
