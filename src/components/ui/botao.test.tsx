import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Botao } from "./botao";

describe("Botao", () => {
  it("troca o rótulo e marca aria-busy quando carregando", () => {
    render(
      <Botao carregando rotuloCarregando="Assinando">
        Assinar
      </Botao>,
    );

    const botao = screen.getByRole("button", { name: "Assinando" });
    expect(botao).toHaveAttribute("aria-busy", "true");
  });

  it("bloqueia o clique quando carregando, sem tirar o botão da árvore de foco", async () => {
    const usuario = userEvent.setup();
    const aoClicar = vi.fn();
    render(
      <Botao carregando rotuloCarregando="Assinando" onClick={aoClicar}>
        Assinar
      </Botao>,
    );

    const botao = screen.getByRole("button", { name: "Assinando" });
    // `carregando` usa aria-disabled, não o atributo `disabled`: o botão
    // continua na árvore de foco (achado da auditoria da P10 parcial).
    expect(botao).not.toBeDisabled();
    expect(botao).toHaveAttribute("aria-disabled", "true");

    await usuario.click(botao);

    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("chama onClick normalmente quando não está carregando nem desabilitado", async () => {
    const usuario = userEvent.setup();
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Assinar</Botao>);

    await usuario.click(screen.getByRole("button", { name: "Assinar" }));

    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it("com disabled, o botão nativo fica realmente desabilitado", () => {
    render(<Botao disabled>Indisponível</Botao>);

    expect(screen.getByRole("button", { name: "Indisponível" })).toBeDisabled();
  });
});
