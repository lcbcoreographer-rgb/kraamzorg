"use client";

import { FileSpreadsheet } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoImportarExtrato, acaoReconciliarExtrato } from "../acoes";
import { estadoInicialGestao } from "../estado-acoes";
import { useAcaoGestao } from "../use-acao";

/**
 * Importar o arquivo do extrato do banco (OFX ou CSV). O arquivo é lido no
 * servidor: o sistema guarda só as linhas (data, valor e descrição) e a
 * assinatura do arquivo, para importar o mesmo arquivo duas vezes não duplicar
 * nada. A conferência nunca dá baixa em cobrança.
 */
export function ImportarExtrato() {
  const { estado, enviar, pendente } = useAcaoGestao(
    acaoImportarExtrato,
    estadoInicialGestao,
  );
  const erroArquivo = estado.campos?.arquivo;
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="extrato-arquivo"
          className="text-apoio text-texto flex items-center gap-2 font-semibold"
        >
          <FileSpreadsheet
            className="size-4"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          Arquivo do extrato (OFX ou CSV)
        </label>
        <input
          id="extrato-arquivo"
          name="arquivo"
          type="file"
          accept=".ofx,.csv,text/csv,application/x-ofx"
          required
          aria-invalid={erroArquivo ? true : undefined}
          aria-describedby="extrato-arquivo-ajuda"
          className="text-corpo text-texto file:bg-marinho file:text-texto-inverso rounded-2 border-borda-campo bg-superficie min-h-toque-campo w-full border-[1.5px] file:mr-4 file:h-full file:cursor-pointer file:border-0 file:px-4 file:font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <p
          id="extrato-arquivo-ajuda"
          className="text-mini text-texto-2 max-w-[62ch]"
        >
          O arquivo é lido no servidor e não fica guardado: ficam só as linhas e
          a assinatura dele, para o mesmo arquivo não entrar duas vezes. O
          extrato serve para conferir. Ele nunca dá baixa em cobrança.
        </p>
        {erroArquivo ? (
          <p role="alert" className="text-apoio text-alerta font-medium">
            {erroArquivo}
          </p>
        ) : null}
      </div>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      <Botao
        type="submit"
        carregando={pendente}
        rotuloCarregando="Importando"
        className="self-start"
      >
        Importar e conferir
      </Botao>
    </form>
  );
}

/** Refazer a conferência das linhas ainda sem par, depois de uma baixa manual. */
export function ReconferirExtrato({ importacaoId }: { importacaoId: string }) {
  const { estado, enviar, pendente } = useAcaoGestao(
    acaoReconciliarExtrato,
    estadoInicialGestao,
  );
  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="importacaoId" value={importacaoId} />
      <Botao
        type="submit"
        variante="secundario"
        tamanho="compacto"
        carregando={pendente}
        rotuloCarregando="Conferindo"
        className="self-start"
      >
        Conferir de novo
      </Botao>
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
    </form>
  );
}
