import type { ReactNode } from "react";
import { descreverPapeis } from "@/lib/auth/papeis";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import {
  abasDe,
  gruposDe,
  papelPrincipal,
  rotasPermitidas,
} from "@/lib/navegacao";
import type { IdRota, ItemNavegacao } from "@/lib/navegacao";
import { contagemParaNavegacao } from "@/modules/agente/conversas/lista";
import { listarFilaTela } from "@/modules/agente/transferencias/dados";
import { contarTransferenciasCriticas } from "@/modules/agente/formatacao";
import {
  NavegacaoInferior,
  NavegacaoLateral,
  type ItemNavegacaoComContador,
} from "./navegacao-app";

type Contador = Pick<
  ItemNavegacaoComContador,
  "contador" | "rotuloContador" | "contadorAlerta"
>;

/**
 * Contadores da navegação, lidos uma vez só por tela:
 * - Início do comercial: transferências vencendo ou de prioridade máxima,
 *   em alerta (crítica do CRM, P0 item 1).
 * - Conversas: quantas conversas esperam alguém (a antiga fila, que mora
 *   no filtro "Esperando alguém" desde 30/09). Neutro no prazo; em alerta
 *   só com prazo vencido ou relato de saúde (DESIGN.md, 2.9: contador em
 *   alerta só para alerta clínico ou transferência vencendo; perda nunca
 *   em vermelho).
 * Falha de leitura não derruba a navegação: o item fica sem contador.
 */
async function contadoresDaNavegacao(
  papeis: SessaoUsuario["papeis"],
): Promise<Partial<Record<IdRota, Contador>>> {
  const doComercial = papelPrincipal(papeis) === "comercial";
  const veConversas = rotasPermitidas(papeis).has("conversas");
  if (!doComercial && !veConversas) return {};

  const fila = await listarFilaTela().catch(() => null);
  if (!fila) return {};
  const agora = new Date();
  const contadores: Partial<Record<IdRota, Contador>> = {};

  if (doComercial) {
    const criticas = contarTransferenciasCriticas(fila, agora);
    if (criticas) {
      contadores.inicio = {
        contador: criticas,
        rotuloContador: `${criticas} ${criticas === 1 ? "transferência" : "transferências"} pedindo atenção`,
      };
    }
  }

  if (veConversas) {
    const { esperando, urgente } = contagemParaNavegacao(fila, agora);
    if (esperando) {
      contadores.conversas = {
        contador: esperando,
        contadorAlerta: urgente,
        rotuloContador: `${esperando} ${esperando === 1 ? "conversa esperando alguém" : "conversas esperando alguém"}`,
      };
    }
  }
  return contadores;
}

function comContadores(
  itens: ItemNavegacao[],
  contadores: Partial<Record<IdRota, Contador>>,
): ItemNavegacaoComContador[] {
  return itens.map((item) =>
    contadores[item.id] ? { ...item, ...contadores[item.id] } : item,
  );
}

/**
 * Casca do painel (P10 item 3; DESIGN.md seções 2.9, 3 e 6). No celular:
 * uma coluna, margem de 16 px e a navegação em pílula flutuante. No
 * computador (1024 px ou mais): barra lateral marinho solta das bordas,
 * na coluna de 248 px, e o conteúdo até 1240 px com margem de 32 px.
 *
 * A casca não sabe de que módulo é a tela: cada rota preenche só o próprio
 * conteúdo (src/app/(app)/<rota>/page.tsx).
 */
export async function CascaApp({
  sessao,
  children,
}: {
  sessao: SessaoUsuario;
  children: ReactNode;
}) {
  const contadores = await contadoresDaNavegacao(sessao.papeis);
  const grupos = gruposDe(sessao.papeis).map((grupo) => ({
    titulo: grupo.titulo,
    itens: comContadores(grupo.itens, contadores),
  }));
  const abas = comContadores(abasDe(sessao.papeis), contadores);

  return (
    <>
      <a
        href="#conteudo"
        className="rounded-pilula bg-acao text-acao-texto fixed top-[-100px] left-4 z-[var(--z-aviso)] px-4 py-3 focus:top-2"
      >
        Pular para o conteúdo
      </a>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[var(--container-lateral)_minmax(0,1fr)]">
        <NavegacaoLateral
          grupos={grupos}
          nome={sessao.nome}
          papeis={descreverPapeis(sessao.papeis)}
        />
        <main
          id="conteudo"
          tabIndex={-1}
          className="max-w-conteudo mx-auto w-full px-4 pb-[calc(var(--altura-abas)+24px+env(safe-area-inset-bottom))] lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <NavegacaoInferior abas={abas} />
    </>
  );
}

/**
 * Casca do portal da enfermeira (PRD 20.4; telas.md, grupo enfermeira):
 * abas inferiores em qualquer largura, sem barra lateral, conteúdo
 * centralizado em até 720 px. O P38 preenche as telas; o P11 e o P12
 * acrescentam o que é offline.
 */
export function CascaEnfermeira({
  sessao,
  children,
}: {
  sessao: SessaoUsuario;
  children: ReactNode;
}) {
  return (
    <>
      <a
        href="#conteudo"
        className="rounded-pilula bg-acao text-acao-texto fixed top-[-100px] left-4 z-[var(--z-aviso)] px-4 py-3 focus:top-2"
      >
        Pular para o conteúdo
      </a>
      <main
        id="conteudo"
        tabIndex={-1}
        className="max-w-portal mx-auto w-full px-4 pb-[calc(var(--altura-abas)+24px+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
      <NavegacaoInferior abas={abasDe(sessao.papeis)} sempre />
    </>
  );
}
