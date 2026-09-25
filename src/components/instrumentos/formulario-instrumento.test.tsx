import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import doc1 from "../../../supabase/dados/instrumentos/doc1.json";
import doc2 from "../../../supabase/dados/instrumentos/doc2.json";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import { criarPersistenciaEmMemoria } from "@/lib/instrumentos/persistencia";
import { FormularioInstrumento } from "./formulario-instrumento";

/**
 * Aceite do P34: o DOC 2 renderiza os blocos do 9.2 com os tipos certos,
 * condição para aparecer, obrigatórios e gemelar com dois bebês. Dados
 * fictícios; nenhum nome de família.
 */
const DOC2 = lerDefinicao(doc2);
const DOC1 = lerDefinicao(doc1);
const GEMEOS = [
  { id: "bebe-a", rotulo: "Bebê 1" },
  { id: "bebe-b", rotulo: "Bebê 2" },
];

const TITULOS_9_2 = [
  "1 Chegada e preparo",
  "2 Puérpera, estado geral",
  "2.1 Sinais vitais",
  "2.2 Ferida operatória",
  "2.3 Medicações",
  "2.4 Autocuidado",
  "2.5 Mamas",
  "2.6 Amamentação e dor",
  "2.7 Lesão mamilar",
  "2.8 Técnica",
  "2.9 Laserterapia",
  "2.10 Hábitos",
  "2.11 Frequência",
  "2.12 Produção",
  "2.13 Apoio",
  "3 RN, avaliação",
  "3.1 Sinais vitais do RN",
  "3.2 Cuidados com o RN",
  "4 Orientações adicionais",
  "5 Sono e rotina",
  "6 Educação da família",
  "7 Apoio emocional",
  "8 Encerramento",
  "9 Comunicação",
  "Assinatura",
  "Resumo",
];

function montar(
  props: Partial<React.ComponentProps<typeof FormularioInstrumento>> = {},
) {
  const persistencia = criarPersistenciaEmMemoria();
  const utils = render(
    <FormularioInstrumento
      definicao={DOC2}
      persistencia={persistencia}
      bebes={GEMEOS}
      agora={() => new Date("2030-01-10T13:05:00Z")}
      {...props}
    />,
  );
  return { persistencia, ...utils };
}

function titulo() {
  return screen
    .getByRole("heading", { level: 2 })
    .textContent?.replace(/\s+/g, " ")
    .trim();
}

async function avancar(user: ReturnType<typeof userEvent.setup>, vezes = 1) {
  for (let i = 0; i < vezes; i += 1) {
    await user.click(screen.getByRole("button", { name: "Próxima etapa" }));
  }
}

