"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { acaoVincularNovaGestacao, estadoInicialMesclagem } from "../acoes";

/** Vínculo de nova gestação (P17 item 1): um botão só, sem folha de
 * confirmação — não mescla nada, só liga as duas famílias. */
export function VincularNovaGestacao({
  familiaRecenteId,
  familiaAnteriorId,
  familiaAnteriorNome,
}: {
  familiaRecenteId: string;
  familiaAnteriorId: string;
  familiaAnteriorNome: string;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoVincularNovaGestacao,
    estadoInicialMesclagem,
  );

  return (
    <form action={acao} className="flex flex-col items-start gap-1">
      <input type="hidden" name="familiaRecenteId" value={familiaRecenteId} />
      <input type="hidden" name="familiaAnteriorId" value={familiaAnteriorId} />
      <Botao
        type="submit"
        variante="secundario"
        tamanho="compacto"
        carregando={enviando}
      >
        Vincular como nova gestação de {familiaAnteriorNome}
      </Botao>
      {estado.erro ? (
        <p role="alert" className="text-apoio text-alerta">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
