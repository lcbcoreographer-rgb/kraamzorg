import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio (DESIGN.md, 2.10 e 11.7). Bloco `areia-clara` de raio 28
 * com uma das ilustrações da casa (`src/components/ilustracoes`), o título
 * que diz o que é, o texto que diz por que está vazio e quando algo vai
 * aparecer ali, e a próxima ação como botão. Nunca omitido: o vazio é
 * desenhado, não uma tela em branco.
 *
 * `variante="tracejado"`: o contorno tracejado de antes, para o lugar de
 * algo que "ainda não" aconteceu dentro de outro bloco (um dia sem
 * registro, uma coluna sem família). Sem ilustração.
 *
 * Nunca com ilustração em tela de família em estado sensível ou de alerta
 * clínico (PRD 20.2 [v4.4]).
 */
export interface EstadoVazioProps {
  titulo: React.ReactNode;
  texto: React.ReactNode;
  /** Botão com a próxima ação (ex: um `<Botao>`). */
  acao?: React.ReactNode;
  /** Uma das ilustrações da casa, decorativa (o título já diz o que é). */
  ilustracao?: React.ReactNode;
  variante?: "bloco" | "tracejado";
  /**
   * Tela de família em estado sensível: o bloco fica branco com contorno,
   * sem tom de apoio (PRD 20.2 [v4.4], regra 3). Quem passa isto também
   * não passa ilustração.
   */
  semTom?: boolean;
  /** Nível do título na hierarquia da página (padrão h3). */
  nivelTitulo?: "h2" | "h3";
  className?: string;
}

export function EstadoVazio({
  titulo,
  texto,
  acao,
  ilustracao,
  variante = "bloco",
  semTom = false,
  nivelTitulo: Titulo = "h3",
  className,
}: EstadoVazioProps) {
  if (variante === "tracejado") {
    return (
      <div
        className={cn(
          "rounded-3 border-marinho-50 flex flex-col items-start gap-3 border-[1.5px] border-dashed p-6",
          className,
        )}
      >
        <Titulo className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </Titulo>
        <p className="text-corpo text-texto-2 max-w-[52ch]">{texto}</p>
        {acao}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-3 tablet:flex-row tablet:items-center tablet:gap-6 flex flex-col items-start gap-4 p-6",
        semTom ? "bg-superficie border-linha border" : "bg-areia-clara",
        className,
      )}
    >
      {ilustracao && !semTom ? (
        <div className="shrink-0">{sobreAreia(ilustracao)}</div>
      ) : null}
      <div className="flex flex-col items-start gap-3">
        <Titulo className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </Titulo>
        <p className="text-corpo text-texto-2 max-w-[52ch]">{texto}</p>
        {acao}
      </div>
    </div>
  );
}

/**
 * A ilustração mora num bloco `areia-clara`: avisa a peça, para a mancha de
 * fundo não sumir no bloco (DESIGN.md, 5.1). Quem já passou `sobre` manda.
 */
function sobreAreia(ilustracao: React.ReactNode): React.ReactNode {
  if (!React.isValidElement<{ sobre?: string }>(ilustracao)) return ilustracao;
  if (ilustracao.props.sobre !== undefined) return ilustracao;
  return React.cloneElement(ilustracao, { sobre: "areia-clara" });
}
