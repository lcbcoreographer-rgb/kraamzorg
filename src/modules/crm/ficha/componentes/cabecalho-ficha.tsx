"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AvisoEfemero } from "@/components/ui/aviso-efemero";
import { BotaoFreio } from "@/components/ui/botao-freio";
import {
  CabecalhoFamilia,
  type DataChaveFamilia,
} from "@/components/ui/cabecalho-familia";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarDataHora } from "@/lib/formatacao";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import {
  acaoAcionarFreio,
  acaoDesfazerFreio,
  estadoInicialFicha,
} from "../acoes";
import { FaixaJustificarFreio } from "./faixa-justificar-freio";
import { FolhaReverterFreio } from "./folha-reverter-freio";

function textoFreioAtivo(estado: EstadoSensivel, em: string | null): string {
  const quando = em ? formatarDataHora(em) : null;
  const desde = quando ? ` desde ${quando}` : "";
  if (estado === "atencao") {
    return `Freio em atenção${desde}. Réguas de conteúdo e marketing pausadas; o contato operacional continua.`;
  }
  if (estado === "encerrado_sensivel") {
    return `Encerrado sensível${desde}. Fora de pesquisa, indicação e remarketing, para sempre.`;
  }
  return `Freio em bloqueio total${desde}. Só contato humano e pelo nome.`;
}

export interface CabecalhoFichaProps {
  familiaId: string;
  nome: string;
  meta: React.ReactNode;
  datas: DataChaveFamilia[];
  estadoSensivelInicial: EstadoSensivel;
  estadoSensivelEmInicial: string | null;
  /** Papel de coordenação ou diretoria: pode abrir a folha de reversão. */
  podeReverter: boolean;
  /** `parametro.freio_desfazer_segundos` (0 = sem "Desfazer"). */
  freioDesfazerSegundos: number;
}

/**
 * Cabeçalho da família com o freio em um toque (P16 item 2; DESIGN.md,
 * seção 6, `familia-cab`). O `CabecalhoFamilia` e o `BotaoFreio` já existem
 * na fundação (`src/components/ui`); este componente só liga os dois às
 * ações do módulo (acionar, desfazer, reverter) e ao aviso efêmero.
 */
export function CabecalhoFicha({
  familiaId,
  nome,
  meta,
  datas,
  estadoSensivelInicial,
  estadoSensivelEmInicial,
  podeReverter,
  freioDesfazerSegundos,
}: CabecalhoFichaProps) {
  const router = useRouter();
  const formDesfazerRef = React.useRef<HTMLFormElement>(null);
  const [avisoAberto, definirAvisoAberto] = React.useState(false);
  const [avisoTexto, definirAvisoTexto] = React.useState<React.ReactNode>(null);
  const [podeDesfazer, definirPodeDesfazer] = React.useState(false);
  const [reverterAberto, definirReverterAberto] = React.useState(false);

  const freioAtivo = estadoSensivelInicial !== "normal";

  const [estadoAcionar, acaoAcionar] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoAcionarFreio(estadoInicialFicha, formulario);
      if (!resultado.erro) {
        definirAvisoTexto(
          `Freio acionado. Nenhuma mensagem automática sai para ${nome}.`,
        );
        definirPodeDesfazer(freioDesfazerSegundos > 0);
        definirAvisoAberto(true);
        router.refresh();
      }
      return resultado;
    },
    estadoInicialFicha,
  );

  const [, acaoDesfazer] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoDesfazerFreio(estadoInicialFicha, formulario);
      if (!resultado.erro) {
        definirAvisoAberto(false);
        router.refresh();
      }
      return resultado;
    },
    estadoInicialFicha,
  );

  return (
    <div className="flex flex-col gap-3">
      <CabecalhoFamilia
        nome={nome}
        meta={meta}
        datas={datas}
        nivelTitulo="h1"
        sangrar
        freioAtivo={freioAtivo}
        textoFreioAtivo={
          freioAtivo
            ? textoFreioAtivo(estadoSensivelInicial, estadoSensivelEmInicial)
            : undefined
        }
        rotuloFreioAtivo="Freio ativo"
        acaoFreioAtivo={
          podeReverter ? () => definirReverterAberto(true) : undefined
        }
        acaoFreio={
          <form action={acaoAcionar}>
            <input type="hidden" name="familiaId" value={familiaId} />
            <BotaoFreio
              type="submit"
              aria-label={`Freio: pausa na hora todas as mensagens automáticas para ${nome}`}
            >
              Freio
            </BotaoFreio>
          </form>
        }
      />

      {estadoAcionar.erro ? (
        <FaixaAlerta variante="imediato" titulo={estadoAcionar.erro} />
      ) : null}

      {freioAtivo ? <FaixaJustificarFreio familiaId={familiaId} /> : null}

      <form ref={formDesfazerRef} action={acaoDesfazer} hidden>
        <input type="hidden" name="familiaId" value={familiaId} />
      </form>
      <AvisoEfemero
        aberto={avisoAberto}
        aoFechar={() => definirAvisoAberto(false)}
        texto={avisoTexto}
        duracaoSegundos={podeDesfazer ? freioDesfazerSegundos : 6}
        rotuloAcao={podeDesfazer ? "Desfazer" : undefined}
        aoAcionarAcao={
          podeDesfazer
            ? () => formDesfazerRef.current?.requestSubmit()
            : undefined
        }
      />

      {podeReverter ? (
        <FolhaReverterFreio
          familiaId={familiaId}
          nome={nome}
          estadoAtual={estadoSensivelInicial}
          aberto={reverterAberto}
          aoFechar={() => definirReverterAberto(false)}
          aoSalvar={({ texto }) => {
            definirAvisoTexto(texto);
            definirPodeDesfazer(false);
            definirAvisoAberto(true);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
