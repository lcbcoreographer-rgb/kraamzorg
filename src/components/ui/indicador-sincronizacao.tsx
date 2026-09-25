import * as React from "react";
import { CloudCheck, CloudUpload, Smartphone, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador de sincronização (DESIGN.md, seção 6; PRD 15). Três estados
 * (rascunho local, enviando, sincronizado) mais o de falha de envio, com
 * nova tentativa. Fica no cabeçalho de toda tela da enfermeira. Nenhum
 * texto fixo: o rótulo (com contagem, hora ou motivo) vem sempre por
 * propriedade, formatado por quem chama.
 */
export type EstadoSincronizacao =
  "local" | "enviando" | "sincronizado" | "erro";

const iconePorEstado: Record<
  EstadoSincronizacao,
  React.ComponentType<{ className?: string }>
> = {
  local: Smartphone,
  enviando: CloudUpload,
  sincronizado: CloudCheck,
  erro: WifiOff,
};

const classePorEstado: Record<EstadoSincronizacao, string> = {
  local: "bg-aviso-lavado text-aviso-texto",
  enviando: "bg-marinho-08 text-texto",
  sincronizado: "bg-sucesso-lavado text-sucesso",
  erro: "bg-aviso-lavado text-aviso-texto",
};

export interface IndicadorSincronizacaoProps {
  estado: EstadoSincronizacao;
  /** Texto do estado ("Salvo no aparelho", "Enviando 3 respostas"...). */
  texto: React.ReactNode;
  /** Só com `estado="erro"`: aciona nova tentativa de envio. */
  aoTentarNovamente?: () => void;
  /** Rótulo do botão de nova tentativa (obrigatório junto de `aoTentarNovamente`). */
  rotuloTentarNovamente?: string;
  className?: string;
}

export function IndicadorSincronizacao({
  estado,
  texto,
  aoTentarNovamente,
  rotuloTentarNovamente,
  className,
}: IndicadorSincronizacaoProps) {
  const Icone = iconePorEstado[estado];

  return (
    <div
      className={cn(
        "rounded-pilula text-mini inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 font-semibold",
        classePorEstado[estado],
        className,
      )}
    >
      <span role="status" className="inline-flex min-w-0 items-center gap-2">
        <Icone
          className={cn(
            "size-[18px] shrink-0",
            estado === "enviando" && "animate-pulse",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0">{texto}</span>
      </span>
      {estado === "erro" && aoTentarNovamente ? (
        <button
          type="button"
          onClick={aoTentarNovamente}
          className="rounded-pilula focus-visible:outline-foco min-h-toque -my-1 ml-1 px-3 underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2"
        >
          {rotuloTentarNovamente}
        </button>
      ) : null}
    </div>
  );
}
