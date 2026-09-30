"use client";

import * as React from "react";
import { formatarMoedaCurta } from "@/lib/gestao/formato";
import { cn } from "@/lib/utils";

/**
 * Colunas (skill dataviz + DESIGN.md, seção "gráficos"): uma série, uma cor
 * (marinho), coluna de até 24 px com a ponta de 4 px arredondada e a base
 * reta, grade de 1 px, valor só nas colunas que a regra marcou. Cor de estado
 * só quando uma regra disse que o número saiu do esperado, e nunca sozinha:
 * `atencao` leva hachura e `alerta` leva cor cheia e o valor escrito sobre a
 * coluna, os dois com palavra na legenda e no detalhe. Cada coluna abre o detalhe ao passar o mouse, tocar
 * ou focar pelo teclado. A mesma informação existe em tabela, logo abaixo
 * (`VerComoTabela`).
 */

export type EstadoColuna = "neutro" | "atencao" | "alerta";

export interface DadoColuna {
  id: string;
  /** Rótulo curto embaixo da coluna (ex: "05/10"). */
  rotulo: string;
  valor: number;
  estado?: EstadoColuna;
  /** Linhas do detalhe (primeira é o título). */
  detalhe: string[];
  /** Valor escrito sobre a coluna (só nas marcadas). */
  valorTexto?: string;
}

export interface ItemLegenda {
  estado: EstadoColuna;
  rotulo: string;
}

export interface ColunasProps {
  /** Frase que diz o que o gráfico mostra (leitor de tela). */
  descricao: string;
  dados: DadoColuna[];
  /** Teto do eixo; padrão o maior valor arredondado para um número redondo. */
  maximo?: number;
  /** Piso do eixo; negativo quando há valores abaixo de zero. */
  minimo?: number;
  referencia?: { valor: number; rotulo: string };
  legenda?: ItemLegenda[];
  /**
   * Como o eixo escreve os números. É um nome e não uma função porque este
   * componente roda no navegador e as telas o chamam do servidor: função não
   * atravessa essa fronteira.
   */
  eixo?: TipoEixo;
  className?: string;
}

export type TipoEixo = "numero" | "porcentagem" | "moeda";

function formatarEixo(tipo: TipoEixo, valor: number): string {
  if (tipo === "porcentagem") return `${valor}%`;
  // Sem o "R$" no eixo: a margem é estreita e o título do gráfico já diz "em reais".
  if (tipo === "moeda")
    return formatarMoedaCurta(valor).replace(/^-?R\$\s?/, (m) =>
      m.startsWith("-") ? "-" : "",
    );
  return String(valor);
}

const LARGURA_COLUNA = 24;
const PASSO = 46;
const LARGURA_MINIMA = 340;
const MARGEM_ESQ = 52;
const MARGEM_DIR = 8;
const TOPO = 22;
const ALTURA_PLANO = 132;
const BASE_ROTULO = 20;

/** Arredonda para 1, 2, 2,5, 5 ou 10 vezes uma potência de dez. */
export function maximoLimpo(valor: number): number {
  if (valor <= 0) return 1;
  const expoente = Math.floor(Math.log10(valor));
  const base = 10 ** expoente;
  const fracao = valor / base;
  const degrau = [1, 2, 2.5, 5, 10].find((d) => fracao <= d) ?? 10;
  return degrau * base;
}

function caminhoColuna(
  x: number,
  base: number,
  altura: number,
  positivo: boolean,
): string {
  const l = LARGURA_COLUNA;
  const r = Math.min(4, altura);
  if (altura < 1) return `M${x},${base}h${l}v0h${-l}z`;
  return positivo
    ? `M${x},${base}v${-(altura - r)}a${r},${r} 0 0 1 ${r},${-r}h${l - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${altura - r}z`
    : `M${x},${base}v${altura - r}a${r},${r} 0 0 0 ${r},${r}h${l - 2 * r}a${r},${r} 0 0 0 ${r},${-r}v${-(altura - r)}z`;
}

function Amostra({ estado }: { estado: EstadoColuna }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {estado === "atencao" ? (
        <>
          <rect
            x="1"
            y="1"
            width="14"
            height="14"
            rx="3"
            fill="var(--aviso-lavado)"
            stroke="var(--aviso)"
            strokeWidth="1.5"
          />
          <path
            d="M1 11 11 1M5 15 15 5"
            stroke="var(--aviso)"
            strokeWidth="1.5"
          />
        </>
      ) : (
        <rect
          x="1"
          y="1"
          width="14"
          height="14"
          rx="3"
          fill={estado === "alerta" ? "var(--alerta)" : "var(--marinho-50)"}
        />
      )}
    </svg>
  );
}

