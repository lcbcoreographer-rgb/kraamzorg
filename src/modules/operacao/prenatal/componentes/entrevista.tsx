"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FormularioInstrumento,
  type SugestaoCampo,
} from "@/components/instrumentos";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { ProgressoEntrevista } from "@/lib/dados/tipos-operacao";
import { formatarData, formatarTelefone } from "@/lib/formatacao";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import type { RespostasFormulario } from "@/lib/instrumentos/respostas";
import { bancoOffline } from "@/lib/sync/db";
import { enviarLoteDoApp } from "@/lib/sync/enviar-app";
import { iniciarMotorSincronizacao } from "@/lib/sync/motor";
import {
  aguardarFilaVazia,
  criarPersistenciaPrenatal,
  lerRascunhosPrenatal,
  sobreporRascunhos,
  type PersistenciaPrenatal,
} from "@/lib/sync/persistencia-prenatal";
import { acaoConcluirEntrevista } from "../acoes";
import { PLANO_ENTREVISTA_PRENATAL, pontoDeRetomada } from "../plano-etapas";

/**
 * Entrevista pré-natal (DOC 1) na tela (P35 itens 2 e 3, fluxo B). Cada
 * resposta grava no aparelho e sobe pelo motor offline (P12); sair no meio e
 * voltar reabre na etapa e no campo onde a pessoa parou, mesmo em outro
 * aparelho (o servidor guarda a marca) e mesmo sem sinal (o aparelho
 * guarda o que ainda não subiu). Toda entrevista começa em branco: não
 * existe duplicar de outra família.
 */
export interface EntrevistaProps {
  usuarioId: string;
  familiaId: string;
  consultaId: string;
  /** Versão de conflito que o servidor devolveu ao abrir. */
  versao: number;
  definicao: DefinicaoInstrumento;
  respostasServidor: RespostasFormulario;
  progresso: ProgressoEntrevista | null;
  /** "bloco.campo" para o valor do cadastro da mesma família. */
  sugestoes: Record<string, string>;
  coletador: string | null;
  /** Idade gestacional calculada da DPP, "34s2d". */
  idadeGestacional: string | null;
  lateral: React.ReactNode;
}

interface Pronto {
  respostas: RespostasFormulario;
  etapaInicial: number;
  campoInicial: { bloco: string; campo: string } | undefined;
  persistencia: PersistenciaPrenatal;
}

function comoSugestao(
  chave: string,
  valor: string,
): SugestaoCampo & { exibicao: string } {
  if (chave.endsWith("data_provavel_do_parto")) {
    return { valor, exibicao: formatarData(valor) ?? valor };
  }
  if (chave.endsWith("telefone_da_gestante")) {
    return { valor, exibicao: formatarTelefone(valor) };
  }
  return { valor, exibicao: valor };
}

export function Entrevista({
  usuarioId,
  familiaId,
  consultaId,
  versao,
  definicao,
  respostasServidor,
  progresso,
  sugestoes,
  coletador,
  idadeGestacional,
  lateral,
}: EntrevistaProps) {
  const roteador = useRouter();
  const etapaRef = React.useRef(1);
  const [pronto, definirPronto] = React.useState<Pronto | null>(null);
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [concluindo, definirConcluindo] = React.useState(false);

  React.useEffect(() => {
    const db = bancoOffline();
    let cancelado = false;
    const persistencia = criarPersistenciaPrenatal({
      db,
      usuarioId,
      consultaId,
      versaoInicial: versao,
      enviar: enviarLoteDoApp,
      etapaAtual: () => etapaRef.current,
    });

    void (async () => {
      let locais: Awaited<ReturnType<typeof lerRascunhosPrenatal>> | null =
        null;
      try {
        locais = await lerRascunhosPrenatal(db, consultaId);
      } catch {
        locais = null; // sem IndexedDB (navegação privativa): vale o do servidor
      }
      if (cancelado) return;
      // a marca do aparelho, se ainda não subiu, é mais nova que a do servidor
      const marca = locais?.progresso ?? progresso;
      const ponto = pontoDeRetomada(marca);
      etapaRef.current = ponto.etapaInicial + 1;
      definirPronto({
        respostas: locais
          ? sobreporRascunhos(respostasServidor, locais.respostas)
          : respostasServidor,
        etapaInicial: ponto.etapaInicial,
        campoInicial: ponto.campoInicial,
        persistencia,
      });
    })();

    const parar = iniciarMotorSincronizacao(db, { enviar: enviarLoteDoApp });
    return () => {
      cancelado = true;
      parar();
    };
    // props de leitura: a entrevista monta uma vez por consulta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId, usuarioId]);

  const sugestoesDoFormulario = React.useMemo(() => {
    const mapa: Record<string, SugestaoCampo> = {};
    for (const [chave, valor] of Object.entries(sugestoes)) {
      mapa[chave] = comoSugestao(chave, valor);
    }
    return mapa;
  }, [sugestoes]);

  const automaticos = React.useMemo(() => {
    const mapa: Record<string, string> = {};
    if (idadeGestacional) mapa["B.idade_gestacional_atual"] = idadeGestacional;
    if (coletador) mapa["B.coletador"] = coletador;
    return mapa;
  }, [idadeGestacional, coletador]);

  async function concluir() {
    if (!pronto || concluindo) return;
    definirConcluindo(true);
    definirAviso(null);
    try {
      // tudo no servidor antes de concluir: depois, resposta nova exige motivo
      const subiu = await aguardarFilaVazia(
        bancoOffline(),
        consultaId,
        enviarLoteDoApp,
      );
      if (!subiu) {
        definirAviso(
          "Sem sinal agora. As respostas estão salvas no aparelho e sobem sozinhas quando a conexão voltar. Conclua a entrevista depois disso.",
        );
        return;
      }
      const resultado = await acaoConcluirEntrevista(consultaId, familiaId);
      if (resultado.erro) {
        definirAviso(resultado.erro);
        return;
      }
      roteador.refresh();
    } finally {
      definirConcluindo(false);
    }
  }

  if (!pronto) {
    return (
      <p className="text-corpo text-texto-2 py-6" role="status">
        Abrindo a entrevista.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso ? <FaixaAlerta variante="erro" titulo={aviso} /> : null}
      <FormularioInstrumento
        definicao={definicao}
        persistencia={pronto.persistencia}
        respostasIniciais={pronto.respostas}
        etapaInicial={pronto.etapaInicial}
        campoInicial={pronto.campoInicial}
        plano={PLANO_ENTREVISTA_PRENATAL}
        sugestoes={sugestoesDoFormulario}
        valoresAutomaticos={automaticos}
        listaDeEtapas
        lateral={lateral}
        rotuloConcluir={concluindo ? "Concluindo" : "Concluir entrevista"}
        aoMudarEtapa={(indice) => {
          etapaRef.current = indice + 1;
          pronto.persistencia.registrarEtapa(indice + 1);
        }}
        aoConcluir={() => {
          void concluir();
        }}
      />
    </div>
  );
}
