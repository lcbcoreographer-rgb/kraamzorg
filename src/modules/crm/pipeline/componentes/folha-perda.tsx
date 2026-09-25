"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { NumeroPipeline } from "@/lib/dados/tipos";
import { acaoMarcarPerdido, estadoInicialPipeline } from "../acoes";
import { MOTIVOS_PERDA, ROTULO_MOTIVO_PERDA } from "../estagios";

/**
 * Folha "Marcar como perdido" (P15 item 2, protótipo `comercial-pipeline.html`,
 * folha `folha-perda`): motivo obrigatório em pílulas, detalhe opcional.
 * Confirmação por folha porque não há desfazer aqui (a família sai do
 * pipeline e para de receber follow-up).
 */
export function FolhaPerda({
  aberta,
  aoFechar,
  oportunidadeId,
  pipeline,
  nomeFamilia,
}: {
  aberta: boolean;
  aoFechar: () => void;
  oportunidadeId: string;
  pipeline: NumeroPipeline;
  nomeFamilia: string;
}) {
  const [estado, acao, enviando] = useActionState(
    async (_anterior: typeof estadoInicialPipeline, formulario: FormData) => {
      const resultado = await acaoMarcarPerdido(
        estadoInicialPipeline,
        formulario,
      );
      if (resultado.sucesso) aoFechar();
      return resultado;
    },
    estadoInicialPipeline,
  );

  return (
    <Dialogo
      open={aberta}
      onOpenChange={(valor) => {
        if (!valor) aoFechar();
      }}
    >
      <DialogoConteudo
        titulo="Marcar como perdido"
        descricao={`A ${nomeFamilia} sai do pipeline e para de receber follow-up. Se a família voltar a escrever, ela reabre em Em conversa.`}
        rotuloFechar="Fechar sem marcar como perdido"
      >
        <form action={acao} className="flex flex-col gap-6">
          <input type="hidden" name="oportunidadeId" value={oportunidadeId} />
          <input type="hidden" name="pipeline" value={pipeline} />
          <EscolhaUnica
            rotulo="Motivo da perda"
            name="motivo"
            opcoes={MOTIVOS_PERDA.map((motivo) => ({
              valor: motivo,
              rotulo: ROTULO_MOTIVO_PERDA[motivo],
            }))}
          />
          <CampoTexto
            rotulo="Detalhe"
            name="detalhe"
            opcional
            multilinha
            linhas={3}
            descricao="Ajuda quem ler o relatório de perdas a entender o motivo."
          />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo={estado.erro} />
          ) : null}
          <DialogoRodape>
            <DialogoFechar asChild>
              <Botao variante="secundario">Voltar</Botao>
            </DialogoFechar>
            <Botao
              type="submit"
              carregando={enviando}
              rotuloCarregando="Marcando"
            >
              Marcar como perdido
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
