"use client";

import { useActionState, useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarData } from "@/lib/formatacao";
import { acaoReagendarCascata, verificarCascata } from "../acoes";
import {
  estadoInicialEquipe,
  type ResultadoVerificacaoCascata,
} from "../estado-acoes";
import { fraseConflito } from "../textos";

/**
 * Reagendamento em cascata (P37 item 4): quando o nascimento ou a alta
 * mudam, todas as visitas que ainda não começaram andam o mesmo número de
 * dias, com o mesmo horário e a mesma enfermeira (logo o mesmo período). A
 * tela mostra o resultado, dia por dia, com os conflitos, antes de salvar.
 */
export function PainelCascata({
  acompanhamentoId,
  primeiraDataPendente,
  hoje,
}: {
  acompanhamentoId: string;
  primeiraDataPendente: string;
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoReagendarCascata,
    estadoInicialEquipe,
  );
  const [novaData, definirNovaData] = useState(primeiraDataPendente);
  const [motivo, definirMotivo] = useState("");
  const [confirmou, definirConfirmou] = useState(false);
  const [resultado, definirResultado] =
    useState<ResultadoVerificacaoCascata | null>(null);
  const campos = estado.campos ?? {};

  useEffect(() => {
    let ativo = true;
    const espera = setTimeout(async () => {
      if (!novaData) {
        definirResultado(null);
        return;
      }
      const r = await verificarCascata({
        acompanhamentoId,
        novaDataInicio: novaData,
      });
      if (ativo) definirResultado(r);
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [acompanhamentoId, novaData]);

  const ok = resultado?.ok === true ? resultado : null;
  const comConflito = (ok?.conflitosTotal ?? 0) > 0;
  const mudou = novaData !== primeiraDataPendente;
  const podeSalvar =
    mudou &&
    ok !== null &&
    motivo.trim().length > 0 &&
    (!comConflito || confirmou);

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="acompanhamentoId" value={acompanhamentoId} />
      <input
        type="hidden"
        name="confirmarConflito"
        value={comConflito && confirmou ? "sim" : "nao"}
      />

      <CampoTexto
        rotulo="Novo primeiro dia das visitas que faltam"
        name="novaDataInicio"
        type="date"
        min={hoje}
        value={novaData}
        onChange={(e) => definirNovaData(e.target.value)}
        required
        erro={campos.novaDataInicio}
        descricao="As outras visitas andam o mesmo número de dias. O horário e a enfermeira ficam."
      />

      <div aria-live="polite" className="flex flex-col gap-3">
        {resultado && !resultado.ok ? (
          <FaixaAlerta variante="erro" titulo={resultado.erro} />
        ) : null}
        {ok ? (
          <div className="flex flex-col gap-3">
            <p className="text-corpo text-texto-2">
              {ok.deslocamentoDias === 0
                ? "Nenhuma visita muda de dia."
                : ok.deslocamentoDias > 0
                  ? `As visitas andam ${ok.deslocamentoDias} ${ok.deslocamentoDias === 1 ? "dia" : "dias"} para frente.`
                  : `As visitas voltam ${-ok.deslocamentoDias} ${ok.deslocamentoDias === -1 ? "dia" : "dias"}.`}
            </p>
            <ol
              aria-label="Como ficam as visitas"
              className="flex flex-col gap-2"
            >
              {ok.visitas.map((v) => (
                <li
                  key={v.visitaId}
                  className="rounded-2 bg-lavanda-clara flex flex-col gap-1 px-4 py-3"
                  data-conflito={v.conflitos.length > 0 ? "sim" : undefined}
                >
                  <p className="text-corpo text-texto flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono font-semibold">
                      D{v.diaNumero}
                    </span>
                    {/* Data igual à de hoje: só a data, sem "de 30/09 para
                        30/09", que obrigava a ler seis linhas para saber
                        que nada muda. */}
                    {v.de !== v.para ? (
                      <>
                        <span className="text-texto-2 font-mono">
                          {formatarData(v.de)}
                        </span>
                        <span aria-hidden="true">para</span>
                        <span className="sr-only">passa para</span>
                      </>
                    ) : null}
                    <span className="font-mono font-semibold">
                      {formatarData(v.para)}
                    </span>
                    {v.horaPrevista ? (
                      <span className="text-texto-2 font-mono">
                        às {v.horaPrevista}
                      </span>
                    ) : null}
                  </p>
                  {v.conflitos.map((c, i) => (
                    <p
                      key={`${c.codigo}-${i}`}
                      className="text-apoio text-aviso-texto"
                    >
                      {fraseConflito(c)}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
            {comConflito ? (
              <FaixaAlerta
                variante="prioritario"
                titulo="Há conflito em alguma visita"
              >
                Nada é salvo pela metade: ou todas as visitas andam, ou nenhuma.
                Confirme abaixo para salvar mesmo assim.
              </FaixaAlerta>
            ) : null}
          </div>
        ) : null}
      </div>

      <CampoTexto
        rotulo="O que mudou"
        name="motivo"
        value={motivo}
        onChange={(e) => definirMotivo(e.target.value)}
        multilinha
        linhas={3}
        required
        erro={campos.motivo}
        descricao="Por exemplo: nascimento antecipado ou alta registrada. Fica na linha do tempo da família."
      />

      {comConflito ? (
        <label className="text-corpo text-texto min-h-toque flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={confirmou}
            onChange={(e) => definirConfirmou(e.target.checked)}
            className="accent-marinho size-5"
          />
          Quero salvar mesmo com o conflito
        </label>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}

      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Reagendando"
        disabled={!podeSalvar}
        className="self-start"
      >
        Reagendar as visitas
      </Botao>
    </form>
  );
}
