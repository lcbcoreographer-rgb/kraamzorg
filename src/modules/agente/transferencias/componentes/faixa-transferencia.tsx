"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  CalendarPlus,
  CircleAlert,
  ClockAlert,
  Hourglass,
  OctagonPause,
  Phone,
  RefreshCw,
  Siren,
  UserCheck,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { DestinoHandoff } from "@/lib/dados/tipos";
import { rotulo } from "@/lib/rotulos-a-confirmar";
import { cn } from "@/lib/utils";
import { textoPrazo } from "@/modules/mensageria/tarefas/agrupar";
import {
  acaoAssumirTransferencia,
  acaoReenviarNotificacao,
  acaoResolverTransferencia,
} from "../../acoes";
import { estadoInicialAgente } from "../../estado-acoes";
import { estadoPrazo, horaBrasilia, quandoRecebida } from "../../formatacao";
import {
  FRASE_DESTINO_HANDOFF,
  MOTIVOS_SENSIVEIS,
  ROTULO_DESFECHO,
} from "../../tipos";
import type { TransferenciaTela } from "../../tipos";

export interface FaixaTransferenciaProps {
  transferencia: TransferenciaTela;
  /** A conversa aberta; null para o pedido sem conversa ligada. */
  conversaId: string | null;
  /** Quem está vendo, para dizer "assumida por você". */
  usuarioId?: string;
  /**
   * De qual destino é o papel de quem vê. Transferência de outro destino
   * (a perda, da coordenação clínica, vista pelo comercial) oferece ligar
   * para quem cuida, e não assumir nem encerrar (crítica do CRM, P0 item
   * 4). Sem isto (diretoria), todas as ações aparecem.
   */
  destinoDoPapel?: DestinoHandoff;
  /** Telefone do plantão (`parametro.plantao_telefones`). */
  telefonePlantao?: string | null;
  /** Linha a mais no fim do texto (a pausa da Isadora nesta conversa). */
  rodape?: React.ReactNode;
  agora?: Date;
}

