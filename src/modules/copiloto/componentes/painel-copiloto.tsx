"use client";

import { useActionState } from "react";
import { Compass, MessageCircleQuestion } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
import { acaoPerguntarAoCopiloto } from "../acoes";
import { estadoInicialCopiloto } from "../estado-acoes";

/**
 * A pergunta e a resposta do copiloto (P48). A resposta vem com os fatos
 * que a sustentam, calculados pelo sistema (não pelo modelo), para a pessoa
 * conferir o número. Recusa e "desligado" dizem o motivo e o que fazer.
 */
export function PainelCopiloto({
  limite,
  exemplos,
}: {
  limite: number;
  exemplos: string[];
}) {
  const [estado, acao, enviando] = useActionState(
    acaoPerguntarAoCopiloto,
    estadoInicialCopiloto,
  );
  const resposta = estado.resposta;

  return (
    <div className="flex flex-col gap-6">
      {/* A pergunta é o agora da tela: bloco de abertura em forma colo,
          dourado-claro (DESIGN.md, 2.4), com o campo branco encaixado. */}
      <form
        action={acao}
        className="rounded-colo bg-dourado-claro flex flex-col gap-4 px-5 pt-5 pb-12 lg:px-7 lg:pt-6"
      >
        <CampoTexto
          rotulo="O que você quer saber?"
          name="pergunta"
          multilinha
          linhas={3}
          required
          maxLength={limite}
          defaultValue={estado.pergunta}
          descricao="Pergunte sobre pipeline, conversão, receita, ocupação ou origem dos leads. Registro assistencial o copiloto não consulta."
        />
        <Botao
          type="submit"
          carregando={enviando}
          rotuloCarregando="Consultando"
          className="self-start"
        >
          Perguntar
        </Botao>
      </form>

      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        {resposta?.situacao === "respondida" ? (
          // A resposta chega como uma bolha de conversa (areia, o lado da
          // Kraamzorg), com o canto de cima mais fechado.
          <div
            className="rounded-3 bg-areia-clara rounded-tl-1 flex flex-col gap-3 p-5"
            data-teste="resposta-copiloto"
          >
            <p className="text-apoio text-texto-2 flex items-center gap-2 font-semibold">
              <Compass
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Copiloto
            </p>
            <p className="text-3 text-texto">{resposta.resposta}</p>
            <details className="text-apoio text-texto-2">
              <summary className="cursor-pointer font-semibold">
                Como chegamos a esses números
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {resposta.fatos.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="mt-2">
                Consulta feita:{" "}
                <span className="font-mono">{resposta.ferramenta}</span>, com as
                suas permissões.
              </p>
            </details>
          </div>
        ) : resposta ? (
          <FaixaAlerta
            variante={resposta.situacao === "erro" ? "erro" : "info"}
            titulo={
              resposta.situacao === "desligado"
                ? "O copiloto está desligado"
                : resposta.situacao === "orcamento"
                  ? "O orçamento do mês acabou"
                  : resposta.situacao === "erro"
                    ? "O copiloto não respondeu"
                    : "O copiloto não responde a esta pergunta"
            }
          >
            {resposta.mensagem}
          </FaixaAlerta>
        ) : null}
      </div>

      {exemplos.length > 0 ? (
        <section aria-labelledby="exemplos" className="flex flex-col gap-3">
          <h2
            id="exemplos"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="areia" forma="quadrado">
              <MessageCircleQuestion />
            </TileIcone>
            Perguntas que ele entende
          </h2>
          <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-2">
            {exemplos.map((e) => (
              <li
                key={e}
                className="rounded-2 bg-areia-clara text-corpo text-texto px-4 py-3"
              >
                {e}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
