"use client";

import { estadoInicialAdmin } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import { CheckCheck, Plus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { Cartao } from "@/components/ui/cartao";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/formatacao";
import {
  acaoAprovarItemBaseConhecimento,
  acaoSalvarItemBaseConhecimento,
} from "../../admin-acoes";
import { ROTULO_TIPO_CONTEUDO } from "../../tipos";
import type { ItemBaseConhecimento, TipoConteudoBase } from "../../tipos";
import type { BaseConhecimentoTela } from "../dados";
import { BotaoReindexar } from "./botao-reindexar";

const seloStatus: Record<
  ItemBaseConhecimento["status"],
  { variante: "sucesso" | "aviso" | "neutro"; rotulo: string }
> = {
  aprovado: { variante: "sucesso", rotulo: "Aprovado" },
  rascunho: { variante: "aviso", rotulo: "Rascunho" },
  arquivado: { variante: "neutro", rotulo: "Arquivado" },
};

function CartaoItem({
  item,
  podeAprovar,
}: {
  item: ItemBaseConhecimento;
  podeAprovar: boolean;
}) {
  const [estado, acao, aprovando] = useActionState(
    acaoAprovarItemBaseConhecimento,
    estadoInicialAdmin,
  );
  const status = seloStatus[item.status];

  return (
    <Cartao variante="plano" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-mini text-texto-2">
            {ROTULO_TIPO_CONTEUDO[item.tipo]}
          </p>
          <h3 className="text-3 text-texto font-semibold">{item.titulo}</h3>
        </div>
        <Selo variante={status.variante}>{status.rotulo}</Selo>
      </div>
      <p className="text-corpo text-texto whitespace-pre-wrap">{item.texto}</p>
      {item.fonte ? (
        <p className="text-mini text-texto-2">Fonte: {item.fonte}</p>
      ) : null}
      {item.status === "rascunho" && podeAprovar ? (
        <form action={acao} className="pt-1">
          <input type="hidden" name="id" value={item.id} />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu certo">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={aprovando}
            rotuloCarregando="Aprovando"
            iconeEsquerda={
              <CheckCheck
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            Aprovar
          </Botao>
        </form>
      ) : item.status === "aprovado" && item.aprovadoPor ? (
        <p className="text-mini text-texto-2">
          Aprovado por {item.aprovadoPor}
          {item.aprovadoEm ? ` em ${formatarDataHora(item.aprovadoEm)}` : ""}.
        </p>
      ) : null}
    </Cartao>
  );
}

function FormularioNovoItem() {
  const [aberto, definirAberto] = useState(false);
  const [estado, acao, salvando] = useActionState(
    acaoSalvarItemBaseConhecimento,
    estadoInicialAdmin,
  );

  if (!aberto) {
    return (
      <Botao
        type="button"
        variante="secundario"
        tamanho="compacto"
        iconeEsquerda={
          <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
        }
        onClick={() => definirAberto(true)}
      >
        Novo item
      </Botao>
    );
  }

  const tipos: TipoConteudoBase[] = Object.keys(
    ROTULO_TIPO_CONTEUDO,
  ) as TipoConteudoBase[];

  return (
    <Cartao variante="plano" className="flex flex-col gap-3">
      <form action={acao} className="flex flex-col gap-3">
        <EscolhaUnica
          rotulo="Tipo"
          name="tipo"
          valorPadrao="faq"
          opcoes={tipos.map((tipo) => ({
            valor: tipo,
            rotulo: ROTULO_TIPO_CONTEUDO[tipo],
          }))}
        />
        <CampoTexto id="bc-titulo" name="titulo" rotulo="Título" />
        <CampoTexto
          id="bc-texto"
          name="texto"
          rotulo="Texto"
          multilinha
          linhas={5}
          maxLength={1500}
          descricao="Um assunto por item, até 1.500 caracteres. Nada clínico: orientação de saúde é da coordenação."
        />
        <CampoTexto id="bc-fonte" name="fonte" rotulo="Fonte" opcional />
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
        <div className="flex gap-2">
          <Botao
            type="submit"
            tamanho="compacto"
            carregando={salvando}
            rotuloCarregando="Salvando"
          >
            Salvar em rascunho
          </Botao>
          <Botao
            type="button"
            variante="fantasma"
            tamanho="compacto"
            onClick={() => definirAberto(false)}
          >
            Cancelar
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}

/**
 * Base de conhecimento da Isadora (P27 item 4, PRD 6.8, 11.9): cadastro com
 * status, aprovação pela diretoria e "Reindexar".
 */
export function PainelBaseConhecimento({
  base,
  podeAprovar,
}: {
  base: BaseConhecimentoTela;
  podeAprovar: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-apoio text-texto-2">
          {base.ultimaIngestao
            ? `Última ingestão em ${formatarDataHora(base.ultimaIngestao.em)}, ${base.ultimaIngestao.itens} itens${base.ultimaIngestao.ok ? "." : `, com erro: ${base.ultimaIngestao.erro ?? "não informado"}.`}`
            : "Ainda não há registro de ingestão."}
        </p>
        <BotaoReindexar />
      </div>

      <FormularioNovoItem />

      {base.itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum item cadastrado"
          texto="Cadastre o que a Isadora pode responder: institucional, FAQ, objeções, políticas e mais."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {base.itens.map((item) => (
            <CartaoItem key={item.id} item={item} podeAprovar={podeAprovar} />
          ))}
        </div>
      )}
    </div>
  );
}
