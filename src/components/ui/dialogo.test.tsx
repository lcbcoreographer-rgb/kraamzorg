import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
} from "./dialogo";

function ExemploDialogo() {
  return (
    <Dialogo>
      <DialogoGatilho>Assinar registro do D4</DialogoGatilho>
      <DialogoConteudo titulo="Assinar registro do D4" rotuloFechar="Fechar">
        <p>Depois de assinado, não pode ser apagado.</p>
        <DialogoFechar>Cancelar</DialogoFechar>
      </DialogoConteudo>
    </Dialogo>
  );
}

describe("Dialogo", () => {
  it("abre ao acionar o gatilho e prende o foco dentro do conteúdo", async () => {
    const usuario = userEvent.setup();
    render(<ExemploDialogo />);

    await usuario.click(
      screen.getByRole("button", { name: "Assinar registro do D4" }),
    );

    expect(
      screen.getByRole("heading", { name: "Assinar registro do D4" }),
    ).toBeInTheDocument();

    // O foco entra no diálogo (Radix leva pro primeiro elemento focável ou
    // pro próprio conteúdo) e Tab não escapa dele: com Cancelar e Fechar
    // como únicos alvos, dar Tab repetidas vezes mantém o foco nesse par.
    await usuario.tab();
    const dentroDoDialogo = screen
      .getByRole("dialog")
      .contains(document.activeElement);
    expect(dentroDoDialogo).toBe(true);
  });

  it("fecha com Esc", async () => {
    const usuario = userEvent.setup();
    render(<ExemploDialogo />);

    await usuario.click(
      screen.getByRole("button", { name: "Assinar registro do D4" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fecha ao acionar o botão de fechar", async () => {
    const usuario = userEvent.setup();
    render(<ExemploDialogo />);

    await usuario.click(
      screen.getByRole("button", { name: "Assinar registro do D4" }),
    );
    await usuario.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
