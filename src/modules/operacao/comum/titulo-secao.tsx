import type { ReactNode } from "react";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { cn } from "@/lib/utils";

/**
 * Título de um assunto da tela, na direção "Colo" (DESIGN.md 6.1, passo 4):
 * o ícone num tile quadrado no tom do assunto, o título em Jost 20 e, quando
 * houver, a contagem numa pílula areia com o número em mono. A frase de
 * apoio, se houver, vem logo abaixo, em `texto-2`.
 *
 * Feito dentro do módulo (a pedido: nada novo em `src/components/ui` nesta
 * frente); as telas da operação, da enfermeira e da família usam este.
 *
 * `tom="neutro"` é para o assunto sério (alerta clínico, freio, ocorrência
 * privada): o tile fica branco, sem tom de apoio (PRD 20.2 [v4.4]).
 */
export function TituloSecao({
  id,
  icone,
  tom = "areia",
  titulo,
  contagem,
  unidade,
  texto,
  lateral,
  nivel = "h2",
  className,
}: {
  id?: string;
  icone?: ReactNode;
  tom?: Tom | "neutro";
  titulo: ReactNode;
  /** Número de itens do assunto (vai numa pílula, ao lado do título). */
  contagem?: number;
  /** Palavra lida depois do número pelo leitor de tela ("famílias"). */
  unidade?: string;
  /** Frase de apoio: o que fazer com este assunto. */
  texto?: ReactNode;
  /** Ação curta à direita (um link). */
  lateral?: ReactNode;
  nivel?: "h2" | "h3";
  className?: string;
}) {
  const Titulo = nivel;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {icone ? (
        <TileIcone
          tom={tom === "neutro" ? "branco" : tom}
          forma="quadrado"
          className={tom === "neutro" ? "border-linha border" : undefined}
        >
          {icone}
        </TileIcone>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Titulo
            id={id}
            className="font-titulo text-2 text-texto scroll-mt-24 font-medium"
          >
            {titulo}
          </Titulo>
          {contagem !== undefined ? (
            <span className="rounded-pilula bg-areia text-apoio text-texto inline-flex min-h-7 min-w-7 items-center justify-center px-2 font-mono font-medium tabular-nums">
              {contagem}
              {unidade ? (
                <span className="sr-only">&nbsp;{unidade}</span>
              ) : null}
            </span>
          ) : null}
        </div>
        {texto ? (
          <p className="text-apoio text-texto-2 max-w-[60ch]">{texto}</p>
        ) : null}
      </div>
      {lateral ? <div className="shrink-0 pt-2">{lateral}</div> : null}
    </div>
  );
}
