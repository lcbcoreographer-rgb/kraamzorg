"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoRegistrarDesfecho } from "../acoes";
import { estadoInicialSessao } from "../estado-acoes";

/**
 * Como foi a reunião (P29 item 2, v4.3). Só a Edilaine (coordenação) e a
 * diretoria registram que a reunião aconteceu ou que a família não veio; o
 * banco recusa os outros papéis. Cancelar vale só para reunião marcada pela
 * equipe: a da Isadora vive no Google Calendar. Quando a reunião aconteceu,
 * a conversa passa ao Leonardo, com o resumo da Isadora e este resultado; a
 * falta devolve a conversa à Isadora, que remarca sem cobrar.
 */
export function PainelDesfecho({
  sessaoId,
  jaPassou,
  podeRegistrar,
  podeCancelar,
  daIsadora,
}: {
  sessaoId: string;
  /** O horário já passou: "aconteceu" e "não veio" só valem depois dele. */
  jaPassou: boolean;
  /** Coordenação ou diretoria: registra realizada e não compareceu. */
  podeRegistrar: boolean;
  /** Reunião marcada pela equipe: o comercial também pode cancelar. */
  podeCancelar: boolean;
  /** Reunião marcada pela Isadora: o texto explica o que acontece depois. */
  daIsadora: boolean;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoRegistrarDesfecho,
    estadoInicialSessao,
  );
  const [desfecho, definirDesfecho] = React.useState("");
  const [parceiro, definirParceiro] = React.useState("");
  const [resultado, definirResultado] = React.useState("");

  // Sem permissão para registrar e sem o que cancelar: a tela só diz quem
  // registra e o que muda depois, sem botão que o banco vai recusar.
  if (!podeRegistrar && !podeCancelar) {
    return (
      <p className="text-corpo text-texto-2 max-w-leitura">
        {daIsadora
          ? "A Edilaine registra como foi a reunião. Quando ela registrar que aconteceu, a conversa passa para o Leonardo e a Isadora deixa de escrever para a família."
          : "A coordenação registra como foi a conversa."}
      </p>
    );
  }

  // Antes do horário, só cancelar faz sentido. Perguntar "como foi" de
  // algo que ainda não aconteceu, com um botão escuro de registrar, faz a
  // pessoa hesitar; aqui a tela diz quando a pergunta vai valer e deixa o
  // cancelamento como ação secundária.
  if (!jaPassou) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-corpo text-texto-2 max-w-leitura">
          {daIsadora
            ? "Depois do horário marcado, a Edilaine registra aqui como foi. Se a família pedir para mudar ou cancelar, a Isadora cuida e o CRM se atualiza sozinho."
            : "Depois do horário marcado, é aqui que você registra como foi. Se a família desmarcou, dá para cancelar agora."}
        </p>
        {podeCancelar ? (
          <form action={acao} className="flex flex-col gap-4">
            <input type="hidden" name="sessaoId" value={sessaoId} />
            <input type="hidden" name="desfecho" value="cancelada" />
            <input type="hidden" name="parceiroPresente" value="" />
            <input type="hidden" name="resultado" value="" />
            {estado.erro ? (
              <FaixaAlerta variante="erro" titulo={estado.erro} />
            ) : null}
            <Botao
              type="submit"
              variante="secundario"
              carregando={enviando}
              rotuloCarregando="Cancelando"
              className="self-start"
            >
              Cancelar a conversa
            </Botao>
          </form>
        ) : null}
      </div>
    );
  }

  const opcoes = [
    ...(podeRegistrar
      ? [
          { valor: "realizada", rotulo: "Aconteceu" },
          { valor: "nao_compareceu", rotulo: "A família não veio" },
        ]
      : []),
    ...(podeCancelar ? [{ valor: "cancelada", rotulo: "Foi cancelada" }] : []),
  ];

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
        rotulo="O que aconteceu no horário marcado"
        name="desfecho-escolha"
        opcoes={opcoes}
        valor={desfecho}
        onMudar={definirDesfecho}
      />
      {desfecho === "realizada" ? (
        <>
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
          <CampoTexto
            rotulo="Como foi a reunião, em uma frase"
            name="resultado"
            multilinha
            linhas={3}
            maxLength={300}
            value={resultado}
            onChange={(evento) => definirResultado(evento.target.value)}
            opcional
            descricao="Vai no resumo que o Leonardo recebe. Sem dado de saúde. Até 300 caracteres."
          />
        </>
      ) : (
        <input type="hidden" name="resultado" value="" />
      )}
      {desfecho === "realizada" ? (
        <p className="text-apoio text-texto-2 max-w-leitura">
          Ao registrar, a conversa passa para o Leonardo e a Isadora deixa de
          escrever para esta família.
        </p>
      ) : null}
      {desfecho === "nao_compareceu" && daIsadora ? (
        <p className="text-apoio text-texto-2 max-w-leitura">
          A Isadora oferece outro horário à família, sem cobrar, e a conversa
          continua com ela.
        </p>
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
