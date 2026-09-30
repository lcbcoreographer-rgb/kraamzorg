import * as React from "react";
import { respostaParaLeitura } from "@/lib/checklist/formato";
import {
  blocoVisivel,
  lerValor,
  type BebeFormulario,
  type ContextoFormulario,
  type RespostasFormulario,
} from "@/lib/instrumentos/respostas";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";

/**
 * O registro em leitura: cada bloco do instrumento com as respostas como
 * foram dadas (só o que foi respondido). Usado no registro assinado e na
 * conferência antes de assinar. Nada aqui edita: para corrigir um registro
 * assinado o caminho é o adendo.
 */
export function VisaoDosDados({
  definicao,
  respostas,
  bebes,
  contexto,
}: {
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  bebes: BebeFormulario[];
  contexto: ContextoFormulario;
}) {
  const ambiente = { definicao, respostas, contexto };
  const blocos = definicao.blocos.filter((b) => blocoVisivel(b, ambiente));

  return (
    <div className="flex flex-col gap-6">
      {blocos.map((bloco) => {
        const alvos: (BebeFormulario | undefined)[] = bloco.repete_por_bebe
          ? bebes
          : [undefined];
        return alvos.map((bebe) => {
          const linhas = bloco.campos
            .filter((c) => c.tipo !== "automatico")
            .map((campo) => ({
              campo,
              texto: respostaParaLeitura(
                campo,
                lerValor(respostas, {
                  bloco: bloco.id,
                  campo: campo.id,
                  bebe: bebe?.id,
                }),
              ),
            }))
            .filter((l) => l.texto !== null);
          if (linhas.length === 0) return null;
          return (
            <section
              key={`${bloco.id}-${bebe?.id ?? ""}`}
              aria-label={`${bloco.titulo}${bebe ? `, ${bebe.rotulo}` : ""}`}
              className="flex flex-col gap-2"
            >
              <h3 className="text-3 text-texto font-semibold">
                <span className="text-texto-2 mr-2 font-mono">{bloco.id}</span>
                {bloco.titulo}
                {bebe ? (
                  <span className="text-texto-2 font-normal">
                    {" "}
                    · {bebe.rotulo}
                  </span>
                ) : null}
              </h3>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {linhas.map(({ campo, texto }) => (
                  <div key={campo.id}>
                    <dt className="text-apoio text-texto-2">{campo.rotulo}</dt>
                    <dd className="text-corpo text-texto">{texto}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        });
      })}
    </div>
  );
}