export function Colunas({
  descricao,
  dados,
  maximo,
  minimo = 0,
  referencia,
  legenda,
  eixo = "numero",
  className,
}: ColunasProps) {
  const idPadrao = React.useId();
  const [ativa, setAtiva] = React.useState<number | null>(null);

  const teto =
    maximo ??
    maximoLimpo(
      Math.max(referencia?.valor ?? 0, ...dados.map((d) => d.valor), 1),
    );
  const piso = minimo < 0 ? -maximoLimpo(Math.abs(minimo)) : 0;
  const escala = ALTURA_PLANO / (teto - piso);
  const yZero = TOPO + teto * escala;
  // Poucas colunas ganham passo maior, para o gráfico não ficar estreito nem
  // ser ampliado (e o texto junto) além do tamanho natural.
  const passo = Math.max(
    PASSO,
    Math.floor(
      (LARGURA_MINIMA - MARGEM_ESQ - MARGEM_DIR) / Math.max(dados.length, 1),
    ),
  );
  const largura = MARGEM_ESQ + dados.length * passo + MARGEM_DIR;
  const altura = TOPO + ALTURA_PLANO + BASE_ROTULO + 6;
  const ticks = piso < 0 ? [piso, 0, teto] : [0, teto / 2, teto];
  const cx = (i: number) => MARGEM_ESQ + i * passo + passo / 2;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="group"
        aria-label={descricao}
        className="block h-auto w-full max-w-full overflow-visible"
        style={{ maxWidth: `${Math.round(largura * 1.5)}px` }}
      >
        <defs>
          <pattern
            id={`${idPadrao}-hachura`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="var(--aviso-lavado)" />
            <rect width="3" height="8" fill="var(--aviso)" />
          </pattern>
        </defs>

        {ticks.map((t) => {
          const y = yZero - t * escala;
          return (
            <g key={t}>
              <line
                x1={MARGEM_ESQ}
                x2={largura - MARGEM_DIR}
                y1={y}
                y2={y}
                stroke="var(--linha)"
                strokeWidth="1"
              />
              <text
                x={MARGEM_ESQ - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="14"
                fill="var(--texto-2)"
                fontFamily="var(--font-mono, monospace)"
              >
                {formatarEixo(eixo, t)}
              </text>
            </g>
          );
        })}

        {referencia ? (
          <g>
            <line
              x1={MARGEM_ESQ}
              x2={largura - MARGEM_DIR}
              y1={yZero - referencia.valor * escala}
              y2={yZero - referencia.valor * escala}
              stroke="var(--marinho)"
              strokeWidth="1.5"
            />
            <text
              x={largura - MARGEM_DIR}
              y={yZero - referencia.valor * escala - 5}
              textAnchor="end"
              fontSize="14"
              fill="var(--texto)"
            >
              {referencia.rotulo}
            </text>
          </g>
        ) : null}

        {dados.map((d, i) => {
          const positivo = d.valor >= 0;
          const alt = Math.min(Math.abs(d.valor) * escala, ALTURA_PLANO);
          const x = cx(i) - LARGURA_COLUNA / 2;
          const estado = d.estado ?? "neutro";
          const fill =
            estado === "atencao"
              ? `url(#${idPadrao}-hachura)`
              : estado === "alerta"
                ? "var(--alerta)"
                : "var(--marinho-50)";
          const topo = positivo ? yZero - alt : yZero + alt;
          return (
            <g
              key={d.id}
              tabIndex={0}
              role="img"
              aria-label={d.detalhe.join(". ")}
              className="outline-none focus-visible:[&>rect.foco]:stroke-[var(--foco)]"
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva((a) => (a === i ? null : a))}
              onFocus={() => setAtiva(i)}
              onBlur={() => setAtiva((a) => (a === i ? null : a))}
              onClick={() => setAtiva((a) => (a === i ? null : i))}
            >
              <rect
                className="foco"
                x={cx(i) - passo / 2 + 2}
                y={TOPO - 12}
                width={passo - 4}
                height={ALTURA_PLANO + BASE_ROTULO + 12}
                rx="6"
                fill={ativa === i ? "var(--marinho-08)" : "transparent"}
                stroke="transparent"
                strokeWidth="2"
              />
              <path
                d={caminhoColuna(x, yZero, alt, positivo)}
                fill={fill}
                stroke={estado === "atencao" ? "var(--aviso)" : "none"}
                strokeWidth="1.5"
              />
              {d.valorTexto ? (
                <text
                  x={cx(i)}
                  y={positivo ? topo - 7 : topo + 16}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="600"
                  fill="var(--texto)"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {d.valorTexto}
                </text>
              ) : null}
              <text
                x={cx(i)}
                y={TOPO + ALTURA_PLANO + BASE_ROTULO}
                textAnchor="middle"
                fontSize="14"
                fill="var(--texto-2)"
                fontFamily="var(--font-mono, monospace)"
              >
                {d.rotulo}
              </text>
            </g>
          );
        })}
      </svg>

      {ativa !== null && dados[ativa] ? (
        <div
          role="status"
          className="rounded-2 bg-marinho text-texto-inverso text-mini shadow-2 pointer-events-none absolute top-0 z-10 max-w-[240px] -translate-x-1/2 px-3 py-2"
          style={{
            left: `${Math.min(Math.max((cx(ativa) / largura) * 100, 20), 80)}%`,
          }}
        >
          {dados[ativa].detalhe.map((linha, i) => (
            <p key={linha} className={i === 0 ? "font-semibold" : undefined}>
              {linha}
            </p>
          ))}
        </div>
      ) : null}

      {legenda && legenda.length > 0 ? (
        <ul className="text-apoio text-texto-2 mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {legenda.map((item) => (
            <li key={item.estado} className="inline-flex items-center gap-2">
              <Amostra estado={item.estado} />
              {item.rotulo}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
