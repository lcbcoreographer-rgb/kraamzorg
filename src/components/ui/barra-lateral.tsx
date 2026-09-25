import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Barra lateral (DESIGN.md, seção 6). Computador, marinho, 248 px, símbolo
 * e nome do sistema no topo. Grupos com título em frase, itens de 44 px,
 * ativo em marinho-claro com ícone dourado. Mostra só o que o papel pode
 * abrir.
 *
 * Este componente é estático (sem papel): os grupos e itens vêm sempre por
 * propriedade. Os grupos por papel (Comercial, Operação, Experiência,
 * Gestão, Sistema) são da casca do app, depois do P07.
 *
 * A visibilidade por tamanho de tela (`hidden lg:flex`) não mora mais aqui:
 * a casca decide isso (`visivelEm`), porque um componente que já esconde a
 * si mesmo deixa uma caixa vazia de 248 px quando alguém, como a vitrine do
 * design system, precisa mostrá-lo fora do computador (achado da auditoria
 * da P10 parcial).
 */
export interface ItemBarraLateral {
  rotulo: string;
  href: string;
  icone: React.ReactNode;
  ativo?: boolean;
  contador?: number;
  /** Contador em destaque (fundo areia), em vez do contador neutro padrão. */
  contadorAlerta?: boolean;
  /** Rótulo completo do contador para o leitor de tela (ex: "2 alertas"). Sem isto, "Alertas" e "2" viram um nome acessível só "Alertas2". */
  rotuloContador?: string;
}

export interface GrupoBarraLateral {
  titulo: string;
  itens: ItemBarraLateral[];
}

export interface BarraLateralProps {
  /** Nome do sistema, ao lado do símbolo (ex: "Kraamzorg OS"). */
  nomeMarca: string;
  /** Caminho do símbolo em `/public/brand` (provisório até o SVG oficial). */
  simboloSrc: string;
  grupos: GrupoBarraLateral[];
  /** Rótulo acessível da navegação (ex: "Navegação principal"). O nome da marca não é o rótulo da navegação. */
  rotulo: string;
  /** Rodapé opcional (nome e papel da pessoa logada). */
  rodape?: React.ReactNode;
  /** Quando mostrar a barra: "sempre" (padrão) ou só a partir do computador. */
  visivelEm?: "sempre" | "computador";
  className?: string;
}

export function BarraLateral({
  nomeMarca,
  simboloSrc,
  grupos,
  rotulo,
  rodape,
  visivelEm = "sempre",
  className,
}: BarraLateralProps) {
  return (
    <nav
      aria-label={rotulo}
      className={cn(
        "w-lateral bg-marinho text-texto-inverso sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-4 py-6",
        visivelEm === "computador" && "hidden lg:flex",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2">
        <Image src={simboloSrc} alt="" width={36} height={31} priority />
        <span className="font-titulo text-marca font-medium">{nomeMarca}</span>
      </div>

      {grupos.map((grupo) => {
        const idGrupo = `barra-lateral-grupo-${grupo.titulo.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <div key={grupo.titulo} className="flex flex-col gap-0.5">
            <span
              id={idGrupo}
              className="text-mini text-texto-inverso-2 px-3 pb-1"
            >
              {grupo.titulo}
            </span>
            <ul aria-labelledby={idGrupo} className="flex flex-col gap-0.5">
              {grupo.itens.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.ativo ? "page" : undefined}
                    className={cn(
                      "min-h-toque rounded-pilula text-apoio text-texto-inverso ease-estado flex items-center gap-3 px-3 font-medium no-underline transition-colors duration-140",
                      "[&>svg]:text-texto-inverso-2 [&>svg]:size-5",
                      item.ativo
                        ? "bg-marinho-claro [&>svg]:text-destaque font-semibold"
                        : "hover:bg-lateral-hover",
                    )}
                  >
                    {item.icone}
                    <span>{item.rotulo}</span>
                    {item.contador ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "text-mini ml-auto font-mono",
                          item.contadorAlerta
                            ? "rounded-pilula bg-areia text-marinho px-2"
                            : item.ativo
                              ? "text-texto-inverso"
                              : "text-texto-inverso-2",
                        )}
                      >
                        {item.contador}
                      </span>
                    ) : null}
                    {item.contador && item.rotuloContador ? (
                      <span className="sr-only">, {item.rotuloContador}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {rodape ? (
        <div className="border-marinho-claro text-apoio mt-auto border-t pt-3">
          {rodape}
        </div>
      ) : null}
    </nav>
  );
}
