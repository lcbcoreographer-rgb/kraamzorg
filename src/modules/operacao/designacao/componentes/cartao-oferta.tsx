"use client";

import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { Oferta } from "@/lib/dados/tipos-operacao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import {
  estadoInicialOperacao,
  type EstadoAcaoOperacao,
} from "../../comum/estado-acoes";
import { useAcao } from "../../comum/use-acao";
import { ROTULO_PAPEL_DESIGNACAO, ROTULO_PERIODO } from "../../comum/rotulos";
import { acaoResponderOferta } from "../acoes";

/** Motivos rápidos de recusa (rótulos de tela, o texto escolhido vai para o histórico). */
const MOTIVOS = [
  {
    valor: "Já tenho família na janela dessas datas",
    rotulo: "Já tenho família nessa janela",
  },
  {
    valor: "Estarei de folga ou bloqueada nessas datas",
    rotulo: "Folga ou bloqueio",
  },
  {
    valor: "A família fica longe da minha região",
    rotulo: "Fica longe de mim",
  },
  {
    valor: "Prefiro conversar com a coordenação",
    rotulo: "Quero conversar antes",
  },
];

/**
 * Oferta de designação para a enfermeira (P36 item 1, fluxo D). Mostra o
 * que ela precisa para decidir: papel, bairro (sem endereço), data provável
 * (estimativa), dias e período das visitas e o prazo. Aceitar é um toque;
 * recusar pede o motivo, que a coordenação lê.
 */
export function CartaoOferta({
  oferta: o,
  aoResponder,
}: {
  oferta: Oferta;
  /** Chamado ao enviar a resposta, antes de a lista do servidor mudar. */
  aoResponder?: (oferta: Oferta) => void;
}) {
  const {
    estado,
    enviar: responder,
    pendente: enviando,
  } = useAcao(async (anterior: EstadoAcaoOperacao, formulario: FormData) => {
    aoResponder?.(o);
    return acaoResponderOferta(anterior, formulario);
  }, estadoInicialOperacao);
  const respondida = Boolean(estado.sucesso);

  return (
    <Cartao className="flex flex-col gap-4" data-oferta={o.designacaoId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-titulo text-2 text-texto font-medium">
          {o.familia}
        </h3>
        <Selo variante="destaque">{ROTULO_PAPEL_DESIGNACAO[o.papel]}</Selo>
        {o.gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
        {o.vencida ? <Selo variante="alerta">Prazo vencido</Selo> : null}
      </div>
      <dl className="text-corpo grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-texto-2">Onde</dt>
        <dd className="text-texto">
          {[o.bairro, o.cidade].filter(Boolean).join(", ") || "não informado"}
          {o.uf ? `, ${o.uf}` : ""}
        </dd>
        <dt className="text-texto-2">Parto provável</dt>
        <dd className="text-texto font-mono">
          {o.dpp ? (formatarData(o.dpp) ?? o.dpp) : "sem data"}
          {o.dpp ? (
            <span className="text-texto-2 font-sans italic"> estimativa</span>
          ) : null}
        </dd>
        <dt className="text-texto-2">Pacote</dt>
        <dd className="text-texto">
          {o.dias} dias, {o.horasPorVisita} h por visita
          {o.periodo ? `, de ${ROTULO_PERIODO[o.periodo].toLowerCase()}` : ""}
        </dd>
        {o.prazoRespostaEm ? (
          <>
            <dt className="text-texto-2">Responder até</dt>
            <dd className="text-texto font-mono">
              {formatarDataHora(o.prazoRespostaEm) ?? ""}
            </dd>
          </>
        ) : null}
      </dl>

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
      ) : null}

      {!respondida && !o.vencida ? (
        <div className="flex flex-col gap-3">
          <form onSubmit={responder}>
            <input type="hidden" name="designacaoId" value={o.designacaoId} />
            <input type="hidden" name="decisao" value="aceitar" />
            <Botao
              type="submit"
              carregando={enviando}
              rotuloCarregando="Aceitando"
              largaTotal
              className="tablet:w-auto"
            >
              Aceitar a família
            </Botao>
          </form>
          <details className="group">
            <summary className="rounded-pilula border-borda-campo bg-superficie text-corpo text-texto hover:bg-marinho-08 tablet:w-auto tablet:inline-flex flex min-h-12 cursor-pointer list-none items-center justify-center border-[1.5px] px-6 font-semibold group-open:mb-2 [&::-webkit-details-marker]:hidden">
              Não posso aceitar
            </summary>
            <form
              onSubmit={responder}
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <input type="hidden" name="designacaoId" value={o.designacaoId} />
              <input type="hidden" name="decisao" value="recusar" />
              <EscolhaUnica
                rotulo="O que aconteceu"
                name="motivoEscolha"
                opcoes={MOTIVOS}
              />
              <CampoTexto
                rotulo="Se quiser, conte mais para a coordenação"
                name="motivoTexto"
                multilinha
                linhas={2}
                opcional
                erro={estado.campos?.motivoTexto}
              />
              <Botao
                type="submit"
                variante="secundario"
                carregando={enviando}
                rotuloCarregando="Enviando"
                className="self-start"
              >
                Recusar a oferta
              </Botao>
            </form>
          </details>
        </div>
      ) : null}
    </Cartao>
  );
}
