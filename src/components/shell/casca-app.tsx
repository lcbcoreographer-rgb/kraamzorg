import type { ReactNode } from "react";
import { descreverPapeis } from "@/lib/auth/papeis";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { abasDe, gruposDe } from "@/lib/navegacao";
import { NavegacaoInferior, NavegacaoLateral } from "./navegacao-app";

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
export function CascaApp({
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
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[var(--container-lateral)_minmax(0,1fr)]">
        <NavegacaoLateral
          grupos={gruposDe(sessao.papeis)}
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
      <NavegacaoInferior abas={abasDe(sessao.papeis)} />
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
