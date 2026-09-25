import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AjudaCampo,
  classeCaixaPorEstado,
  RotuloCampo,
  type EstadoCampo,
} from "@/components/ui/campo";

/**
 * Seleção nativa no mesmo desenho de `CampoTexto` (DESIGN.md, seção 6): o
 * projeto ainda não tem um componente de seleção em `src/components/ui`
 * (o P15 fez o mesmo dentro do próprio módulo). Fica aqui, dentro do
 * módulo de Configurações, para os formulários de pacote, cidade, termo
 * de alerta e régua.
 */
export interface OpcaoSelecao {
  valor: string;
  rotulo: string;
}

export interface CampoSelecaoProps {
  rotulo: React.ReactNode;
  name: string;
  opcoes: OpcaoSelecao[];
  opcaoVazia?: string;
  descricao?: React.ReactNode;
  erro?: React.ReactNode;
  estado?: EstadoCampo;
  opcional?: boolean;
  id?: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const CampoSelecao = React.forwardRef<
  HTMLSelectElement,
  CampoSelecaoProps
>(function CampoSelecao(
  {
    rotulo,
    name,
    opcoes,
    opcaoVazia,
    descricao,
    erro,
    estado: estadoProp,
    opcional,
    id,
    className,
    ...props
  },
  ref,
) {
  const idGerado = React.useId();
  const idCampo = id ?? idGerado;
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const estado: EstadoCampo = erro ? "erro" : (estadoProp ?? "normal");
  const descrevePor =
    [descricao ? idAjuda : null, erro ? idErro : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <RotuloCampo htmlFor={idCampo} opcional={opcional}>
        {rotulo}
      </RotuloCampo>
      <div
        className={cn(
          "rounded-2 bg-superficie ease-estado min-h-toque-campo relative flex items-center transition-[border-color,box-shadow] duration-140",
          classeCaixaPorEstado(estado, props.disabled),
        )}
      >
        <select
          ref={ref}
          id={idCampo}
          name={name}
          aria-describedby={descrevePor}
          aria-invalid={estado === "erro" || undefined}
          className={cn(
            "text-corpo text-texto rounded-2 min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent px-4 pr-10 focus-visible:shadow-none focus-visible:outline-none",
            className,
          )}
          {...props}
        >
          {opcaoVazia ? <option value="">{opcaoVazia}</option> : null}
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-texto-2 pointer-events-none absolute right-3 size-4"
        />
      </div>
      {descricao ? (
        <AjudaCampo id={idAjuda} estado={estado}>
          {descricao}
        </AjudaCampo>
      ) : null}
      {erro ? (
        <AjudaCampo id={idErro} estado="erro" mensagem>
          {erro}
        </AjudaCampo>
      ) : null}
    </div>
  );
});
