"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Bot, UserCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarData } from "@/lib/formatacao";
import {
  acaoMarcarNaoLead,
  acaoPausarConversa,
  acaoResolverTransferencia,
  acaoRetomarAgenteComercial,
  acaoRetomarPausaManual,
  estadoInicialAgente,
} from "../../acoes";
import { primeiroNome } from "../../formatacao";
import { CLASSIFICACOES_NAO_LEAD } from "../../loja-extra";
import { ROTULO_DESFECHO, ROTULO_NAO_LEAD } from "../../tipos";
import type { ConversaComPausa, TransferenciaTela } from "../../tipos";
import type { FichaTela } from "@/modules/crm/ficha/tipos";

export interface PainelResumoProps {
  conversa: ConversaComPausa;
  ficha: FichaTela | null;
  transferenciaAberta: TransferenciaTela | null;
}

export function PainelResumo({ conversa, ficha, transferenciaAberta }: PainelResumoProps) {
  const nome = conversa.nomeFamilia ?? conversa.nomeContato ?? "a família";
  const oportunidade = ficha?.oportunidade ?? null;
  const dpp = ficha?.datas.find((d) => d.rotulo === "DPP")?.valor ?? null;

  return (
    <aside className="flex flex-col gap-3" aria-label="Resumo da família">
      {ficha ? (
        <details className="bg-superficie-2 rounded-3 p-4" open>
          <summary className="min-h-toque flex cursor-pointer list-none items-center gap-2 font-semibold">
            <Bot aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Resumo da Isadora
          </summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-apoio">
            <dt className="text-marinho-72">Onde</dt>
            <dd>
              {[ficha.bairro, ficha.cidade, ficha.uf].filter(Boolean).join(", ") ||
                "não informado"}
            </dd>
            {dpp ? (
              <>
                <dt className="text-marinho-72">DPP</dt>
                <dd className="font-mono">{formatarData(dpp)} (estimativa)</dd>
              </>
            ) : null}
            {ficha.idadeGestacional ? (
              <>
                <dt className="text-marinho-72">Semanas</dt>
                <dd className="font-mono">{ficha.idadeGestacional}</dd>
              </>
            ) : null}
            {oportunidade?.pdfEnviadoEm ? (
              <>
                <dt className="text-marinho-72">Apresentação</dt>
                <dd>Enviada em {formatarData(oportunidade.pdfEnviadoEm)}</dd>
              </>
            ) : null}
            {ficha.estagioRotulo ? (
              <>
                <dt className="text-marinho-72">Estágio</dt>
                <dd>{ficha.estagioRotulo}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}

      {conversa.agenteEncerradoEm ? (
        <FaixaInfoEncerrada conversaId={conversa.id} nome={nome} />
      ) : conversa.situacao === "pausada" && !transferenciaAberta ? (
        <FaixaPausaManual conversaId={conversa.id} pausaMotivo={conversa.pausaMotivo} />
      ) : conversa.situacao === "isadora" ? (
        <FaixaIsadoraAtiva conversaId={conversa.id} />
      ) : null}

      {transferenciaAberta ? <ResolverTransferencia transferencia={transferenciaAberta} conversaId={conversa.id} /> : null}

      <div className="flex flex-wrap gap-2">
        {conversa.familiaId ? (
          <Botao asChild variante="secundario" tamanho="compacto">
            <Link href={`/familias/${conversa.familiaId}`}>Ver ficha</Link>
          </Botao>
        ) : null}
        {conversa.situacao === "isadora" || conversa.situacao === "pausada" ? (
          <MarcarNaoLead conversaId={conversa.id} nome={nome} />
        ) : null}
      </div>
    </aside>
  );
}

function FaixaIsadoraAtiva({ conversaId }: { conversaId: string }) {
  const [estado, acao, enviando] = useActionState(acaoPausarConversa, estadoInicialAgente);
  return (
    <FaixaAlerta
      variante="info"
      titulo="A Isadora está conduzindo esta conversa"
      acoes={
        <form action={acao}>
          <input type="hidden" name="conversaId" value={conversaId} />
          <input type="hidden" name="origem" value="assumir" />
          <Botao
            type="submit"
            variante="primario"
            tamanho="compacto"
            carregando={enviando}
            rotuloCarregando="Assumindo"
            iconeEsquerda={<UserCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          >
            Assumir conversa
          </Botao>
        </form>
      }
    >
      Se você assumir, ela para de responder aqui até você devolver.
      {estado.erro ? <span className="text-alerta block">{estado.erro}</span> : null}
    </FaixaAlerta>
  );
}

function FaixaPausaManual({
  conversaId,
  pausaMotivo,
}: {
  conversaId: string;
  pausaMotivo: string | null;
}) {
  const [estado, acao, enviando] = useActionState(acaoRetomarPausaManual, estadoInicialAgente);
  return (
    <FaixaAlerta
      variante="info"
      titulo="Isadora pausada nesta conversa"
      acoes={
        <form action={acao}>
          <input type="hidden" name="conversaId" value={conversaId} />
          <Botao type="submit" tamanho="compacto" carregando={enviando} rotuloCarregando="Devolvendo">
            Devolver agora
          </Botao>
        </form>
      }
    >
      {pausaMotivo ?? "Pausada manualmente por alguém da equipe."}
      {estado.erro ? <span className="text-alerta block">{estado.erro}</span> : null}
    </FaixaAlerta>
  );
}

function FaixaInfoEncerrada({ conversaId, nome }: { conversaId: string; nome: string }) {
  const [aberto, definirAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    acaoRetomarAgenteComercial,
    estadoInicialAgente,
  );

  return (
    <FaixaAlerta variante="info" titulo="A Isadora saiu desta conversa">
      Não volta sozinha. Daqui em diante é com você. Só o botão abaixo devolve, e a Isadora só
      responde a partir da próxima mensagem de {primeiroNome(nome)}.
      {estado.erro ? <span className="text-alerta mt-2 block">{estado.erro}</span> : null}
      <div className="mt-3">
        <Dialogo open={aberto} onOpenChange={definirAberto}>
          <DialogoGatilho asChild>
            <Botao type="button" variante="secundario" tamanho="compacto">
              Devolver à Isadora
            </Botao>
          </DialogoGatilho>
          <DialogoConteudo
            titulo="Devolver esta conversa à Isadora"
            rotuloFechar="Fechar"
            descricao={`A Isadora volta a responder a ${nome} a partir da próxima mensagem dela. Isso fica registrado.`}
          >
            <form
              action={acao}
              onSubmit={() => {
                definirAberto(false);
              }}
            >
              <input type="hidden" name="conversaId" value={conversaId} />
              <DialogoRodape>
                <DialogoFechar asChild>
                  <Botao type="button" variante="secundario">
                    Cancelar
                  </Botao>
                </DialogoFechar>
                <Botao type="submit" carregando={enviando} rotuloCarregando="Devolvendo">
                  Devolver à Isadora
                </Botao>
              </DialogoRodape>
            </form>
          </DialogoConteudo>
        </Dialogo>
      </div>
    </FaixaAlerta>
  );
}

function ResolverTransferencia({
  transferencia,
  conversaId,
}: {
  transferencia: TransferenciaTela;
  conversaId: string;
}) {
  const [mostrar, definirMostrar] = useState(false);
  const [estado, acao, enviando] = useActionState(
    acaoResolverTransferencia,
    estadoInicialAgente,
  );

  if (transferencia.status === "resolvido") return null;

  return (
    <div className="flex flex-col gap-2">
      <Botao type="button" variante="secundario" tamanho="compacto" onClick={() => definirMostrar((v) => !v)}>
        Marcar como resolvida
      </Botao>
      {mostrar ? (
        <form action={acao} className="border-linha flex flex-col gap-3 border-t pt-3">
          <input type="hidden" name="transferenciaId" value={transferencia.id} />
          <input type="hidden" name="conversaId" value={conversaId} />
          <EscolhaUnica
            rotulo="Como terminou"
            name="desfecho"
            opcoes={Object.entries(ROTULO_DESFECHO).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao type="submit" tamanho="compacto" carregando={enviando} rotuloCarregando="Salvando">
            Marcar como resolvida
          </Botao>
        </form>
      ) : null}
    </div>
  );
}

function MarcarNaoLead({ conversaId, nome }: { conversaId: string; nome: string }) {
  const [mostrar, definirMostrar] = useState(false);
  const [estado, acao, enviando] = useActionState(acaoMarcarNaoLead, estadoInicialAgente);

  return (
    <div className="flex flex-col gap-2">
      <Botao type="button" variante="fantasma" tamanho="compacto" onClick={() => definirMostrar((v) => !v)}>
        Marcar como não lead
      </Botao>
      {mostrar ? (
        <form action={acao} className="border-linha flex flex-col gap-3 border-t pt-3">
          <input type="hidden" name="conversaId" value={conversaId} />
          <EscolhaUnica
            rotulo="Não é lead porque"
            name="classificacao"
            opcoes={CLASSIFICACOES_NAO_LEAD.map((valor) => ({ valor, rotulo: ROTULO_NAO_LEAD[valor] }))}
          />
          <p className="text-apoio text-texto-2">
            A Isadora encaminha {primeiroNome(nome)} e para de responder depois disso.
          </p>
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao type="submit" tamanho="compacto" carregando={enviando} rotuloCarregando="Salvando">
            Marcar como não lead
          </Botao>
        </form>
      ) : null}
    </div>
  );
}
