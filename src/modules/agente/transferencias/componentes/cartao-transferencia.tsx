"use client";

import { estadoInicialAgente } from "../../estado-acoes";
import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  ClockAlert,
  Hourglass,
  OctagonPause,
  Phone,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { DestinoHandoff } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";
import { textoPrazo } from "@/modules/mensageria/tarefas/agrupar";
import { acaoAssumirTransferencia, acaoReenviarNotificacao } from "../../acoes";
import { estadoPrazo, horaBrasilia } from "../../formatacao";
import { FRASE_DESTINO_HANDOFF, MOTIVOS_SENSIVEIS } from "../../tipos";
import type { TransferenciaTela } from "../../tipos";

// Reexportado para quem já importava daqui (o teste do componente, e
// código futuro): a implementação mora em `../../formatacao`, sem "use
// client", para o servidor poder calcular o contador da aba Início sem
// puxar React nem ícones para o bundle de servidor (P0 item 1).
export { estadoPrazo };
export type { EstadoPrazo } from "../../formatacao";

export function CartaoTransferencia({
  transferencia,
  agora = new Date(),
  usuarioId,
  destinoDoPapel,
  telefonePlantao,
}: {
  transferencia: TransferenciaTela;
  agora?: Date;
  /** Quem está vendo, para dizer "você assumiu" em vez de só "assumida". */
  usuarioId?: string;
  /**
   * De qual destino é o papel de quem está vendo (comercial ->
   * "comercial", coordenação -> "coordenacao_clinica"). Sem isto (ex:
   * diretoria, que vê tudo), o cartão sempre oferece "Assumir conversa"
   * (crítica do CRM, P0 item 4).
   */
  destinoDoPapel?: DestinoHandoff;
  /** Telefone do plantão, para "Ligar para a coordenação" (parametro). */
  telefonePlantao?: string | null;
}) {
  const [estadoAssumir, acaoAssumir, assumindo] = useActionState(
    acaoAssumirTransferencia,
    estadoInicialAgente,
  );
  const [estadoReenviar, acaoReenviar, reenviando] = useActionState(
    acaoReenviarNotificacao,
    estadoInicialAgente,
  );

  const prazo = estadoPrazo(
    transferencia.criadoEm,
    transferencia.slaVenceEm,
    agora,
  );
  const prazoTexto = textoPrazo(transferencia.slaVenceEm, agora);
  const maxima = transferencia.prioridade === "maxima";
  const sensivel = MOTIVOS_SENSIVEIS.includes(transferencia.motivo);
  const assumida = transferencia.status === "assumido";
  const horaAssumida = horaBrasilia(transferencia.assumidoEm);
  const quemAssumiu =
    usuarioId && transferencia.assumidoPor === usuarioId
      ? "Você assumiu"
      : "Assumida";
  // O destino não é o papel de quem vê (ex: coordenação clínica, e quem
  // olha é o comercial): oferecer "Ligar para a coordenação" em vez de
  // assumir uma conversa que não é da pessoa (crítica do CRM, P0 item 4).
  const naoEDoPapel = Boolean(
    destinoDoPapel && transferencia.destino !== destinoDoPapel,
  );

  return (
    <Cartao
      className={cn(
        "flex flex-col gap-3",
        // Prioridade máxima em fundo de alerta, no topo da fila
        // (fluxos.md, fluxo E, item 1; protótipo comercial-inicio). Perda
        // gestacional e estado sensível nunca em vermelho (DESIGN.md,
        // seção 8): ficam em ameixa, mesmo com prioridade máxima.
        maxima &&
          (sensivel
            ? "bg-sensivel-lavado border-sensivel-borda border shadow-none"
            : "bg-alerta-lavado border-alerta-borda border shadow-none"),
      )}
      aria-labelledby={`transf-${transferencia.id}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <h3
          id={`transf-${transferencia.id}`}
          className={cn(
            "text-3 flex items-center gap-1.5 font-semibold",
            maxima && (sensivel ? "text-sensivel" : "text-alerta"),
            !maxima && "text-texto",
          )}
        >
          {maxima && sensivel ? (
            <OctagonPause
              aria-hidden="true"
              className="size-4 shrink-0"
              strokeWidth={1.75}
            />
          ) : null}
          {transferencia.motivoRotulo}
        </h3>
        <span
          className={cn(
            "text-apoio inline-flex items-center gap-1 whitespace-nowrap tabular-nums",
            prazo === "vencido" && "text-alerta font-medium",
            prazo === "perto" && "text-aviso-texto font-medium",
            prazo === "normal" && "text-texto-2",
          )}
        >
          {prazo === "vencido" ? (
            <ClockAlert
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          ) : (
            <Hourglass
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          )}
          {prazoTexto ?? "sem prazo"}
        </span>
        <p className="text-apoio text-texto-2 col-span-2">
          {transferencia.nomeFamilia ?? "Contato sem família"} ·{" "}
          {FRASE_DESTINO_HANDOFF[transferencia.destino]}
        </p>
      </div>

      <p className="text-corpo text-texto">{transferencia.resumo}</p>

      {transferencia.notificacaoOk === false ? (
        <FaixaAlerta
          variante="erro"
          titulo="O aviso ao grupo não saiu"
          acoes={
            <form action={acaoReenviar}>
              <input
                type="hidden"
                name="transferenciaId"
                value={transferencia.id}
              />
              <Botao
                type="submit"
                variante="secundario"
                tamanho="compacto"
                carregando={reenviando}
                rotuloCarregando="Reenviando"
                iconeEsquerda={
                  <RefreshCw
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                }
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
        <FaixaAlerta variante="erro" titulo="Não deu certo">
          {estadoReenviar.erro}
        </FaixaAlerta>
      ) : null}

      {transferencia.pausaVenceu ? (
        <FaixaAlerta variante="imediato" titulo="A Isadora voltou a responder">
          A pausa venceu com esta transferência aberta. Ela não retoma o assunto
          transferido; assuma para responder a família.
        </FaixaAlerta>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {assumida ? (
          <>
            <Selo variante="sucesso" icone={<UserCheck />}>
              {horaAssumida ? `${quemAssumiu} às ${horaAssumida}` : quemAssumiu}
            </Selo>
            {transferencia.conversaId ? (
              <Botao asChild tamanho="compacto" variante="fantasma">
                <Link href={`/conversas/${transferencia.conversaId}`}>
                  Abrir conversa
                </Link>
              </Botao>
            ) : null}
          </>
        ) : naoEDoPapel ? (
          <>
            {telefonePlantao ? (
              <Botao
                asChild
                tamanho="compacto"
                iconeEsquerda={
                  <Phone
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                }
              >
                <a href={`tel:${telefonePlantao}`}>Ligar para a coordenação</a>
              </Botao>
            ) : null}
            {/* Sem o telefone (fora da demonstração, a RLS de `parametro`
                só deixa a diretoria ler), "Ver conversa" fica sozinho: o
                destino já está na linha acima, repeti-lo aqui não ajuda. */}
            {transferencia.conversaId ? (
              <Botao asChild tamanho="compacto" variante="fantasma">
                <Link href={`/conversas/${transferencia.conversaId}`}>
                  Ver conversa
                </Link>
              </Botao>
            ) : null}
          </>
        ) : (
          <form action={acaoAssumir}>
            <input
              type="hidden"
              name="transferenciaId"
              value={transferencia.id}
            />
            <input
              type="hidden"
              name="conversaId"
              value={transferencia.conversaId ?? ""}
            />
            <input type="hidden" name="abrirConversa" value="1" />
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={assumindo}
              rotuloCarregando="Assumindo"
              iconeEsquerda={
                <UserCheck
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              Assumir conversa
            </Botao>
          </form>
        )}
      </div>
      {estadoAssumir.erro ? (
        <FaixaAlerta variante="erro" titulo="Não deu certo">
          {estadoAssumir.erro}
        </FaixaAlerta>
      ) : null}
    </Cartao>
  );
}
