import * as React from "react";
import { calcularCurvaPeso, type CurvaPeso } from "@/lib/checklist/curva-peso";
import { textos } from "../checklist/textos";

/**
 * Curva de peso do bebê (PRD 9.2, P39 item 5), na etapa do bebê: perda
 * percentual desde o nascimento, menor peso, ganho absoluto e ganho médio
 * diário a partir do menor peso, com uma casa decimal. Recalcula com o peso
 * digitado hoje, sem esperar assinar. Só leitura: nada aqui vira resposta.
 */
export function CurvaDePeso({ curva }: { curva: CurvaPeso | null }) {
  return (
    <section
      aria-labelledby="curva-titulo"
      className="rounded-2 border-linha bg-superficie flex flex-col gap-3 border p-4"
    >
      <h3 id="curva-titulo" className="text-3 text-texto font-semibold">
        {textos.curva.titulo}
      </h3>
      {curva ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Item
            rotulo={textos.curva.menorPeso}
            valor={textos.curva.gramas(curva.menorPesoG)}
          />
          <Item
            rotulo={textos.curva.ultimo}
            valor={textos.curva.gramas(curva.ultimoPesoG)}
          />
          <Item
            rotulo={textos.curva.perda}
            valor={
              curva.perdaPercentual === null
                ? textos.curva.semValor
                : textos.curva.percentual(curva.perdaPercentual)
            }
          />
          <Item
            rotulo={textos.curva.ganho}
            valor={textos.curva.gramas(curva.ganhoAbsolutoG)}
          />
          <Item
            rotulo={textos.curva.ganhoDiario}
            valor={
              curva.ganhoMedioDiarioG === null
                ? textos.curva.semValor
                : textos.curva.porDia(curva.ganhoMedioDiarioG)
            }
          />
        </dl>
      ) : (
        <p className="text-corpo text-texto-2">{textos.curva.semDados}</p>
      )}
      <p className="text-apoio text-texto-2">{textos.curva.ajuda}</p>
    </section>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-apoio text-texto-2">{rotulo}</dt>
      <dd className="text-corpo text-texto font-mono font-medium">{valor}</dd>
    </div>
  );
}

export { calcularCurvaPeso };