describe("FormularioInstrumento com o DOC 2", () => {
  it("mostra uma etapa por bloco do 9.2, na ordem", async () => {
    const user = userEvent.setup();
    montar();
    const vistos: string[] = [];
    for (let i = 0; i < TITULOS_9_2.length; i += 1) {
      expect(
        screen.getByText(`Etapa ${i + 1} de ${TITULOS_9_2.length}`),
      ).toBeInTheDocument();
      vistos.push(titulo() ?? "");
      if (i < TITULOS_9_2.length - 1) await avancar(user);
    }
    expect(vistos).toEqual(TITULOS_9_2);
    expect(
      screen.getByRole("button", { name: "Concluir" }),
    ).toBeInTheDocument();
  });

  it("usa o controle certo para cada tipo do bloco 1 e do 2.1", async () => {
    const user = userEvent.setup();
    const { container } = montar();
    // Bloco 1: data e horário, cinco perguntas sim ou não (uma com texto).
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
    expect(container.querySelector('input[type="time"]')).not.toBeNull();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(5);
    expect(
      within(
        screen.getByRole("radiogroup", { name: /Pontualidade confirmada/ }),
      ).getAllByRole("radio"),
    ).toHaveLength(2);

    await avancar(user); // 2
    const dor = screen.getByRole("radiogroup", { name: /Dor, intensidade/ });
    expect(within(dor).getAllByRole("radio")).toHaveLength(11);

    await avancar(user); // 2.1
    expect(
      screen.getByRole("group", { name: /Pressão arterial/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Sistólica/)).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByLabelText(/Diastólica/)).toBeInTheDocument();
    expect(screen.getAllByText("mmHg")).toHaveLength(2);
    expect(screen.getByLabelText(/Temperatura/)).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByText("°C")).toBeInTheDocument();
    expect(screen.getByText("bpm")).toBeInTheDocument();
  });

  it("não traz resposta marcada: nada vem preenchido além de hora e data automáticas", () => {
    montar();
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).not.toBeChecked();
  });

  it("grava por campo: toque grava na hora; número grava ao sair do campo", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    await user.click(
      within(
        screen.getByRole("radiogroup", { name: /Pontualidade confirmada/ }),
      ).getByRole("radio", {
        name: /Sim/,
      }),
    );
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "1", campo: "pontualidade_confirmada" },
      valor: true,
    });
    expect(screen.getByRole("status")).toHaveTextContent("Salvo no aparelho");

    await avancar(user, 2); // 2.1
    const temperatura = screen.getByLabelText(/Temperatura/);
    await user.type(temperatura, "37,8");
    const antes = persistencia.gravacoes.length;
    await user.tab();
    expect(persistencia.gravacoes.length).toBe(antes + 1);
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "2.1", campo: "temperatura" },
      valor: 37.8,
    });
  });

  it("condição para aparecer: motivo do contato só depois do sim em contato com médico", async () => {
    const user = userEvent.setup();
    montar();
    await avancar(user, TITULOS_9_2.indexOf("9 Comunicação"));
    expect(titulo()).toBe("9 Comunicação");
    expect(screen.queryByLabelText(/Motivo do contato realizado/)).toBeNull();
    const grupo = screen.getByRole("radiogroup", {
      name: /Contato com médico necessário/,
    });
    await user.click(within(grupo).getByRole("radio", { name: /Não/ }));
    expect(screen.queryByLabelText(/Motivo do contato realizado/)).toBeNull();
    await user.click(within(grupo).getByRole("radio", { name: /Sim/ }));
    expect(
      screen.getByLabelText(/Motivo do contato realizado/),
    ).toBeInTheDocument();
  });

  it("resposta que deixa de se aplicar é apagada e a remoção grava", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    await avancar(user, TITULOS_9_2.indexOf("9 Comunicação"));
    const grupo = screen.getByRole("radiogroup", {
      name: /Contato com médico necessário/,
    });
    await user.click(within(grupo).getByRole("radio", { name: /Sim/ }));
    await user.type(
      screen.getByLabelText(/Motivo do contato realizado/),
      "Febre persistente",
    );
    await user.tab();
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "9", campo: "motivo_contato_realizado" },
      valor: "Febre persistente",
    });

    await user.click(within(grupo).getByRole("radio", { name: /Não/ }));
    const ultimas = persistencia.gravacoes.slice(-2);
    expect(ultimas).toContainEqual({
      endereco: { bloco: "9", campo: "motivo_contato_realizado" },
      valor: null,
    });
    expect(ultimas).toContainEqual({
      endereco: { bloco: "9", campo: "contato_medico_necessario" },
      valor: false,
    });
    // Voltar ao sim abre o campo vazio: o texto antigo não volta escondido.
    await user.click(within(grupo).getByRole("radio", { name: /Sim/ }));
    expect(screen.getByLabelText(/Motivo do contato realizado/)).toHaveValue(
      "",
    );
  });

  it("sim ou não com texto: o texto não fica gravado quando a resposta deixa de pedir", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    const grupo = screen.getByRole("radiogroup", {
      name: /Acompanhante presente/,
    });
    await user.click(within(grupo).getByRole("radio", { name: /Sim/ }));
    await user.type(screen.getByLabelText("Quem?"), "Parceiro");
    await user.tab();
    expect(persistencia.gravacoes.at(-1)?.valor).toEqual({
      resposta: true,
      texto: "Parceiro",
    });
    await user.click(within(grupo).getByRole("radio", { name: /Não/ }));
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "1", campo: "acompanhante_presente" },
      valor: { resposta: false },
    });
  });

  it("sim ou não com texto abre o texto só quando a resposta pede", async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.queryByLabelText("Quem?")).toBeNull();
    const grupo = screen.getByRole("radiogroup", {
      name: /Acompanhante presente/,
    });
    await user.click(within(grupo).getByRole("radio", { name: /Sim/ }));
    expect(screen.getByLabelText("Quem?")).toBeInTheDocument();
    await user.click(within(grupo).getByRole("radio", { name: /Não/ }));
    expect(screen.queryByLabelText("Quem?")).toBeNull();
  });

  it("marca os obrigatórios e só libera concluir sem pendência", async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.getByText("Data", { exact: false }).textContent).toContain(
      "(obrigatório)",
    );
    await avancar(user, TITULOS_9_2.length - 1);
    const concluir = screen.getByRole("button", { name: "Concluir" });
    expect(concluir).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Falta responder para concluir:"),
    ).toBeInTheDocument();
    // Bloco de amamentação inteiro e os dois bebês entram na lista.
    expect(
      screen.getByRole("button", { name: /Ir para Apoio, Quem mais apoia/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Ir para Sinais vitais do RN, Bebê 1, Peso/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Ir para Sinais vitais do RN, Bebê 2, Peso/,
      }),
    ).toBeInTheDocument();
    // Tocar a pendência leva à etapa e à aba do bebê.
    await user.click(
      screen.getByRole("button", {
        name: /Ir para Sinais vitais do RN, Bebê 2, Peso/,
      }),
    );
    expect(titulo()).toBe("3.1 Sinais vitais do RN");
    expect(screen.getByRole("tab", { name: "Bebê 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("gemelar: uma aba por bebê, e cada resposta grava com o bebê certo", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    await avancar(user, TITULOS_9_2.indexOf("3.1 Sinais vitais do RN"));
    const abas = screen.getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual(["Bebê 1", "Bebê 2"]);

    await user.type(screen.getByLabelText(/Peso/), "2890");
    await user.tab();
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "3.1", campo: "peso", bebe: "bebe-a" },
      valor: 2890,
    });

    await user.click(screen.getByRole("tab", { name: "Bebê 2" }));
    const pesoB = screen.getByLabelText(/Peso/);
    expect(pesoB).toHaveValue("");
    await user.type(pesoB, "2710");
    await user.tab();
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "3.1", campo: "peso", bebe: "bebe-b" },
      valor: 2710,
    });

    await user.click(screen.getByRole("tab", { name: "Bebê 1" }));
    expect(screen.getByLabelText(/Peso/)).toHaveValue("2890");
  });

  it("bebê único: sem abas; nenhum bebê: aviso no lugar do bloco", async () => {
    const user = userEvent.setup();
    const { unmount } = montar({ bebes: [{ id: "unico", rotulo: "Bebê" }] });
    await avancar(user, TITULOS_9_2.indexOf("3 RN, avaliação"));
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.getByRole("radiogroup", {
        name: /Respiração sem sinais de esforço/,
      }),
    ).toBeInTheDocument();
    unmount();

    montar({ bebes: [] });
    await avancar(user, TITULOS_9_2.indexOf("3 RN, avaliação"));
    expect(screen.getByText(/Nenhum bebê registrado/)).toBeInTheDocument();
  });

  it("último dia: a etapa aparece só com o contexto, e o pediatra aceita justificativa", async () => {
    const user = userEvent.setup();
    montar({ contexto: { ultimo_dia: true } });
    await avancar(user, TITULOS_9_2.indexOf("9 Comunicação") + 1);
    expect(titulo()).toBe("Último dia");
    expect(screen.getByText("Etapa 25 de 27")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Não consegui, justificar" }),
    );
    expect(
      screen.getByLabelText("Justificativa da ausência do contato do pediatra"),
    ).toBeInTheDocument();
  });

  it("LATCH: nota de 0 a 10 com a avaliação ótimo, regular ou ruim", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    await avancar(user, TITULOS_9_2.indexOf("2.8 Técnica"));
    const latch = screen.getByRole("radiogroup", { name: /^LATCH/ });
    await user.click(within(latch).getByRole("radio", { name: "5" }));
    const avaliacao = screen.getByRole("radiogroup", { name: "Avaliação" });
    await user.click(within(avaliacao).getByRole("radio", { name: "Regular" }));
    expect(persistencia.gravacoes.at(-1)).toEqual({
      endereco: { bloco: "2.8", campo: "latch" },
      valor: { valor: 5, complemento: "regular" },
    });
  });

  it("múltipla escolha com opção exclusiva: não aplicada desmarca as outras", async () => {
    const user = userEvent.setup();
    const { persistencia } = montar();
    await avancar(user, TITULOS_9_2.indexOf("2.9 Laserterapia"));
    await user.click(screen.getByRole("checkbox", { name: "Analgesia" }));
    await user.click(screen.getByRole("checkbox", { name: "ILIB" }));
    expect(persistencia.gravacoes.at(-1)?.valor).toEqual(["analgesia", "ilib"]);
    await user.click(screen.getByRole("checkbox", { name: "Não aplicada" }));
    expect(persistencia.gravacoes.at(-1)?.valor).toEqual(["nao_aplicada"]);
    expect(
      screen.getByRole("checkbox", { name: "Analgesia" }),
    ).not.toBeChecked();
  });

  it("avisa o motor de alertas com as ligações satisfeitas (PU-01 a 38 °C)", async () => {
    const user = userEvent.setup();
    const avaliados: string[][] = [];
    montar({
      aoAvaliarAlertas: (_e, alertas) =>
        avaliados.push(alertas.flatMap((a) => a.regras)),
    });
    await avancar(user, 2);
    await user.type(screen.getByLabelText(/Temperatura/), "38,2");
    await user.tab();
    expect(avaliados.at(-1)).toEqual(["PU-01"]);
  });

  it("retoma na etapa onde parou", () => {
    montar({ etapaInicial: 6 });
    expect(titulo()).toBe("2.5 Mamas");
  });
});

describe("FormularioInstrumento com o DOC 1", () => {
  it("preenche a hora de início ao abrir e grava, editável", () => {
    const persistencia = criarPersistenciaEmMemoria();
    render(
      <FormularioInstrumento
        definicao={DOC1}
        persistencia={persistencia}
        etapaInicial={1}
        agora={() => new Date("2030-01-10T13:05:00Z")}
      />,
    );
    expect(screen.getByLabelText("Hora de início")).toHaveValue("10:05");
    expect(screen.getByLabelText("Hora de término")).toHaveValue("");
    expect(persistencia.gravacoes).toContainEqual({
      endereco: { bloco: "B", campo: "hora_de_inicio" },
      valor: "10:05",
    });
  });
});
