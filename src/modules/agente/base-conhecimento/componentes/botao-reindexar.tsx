"use client";

import * as React from "react";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * "Reindexar" (P27 item 4, P26 item 3): chama `POST /api/agente/reindexar`,
 * a rota do próprio módulo que aciona o webhook do fluxo 1 de ingestão RAG
 * com o segredo do servidor (o segredo nunca chega ao navegador).
 */
export function BotaoReindexar() {
  const [estado, definirEstado] = useState<
    | { tipo: "ocioso" }
    | { tipo: "enviando" }
    | { tipo: "ok"; texto: string }
    | { tipo: "erro"; texto: string }
  >({ tipo: "ocioso" });

  async function reindexar() {
    definirEstado({ tipo: "enviando" });
    try {
      const resposta = await fetch("/api/agente/reindexar", { method: "POST" });
      const corpo = (await resposta.json().catch(() => null)) as {
        erro?: string;
      } | null;
      if (!resposta.ok) {
        definirEstado({
          tipo: "erro",
          texto:
            corpo?.erro ??
            "A atualização não começou. Tente de novo em alguns minutos.",
        });
        return;
      }
      definirEstado({
        tipo: "ok",
        texto:
          "Atualização iniciada. A Isadora passa a usar os itens aprovados quando terminar.",
      });
    } catch {
      definirEstado({
        tipo: "erro",
        texto: "Sem sinal agora. Tente de novo em instantes.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Botao
          type="button"
          variante="secundario"
          tamanho="compacto"
          carregando={estado.tipo === "enviando"}
          rotuloCarregando="Atualizando"
          iconeEsquerda={
            <RefreshCw
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          }
          onClick={reindexar}
        >
          Atualizar o que a Isadora sabe
        </Botao>
      </div>
      {estado.tipo === "erro" ? (
        <FaixaAlerta
          variante="erro"
          titulo="A Isadora não atualizou o que sabe"
        >
          {estado.texto}
        </FaixaAlerta>
      ) : null}
      {estado.tipo === "ok" ? (
        <p className="text-sucesso text-apoio" role="status">
          {estado.texto}
        </p>
      ) : null}
    </div>
  );
}
