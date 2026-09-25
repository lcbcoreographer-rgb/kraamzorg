import { describe, expect, it } from "vitest";
import { criarMensageiro } from "./index";

describe("criarMensageiro", () => {
  it("monta a implementação de cada canal do enum modo_mensageria", () => {
    expect(criarMensageiro("manual").canal).toBe("manual");
    expect(criarMensageiro("uazapi").canal).toBe("uazapi");
    expect(criarMensageiro("cloud_api").canal).toBe("cloud_api");
  });
});
