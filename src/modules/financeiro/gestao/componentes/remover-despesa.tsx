"use client";

import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { acaoRemoverDespesa } from "../acoes";
import { estadoInicialGestao } from "../estado-acoes";
import { useAcaoGestao } from "../use-acao";

/**
 * Tirar uma despesa do DRE. Pede o motivo (pelo menos 10 letras) e não apaga a
 * linha: o registro, o motivo e quem removeu ficam guardados.
 */
export function RemoverDespesa({
  despesaId,
  descricao,
}: {
  despesaId: string;
  descricao: string;
}) {
  const { estado, enviar, pendente } = useAcaoGestao(
    acaoRemoverDespesa,
    estadoInicialGestao,
  );
  return (
    <details className="group">
      <summary
        className="text-apoio text-texto min-h-toque inline-flex cursor-pointer list-none items-center font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden"
        aria-label={`Remover a despesa ${descricao}`}
      >
        Remover
      </summary>
      <form
        onSubmit={enviar}
        className="mt-2 flex max-w-[420px] flex-col gap-3"
        noValidate
      >
        <input type="hidden" name="despesaId" value={despesaId} />
        <CampoTexto
          rotulo="Motivo da remoção"
          name="motivo"
          required
          maxLength={300}
          descricao="Fica registrado junto de quem removeu. A despesa sai do DRE, mas o registro continua guardado."
          erro={estado.campos?.motivo}
        />
        {estado.erro ? (
          <p role="alert" className="text-apoio text-alerta font-medium">
            {estado.erro}
          </p>
        ) : null}
        {estado.sucesso ? (
          <p role="status" className="text-apoio text-sucesso font-medium">
            {estado.sucesso}
          </p>
        ) : null}
        <Botao
          type="submit"
          variante="secundario"
          tamanho="compacto"
          carregando={pendente}
          rotuloCarregando="Removendo"
          className="self-start"
        >
          Remover do DRE
        </Botao>
      </form>
    </details>
  );
}
