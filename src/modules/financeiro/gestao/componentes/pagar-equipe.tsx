"use client";

import { CircleCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { acaoPagarEquipe } from "../acoes";
import { estadoInicialGestao } from "../estado-acoes";
import { useAcaoGestao } from "../use-acao";

/** Registrar o pagamento de uma profissional cujo pagamento está liberado. */
export function PagarEquipe({
  pagamentoId,
  profissionalNome,
  hoje,
}: {
  pagamentoId: string;
  profissionalNome: string;
  hoje: string;
}) {
  const { estado, enviar, pendente } = useAcaoGestao(
    acaoPagarEquipe,
    estadoInicialGestao,
  );
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="pagamentoId" value={pagamentoId} />
      <div className="flex flex-wrap items-end gap-3">
        <CampoTexto
          rotulo="Dia do pagamento"
          name="data"
          type="date"
          max={hoje}
          defaultValue={hoje}
          erro={estado.campos?.data}
          containerClassName="w-48"
        />
        <Botao
          type="submit"
          carregando={pendente}
          rotuloCarregando="Registrando"
          aria-label={`Registrar o pagamento de ${profissionalNome}`}
        >
          Registrar pagamento
        </Botao>
      </div>
      {estado.erro ? (
        <p role="alert" className="text-apoio text-alerta font-medium">
          {estado.erro}
        </p>
      ) : null}
      {estado.sucesso ? (
        <p
          role="status"
          className="text-apoio text-sucesso flex items-start gap-2 font-medium"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {estado.sucesso}
        </p>
      ) : null}
    </form>
  );
}
