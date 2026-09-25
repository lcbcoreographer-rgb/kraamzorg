"use client";

import { estadoInicialAdmin } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoSalvarModoAgente } from "../../admin-acoes";
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
  configuracao: ConfiguracaoAgente | null;
  podeEditar: boolean;
}) {
  const [estado, acao, salvando] = useActionState(
    acaoSalvarModoAgente,
    estadoInicialAdmin,
  );
  const [numeros, definirNumeros] = useState(
    configuracao?.numerosTeste.join("\n") ?? "",
  );
  const [modo, definirModo] = useState<string>(
    configuracao?.modo ?? "desligado",
  );

  if (!podeEditar || !configuracao) {
    return (
      <FaixaAlerta
        variante="info"
        titulo="Só a diretoria altera o modo da Isadora"
      >
        O modo e a lista de números de teste ficam com a diretoria. Para mudar,
        fale com a diretoria.
      </FaixaAlerta>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <EscolhaUnica
        rotulo="Modo da Isadora"
        name="modo"
        valor={modo}
        onMudar={definirModo}
        opcoes={Object.entries(ROTULO_MODO_AGENTE).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
        descricao="Desligada, ela só grava as mensagens. Em teste, só responde aos números da lista abaixo. O filtro de saúde vale nos dois modos ligados."
      />
      {modo === "producao" && configuracao.modo !== "producao" ? (
        <FaixaAlerta
          variante="prioritario"
          titulo="Em produção, a Isadora responde a todas as famílias"
        >
          Só ligue depois que o número oficial estiver homologado. Confira antes
          de salvar.
        </FaixaAlerta>
      ) : null}
      <CampoTexto
        id="numeros-teste"
        name="numerosTeste"
        rotulo="Números de teste"
        multilinha
        linhas={4}
        value={numeros}
        onChange={(evento) => definirNumeros(evento.target.value)}
        descricao="Um número por linha, com +55 e DDD."
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
        <p className="text-mini text-texto-2">
          Última alteração em {formatarDataHora(configuracao.atualizadoEm)}.
        </p>
      ) : null}
    </form>
  );
}
