import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Barra lateral (DESIGN.md, 2.9 e seção 6). Computador, marinho, solta 12
 * px das bordas com raio 28, como um bloco que segura a navegação. Símbolo
 * e nome do sistema no topo; grupos com título em frase; itens de 44 px em
 * pílula; o ativo vira uma pílula creme com o ícone e o texto em marinho.
 * Mostra só o que o papel pode abrir.
 *
 * Este componente é estático (sem papel): os grupos e itens vêm sempre por
 * propriedade. Os grupos por papel (Comercial, Operação, Experiência,
 * Gestão, Sistema) são da casca do app.
 *
 * A visibilidade por tamanho de tela (`hidden lg:flex`) não mora aqui: a
 * casca decide isso (`visivelEm`), porque um componente que já esconde a
 * si mesmo deixa uma caixa vazia quando alguém, como a vitrine do design
 * system, precisa mostrá-lo fora do computador.
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
  /** "fixa" (padrão) presa na lateral da tela; "solta" dentro do fluxo (vitrine). */
  posicao?: "fixa" | "solta";
  className?: string;
}

export function BarraLateral({
  nomeMarca,
  simboloSrc,
  grupos,
  rotulo,
  rodape,
  visivelEm = "sempre",
  posicao = "fixa",
  className,
}: BarraLateralProps) {
  return (
    <nav
      aria-label={rotulo}
      className={cn(
        "bg-marinho text-texto-inverso rounded-3 shadow-2 flex flex-col gap-6 overflow-y-auto px-3 py-6",
        posicao === "fixa" &&
          "sticky top-3 m-3 h-[calc(100dvh-24px)] w-[calc(var(--container-lateral)-24px)]",
        visivelEm === "computador" && "hidden lg:flex",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-3">
        <Image
          src={simboloSrc}
          alt=""
          width={36}
          height={31}
          priority
          style={{ height: "auto" }}
        />
        <span className="font-titulo text-marca font-medium">{nomeMarca}</span>
      </div>

      {grupos.map((grupo) => {
        const idGrupo = `barra-lateral-grupo-${grupo.titulo.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <div key={grupo.titulo} className="flex flex-col gap-0.5">
            <span
              id={idGrupo}
              className="text-mini text-texto-inverso-2 px-4 pb-1"
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
                      "min-h-toque rounded-pilula text-apoio ease-estado flex items-center gap-3 px-4 font-medium no-underline transition-colors duration-140",
                      "[&>svg]:size-5",
                      item.ativo
                        ? "bg-creme text-marinho [&>svg]:text-marinho font-semibold"
                        : "text-texto-inverso hover:bg-lateral-hover [&>svg]:text-texto-inverso-2",
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
                              ? "text-marinho"
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
        <div className="border-marinho-claro text-apoio mt-auto border-t px-1 pt-4">
          {rodape}
        </div>
      ) : null}
    </nav>
  );
}
