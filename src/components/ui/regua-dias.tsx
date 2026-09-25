import * as React from "react";
import { OctagonPause, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Régua de dias (DESIGN.md, seção 2 e 6): a forma assinatura da direção
 * "Caderneta de visita". Um segmento por dia, "D4" em mono e a data curta.
 * Toda noção de tempo do produto herda desta forma (acompanhamento D1 a
 * D12, progresso do checklist, semana da equipe, prazo de SLA).
 *
 * Grade explícita (`repeat(dias.length, ...)`), não `auto-fit`: com
 * `auto-fit` a forma quebrava de jeito diferente conforme a largura exata
 * do aparelho (12 dias viravam 7+5 em 430 px, 10+2 em 600 a 640 px), o que
 * fere a "forma assinatura" (achado da auditoria da P10 parcial). Abaixo de
 * 600 px, com mais de 6 dias, a grade fixa em 6 colunas (duas linhas de
 * seis), como no protótipo estático.
 */
export type EstadoDia =
  "feito" | "hoje" | "pendente" | "futuro" | "alerta" | "sensivel";

export interface DiaRegua {
  numero: number;
  /** Data curta já formatada por quem chama (ex: "24/09"). */
  rotuloData?: string;
  estado: EstadoDia;
  /**
   * Rótulo do estado para leitor de tela (ex: "alerta", "sensível").
   * Sem isto, só "hoje" chega ao leitor de tela (por `aria-current`); os
   * demais estados dependiam só de cor e hachura (achado da auditoria).
   */
  rotuloEstado?: string;
}

export interface ReguaDiasProps {
  dias: DiaRegua[];
  /** Rótulo acessível da régua inteira (ex: "Acompanhamento, D1 a D12"). */
  rotulo: string;
  /** Versão fina (10 px), sem número nem data, para linha de lista e cartão. */
  fina?: boolean;
  className?: string;
}

const classePorEstado: Record<EstadoDia, string> = {
  feito: "bg-marinho border-marinho text-texto-inverso",
  hoje: "bg-superficie border-2 border-dourado text-texto shadow-anel-hoje",
  pendente:
    "border-[1.5px] border-aviso-borda text-aviso-texto bg-superficie bg-hachura-aviso",
  futuro:
    "border-[1.5px] border-dashed border-marinho-50 text-texto-2 bg-transparent",
  alerta: "border-[1.5px] border-alerta text-alerta bg-alerta-lavado",
  sensivel: "border-[1.5px] border-sensivel text-sensivel bg-sensivel-lavado",
};

/**
 * Alerta e sensível diferem só pelo matiz (vermelho x ameixa): um ícone de
 * 12 a 14 px marca a diferença por forma, não só por cor (achado da
 * auditoria).
 */
const iconePorEstado: Partial<
  Record<EstadoDia, React.ComponentType<{ className?: string }>>
> = {
  alerta: TriangleAlert,
  sensivel: OctagonPause,
};

export function ReguaDias({ dias, rotulo, fina, className }: ReguaDiasProps) {
  return (
    <ol
      aria-label={rotulo}
      className={cn(
        "grid gap-1",
        fina && "gap-[3px]",
        // Abaixo de 600px, com mais de 6 dias, força 6 colunas (duas linhas
        // de 6, como o protótipo estático); o grid preenche em ordem de
        // leitura sozinho, sem precisar posicionar cada item.
        !fina && dias.length > 6 && "max-[599px]:!grid-cols-6",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))`,
      }}
    >
      {dias.map((dia) => {
        const Icone = iconePorEstado[dia.estado];
        return (
          <li
            key={dia.numero}
            className={cn(
              "rounded-2 flex flex-col items-center justify-center font-mono tabular-nums",
              fina
                ? "rounded-pilula min-h-[10px] border"
                : "min-h-12 gap-0 border py-1",
              classePorEstado[dia.estado],
            )}
            aria-current={dia.estado === "hoje" ? "date" : undefined}
          >
            {!fina ? (
              <>
                <span
                  className={cn(
                    "text-apoio flex items-center gap-1 leading-tight",
                    dia.estado === "hoje" && "font-semibold",
                  )}
                >
                  {Icone ? (
                    <Icone className="size-[13px]" aria-hidden="true" />
                  ) : null}
                  D{dia.numero}
                </span>
                {dia.rotuloData ? (
                  // Sem opacidade reduzida (o protótipo estático usava 0.9): em
                  // "alerta" e "sensivel" o texto já fica sobre um fundo lavado
                  // mais claro, e a opacidade empurrava o contraste do rótulo de
                  // 11 px para abaixo de 4,5:1 AA (achado do axe no P10).
                  <span className="text-micro leading-tight">
                    {dia.rotuloData}
                  </span>
                ) : null}
                {dia.rotuloEstado ? (
                  <span className="sr-only">, {dia.rotuloEstado}</span>
                ) : null}
              </>
            ) : (
              <span className="sr-only">
                D{dia.numero}
                {dia.rotuloData ? `, ${dia.rotuloData}` : ""}
                {dia.rotuloEstado ? `, ${dia.rotuloEstado}` : ""}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
