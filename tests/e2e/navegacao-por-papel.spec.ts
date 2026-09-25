import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "./apoio/entrar";

/**
 * P10 item 3 (aceite: "Playwright no celular e no computador mostra a
 * navegação certa por papel; axe sem violação grave"). Cada papel entra
 * pelo seletor da demonstração, passa pelo MFA quando o papel exige (PRD 13)
 * e confere as abas inferiores (celular) ou os grupos da barra lateral
 * (computador), conforme o PRD 20.4 e o protótipo.
 */
interface Esperado {
  rotulo: string;
  inicio: string;
  abas: string[];
  grupos: string[];
  /** Portal da enfermeira: abas também no computador, sem barra lateral. */
  portal?: boolean;
}

const PAPEIS: Esperado[] = [
  {
    rotulo: "Comercial",
    inicio: "/inicio",
    abas: ["Início", "Pipeline", "Conversas", "Famílias", "Mais"],
    grupos: ["Comercial", "Sistema"],
  },
  {
    rotulo: "Coordenação",
    inicio: "/inicio",
    abas: ["Início", "Radar", "Agenda", "Famílias", "Mais"],
    grupos: ["Operação", "Experiência", "Sistema"],
  },
  {
    rotulo: "Financeiro",
    inicio: "/inicio",
    abas: ["Início", "Cobranças", "Notas", "Mais"],
    grupos: ["Comercial", "Gestão"],
  },
  {
    rotulo: "Diretoria",
    inicio: "/inicio",
    abas: ["Início", "Pipeline", "Radar", "Financeiro", "Mais"],
    grupos: ["Comercial", "Operação", "Gestão", "Sistema"],
  },
  {
    rotulo: "Marketing",
    inicio: "/inicio",
    abas: ["Início", "Mais"],
    grupos: ["Gestão"],
  },
  {
    rotulo: "Enfermeira",
    inicio: "/hoje",
    abas: ["Hoje", "Famílias", "Alertas", "Perfil"],
    grupos: [],
    portal: true,
  },
];

for (const papel of PAPEIS) {
  test(`${papel.rotulo}: entra, vê a navegação do papel e passa no axe`, async ({
    page,
  }, info) => {
    await entrarComo(page, papel.rotulo);
    await expect(page).toHaveURL(new RegExp(`${papel.inicio}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const navegacao = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    await expect(navegacao).toHaveCount(1);

    const celular = info.project.name === "celular";
    if (celular || papel.portal) {
      await expect(navegacao.getByRole("link")).toHaveText(papel.abas);
      await expect(
        navegacao.getByRole("link", { name: papel.abas[0] }),
      ).toHaveAttribute("aria-current", "page");
    } else {
      const titulos = navegacao.getByRole("list");
      await expect(titulos).toHaveCount(papel.grupos.length);
      for (const grupo of papel.grupos) {
        await expect(
          navegacao.getByRole("list", { name: grupo }),
        ).toBeVisible();
      }
      await expect(
        navegacao.getByRole("link", { name: "Início" }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        navegacao.getByRole("button", { name: "Sair" }),
      ).toBeVisible();
    }

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });
}

test("rota fora da navegação do papel volta para o início", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/sessoes");
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/inicio$/);
});

test("todas as rotas do comercial abrem com o estado vazio", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  for (const [caminho, titulo] of [
    ["/pipeline", "Pipeline"],
    ["/familias", "Famílias"],
    ["/familias/00000000-0000-4000-8006-000000000001", "Ficha da família"],
    ["/conversas", "Conversas"],
    ["/transferencias", "Transferências"],
    ["/agente", "Isadora"],
    ["/tarefas", "Tarefas"],
    ["/mais", "Mais"],
  ] as const) {
    await page.goto(caminho);
    await expect(page).toHaveURL(new RegExp(`${caminho}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: titulo }),
    ).toBeVisible();
  }
});

test("Mais mostra o resto da navegação e sai do sistema", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/mais");
  const conteudo = page.locator("#conteudo");
  await expect(
    conteudo.getByRole("link", { name: "Transferências" }),
  ).toBeVisible();
  await expect(conteudo.getByRole("link", { name: "Isadora" })).toBeVisible();
  await semViolacaoGrave(page);
  await page.getByRole("button", { name: "Sair" }).last().click();
  await expect(page).toHaveURL(/\/entrar\?aviso=saiu$/);
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/entrar\?proximo=%2Fpipeline$/);
});
