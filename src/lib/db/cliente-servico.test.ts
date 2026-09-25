import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A chave service_role ignora a RLS: só o servidor usa, e só nos arquivos
 * autorizados (cliente-servico.ts lista os motivos). Nenhum componente de
 * navegador, nenhum "use client" e nenhum outro arquivo importa o cliente
 * de serviço ou lê SUPABASE_SERVICE_ROLE_KEY.
 */
const RAIZ = resolve(__dirname, "../../..");
const SRC = join(RAIZ, "src");

const AUTORIZADOS = new Set([
  "src/lib/db/cliente-servico.ts",
  "src/lib/dados/supabase/usuarios.ts",
]);

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx|mjs|js)$/.test(nome) && !/\.test\.tsx?$/.test(nome)
      ? [caminho]
      : [];
  });
}

describe("cliente de serviço (service_role)", () => {
  const todos = arquivos(SRC).map((caminho) => ({
    caminho: relative(RAIZ, caminho),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("só os arquivos autorizados importam o cliente de serviço ou leem a chave", () => {
    const usam = todos
      .filter(
        (a) =>
          /cliente-servico/.test(a.texto.replace(/^\s*(\/\/|\*).*$/gm, "")) ||
          a.texto.includes("SUPABASE_SERVICE_ROLE_KEY"),
      )
      .map((a) => a.caminho)
      .filter((c) => !AUTORIZADOS.has(c));
    expect(usam).toEqual([]);
  });

  it("o cliente de serviço é server-only", () => {
    const servico = todos.find(
      (a) => a.caminho === "src/lib/db/cliente-servico.ts",
    );
    expect(servico?.texto).toMatch(/^import "server-only";/m);
  });

  it("nenhum arquivo 'use client' importa algo de src/lib/dados, da autenticação do servidor ou do cliente de servidor", () => {
    const clientes = todos.filter((a) => /^["']use client["'];/m.test(a.texto));
    const proibidos = clientes.filter((a) =>
      /from "@\/lib\/(dados\/(fabrica|supabase|demonstracao|modo)|auth\/(sessao|supabase|demonstracao|borda)|db\/cliente-(servidor|servico))/.test(
        a.texto,
      ),
    );
    expect(proibidos.map((a) => a.caminho)).toEqual([]);
  });
});
