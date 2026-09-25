import type { ReactNode } from "react";
import { descreverPapeis } from "@/lib/auth/papeis";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { abasDe, gruposDe, papelPrincipal } from "@/lib/navegacao";
import type { ItemNavegacao } from "@/lib/navegacao";
import { contarTransferenciasCriticas } from "@/modules/agente/transferencias/dados";
import {
  NavegacaoInferior,
  NavegacaoLateral,
  type ItemNavegacaoComContador,
} from "./navegacao-app";

/**
 * Acrescenta o contador da aba Início ("N transferências vencendo ou de
 * prioridade máxima"), só para o comercial (crítica do CRM, P0 item 1).
 * Falha de leitura não derruba a navegação: a aba fica sem contador.
 */
async function comContadorInicio(
  itens: ItemNavegacao[],
  papeis: SessaoUsuario["papeis"],
): Promise<ItemNavegacaoComContador[]> {
  if (papelPrincipal(papeis) !== "comercial") return itens;
  const contador = await contarTransferenciasCriticas().catch(() => 0);
  if (!contador) return itens;
  return itens.map((item) =>
    item.id === "inicio"
      ? {
          ...item,
          contador,
          rotuloContador: `${contador} ${contador === 1 ? "transferência" : "transferências"} pedindo atenção`,
        }
      : item,
  );
}

/**
 * Casca do painel (P10 item 3; DESIGN.md seções 3 e 6; protótipo
 * comercial-inicio.html e coordenacao-inicio.html). No celular: uma
 * coluna, margem de 16 px e abas inferiores fixas. No computador (1024 px
 * ou mais): barra lateral marinho de 248 px com os grupos do papel e o
 * conteúdo até 1240 px com margem de 32 px.
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
  const grupos = await Promise.all(
    gruposDe(sessao.papeis).map(async (grupo) => ({
      titulo: grupo.titulo,
      itens: await comContadorInicio(grupo.itens, sessao.papeis),
    })),
  );
  const abas = await comContadorInicio(abasDe(sessao.papeis), sessao.papeis);

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
          className="max-w-conteudo mx-auto w-full px-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-8 lg:pb-12"
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
        className="max-w-portal mx-auto w-full px-4 pb-[calc(88px+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
      <NavegacaoInferior abas={abasDe(sessao.papeis)} sempre />
    </>
  );
}
