"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { ClockAlert, Hourglass, RefreshCw, UserCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { textoPrazo } from "@/modules/mensageria/tarefas/agrupar";
import {
  acaoAssumirTransferencia,
  acaoReenviarNotificacao,
  estadoInicialAgente,
} from "../../acoes";
import { ROTULO_DESTINO_HANDOFF } from "../../tipos";
import type { TransferenciaTela } from "../../tipos";

function estadoPrazo(slaVenceEm: string | null, agora: Date): "vencido" | "perto" | "normal" {
  if (!slaVenceEm) return "normal";
  const vence = new Date(slaVenceEm).getTime();
  if (vence < agora.getTime()) return "vencido";
  const restanteMin = (vence - agora.getTime()) / 60_000;
  return restanteMin <= 30 ? "perto" : "normal";
}

export function CartaoTransferencia({
  transferencia,
  agora = new Date(),
}: {
  transferencia: TransferenciaTela;
  agora?: Date;
}) {
  const [estadoAssumir, acaoAssumir, assumindo] = useActionState(
    acaoAssumirTransferencia,
    estadoInicialAgente,
  );
  const [estadoReenviar, acaoReenviar, reenviando] = useActionState(
    acaoReenviarNotificacao,
    estadoInicialAgente,
  );

  const prazo = estadoPrazo(transferencia.slaVenceEm, agora);
  const prazoTexto = textoPrazo(transferencia.slaVenceEm, agora);
  const maxima = transferencia.prioridade === "maxima";
  const assumida = transferencia.status === "assumido";

  return (
    <Cartao
      className="flex flex-col gap-3"
      variante={maxima ? "areia" : "padrao"}
      aria-labelledby={`transf-${transferencia.id}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <h3
          id={`transf-${transferencia.id}`}
          className={
            maxima
              ? "text-3 text-alerta font-semibold"
              : "text-3 text-texto font-semibold"
          }
        >
          {transferencia.motivoRotulo}
        </h3>
        <span
          className={
            prazo === "vencido"
              ? "text-apoio text-alerta inline-flex items-center gap-1 font-medium"
              : prazo === "perto"
                ? "text-apoio text-aviso-texto inline-flex items-center gap-1 font-medium"
                : "text-apoio text-texto-2 inline-flex items-center gap-1"
          }
        >
          {prazo === "vencido" ? (
            <ClockAlert aria-hidden="true" className="size-4" strokeWidth={1.75} />
          ) : (
            <Hourglass aria-hidden="true" className="size-4" strokeWidth={1.75} />
          )}
          {prazoTexto ?? "sem prazo"}
        </span>
        <p className="text-apoio text-texto-2 col-span-2">
          {transferencia.nomeFamilia ?? "Contato sem família"} · é da{" "}
          {ROTULO_DESTINO_HANDOFF[transferencia.destino]}
        </p>
      </div>

      <p className="text-corpo text-texto">{transferencia.resumo}</p>

      {transferencia.notificacaoOk === false ? (
        <FaixaAlerta
          variante="imediato"
          titulo="O aviso ao grupo não saiu"
          acoes={
            <form action={acaoReenviar}>
              <input type="hidden" name="transferenciaId" value={transferencia.id} />
              <Botao
                type="submit"
                tamanho="compacto"
                carregando={reenviando}
                rotuloCarregando="Reenviando"
                iconeEsquerda={<RefreshCw aria-hidden="true" className="size-4" strokeWidth={1.75} />}
              >
                Reenviar aviso
              </Botao>
            </form>
          }
        >
          A equipe pode não ter visto esta transferência.
        </FaixaAlerta>
      ) : null}
      {estadoReenviar.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu certo">
          {estadoReenviar.erro}
        </FaixaAlerta>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {assumida ? (
          <>
            <Selo variante="sucesso" icone={<UserCheck />}>
              Assumida
            </Selo>
            <Botao asChild tamanho="compacto" variante="fantasma">
              <Link href={`/conversas/${transferencia.conversaId ?? ""}`}>Abrir conversa</Link>
            </Botao>
          </>
        ) : (
          <form action={acaoAssumir}>
            <input type="hidden" name="transferenciaId" value={transferencia.id} />
            <input type="hidden" name="conversaId" value={transferencia.conversaId ?? ""} />
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={assumindo}
              rotuloCarregando="Assumindo"
              iconeEsquerda={<UserCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            >
              Assumir conversa
            </Botao>
          </form>
        )}
      </div>
      {estadoAssumir.erro ? (
        <FaixaAlerta variante="imediato" titulo="Não deu certo">
          {estadoAssumir.erro}
        </FaixaAlerta>
      ) : null}
    </Cartao>
  );
}
