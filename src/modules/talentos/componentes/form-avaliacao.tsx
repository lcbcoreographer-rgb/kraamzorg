"use client";

import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { RoteiroTalentos } from "@/lib/dados/tipos-relacao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { acaoAvaliarCandidata } from "../acoes";

/**
 * Roteiro de entrevista (P51 item 3): as perguntas em blocos, uma caixa de
 * resposta cada, e os critérios com nota de 1 a 5. Perguntas e critérios vêm
 * do parâmetro talentos_roteiro; nada do texto mora no código.
 */
export function FormularioAvaliacao({
  candidataId,
  roteiro,
}: {
  candidataId: string;
  roteiro: RoteiroTalentos;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoAvaliarCandidata,
    estadoInicialRelacao,
  );
  const notas = Array.from(
    { length: roteiro.escala.max - roteiro.escala.min + 1 },
    (_, i) => roteiro.escala.min + i,
  );
  return (
    <form
      onSubmit={acao}
      className="flex flex-col gap-6"
      aria-label="Avaliação da entrevista"
    >
      <input type="hidden" name="candidataId" value={candidataId} />
      {roteiro.blocos.map((bloco) => (
        <fieldset
          key={bloco.id}
          className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
        >
          <legend className="font-titulo text-2 text-texto px-1 font-medium">
            {bloco.nome}
          </legend>
          {bloco.perguntas.map((p) => (
            <CampoTexto
              key={p.id}
              rotulo={p.texto}
              name={`resposta:${p.id}`}
              multilinha
              linhas={3}
              maxLength={2000}
              opcional
            />
          ))}
        </fieldset>
      ))}

      <fieldset className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5">
        <legend className="font-titulo text-2 text-texto px-1 font-medium">
          Critérios, nota de {roteiro.escala.min} a {roteiro.escala.max}
        </legend>
        {roteiro.criterios.map((c) => (
          <div
            key={c.id}
            role="radiogroup"
            aria-label={c.nome}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-corpo text-texto">{c.nome}</span>
            <div className="flex gap-2">
              {notas.map((n) => (
                <label
                  key={n}
                  className="text-corpo text-texto min-h-toque min-w-toque border-linha rounded-2 flex cursor-pointer items-center justify-center gap-1 border px-3"
                >
                  <input
                    type="radio"
                    name={`nota:${c.id}`}
                    value={n}
                    className="size-4"
                  />
                  {n}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <CampoTexto
        rotulo="Observações da entrevista"
        name="observacoes"
        multilinha
        linhas={4}
        maxLength={1500}
        opcional
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="A avaliação não foi salva">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          Ela fica no histórico da candidata.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar avaliação
      </Botao>
    </form>
  );
}
