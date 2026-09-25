"use client";

import * as React from "react";
import { useActionState } from "react";
import { OctagonPause } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoJustificarFreio, estadoInicialFicha } from "../acoes";

/**
 * "Justificar o freio" (PRD 8.3: "justificar depois é aceitável; atrasar
 * não é"). Formulário embutido na própria faixa, sem página nem tarefa à
 * parte: a tarefa de justificativa (P18, `src/modules/*` fora desta pasta)
 * continua existindo no banco para quem prefere resolver por lá.
 */
export function FaixaJustificarFreio({ familiaId }: { familiaId: string }) {
  const [estado, acao, enviando] = useActionState(
    acaoJustificarFreio,
    estadoInicialFicha,
  );

  if (estado.sucesso) {
    return (
      <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
        Obrigada por registrar o motivo.
      </FaixaAlerta>
    );
  }

  return (
    <FaixaAlerta
      variante="sensivel"
      titulo="Justificar o freio"
      meta="Justificar depois é normal; o que importava era parar as mensagens automáticas."
    >
      <form action={acao} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="familiaId" value={familiaId} />
        <CampoTexto
          rotulo="Motivo do freio"
          name="motivo"
          multilinha
          linhas={2}
          placeholder="O que aconteceu com esta família"
        />
        {estado.erro ? (
          <span className="text-apoio text-alerta">{estado.erro}</span>
        ) : null}
        <Botao
          type="submit"
          tamanho="compacto"
          variante="secundario"
          carregando={enviando}
          rotuloCarregando="Salvando"
          iconeEsquerda={<OctagonPause aria-hidden="true" className="size-4" />}
          className="self-start"
        >
          Salvar justificativa
        </Botao>
      </form>
    </FaixaAlerta>
  );
}
