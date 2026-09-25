"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoSalvarModoAgente, estadoInicialAdmin } from "../../admin-acoes";
import { ROTULO_MODO_AGENTE } from "../../tipos";
import type { ConfiguracaoAgente } from "../../tipos";

/**
 * Modo do agente e números de teste (P27 item 3, PRD 11.3, 11.7). Só a
 * diretoria altera (RLS de `parametro`, `0007_permissoes.sql`); o
 * comercial vê em modo leitura.
 */
export function PainelModo({
  configuracao,
  podeEditar,
}: {
  configuracao: ConfiguracaoAgente;
  podeEditar: boolean;
}) {
  const [estado, acao, salvando] = useActionState(acaoSalvarModoAgente, estadoInicialAdmin);
  const [numeros, definirNumeros] = useState(configuracao.numerosTeste.join("\n"));

  if (!podeEditar) {
    return (
      <FaixaAlerta variante="info" titulo="Só a diretoria altera o modo da Isadora">
        Hoje a Isadora está {ROTULO_MODO_AGENTE[configuracao.modo].toLowerCase()}. Para mudar,
        fale com a diretoria.
      </FaixaAlerta>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <EscolhaUnica
        rotulo="Modo da Isadora"
        name="modo"
        valorPadrao={configuracao.modo}
        opcoes={Object.entries(ROTULO_MODO_AGENTE).map(([valor, rotulo]) => ({ valor, rotulo }))}
        descricao="Em teste, a Isadora só responde aos números da lista abaixo."
      />
      <CampoTexto
        id="numeros-teste"
        name="numerosTeste"
        rotulo="Números de teste"
        multilinha
        linhas={4}
        value={numeros}
        onChange={(evento) => definirNumeros(evento.target.value)}
        descricao="Um número E.164 por linha, por exemplo +5511900000001."
      />
      {estado.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu para salvar">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <p className="text-sucesso text-apoio" role="status">
          {estado.sucesso}
        </p>
      ) : null}
      <div>
        <Botao type="submit" carregando={salvando} rotuloCarregando="Salvando">
          Salvar modo da Isadora
        </Botao>
      </div>
      {configuracao.atualizadoEm ? (
        <p className="text-mini text-texto-2 inline-flex items-center gap-1">
          <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          Última alteração salva.
        </p>
      ) : null}
    </form>
  );
}
