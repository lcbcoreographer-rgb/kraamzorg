"use client";

import * as React from "react";
import { useActionState } from "react";
import { BellOff } from "lucide-react";
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
import { Selo } from "@/components/ui/selo";
import { acaoDesmarcarNaoContatar, acaoMarcarNaoContatar } from "../acoes";
import { estadoInicialFicha } from "../estado-acoes";

/**
 * "Não contatar" com motivo (P16 item 3). Marcar exige motivo, na mesma
 * folha; desmarcar é uma ação direta, porque só reabre o contato, não
 * esconde nada.
 */
export function ControleNaoContatar({
  familiaId,
  naoContatar,
  podeEditar,
}: {
  familiaId: string;
  naoContatar: boolean;
  podeEditar: boolean;
}) {
  const [aberto, definirAberto] = React.useState(false);
  const [estadoMarcar, acaoMarcar, marcando] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoMarcarNaoContatar(
        estadoInicialFicha,
        formulario,
      );
      if (resultado.sucesso) definirAberto(false);
      return resultado;
    },
    estadoInicialFicha,
  );
  const [, acaoDesmarcar, desmarcando] = useActionState(
    acaoDesmarcarNaoContatar,
    estadoInicialFicha,
  );

  if (naoContatar) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Selo variante="aviso" icone={<BellOff aria-hidden="true" />}>
          Não contatar
        </Selo>
        {podeEditar ? (
          <form action={acaoDesmarcar}>
            <input type="hidden" name="familiaId" value={familiaId} />
            <Botao
              type="submit"
              variante="fantasma"
              tamanho="compacto"
              carregando={desmarcando}
              rotuloCarregando="Salvando"
            >
              Voltar a poder contatar
            </Botao>
          </form>
        ) : null}
      </div>
    );
  }

  if (!podeEditar) return null;

  return (
    <Dialogo open={aberto} onOpenChange={definirAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="fantasma"
          tamanho="compacto"
          iconeEsquerda={<BellOff aria-hidden="true" className="size-4" />}
        >
          Marcar não contatar
        </Botao>
      </DialogoGatilho>
      <DialogoConteudo
        titulo="Marcar não contatar"
        descricao="A família para de receber qualquer mensagem ativa, com o motivo registrado."
        rotuloFechar="Fechar sem marcar"
      >
        <form action={acaoMarcar} className="flex flex-col gap-4">
          <input type="hidden" name="familiaId" value={familiaId} />
          <CampoTexto
            rotulo="Motivo"
            name="motivo"
            multilinha
            linhas={3}
            placeholder="Por que esta família não deve ser mais contatada"
            required
          />
          {estadoMarcar.erro ? (
            <FaixaAlerta variante="imediato" titulo={estadoMarcar.erro} />
          ) : null}
          <DialogoRodape>
            <DialogoFechar asChild>
              <Botao variante="secundario">Cancelar</Botao>
            </DialogoFechar>
            <Botao
              type="submit"
              carregando={marcando}
              rotuloCarregando="Salvando"
            >
              Marcar não contatar
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
