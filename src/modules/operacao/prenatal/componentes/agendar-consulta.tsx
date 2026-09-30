"use client";

import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { estadoInicialOperacao } from "../../comum/estado-acoes";
import { useAcao } from "../../comum/use-acao";
import { acaoAgendarConsulta } from "../acoes";

/**
 * Marcar ou remarcar a consulta pré-natal (P35 itens 1 e 5). Dia e hora nos
 * seletores nativos do aparelho, horário de Brasília. Marcar leva o P2 a
 * "Consulta pré-natal agendada" e conclui a tarefa de agendar.
 */
export function AgendarConsulta({
  familiaId,
  remarcar,
  hoje,
}: {
  familiaId: string;
  remarcar: boolean;
  /** "aaaa-mm-dd" em Brasília: nada antes de hoje. */
  hoje: string;
}) {
  const {
    estado,
    enviar: acao,
    pendente: enviando,
  } = useAcao(acaoAgendarConsulta, estadoInicialOperacao);
  const campos = estado.campos ?? {};

  return (
    <form onSubmit={acao} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="familiaId" value={familiaId} />
      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-4">
        <CampoTexto
          rotulo="Dia da consulta"
          name="data"
          type="date"
          min={hoje}
          required
          erro={campos.data}
        />
        <CampoTexto
          rotulo="Horário"
          name="hora"
          type="time"
          step={300}
          required
          erro={campos.hora}
          descricao="Horário de Brasília."
        />
      </div>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
      ) : null}
      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando={remarcar ? "Remarcando" : "Marcando"}
        largaTotal
        className="tablet:w-auto self-start"
      >
        {remarcar ? "Remarcar a consulta" : "Marcar a consulta"}
      </Botao>
    </form>
  );
}
