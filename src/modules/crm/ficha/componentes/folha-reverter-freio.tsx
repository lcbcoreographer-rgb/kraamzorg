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
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { acaoReverterFreio } from "../acoes";
import { estadoInicialFicha } from "../estado-acoes";
import { EFEITO_ESTADO_SENSIVEL, ROTULO_ESTADO_SENSIVEL } from "../rotulos";

const ESTADOS: EstadoSensivel[] = [
  "normal",
  "atencao",
  "bloqueio_total",
  "encerrado_sensivel",
];

/**
 * Folha "Reverter ou ajustar o freio" (telas.md K7, PRD 8.3): só coordenação
 * ou diretoria, justificativa obrigatória. Mostra os outros estados (o
 * atual não é uma mudança) com o efeito de cada um em uma frase; a ação
 * escolhe entre descer (`api.reverter_freio`) e subir (`api.acionar_freio`),
 * e o banco é quem barra de verdade quem não tem o papel ou o AAL2.
 */
export function FolhaReverterFreio({
  familiaId,
  nome,
  estadoAtual,
  aberto,
  aoFechar,
  aoSalvar,
}: {
  familiaId: string;
  nome: string;
  estadoAtual: EstadoSensivel;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (resultado: { texto: string }) => void;
}) {
  const opcoes = ESTADOS.filter((valor) => valor !== estadoAtual);
  const [estado, acao, enviando] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoReverterFreio(estadoInicialFicha, formulario);
      if (resultado.sucesso) {
        const estadoEscolhido = formulario.get("estado");
        aoSalvar({
          texto: `${ROTULO_ESTADO_SENSIVEL[estadoEscolhido as EstadoSensivel]}: salvo agora.`,
        });
        aoFechar();
      }
      return resultado;
    },
    estadoInicialFicha,
  );

  return (
    <Dialogo
      open={aberto}
      onOpenChange={(valor) => {
        if (!valor) aoFechar();
      }}
    >
      <DialogoConteudo
        titulo="Reverter ou ajustar o freio"
        descricao={`${nome}. Registrado com seu nome e a hora.`}
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="flex flex-col gap-4">
          <input type="hidden" name="familiaId" value={familiaId} />
          <p className="text-apoio text-texto-2">
            Agora: {ROTULO_ESTADO_SENSIVEL[estadoAtual].toLowerCase()}.
          </p>
          <EscolhaUnica
            rotulo="O que fazer com o freio"
            name="estado"
            valorPadrao={opcoes[0]}
            opcoes={opcoes.map((valor) => ({
              valor,
              rotulo: ROTULO_ESTADO_SENSIVEL[valor],
            }))}
          />
          <p className="text-apoio text-texto-2">
            {opcoes.map((valor) => (
              <span key={valor} className="mr-3 block">
                <strong className="text-texto font-semibold">
                  {ROTULO_ESTADO_SENSIVEL[valor]}:
                </strong>{" "}
                {EFEITO_ESTADO_SENSIVEL[valor]}
              </span>
            ))}
          </p>
          <CampoTexto
            rotulo="Justificativa"
            name="justificativa"
            multilinha
            placeholder="Explique o motivo da decisão"
            required
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
              variante="sensivel"
              carregando={enviando}
              rotuloCarregando="Salvando"
            >
              Salvar decisão
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
