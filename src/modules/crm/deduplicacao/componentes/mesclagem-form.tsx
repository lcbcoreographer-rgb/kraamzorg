"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import { rotuloEstagio } from "@/modules/crm/pipeline/estagios";
import type { CartaoOportunidade, ResumoFamilia } from "@/lib/dados/tipos";
import { acaoMesclar } from "../acoes";
import { estadoInicialMesclagem } from "../estado-acoes";

export interface LadoMesclagem {
  familia: ResumoFamilia;
  oportunidade: CartaoOportunidade | null;
}

function ehAberta(o: CartaoOportunidade | null): boolean {
  if (!o) return false;
  if (o.pipeline === 1) return o.estagioP1 !== "perdido";
  return !["perdido", "cancelado", "distrato"].includes(o.estagioP2 ?? "");
}

function LadoCartao({
  lado,
  destaque,
}: {
  lado: LadoMesclagem;
  destaque: boolean;
}) {
  return (
    <Cartao
      variante={destaque ? "padrao" : "plano"}
      className="flex flex-col gap-2"
    >
      <p className="text-3 font-titulo font-medium">{lado.familia.nome}</p>
      <dl className="text-apoio text-texto-2 flex flex-col gap-1">
        <div className="flex gap-2">
          <dt className="font-medium">DPP</dt>
          <dd>
            {lado.familia.dpp
              ? formatarData(lado.familia.dpp)
              : "Não informada"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Cidade</dt>
          <dd>
            {[lado.familia.bairro, lado.familia.cidade]
              .filter(Boolean)
              .join(", ") || "Não informada"}
          </dd>
        </div>
        {lado.oportunidade ? (
          <div className="flex items-center gap-2">
            <dt className="font-medium">Oportunidade</dt>
            <dd>
              <Selo variante={ehAberta(lado.oportunidade) ? "aviso" : "neutro"}>
                {rotuloEstagio(
                  lado.oportunidade.pipeline,
                  (lado.oportunidade.pipeline === 1
                    ? lado.oportunidade.estagioP1
                    : lado.oportunidade.estagioP2)!,
                )}
              </Selo>
            </dd>
          </div>
        ) : null}
      </dl>
    </Cartao>
  );
}

/**
 * Mesclagem lado a lado (P17 item 2, protótipo `comercial-ficha.html`
 * como referência de tom): escolha de qual família fica, escolha de qual
 * oportunidade fica quando as duas têm uma aberta, e confirmação clara,
 * pois não há desfazer.
 */
export function MesclagemForm({
  a,
  b,
}: {
  a: LadoMesclagem;
  b: LadoMesclagem;
}) {
  const [ficaId, definirFicaId] = React.useState(a.familia.id);
  const duasAbertas = ehAberta(a.oportunidade) && ehAberta(b.oportunidade);
  const [oportunidadeFicaId, definirOportunidadeFicaId] = React.useState(
    a.oportunidade?.oportunidadeId ?? b.oportunidade?.oportunidadeId ?? "",
  );
  const [estado, acao, enviando] = useActionState(
    acaoMesclar,
    estadoInicialMesclagem,
  );

  const perde = ficaId === a.familia.id ? b : a;
  const fica = ficaId === a.familia.id ? a : b;

  return (
    <form action={acao} className="flex flex-col gap-6">
      <input type="hidden" name="familiaFicaId" value={ficaId} />
      <input type="hidden" name="familiaPerdeId" value={perde.familia.id} />
      {duasAbertas ? (
        <input
          type="hidden"
          name="oportunidadeFicaId"
          value={oportunidadeFicaId}
        />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-apoio text-texto font-semibold">
          Qual família fica
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[a, b].map((lado) => (
            <label key={lado.familia.id} className="relative cursor-pointer">
              <input
                type="radio"
                name="ficaVisivel"
                value={lado.familia.id}
                checked={ficaId === lado.familia.id}
                onChange={() => definirFicaId(lado.familia.id)}
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <div className="peer-checked:outline-acao rounded-3 peer-checked:outline-2 peer-checked:outline-offset-2">
                <LadoCartao lado={lado} destaque={ficaId === lado.familia.id} />
              </div>
            </label>
          ))}
        </div>
        <p className="text-apoio text-texto-2">
          A outra família some da lista e os dados dela passam para esta:
          conversas, mensagens, tarefas{duasAbertas ? "" : " e a oportunidade"}.
        </p>
      </fieldset>

      {duasAbertas ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-apoio text-texto font-semibold">
            Qual oportunidade fica
          </legend>
          <p className="text-apoio text-texto-2">
            As duas famílias têm uma oportunidade aberta. A que não for
            escolhida passa para perdido, com o motivo &ldquo;mesclada em{" "}
            {fica.familia.nome}
            &rdquo;, antes de mesclar.
          </p>
          <div className="flex flex-wrap gap-2">
            {[a, b].map((lado) =>
              lado.oportunidade ? (
                <label
                  key={lado.oportunidade.oportunidadeId}
                  className="border-borda-campo bg-superficie text-apoio text-texto has-[:checked]:border-acao has-[:checked]:bg-acao has-[:checked]:text-acao-texto min-h-toque rounded-pilula relative inline-flex cursor-pointer items-center gap-2 border-[1.5px] px-4 font-medium"
                >
                  <input
                    type="radio"
                    name="oportunidadeVisivel"
                    value={lado.oportunidade.oportunidadeId}
                    checked={
                      oportunidadeFicaId === lado.oportunidade.oportunidadeId
                    }
                    onChange={() =>
                      definirOportunidadeFicaId(
                        lado.oportunidade!.oportunidadeId,
                      )
                    }
                    className="peer absolute size-px overflow-hidden opacity-0"
                  />
                  Da {lado.familia.nome}
                </label>
              ) : null,
            )}
          </div>
        </fieldset>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="imediato" titulo={estado.erro} />
      ) : null}

      <FaixaAlerta variante="prioritario" titulo="Não há como desfazer">
        Confira os dois lados antes de confirmar. Depois de mesclar, a família
        que saiu não aparece mais sozinha em nenhuma lista.
      </FaixaAlerta>

      <div className="flex flex-wrap gap-3">
        <Botao type="submit" carregando={enviando} rotuloCarregando="Mesclando">
          Mesclar as duas famílias
        </Botao>
      </div>
    </form>
  );
}
