"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { ConflitoAgenda } from "@/lib/dados/tipos-equipe";
import { acaoReagendarVisita, verificarReagendamentoVisita } from "../acoes";
import {
  estadoInicialEquipe,
  type ResultadoVerificacaoVisita,
} from "../estado-acoes";
import { fraseConflito } from "../textos";

/**
 * Reagendar uma visita (P37 itens 3 e 4). A cada mudança de dia, hora ou
 * enfermeira o formulário pergunta ao banco quais conflitos haveria, sem
 * gravar, e mostra os avisos antes de salvar. Sem conflito, salva direto;
 * com conflito, só salva quem confirma e conta o motivo. Deixar a hora em
 * branco mantém o horário (logo o período da família).
 */
export function PainelReagendar({
  visitaId,
  acompanhamentoId,
  dataAtual,
  horaAtual,
  profissionalAtualId,
  profissionais,
  hoje,
}: {
  visitaId: string;
  acompanhamentoId: string;
  dataAtual: string;
  horaAtual: string | null;
  profissionalAtualId: string;
  profissionais: { id: string; nome: string }[];
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoReagendarVisita,
    estadoInicialEquipe,
  );
  const [data, definirData] = useState(dataAtual);
  const [hora, definirHora] = useState(horaAtual ?? "");
  const [profissionalId, definirProfissional] = useState(profissionalAtualId);
  const [confirmou, definirConfirmou] = useState(false);
  const [motivo, definirMotivo] = useState("");
  const [resultado, definirResultado] =
    useState<ResultadoVerificacaoVisita | null>(null);
  const [verificando, definirVerificando] = useState(false);
  const campos = estado.campos ?? {};

  useEffect(() => {
    let ativo = true;
    const espera = setTimeout(async () => {
      if (!data) {
        definirResultado(null);
        return;
      }
      definirVerificando(true);
      const r = await verificarReagendamentoVisita({
        visitaId,
        data,
        hora: hora || null,
        profissionalId:
          profissionalId === profissionalAtualId ? null : profissionalId,
      });
      if (ativo) {
        definirResultado(r);
        definirVerificando(false);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [visitaId, data, hora, profissionalId, profissionalAtualId]);

  const conflitos: ConflitoAgenda[] = resultado?.ok ? resultado.conflitos : [];
  const comConflito = conflitos.length > 0;
  const mudou =
    data !== dataAtual ||
    hora !== (horaAtual ?? "") ||
    profissionalId !== profissionalAtualId;
  const podeSalvar =
    mudou &&
    resultado?.ok === true &&
    (!comConflito || (confirmou && motivo.trim().length > 0));

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="visitaId" value={visitaId} />
      <input
        type="hidden"
        name="confirmarConflito"
        value={comConflito && confirmou ? "sim" : "nao"}
      />

      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-5">
        <CampoTexto
          rotulo="Novo dia"
          name="data"
          type="date"
          min={hoje}
          value={data}
          onChange={(e) => definirData(e.target.value)}
          required
          erro={campos.data}
        />
        <CampoTexto
          rotulo="Horário"
          name="hora"
          type="time"
          step={300}
          value={hora}
          onChange={(e) => definirHora(e.target.value)}
          opcional
          descricao="Em branco mantém o horário e o período da família."
        />
      </div>

      {profissionais.length > 1 ? (
        <>
          <input
            type="hidden"
            name="profissionalId"
            value={profissionalId === profissionalAtualId ? "" : profissionalId}
          />
          <EscolhaUnica
            rotulo="Enfermeira"
            name="profissional-escolha"
            opcoes={profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            valor={profissionalId}
            onMudar={definirProfissional}
            descricao="Outra enfermeira só recebe a visita se já aceitou esta família."
          />
        </>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-3">
        {verificando && !resultado ? (
          <p className="text-apoio text-texto-2">Conferindo a agenda.</p>
        ) : null}
        {resultado && !resultado.ok ? (
          <FaixaAlerta variante="erro" titulo={resultado.erro} />
        ) : null}
        {resultado?.ok && !comConflito ? (
          <FaixaAlerta variante="sucesso" titulo="Sem conflito na agenda">
            {mudou
              ? "Pode salvar."
              : "Escolha um novo dia, horário ou enfermeira."}
          </FaixaAlerta>
        ) : null}
        {resultado?.ok && comConflito ? (
          <FaixaAlerta
            variante="prioritario"
            titulo={
              conflitos.length === 1
                ? "Há um conflito na agenda"
                : `Há ${conflitos.length} conflitos na agenda`
            }
          >
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              {conflitos.map((c, i) => (
                <li key={`${c.codigo}-${i}`}>{fraseConflito(c)}</li>
              ))}
            </ul>
          </FaixaAlerta>
        ) : null}
      </div>

      {comConflito ? (
        <div className="flex flex-col gap-4">
          <label className="text-corpo text-texto min-h-toque flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={confirmou}
              onChange={(e) => definirConfirmou(e.target.checked)}
              className="accent-marinho size-5"
            />
            Quero salvar mesmo com o conflito
          </label>
          {confirmou ? (
            <CampoTexto
              rotulo="Motivo"
              name="motivo"
              value={motivo}
              onChange={(e) => definirMotivo(e.target.value)}
              multilinha
              linhas={3}
              required
              erro={campos.motivo}
              descricao="Fica registrado na linha do tempo da família e no histórico da agenda."
            />
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="motivo" value="" />
      )}

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Botao
          type="submit"
          carregando={enviando}
          rotuloCarregando="Reagendando"
          disabled={!podeSalvar}
        >
          Reagendar a visita
        </Botao>
        <Botao asChild variante="fantasma">
          <Link href={`/agenda/cascata/${acompanhamentoId}`}>
            Mudar todas as visitas da família
          </Link>
        </Botao>
      </div>
    </form>
  );
}