function comMaiuscula(frase: string): string {
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * A transferência aberta dentro da conversa, numa faixa no topo do painel
 * (pedido do dono em 30/09: "as transferências têm que funcionar em
 * conjunto com as conversas"). Junta o que a fila e o painel da conversa
 * mostravam: motivo, prazo, com quem está, quem pegou, o resumo da
 * Isadora e as ações (assumir, marcar na agenda, reenviar o aviso,
 * encerrar com o desfecho). As ações chamam as mesmas funções de antes.
 *
 * Tom pelo que ela é (DESIGN.md, 2.5): pessoas e conversas em argila.
 * Relato de saúde continua destacado em alerta, como na fila. Perda e
 * estado sensível em ameixa, com a hora do relato no lugar do prazo, sem
 * relógio e sem vermelho (seção 11.8).
 */
export function FaixaTransferencia({
  transferencia,
  conversaId,
  usuarioId,
  destinoDoPapel,
  telefonePlantao,
  rodape,
  agora = new Date(),
}: FaixaTransferenciaProps) {
  const [mostrarResolver, definirMostrarResolver] = useState(false);
  const [estadoAssumir, acaoAssumir, assumindo] = useActionState(
    acaoAssumirTransferencia,
    estadoInicialAgente,
  );
  const [estadoReenviar, acaoReenviar, reenviando] = useActionState(
    acaoReenviarNotificacao,
    estadoInicialAgente,
  );
  const [estadoResolver, acaoResolver, resolvendo] = useActionState(
    acaoResolverTransferencia,
    estadoInicialAgente,
  );

  if (transferencia.status === "resolvido") return null;

  const sensivel = MOTIVOS_SENSIVEIS.includes(transferencia.motivo);
  const saude = transferencia.prioridade === "maxima" && !sensivel;
  const assumida = transferencia.status === "assumido";
  const prazo = estadoPrazo(
    transferencia.criadoEm,
    transferencia.slaVenceEm,
    agora,
  );
  const prazoTexto = textoPrazo(transferencia.slaVenceEm, agora);
  const horaRecebida = quandoRecebida(transferencia.criadoEm, agora);
  // "desde as 11:48", "desde ontem às 11:48", "desde 28/09 às 11:48".
  const desde = horaRecebida.replace(/^às /, "as ").replace(/^em /, "");
  const horaAssumida = horaBrasilia(transferencia.assumidoEm);
  const porVoce = Boolean(usuarioId && transferencia.assumidoPor === usuarioId);
  const naoEDoPapel = Boolean(
    destinoDoPapel && transferencia.destino !== destinoDoPapel,
  );
  const rotuloResolver = sensivel
    ? rotulo("resolverSensivel")
    : "Marcar como resolvida";
  const variantePerigo = sensivel ? "sensivel" : "erro";
  const podeLigar = naoEDoPapel && !assumida && Boolean(telefonePlantao);
  const marcaNaAgenda =
    transferencia.motivo === "reuniao" &&
    !naoEDoPapel &&
    Boolean(transferencia.familiaId);
  const temAcoes = assumida || !naoEDoPapel || podeLigar || marcaNaAgenda;

  return (
    <section
      aria-label="Transferência aberta"
      className={cn(
        "rounded-3 flex flex-col gap-3 p-3 lg:p-4",
        sensivel
          ? "bg-sensivel-lavado border-sensivel-borda border"
          : saude
            ? "bg-alerta-lavado border-alerta-borda border"
            : "bg-argila-clara",
      )}
    >
      <div className="flex items-start gap-3">
        {sensivel ? (
          <OctagonPause
            aria-hidden="true"
            className="text-sensivel mt-0.5 size-6 shrink-0"
            strokeWidth={1.75}
          />
        ) : saude ? (
          <Siren
            aria-hidden="true"
            className="text-alerta mt-0.5 size-6 shrink-0"
            strokeWidth={1.75}
          />
        ) : (
          <TileIcone tom="argila" forma="quadrado" tamanho="p">
            <ArrowRightLeft />
          </TileIcone>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3
              className={cn(
                "text-3 font-semibold",
                sensivel
                  ? "text-sensivel"
                  : saude
                    ? "text-alerta"
                    : "text-texto",
              )}
            >
              {transferencia.motivoRotulo}
            </h3>
            {sensivel ? (
              // Em momento sensível, o prazo vira a hora do acontecimento
              // (DESIGN.md, 11.8, regra 1).
              <span className="text-apoio text-texto-2 inline-flex items-center gap-1 whitespace-nowrap">
                {horaRecebida ? `recebida ${horaRecebida}` : "recebida hoje"}
              </span>
            ) : !assumida && prazoTexto ? (
              <span
                className={cn(
                  "rounded-pilula text-apoio inline-flex min-h-7 items-center gap-1.5 px-3 font-medium whitespace-nowrap tabular-nums",
                  prazo === "vencido" && "bg-alerta-lavado text-alerta",
                  prazo === "perto" && "bg-aviso-lavado text-aviso-texto",
                  prazo === "normal" && "bg-superficie text-texto",
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
                {prazoTexto}
              </span>
            ) : null}
          </div>
          <p className="text-apoio text-texto-2">
            {comMaiuscula(FRASE_DESTINO_HANDOFF[transferencia.destino])}
            {!sensivel && desde ? `, desde ${desde}` : ""}.
          </p>
          <p className="text-apoio text-texto mt-0.5">{transferencia.resumo}</p>
          {rodape ? <div className="mt-1.5">{rodape}</div> : null}
          {sensivel && prazo === "vencido" && !assumida ? (
            <p className="text-apoio text-texto-2">
              Ainda sem contato da equipe.
            </p>
          ) : null}
        </div>
      </div>

      {transferencia.notificacaoOk === false ? (
        // O aviso ao grupo que falhou, numa linha só com a ação ao lado.
        // Ao lado de uma perda, continua visível em ameixa: nada vermelho
        // na tela de uma família em luto.
        <div
          className={cn(
            "rounded-2 bg-superficie flex flex-wrap items-center gap-x-3 gap-y-2 border px-3 py-2",
            sensivel ? "border-sensivel-borda" : "border-alerta-borda",
          )}
        >
          <CircleAlert
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0",
              sensivel ? "text-sensivel" : "text-alerta",
            )}
            strokeWidth={1.75}
          />
          <p className="text-apoio text-texto min-w-0 flex-1">
            <strong
              className={cn(
                "font-semibold",
                sensivel ? "text-sensivel" : "text-alerta",
              )}
            >
              O aviso ao grupo não saiu.
            </strong>{" "}
            <span className="max-tablet:hidden">
              A equipe pode não ter visto esta transferência.
            </span>
          </p>
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
        </div>
      ) : null}
      {estadoReenviar.erro ? (
        <FaixaAlerta
          variante={variantePerigo}
          titulo="O aviso não foi reenviado"
        >
          {estadoReenviar.erro}
        </FaixaAlerta>
      ) : null}

      {transferencia.pausaVenceu && !sensivel ? (
        <FaixaAlerta variante="erro" titulo="A Isadora voltou a responder">
          A pausa venceu com esta transferência aberta. Ela não retoma o assunto
          transferido; assuma para responder a família.
        </FaixaAlerta>
      ) : null}

      {temAcoes ? (
        <div className="flex flex-wrap items-center gap-2">
          {assumida ? (
            <Selo variante="sucesso" icone={<UserCheck />}>
              {porVoce ? "Assumida por você" : "Assumida"}
              {horaAssumida ? ` às ${horaAssumida}` : ""}
            </Selo>
          ) : naoEDoPapel ? (
            podeLigar ? (
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
            ) : null
          ) : (
            <form action={acaoAssumir}>
              <input
                type="hidden"
                name="transferenciaId"
                value={transferencia.id}
              />
              <input type="hidden" name="conversaId" value={conversaId ?? ""} />
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

          {/* Pedido de conversa com a coordenação (D-15, P29): a agenda abre
            com as opções que a família passou à Isadora. */}
          {marcaNaAgenda ? (
            <Botao
              asChild
              tamanho="compacto"
              variante="secundario"
              iconeEsquerda={
                <CalendarPlus
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              }
            >
              <Link
                href={`/sessoes-venda/nova?transferencia=${transferencia.id}`}
              >
                Marcar na agenda
              </Link>
            </Botao>
          ) : null}

          {!naoEDoPapel ? (
            <Botao
              type="button"
              variante="secundario"
              tamanho="compacto"
              aria-expanded={mostrarResolver}
              onClick={() => definirMostrarResolver((v) => !v)}
            >
              {rotuloResolver}
            </Botao>
          ) : null}
        </div>
      ) : null}

      {naoEDoPapel && !assumida ? (
        <p className="text-apoio text-texto-2">
          Quem assume e encerra esta transferência é{" "}
          {FRASE_DESTINO_HANDOFF[transferencia.destino].replace(/^com /, "")}.
        </p>
      ) : null}

      {estadoAssumir.erro ? (
        <FaixaAlerta
          variante={variantePerigo}
          titulo="A conversa não foi assumida"
        >
          {estadoAssumir.erro}
        </FaixaAlerta>
      ) : null}

      {mostrarResolver ? (
        <form
          action={acaoResolver}
          className="border-linha flex flex-col gap-3 border-t pt-3"
        >
          <input
            type="hidden"
            name="transferenciaId"
            value={transferencia.id}
          />
          <input type="hidden" name="conversaId" value={conversaId ?? ""} />
          <EscolhaUnica
            rotulo="Como terminou"
            name="desfecho"
            opcoes={Object.entries(ROTULO_DESFECHO).map(([valor, texto]) => ({
              valor,
              rotulo: texto,
            }))}
            descricao="Encerra a transferência e não muda quem responde a conversa."
          />
          {estadoResolver.erro ? (
            <FaixaAlerta
              variante={variantePerigo}
              titulo="A transferência continua aberta"
            >
              {estadoResolver.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={resolvendo}
              rotuloCarregando="Salvando"
            >
              {rotuloResolver}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              tamanho="compacto"
              onClick={() => definirMostrarResolver(false)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : null}
    </section>
  );
}
