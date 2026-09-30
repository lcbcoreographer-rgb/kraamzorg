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
 *
 * Direção "Colo" [v4.4] (DESIGN.md, 2.5): cada bloco do instrumento num
 * bloco `areia-clara` (o que já foi guardado), o número do bloco numa
 * pílula e as respostas em grade de duas colunas, cada uma num quadro
 * branco. Família em estado sensível (`semTom`): blocos brancos com
 * contorno, sem tom de apoio.
 */
export function VisaoDosDados({
  definicao,
  respostas,
  bebes,
  contexto,
  semTom = false,
}: {
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  bebes: BebeFormulario[];
  contexto: ContextoFormulario;
  /** Família em estado sensível: sem tom de apoio (PRD 20.2 [v4.4]). */
  semTom?: boolean;
}) {
  const ambiente = { definicao, respostas, contexto };
  const blocos = definicao.blocos.filter((b) => blocoVisivel(b, ambiente));

  return (
    <div className="flex flex-col gap-3">
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
              className={
                semTom
                  ? "rounded-3 border-linha flex flex-col gap-3 border p-4"
                  : "rounded-3 bg-areia-clara flex flex-col gap-3 p-4"
              }
            >
              <h3 className="text-3 text-texto flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <span className="rounded-pilula bg-superficie text-apoio inline-flex min-h-7 items-center px-2.5 font-mono font-medium">
                  {bloco.id}
                </span>
                <span>{bloco.titulo}</span>
                {bebe ? (
                  <span className="text-texto-2 font-normal">
                    {bebe.rotulo}
                  </span>
                ) : null}
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                {linhas.map(({ campo, texto }) => (
                  <div
                    key={campo.id}
                    className="rounded-2 bg-superficie flex flex-col gap-0.5 px-3 py-2.5"
                  >
                    <dt className="text-mini text-texto-2">{campo.rotulo}</dt>
                    <dd className="text-corpo text-texto font-medium break-words">
                      {texto}
                    </dd>
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
