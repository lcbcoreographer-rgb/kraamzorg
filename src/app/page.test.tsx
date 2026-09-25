import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("página inicial", () => {
  it("renderiza o nome do sistema", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Kraamzorg OS" }),
    ).toBeInTheDocument();
  });
});
