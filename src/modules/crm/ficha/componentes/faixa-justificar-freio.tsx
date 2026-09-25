"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import { OctagonPause } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoJustificarFreio } from "../acoes";
import { estadoInicialFicha } from "../estado-acoes";

/**
 * "Justificar o freio" (PRD 8.3: "justificar depois é aceitável; atrasar
 * não é"). Formulário embutido na própria faixa, sem página à parte. Só
 * aparece para quem tem a tarefa de justificativa aberta (quem acionou sem
 * motivo, `privado.acionar_freio`); a justificativa conclui a tarefa, e a
 * faixa fica com a confirmação até a próxima visita.
 *
 * Fechada por padrão (protótipo, crítica do CRM P2 item 13): mostra o
 * prazo e o botão "Escrever justificativa", que abre o campo. O
 * formulário vai na prop `acoes` da `FaixaAlerta`, nunca como `children`:
 * um `<form>` dentro do `<p>` de `children` quebrava a hidratação
 * (erro de hidratação, crítica do CRM, P0 item 5).
 */
export function FaixaJustificarFreio({
  familiaId,
  pendente,
  venceEm = null,
}: {
  familiaId: string;
  pendente: boolean;
  venceEm?: string | null;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoJustificarFreio,
    estadoInicialFicha,
  );
  const [aberto, definirAberto] = useState(false);

  if (!pendente && !estado.sucesso) return null;

  if (estado.sucesso) {
    return (
      <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
        Obrigada por registrar o motivo.
      </FaixaAlerta>
    );
  }

  const prazo = venceEm ? formatarDataHora(venceEm) : null;

  if (!aberto) {
    return (
      <FaixaAlerta
        variante="sensivel"
        titulo="Justificar o freio"
        acoes={
          <Botao
            type="button"
            tamanho="compacto"
            variante="secundario"
            iconeEsquerda={
              <OctagonPause aria-hidden="true" className="size-4" />
            }
            onClick={() => definirAberto(true)}
          >
            Escrever justificativa
          </Botao>
        }
      >
        {prazo
          ? `Escreva o motivo até ${prazo}.`
          : "Justificar depois é normal."}
      </FaixaAlerta>
    );
  }

  return (
    <FaixaAlerta
      variante="sensivel"
      titulo="Justificar o freio"
      meta="Justificar depois é normal; o que importava era parar as mensagens automáticas."
      acoes={
        <form
          action={acao}
          className="flex w-full flex-col gap-3"
          data-testid="form-justificar-freio"
        >
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
            iconeEsquerda={
              <OctagonPause aria-hidden="true" className="size-4" />
            }
            className="self-start"
          >
            Salvar justificativa
          </Botao>
        </form>
      }
    />
  );
}
