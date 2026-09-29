// Antes de importar o Dexie: o IndexedDB falso do invariante 4.
import "fake-indexeddb/auto";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FamiliaPortal,
  PortalHoje,
  VisitaPortal,
} from "@/lib/dados/tipos-equipe";
import { bancoOffline, criarBancoOffline, type BancoOffline } from "@/lib/sync";
import { guardarDiaNoAparelho, lerDiaDoAparelho } from "./cache-portal";
import { HojeCliente } from "./componentes/hoje-cliente";
import { ProvedorPortal } from "./componentes/provedor-portal";
import {
  aplicarMarcasLocais,
  lerMarcasLocais,
  proximoPasso,
  registrarChegadaNoAparelho,
  registrarSaidaNoAparelho,
} from "./registro-local";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const USUARIO = "usuario-enfermeira-1";
const VISITA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function visita(sobrescreve: Partial<VisitaPortal> = {}): VisitaPortal {
  return {
    visitaId: VISITA_ID,
    acompanhamentoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    familiaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    nomeExibicao: "Família Teste Um",
    bairro: "Bairro Teste",
    endereco: { logradouro: "Rua Teste", numero: "10" },
    cidade: "Cidade Teste",
    uf: "SP",
    diaNumero: 2,
    diasContratados: 6,
    data: "2026-09-29",
    horaPrevista: "09:00",
    horasPorVisita: 4,
    turno: "manha",
    estado: "confirmada",
    checkinEm: null,
    checkoutEm: null,
    versao: 3,
    papel: "titular",
    estadoSensivel: "normal",
    gemelar: false,
    contatoNome: "Contato Teste",
    contatoTelefone: "+5511900000000",
    ...sobrescreve,
  };
}

const HOJE: PortalHoje = {
  dia: "2026-09-29",
  profissionalId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  profissionalNome: "Enfermeira Teste",
  status: "livre",
  visitas: [visita()],
  fichasPendentes: [],
};

const FAMILIAS: FamiliaPortal[] = [
  {
    familiaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    nomeExibicao: "Família Teste Um",
    bairro: "Bairro Teste",
    cidade: "Cidade Teste",
    uf: "SP",
    dpp: null,
    dataNascimento: "2026-09-25",
    dataAlta: "2026-09-27",
    dataInicioEfetivo: null,
    gemelar: false,
    estadoSensivel: "normal",
    papel: "titular",
    acompanhamento: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      estado: "em_execucao",
      diasContratados: 6,
      periodo: "manha",
      inicioEfetivo: null,
      encerramento: null,
    },
    visitas: [],
  },
];

let contador = 0;
let db: BancoOffline;

beforeEach(() => {
  contador += 1;
  db = criarBancoOffline(`teste-portal-cliente-${contador}-${Date.now()}`);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

describe("cache do dia no aparelho (P38 item 2)", () => {
  it("guarda o dia e as famílias e devolve tudo sem sinal", async () => {
    await guardarDiaNoAparelho(db, HOJE, FAMILIAS, 1_000);
    const guardado = await lerDiaDoAparelho(db, 2_000);
    expect(guardado?.dia).toBe("2026-09-29");
    expect(guardado?.visitas.map((v) => v.visitaId)).toEqual([VISITA_ID]);
    expect(guardado?.familias.map((f) => f.nomeExibicao)).toEqual([
      "Família Teste Um",
    ]);
    expect(guardado?.buscadoEm).toBe(1_000);
  });

  it("vence em 24 horas: passado esse tempo o Hoje pede para abrir com sinal", async () => {
    await guardarDiaNoAparelho(db, HOJE, FAMILIAS, 1_000);
    expect(await lerDiaDoAparelho(db, 1_000 + 24 * 3_600_000 + 1)).toBeNull();
  });
});

describe("chegada e saída no aparelho", () => {
  it("chegada grava a hora na fila e a visita passa a mostrar 'Saí da casa'", async () => {
    const antes = aplicarMarcasLocais(
      visita(),
      await lerMarcasLocais(db, VISITA_ID),
    );
    expect(proximoPasso(antes)).toBe("chegar");

    await registrarChegadaNoAparelho(
      db,
      USUARIO,
      visita(),
      new Date("2026-09-29T12:05:00Z"),
    );
    const depois = aplicarMarcasLocais(
      visita(),
      await lerMarcasLocais(db, VISITA_ID),
    );
    expect(depois.checkinEm).toBe("2026-09-29T12:05:00.000Z");
    expect(depois.chegadaSituacao).toBe("no_aparelho");
    expect(depois.estado).toBe("iniciada");
    expect(proximoPasso(depois)).toBe("sair");
    expect(await db.fila.count()).toBe(1);
  });

  it("saída fecha a visita e deixa a ficha do dia pendente", async () => {
    await registrarChegadaNoAparelho(
      db,
      USUARIO,
      visita(),
      new Date("2026-09-29T12:05:00Z"),
    );
    await registrarSaidaNoAparelho(
      db,
      USUARIO,
      visita(),
      new Date("2026-09-29T16:10:00Z"),
    );
    const tela = aplicarMarcasLocais(
      visita(),
      await lerMarcasLocais(db, VISITA_ID),
    );
    expect(tela.checkoutEm).toBe("2026-09-29T16:10:00.000Z");
    expect(tela.estado).toBe("ficha_pendente");
    expect(proximoPasso(tela)).toBe("nenhum");
    expect(await db.fila.count()).toBe(2);
  });

  it("a hora que o servidor já devolveu vale mais que a do aparelho", () => {
    const tela = aplicarMarcasLocais(
      visita({ checkinEm: "2026-09-29T12:00:00.000Z", estado: "iniciada" }),
      { chegada: null, saida: null },
    );
    expect(tela.chegadaSituacao).toBe("sincronizado");
    expect(proximoPasso(tela)).toBe("sair");
  });
});

describe("Hoje sem sinal (tela)", () => {
  it("abre o dia guardado, registra a chegada e mostra o que está salvo no aparelho", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    // O motor real usa o banco padrão do app; o teste guarda o dia nele.
    const banco = bancoOffline();
    await banco.delete().catch(() => undefined);
    await banco.open();
    await guardarDiaNoAparelho(banco, HOJE, FAMILIAS);

    render(
      <ProvedorPortal usuarioId={USUARIO}>
        <HojeCliente inicial={null} familias={[]} hoje={null} />
      </ProvedorPortal>,
    );

    expect(await screen.findByText("Família Teste Um")).toBeInTheDocument();
    expect(screen.getAllByText(/Sem sinal agora/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/sobe sozinho quando a conexão voltar/),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cheguei" }));
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Saí da casa" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Salvo no aparelho")).toBeInTheDocument();
    expect(await banco.fila.count()).toBe(1);
  });
});
