"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoMontarEvolucao } from "../acoes";
import {
  estadoInicialEvolucao,
  type EstadoAcaoEvolucao,
} from "../estado-acoes";

/** Botão que monta o rascunho a partir do checklist (nenhum dado é enviado a ninguém). */
export function MontarEvolucao({
  acompanhamentoId,
  slug,
}: {
  acompanhamentoId: string;
  slug: string;
}) {
  const [estado, definirEstado] = React.useState<EstadoAcaoEvolucao>(
    estadoInicialEvolucao,
  );
  const [ocupado, iniciar] = React.useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Botao
          className="max-w-full text-balance whitespace-normal"
          carregando={ocupado}
          rotuloCarregando="Montando"
          onClick={() => {
            definirEstado(estadoInicialEvolucao);
            iniciar(async () => {
              definirEstado(await acaoMontarEvolucao(acompanhamentoId, slug));
            });
          }}
        >
          Montar o rascunho com o checklist
        </Botao>
      </div>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
      ) : null}
    </div>
  );
}
