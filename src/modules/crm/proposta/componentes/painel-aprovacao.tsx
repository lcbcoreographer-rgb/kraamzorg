"use client";

import { useActionState } from "react";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { TileIcone } from "@/components/ui/tile-icone";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoAprovarDesconto } from "../acoes";
import { estadoInicialProposta } from "../estado-acoes";

/**
 * Aprovação do desconto ou da condição (D-16; C-04 e C-05): só a diretoria
 * aprova, e a aprovação fica registrada com o nome de quem aprovou. Mudar a
 * proposta depois tira a aprovação (o banco faz isso ao salvar).
 */
export function PainelAprovacao({
  familiaId,
  oportunidadeId,
  aprovado,
  aprovadoPor,
  podeAprovar,
}: {
  familiaId: string;
  oportunidadeId: string;
  aprovado: boolean;
  aprovadoPor: string | null;
  podeAprovar: boolean;
}) {
  const [estado, acao, aprovando] = useActionState(
    acaoAprovarDesconto,
    estadoInicialProposta,
  );

  if (aprovado) {
    return (
      <p className="text-corpo text-sucesso flex items-start gap-2 font-medium">
        <CircleCheck
          className="mt-1 size-4 shrink-0"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        Condição aprovada pela diretoria
        {aprovadoPor ? `, por ${aprovadoPor}` : ""}.
      </p>
    );
  }

  return (
    <section className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5">
      <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="argila" forma="quadrado" tamanho="p">
          <ShieldCheck />
        </TileIcone>
        Aprovação da diretoria
      </h2>
      <p className="text-corpo text-texto-2">
        {podeAprovar
          ? "Esta proposta tem desconto ou condição que pede a sua aprovação. Depois dela, o comercial gera o link do formulário."
          : "Esta proposta tem desconto ou condição que pede a aprovação da diretoria. Avise a diretoria; o link do formulário sai depois dela."}
      </p>
      {podeAprovar ? (
        <form action={acao}>
          <input type="hidden" name="familiaId" value={familiaId} />
          <input type="hidden" name="oportunidadeId" value={oportunidadeId} />
          <Botao
            type="submit"
            variante="secundario"
            tamanho="compacto"
            carregando={aprovando}
            rotuloCarregando="Aprovando"
          >
            Aprovar a condição
          </Botao>
        </form>
      ) : null}
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} anunciar />
      ) : null}
    </section>
  );
}
