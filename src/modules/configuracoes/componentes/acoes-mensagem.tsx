"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import {
  aprovarMensagemAction,
  arquivarMensagemAction,
  type EstadoFormulario,
} from "../acoes/mensagens";

const inicial: EstadoFormulario = {};

export function AcoesMensagem({
  chave,
  status,
}: {
  chave: string;
  status: string;
}) {
  const [estadoAprovar, acaoAprovar, aprovando] = useActionState(
    aprovarMensagemAction,
    inicial,
  );
  const [estadoArquivar, acaoArquivar, arquivando] = useActionState(
    arquivarMensagemAction,
    inicial,
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {status === "rascunho" ? (
          <form action={acaoAprovar}>
            <input type="hidden" name="chave" value={chave} />
            <Botao
              type="submit"
              variante="secundario"
              tamanho="compacto"
              carregando={aprovando}
            >
              Aprovar
            </Botao>
          </form>
        ) : null}
        {status !== "arquivado" ? (
          <form action={acaoArquivar}>
            <input type="hidden" name="chave" value={chave} />
            <Botao
              type="submit"
              variante="fantasma"
              tamanho="compacto"
              carregando={arquivando}
            >
              Arquivar
            </Botao>
          </form>
        ) : null}
      </div>
      {estadoAprovar.erro ? (
        <p role="alert" className="text-apoio text-alerta">
          {estadoAprovar.erro}
        </p>
      ) : null}
      {estadoArquivar.erro ? (
        <p role="alert" className="text-apoio text-alerta">
          {estadoArquivar.erro}
        </p>
      ) : null}
    </div>
  );
}
