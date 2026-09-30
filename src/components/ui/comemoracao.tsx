import * as React from "react";
import { CadernoDeVisita } from "@/components/ilustracoes";
import { cn } from "@/lib/utils";

/**
 * Comemoração do checklist completo (DESIGN.md, 2.11; decisão do dono do
 * projeto, PRD 20.2 [v4.4]). Bloco `salvia-clara` em forma colo com o
 * caderno de visita: o traço se desenha uma vez em 700 ms, o check
 * aparece por último, e para. Texto calmo, sem exclamação e sem
 * "parabéns": a comemoração é o desenho, as palavras dizem o que falta.
 *
 * Quem usa decide quando mostrar: nunca com alerta na visita e nunca em
 * família em estado sensível (aí fica a linha "Tudo respondido", em
 * texto). `role="status"`: o leitor de tela anuncia o título uma vez.
 */
export interface ComemoracaoProps {
  titulo: React.ReactNode;
  texto?: React.ReactNode;
  /** A próxima ação (ex: "Assinar registro do D4"). */
  acao?: React.ReactNode;
  className?: string;
}

export function Comemoracao({
  titulo,
  texto,
  acao,
  className,
}: ComemoracaoProps) {
  return (
    <div
      className={cn(
        "rounded-colo bg-salvia-clara tablet:flex-row tablet:items-center tablet:gap-6 flex flex-col items-start gap-4 px-6 pt-6 pb-12",
        className,
      )}
    >
      <CadernoDeVisita animar tamanho={112} />
      <div className="flex flex-col items-start gap-2">
        <div role="status" className="flex flex-col gap-2">
          <p className="font-titulo text-1 text-texto font-medium">{titulo}</p>
          {texto ? <p className="text-corpo text-texto-2">{texto}</p> : null}
        </div>
        {acao ? <div className="pt-2">{acao}</div> : null}
      </div>
    </div>
  );
}
