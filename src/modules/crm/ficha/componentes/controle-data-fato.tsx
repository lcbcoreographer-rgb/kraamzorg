"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarData } from "@/lib/formatacao";
import { acaoRegistrarDataFato } from "../acoes";
import { estadoInicialFicha } from "../estado-acoes";
import type { CampoDataFato } from "../dados";

/**
 * Registro das datas de nascimento e alta (P16 item 4). São FATO, escritas
 * à mão quando a família ou a equipe avisa: nenhuma automação as calcula
 * (PRD 6.10, as quatro datas nunca se confundem).
 */
export function ControleDataFato({
  familiaId,
  campo,
  rotulo,
  valorAtual,
  hoje,
}: {
  familiaId: string;
  campo: CampoDataFato;
  rotulo: string;
  valorAtual: string | null;
  /** "aaaa-mm-dd" em Brasília: fato não fica no futuro. */
  hoje: string;
}) {
  const [aberto, definirAberto] = React.useState(false);
  const [estado, acao, enviando] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoRegistrarDataFato(
        estadoInicialFicha,
        formulario,
      );
      if (resultado.sucesso) definirAberto(false);
      return resultado;
    },
    estadoInicialFicha,
  );

  return (
    <Dialogo open={aberto} onOpenChange={definirAberto}>
      <DialogoGatilho asChild>
        <Botao variante="fantasma" tamanho="compacto">
          {valorAtual
            ? `Corrigir ${rotulo.toLowerCase()}`
            : `Registrar ${rotulo.toLowerCase()}`}
        </Botao>
      </DialogoGatilho>
      <DialogoConteudo
        titulo={`Registrar ${rotulo.toLowerCase()}`}
        descricao="Vira fato a partir de agora. Nenhuma automação dispara por esta data sozinha."
        rotuloFechar="Fechar sem registrar"
      >
        {/* noValidate: o seletor nativo já não oferece dia depois de hoje
            (max), e quem digita uma data impossível recebe a explicação
            do servidor, em vez do balão genérico do navegador. */}
        <form action={acao} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="familiaId" value={familiaId} />
          <input type="hidden" name="campo" value={campo} />
          <CampoTexto
            rotulo={rotulo}
            name="valor"
            type="date"
            defaultValue={valorAtual ?? undefined}
            max={hoje}
            descricao={`Até hoje, ${formatarData(hoje)}.`}
            required
          />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo={estado.erro} />
          ) : null}
          <DialogoRodape>
            <DialogoFechar asChild>
              <Botao variante="secundario">Cancelar</Botao>
            </DialogoFechar>
            <Botao
              type="submit"
              carregando={enviando}
              rotuloCarregando="Salvando"
            >
              Salvar
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
