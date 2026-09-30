"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { Dialogo, DialogoConteudo } from "@/components/ui/dialogo";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import type { Bloco, Campo } from "@/lib/instrumentos/schema";
import { textos } from "../checklist/textos";

/**
 * Janelas de apoio do DOC 4 (PRD 9.4, P40 item 5): a tabela LATCH, a escala
 * de trauma mamilar (NTS) e os protocolos de laserterapia, abertas durante a
 * visita sem sair do campo do checklist. Tudo vem da definição aprovada do
 * DOC 4 (rótulos, pontos, textos e a interpretação); aqui só a forma:
 *
 * - vários itens de escala curta (LATCH, 0 a 2 cada): a soma, que a
 *   enfermeira usa como nota do campo se quiser;
 * - uma escala com pontos descritos (NTS 0 a 5): escolhe um ponto;
 * - opções com texto de ajuda (laserterapia): só consulta.
 *
 * Nada é preenchido sozinho: "Usar N no campo" é um toque da enfermeira.
 */

type Modo = "soma" | "pontos" | "consulta";

function escalas(bloco: Bloco): Extract<Campo, { tipo: "escala" }>[] {
  return bloco.campos.filter(
    (c): c is Extract<Campo, { tipo: "escala" }> => c.tipo === "escala",
  );
}

export function modoDaJanela(bloco: Bloco): Modo {
  const lista = escalas(bloco);
  if (lista.length > 1) return "soma";
  if (lista.length === 1 && lista[0]?.pontos?.length) return "pontos";
  return "consulta";
}

export interface JanelaApoioProps {
  bloco: Bloco | null;
  aberto: boolean;
  aoFechar: () => void;
  /** Nota escolhida ou somada para o campo que a janela apoia. */
  aoUsar?: (valor: number, bloco: Bloco) => void;
}

export function JanelaApoio({
  bloco,
  aberto,
  aoFechar,
  aoUsar,
}: JanelaApoioProps) {
  return (
    <Dialogo open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      {bloco ? (
        <DialogoConteudo
          titulo={bloco.titulo}
          descricao={bloco.ajuda}
          rotuloFechar={textos.apoio.rotuloFechar}
        >
          <Conteudo
            key={bloco.id}
            bloco={bloco}
            aoUsar={aoUsar}
            aoFechar={aoFechar}
          />
        </DialogoConteudo>
      ) : null}
    </Dialogo>
  );
}

function Conteudo({
  bloco,
  aoUsar,
  aoFechar,
}: {
  bloco: Bloco;
  aoUsar?: JanelaApoioProps["aoUsar"];
  aoFechar: () => void;
}) {
  const modo = modoDaJanela(bloco);
  const [notas, definirNotas] = React.useState<Record<string, number>>({});
  const [ponto, definirPonto] = React.useState<number | null>(null);

  if (modo === "soma") {
    const itens = escalas(bloco);
    const soma = Object.values(notas).reduce((a, b) => a + b, 0);
    const completo = itens.every((i) => notas[i.id] !== undefined);
    return (
      <div className="flex flex-col gap-4">
        <p className="text-apoio text-texto-2">{textos.apoio.latchAjuda}</p>
        {itens.map((item) => (
          <EscolhaUnica
            key={item.id}
            rotulo={item.rotulo}
            name={`apoio-${bloco.id}-${item.id}`}
            tamanho="checklist"
            opcoes={Array.from({ length: item.max - item.min + 1 }, (_, i) => ({
              valor: String(item.min + i),
              rotulo: String(item.min + i),
            }))}
            valor={
              notas[item.id] === undefined ? undefined : String(notas[item.id])
            }
            onMudar={(v) =>
              definirNotas((atual) => ({ ...atual, [item.id]: Number(v) }))
            }
          />
        ))}
        <p className="text-3 text-texto font-semibold" role="status">
          {textos.apoio.latchSoma(
            soma,
            itens.reduce((total, item) => total + item.max, 0),
          )}
        </p>
        {aoUsar ? (
          <Botao
            disabled={!completo}
            onClick={() => {
              aoUsar(soma, bloco);
              aoFechar();
            }}
          >
            {completo
              ? textos.apoio.latchUsar(soma)
              : textos.apoio.latchEscolha}
          </Botao>
        ) : null}
      </div>
    );
  }

  if (modo === "pontos") {
    const escala = escalas(bloco)[0]!;
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {escala.pontos!.map((p) => (
            <li key={p.valor}>
              <button
                type="button"
                aria-pressed={ponto === p.valor}
                onClick={() => definirPonto(p.valor)}
                className={
                  "rounded-2 min-h-toque flex w-full items-start gap-3 border-[1.5px] p-3 text-left " +
                  (ponto === p.valor
                    ? "border-dourado bg-dourado-lavado"
                    : "border-borda-campo bg-superficie")
                }
              >
                <span className="text-3 font-mono font-medium">{p.valor}</span>
                <span className="text-corpo text-texto">{p.rotulo}</span>
              </button>
            </li>
          ))}
        </ul>
        {aoUsar ? (
          <Botao
            disabled={ponto === null}
            onClick={() => {
              if (ponto === null) return;
              aoUsar(ponto, bloco);
              aoFechar();
            }}
          >
            {ponto === null
              ? textos.apoio.ntsEscolha
              : textos.apoio.ntsUsar(ponto)}
          </Botao>
        ) : null}
      </div>
    );
  }

  const opcoes = bloco.campos.flatMap((c) =>
    c.tipo === "opcao_unica" || c.tipo === "multipla" ? c.opcoes : [],
  );
  return (
    <ul className="flex flex-col gap-3">
      {opcoes.map((o) => (
        <li key={o.valor} className="rounded-2 border-linha border p-3">
          <p className="text-corpo text-texto font-semibold">{o.rotulo}</p>
          {o.ajuda ? (
            <p className="text-corpo text-texto-2">{o.ajuda}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
