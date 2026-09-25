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
import { acaoAcionarFreio, acaoDesfazerFreio } from "../acoes";
import { estadoInicialFicha } from "../estado-acoes";
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
  /**
   * Reserva para o prazo do "Desfazer" quando a resposta do acionamento
   * não traz `desfazer_ate`. O normal é vir da resposta do banco, porque
   * só a diretoria lê `parametro`.
   */
  freioDesfazerSegundos?: number;
  /**
   * Quem está na tela tem a tarefa "Justificar o freio" aberta
   * (`temJustificativaPendente`). Opcional porque outras telas da família
   * (a conversa, P27) usam este cabeçalho sem ler tarefas: sem a prop, a
   * faixa aparece logo depois do toque de quem acionou, nesta visita.
   */
  justificativaPendente?: boolean;
  /** Vencimento da tarefa de justificativa, para o prazo na faixa (P2 item 13). */
  justificativaVenceEm?: string | null;
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
  freioDesfazerSegundos = 0,
  justificativaPendente = false,
  justificativaVenceEm = null,
}: CabecalhoFichaProps) {
  const router = useRouter();
  const formDesfazerRef = React.useRef<HTMLFormElement>(null);
  const [avisoAberto, definirAvisoAberto] = React.useState(false);
  const [avisoTexto, definirAvisoTexto] = React.useState<React.ReactNode>(null);
  // Segundos do "Desfazer" deste acionamento (0 = sem "Desfazer"). Vem da
  // resposta do banco (`desfazer_ate`); a prop é só o valor de reserva.
  const [prazoDesfazer, definirPrazoDesfazer] = React.useState(0);
  const podeDesfazer = prazoDesfazer > 0;
  const [reverterAberto, definirReverterAberto] = React.useState(false);
  // Quem acabou de acionar tem a tarefa de justificativa (PRD 8.3), mesmo
  // numa tela que não lê tarefas.
  const [acionouAgora, definirAcionouAgora] = React.useState(false);

  const freioAtivo = estadoSensivelInicial !== "normal";
  // Estável entre renderizações: o AvisoEfemero reinicia o temporizador
  // quando esta função muda, e o router.refresh() re-renderiza a ficha
  // logo depois do toque (o "Desfazer" não pode durar mais que o prazo).
  const fecharAviso = React.useCallback(() => definirAvisoAberto(false), []);

  const [estadoAcionar, acaoAcionar, acionando] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoAcionarFreio(estadoInicialFicha, formulario);
      if (!resultado.erro) {
        definirAvisoTexto(
          `Freio acionado. Nenhuma mensagem automática sai para ${nome}.`,
        );
        definirPrazoDesfazer(
          resultado.desfazerSegundos ?? freioDesfazerSegundos,
        );
        definirAcionouAgora(true);
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
        definirAcionouAgora(false);
        router.refresh();
      } else {
        definirAvisoTexto(resultado.erro);
        definirPrazoDesfazer(0);
        definirAvisoAberto(true);
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
              aria-busy={acionando || undefined}
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

      {freioAtivo ? (
        <FaixaJustificarFreio
          familiaId={familiaId}
          pendente={justificativaPendente || acionouAgora}
          venceEm={justificativaVenceEm}
        />
      ) : null}

      <form ref={formDesfazerRef} action={acaoDesfazer} hidden>
        <input type="hidden" name="familiaId" value={familiaId} />
      </form>
      <AvisoEfemero
        aberto={avisoAberto}
        aoFechar={fecharAviso}
        texto={avisoTexto}
        duracaoSegundos={podeDesfazer ? prazoDesfazer : 6}
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
            definirPrazoDesfazer(0);
            definirAvisoAberto(true);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
