"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { NumeroPipeline } from "@/lib/dados/tipos";
import { acaoTransicionar } from "../acoes";
import { estadoInicialPipeline } from "../estado-acoes";

/**
 * Folha "Sair de intercorrência" (PRD 7.2, 0006_maquinas_estado.sql seção
 * 3.4): sair de `intercorrencia` só volta ao estágio anterior e exige
 * motivo, decisão da coordenação. Sem isso o banco recusa a transição
 * (22023) com uma mensagem genérica; esta folha coleta o motivo antes de
 * chamar `api.transicionar`, para o mesmo passo que o menu "Mover para"
 * já oferece não falhar por engano.
 */
export function FolhaSaidaIntercorrencia({
  aberta,
  aoFechar,
  oportunidadeId,
  pipeline,
  destinoEstagio,
  destinoRotulo,
  nomeFamilia,
}: {
  aberta: boolean;
  aoFechar: () => void;
  oportunidadeId: string;
  pipeline: NumeroPipeline;
  destinoEstagio: string;
  destinoRotulo: string;
  nomeFamilia: string;
}) {
  const [estado, acao, enviando] = useActionState(
    async (_anterior: typeof estadoInicialPipeline, formulario: FormData) => {
      const resultado = await acaoTransicionar(
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
        titulo={`Sair de intercorrência para ${destinoRotulo}`}
        descricao={`Decisão da coordenação (PRD 7.2). Escreva o motivo antes de voltar a ${nomeFamilia} para ${destinoRotulo}.`}
        rotuloFechar="Fechar sem sair da intercorrência"
      >
        <form action={acao} className="flex flex-col gap-6">
          <input type="hidden" name="oportunidadeId" value={oportunidadeId} />
          <input type="hidden" name="pipeline" value={pipeline} />
          <input type="hidden" name="para" value={destinoEstagio} />
          <CampoTexto
            rotulo="Motivo da saída"
            name="motivo"
            required
            multilinha
            linhas={3}
            descricao="Fica registrado na linha do tempo e na auditoria."
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
              rotuloCarregando="Confirmando"
            >
              Confirmar saída
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
