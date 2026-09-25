import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  OctagonPause,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faixa de alerta clínico (DESIGN.md, seção 6). Fundo lavado da cor do
 * estado, borda fina, ícone de 24, código da regra em mono (PU-01), título
 * que diz o achado com o valor, conduta em frase completa e ações. Aparece
 * logo abaixo do campo que a disparou; `fixa` prende no topo do checklist
 * até ser registrada. `role="alert"` só na primeira aparição
 * (`anunciar={true}`, o consumidor decide quando é a primeira vez).
 *
 * `imediato` é reservado ao alerta clínico (ícone `siren`); uma falha
 * operacional (envio que não saiu, ação que não deu certo) usa `erro`
 * (ícone `circle-alert`), para não emprestar a urgência clínica a um
 * problema técnico (crítica do CRM, P0 item 15).
 */
export type VarianteFaixa =
  | "imediato"
  | "erro"
  | "prioritario"
  | "sensivel"
  | "info"
  | "sucesso";

const config: Record<
  VarianteFaixa,
  {
    classe: string;
    iconeClasse: string;
    Icone: React.ComponentType<{ className?: string }>;
  }
> = {
  imediato: {
    classe: "bg-alerta-lavado border-alerta-borda",
    iconeClasse: "text-alerta",
    Icone: Siren,
  },
  erro: {
    classe: "bg-alerta-lavado border-alerta-borda",
    iconeClasse: "text-alerta",
    Icone: CircleAlert,
  },
  prioritario: {
    classe: "bg-aviso-lavado border-aviso-borda",
    iconeClasse: "text-aviso-texto",
    Icone: TriangleAlert,
  },
  sensivel: {
    classe: "bg-sensivel-lavado border-sensivel-borda",
    iconeClasse: "text-sensivel",
    Icone: OctagonPause,
  },
  info: {
    classe: "bg-superficie border-linha",
    iconeClasse: "text-texto-2",
    Icone: Info,
  },
  sucesso: {
    classe: "bg-sucesso-lavado border-sucesso-borda",
    iconeClasse: "text-sucesso",
    Icone: CircleCheck,
  },
};

export interface FaixaAlertaProps {
  variante: VarianteFaixa;
  /** Código da regra, em mono ("PU-01"). */
  codigo?: string;
  /** Achado com o valor ("Febre de 38,2 °C na puérpera"). */
  titulo: React.ReactNode;
  /** Conduta em frase completa. */
  children?: React.ReactNode;
  /** O que precisa ser registrado antes de fechar, texto auxiliar. */
  meta?: React.ReactNode;
  acoes?: React.ReactNode;
  /** Fica presa no topo do checklist até ser registrada. */
  fixa?: boolean;
  /** `role="alert"` (primeira aparição). Padrão: só nos estados de risco. */
  anunciar?: boolean;
  className?: string;
}

export function FaixaAlerta({
  variante,
  codigo,
  titulo,
  children,
  meta,
  acoes,
  fixa,
  anunciar,
  className,
}: FaixaAlertaProps) {
  const { classe, iconeClasse, Icone } = config[variante];
  const risco =
    variante === "imediato" ||
    variante === "erro" ||
    variante === "prioritario" ||
    variante === "sensivel";
  const deveAnunciar = anunciar ?? risco;

  return (
    <div
      role={deveAnunciar ? "alert" : risco ? undefined : "status"}
      className={cn(
        "rounded-2 grid grid-cols-[auto_minmax(0,1fr)] gap-3 border p-4",
        classe,
        fixa && "shadow-1 sticky top-[72px] z-10",
        className,
      )}
    >
      <Icone className={cn("mt-0.5 size-6 shrink-0", iconeClasse)} />
      <div>
        <p className={cn("text-3 leading-snug font-semibold", iconeClasse)}>
          {codigo ? (
            <span className="text-apoio mr-2 font-mono font-medium">
              {codigo}
            </span>
          ) : null}
          {titulo}
        </p>
        {children ? (
          // `<div>`, não `<p>`: alguns consumidores (a faixa de justificar
          // o freio) passam um `<form>` como filho, e um `<form>` dentro de
          // `<p>` é HTML inválido, o navegador reordena o DOM na hidratação
          // e o React quebra na hidratação (erro de minificação número
          // quatrocentos e dezoito, crítica do CRM, P0 item 5).
          <div className="text-corpo text-texto mt-1">{children}</div>
        ) : null}
        {meta ? <p className="text-apoio text-texto-2 mt-2">{meta}</p> : null}
        {acoes ? (
          <div className="mt-4 flex flex-wrap gap-2">{acoes}</div>
        ) : null}
      </div>
    </div>
  );
}
