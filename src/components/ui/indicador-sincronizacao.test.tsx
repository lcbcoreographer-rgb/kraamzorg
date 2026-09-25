import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndicadorSincronizacao } from "./indicador-sincronizacao";

describe("IndicadorSincronizacao", () => {
  it("mostra o texto do estado local", () => {
    render(<IndicadorSincronizacao estado="local" texto="Salvo no aparelho" />);

    expect(screen.getByRole("status")).toHaveTextContent("Salvo no aparelho");
  });

  it("mostra o texto do estado enviando", () => {
    render(
      <IndicadorSincronizacao estado="enviando" texto="Enviando 3 respostas" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Enviando 3 respostas",
    );
  });

  it("mostra o texto do estado sincronizado", () => {
    render(
      <IndicadorSincronizacao
        estado="sincronizado"
        texto="Sincronizado 11:42"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Sincronizado 11:42");
  });

  it("não mostra botão de nova tentativa fora do estado de erro", () => {
    render(
      <IndicadorSincronizacao
        estado="sincronizado"
        texto="Sincronizado 11:42"
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("mostra o botão de nova tentativa no estado de erro e chama o callback", () => {
    const aoTentar = vi.fn();
    render(
      <IndicadorSincronizacao
        estado="erro"
        texto="Não enviou. Tentamos de novo em 30 s."
        aoTentarNovamente={aoTentar}
        rotuloTentarNovamente="Tentar agora"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tentar agora" }));

    expect(aoTentar).toHaveBeenCalledTimes(1);
  });
});
