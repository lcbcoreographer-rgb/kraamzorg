"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoRegistrarDesfecho } from "../acoes";
import { estadoInicialSessao } from "../estado-acoes";

/**
 * Como foi a conversa (P29 item 2). Três respostas e, quando aconteceu, se
 * quem vai estar com a gestante participou. O banco cuida do resto: move o
 * P1, tira o lembrete e cria a tarefa de retorno com o texto aprovado.
 */
export function PainelDesfecho({
  sessaoId,
  jaPassou,
}: {
  sessaoId: string;
  /** O horário já passou: "aconteceu" e "não veio" só valem depois dele. */
  jaPassou: boolean;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoRegistrarDesfecho,
    estadoInicialSessao,
  );
  const [desfecho, definirDesfecho] = React.useState(
    jaPassou ? "" : "cancelada",
  );
  const [parceiro, definirParceiro] = React.useState("");

  if (estado.sucesso) {
    return <FaixaAlerta variante="sucesso" titulo={estado.sucesso} anunciar />;
  }

  const opcoes = jaPassou
    ? [
        { valor: "realizada", rotulo: "Aconteceu" },
        { valor: "nao_compareceu", rotulo: "A família não veio" },
        { valor: "cancelada", rotulo: "Foi cancelada" },
      ]
    : [{ valor: "cancelada", rotulo: "Foi cancelada" }];

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="sessaoId" value={sessaoId} />
      <input type="hidden" name="desfecho" value={desfecho} />
      <input
        type="hidden"
        name="parceiroPresente"
        value={desfecho === "realizada" ? parceiro : ""}
      />
      <EscolhaUnica
        rotulo="Como foi a conversa"
        name="desfecho-escolha"
        opcoes={opcoes}
        valor={desfecho}
        onMudar={definirDesfecho}
        descricao={
          jaPassou
            ? undefined
            : "Aconteceu e não veio ficam disponíveis depois do horário marcado."
        }
      />
      {desfecho === "realizada" ? (
        <EscolhaUnica
          rotulo="Quem vai estar com a gestante participou?"
          name="parceiro-escolha"
          opcoes={[
            { valor: "sim", rotulo: "Participou" },
            { valor: "nao", rotulo: "Não participou" },
          ]}
          valor={parceiro}
          onMudar={definirParceiro}
          descricao="Opcional. Ajuda a preparar a proposta."
        />
      ) : null}
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Registrando"
        disabled={!desfecho}
        className="self-start"
      >
        Registrar como foi
      </Botao>
    </form>
  );
}
