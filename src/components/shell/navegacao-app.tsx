"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { AbasInferiores } from "@/components/ui/abas-inferiores";
import { BarraLateral } from "@/components/ui/barra-lateral";
import { ativo, type GrupoLateral, type ItemNavegacao } from "@/lib/navegacao";
import { IconeNavegacao } from "./icones-navegacao";

/**
 * Item de navegação com o contador opcional da aba Início (P0 item 1):
 * transferências vencendo ou de prioridade máxima, só para o comercial.
 * `ItemNavegacao` (src/lib/navegacao) fica sem o campo porque o proxy lê
 * esse tipo sem montar o contador.
 */
export type ItemNavegacaoComContador = ItemNavegacao & {
  contador?: number;
  rotuloContador?: string;
};

/**
 * Navegação da casca, ligada ao caminho atual (item ativo). Recebe os
 * itens já filtrados pelo papel (src/lib/navegacao, no servidor): a barra
 * lateral aparece só no computador (1024 px ou mais) e as abas inferiores
 * só abaixo disso (DESIGN.md, seção 3).
 */
export interface NavegacaoAppProps {
  grupos: { titulo: GrupoLateral; itens: ItemNavegacaoComContador[] }[];
  abas: ItemNavegacaoComContador[];
  nome: string;
  papeis: string;
}

export function NavegacaoLateral({
  grupos,
  nome,
  papeis,
}: Omit<NavegacaoAppProps, "abas">) {
  const caminho = usePathname();
  return (
    <BarraLateral
      nomeMarca="Kraamzorg OS"
      simboloSrc="/brand/simbolo-provisorio.png"
      rotulo="Navegação principal"
      visivelEm="computador"
      grupos={grupos.map((grupo) => ({
        titulo: grupo.titulo,
        itens: grupo.itens.map((item) => ({
          rotulo: item.rotulo,
          href: item.caminho,
          icone: <IconeNavegacao nome={item.icone} />,
          ativo: ativo(item, caminho),
          contador: item.contador,
          contadorAlerta: Boolean(item.contador),
          rotuloContador: item.rotuloContador,
        })),
      }))}
      rodape={
        <div className="flex flex-col gap-2 px-2">
          <div>
            <p className="text-texto-inverso font-semibold">{nome}</p>
            <p className="text-mini text-texto-inverso-2">{papeis}</p>
          </div>
          <form action="/sair" method="post">
            <button
              type="submit"
              className="min-h-toque rounded-pilula text-apoio text-texto-inverso hover:bg-lateral-hover -ml-3 inline-flex items-center gap-2 px-3 font-medium"
            >
              <LogOut
                aria-hidden="true"
                className="text-texto-inverso-2 size-5"
                strokeWidth={1.75}
              />
              Sair
            </button>
          </form>
        </div>
      }
    />
  );
}

export function NavegacaoInferior({
  abas,
  sempre = false,
}: Pick<NavegacaoAppProps, "abas"> & { sempre?: boolean }) {
  const caminho = usePathname();
  return (
    <AbasInferiores
      rotulo="Navegação principal"
      visivelEm={sempre ? "sempre" : "celular"}
      itens={abas.map((item) => ({
        rotulo: item.rotulo,
        href: item.caminho,
        icone: <IconeNavegacao nome={item.icone} />,
        ativo: ativo(item, caminho),
        contador: item.contador,
        rotuloContador: item.rotuloContador,
      }))}
    />
  );
}
