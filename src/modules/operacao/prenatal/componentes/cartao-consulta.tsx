import Link from "next/link";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";
import { formatarDataHora } from "@/lib/formatacao";
import { ROTULO_STATUS_CONSULTA } from "../../comum/rotulos";
import { frasePorOndeParou } from "../agrupar";
import { PLANO_ENTREVISTA_PRENATAL } from "../plano-etapas";

/**
 * Uma consulta pré-natal na lista da coordenação (direção "Colo"): quem é,
 * em que semana está, quando é a consulta e onde a entrevista parou. O que
 * ainda falta fazer é cartão branco; com a entrevista começada, a barra
 * mostra as etapas já passadas. A concluída encolhe num bloco sálvia (o
 * que está feito), com o link para ver a entrevista.
 */
export function CartaoConsulta({
  consulta,
}: {
  consulta: ConsultaPrenatalResumo;
}) {
  const total = PLANO_ENTREVISTA_PRENATAL.length;
  const concluida = consulta.status === "realizada";
  const semData = consulta.status === "pendente";
  const emAndamento =
    !concluida && (consulta.iniciadaEm !== null || consulta.etapa !== null);
  const ondeParou = frasePorOndeParou(consulta, total, formatarDataHora);

  if (concluida) {
    return (
      <Cartao
        variante="salvia"
        className="flex h-full items-center gap-3 p-4"
        data-consulta={consulta.familiaId}
      >
        <TileIcone tom="salvia" forma="quadrado">
          <ClipboardCheck />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-corpo text-texto font-semibold">
            {consulta.nome}
          </h3>
          <p className="text-apoio text-texto-2">
            {consulta.ig ? (
              <span className="text-texto font-mono">{consulta.ig}</span>
            ) : (
              "Sem data provável"
            )}
            {consulta.cidade ? `, ${consulta.cidade}` : ""}. {ondeParou}.
          </p>
        </div>
        <Botao
          asChild
          variante="secundario"
          tamanho="compacto"
          className="shrink-0"
        >
          <Link href={`/prenatal/${consulta.familiaId}`}>Ver entrevista</Link>
        </Botao>
      </Cartao>
    );
  }

  const rotuloAcao = semData
    ? "Marcar a consulta"
    : emAndamento && consulta.etapa
      ? `Retomar da etapa ${consulta.etapa}`
      : "Começar entrevista";

  return (
    <Cartao
      className="flex h-full flex-col gap-4"
      data-consulta={consulta.familiaId}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-titulo text-2 text-texto font-medium">
            {consulta.nome}
          </h3>
          {consulta.urgente ? <Selo variante="alerta">Urgente</Selo> : null}
        </div>
        <p className="text-corpo text-texto-2">
          {consulta.ig ? (
            <>
              <span className="text-texto font-mono">{consulta.ig}</span>
              {consulta.cidade ? `, ${consulta.cidade}.` : "."}
            </>
          ) : (
            "Sem data provável do parto."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {consulta.chegouAlerta ? (
            <Selo variante="aviso">Chegou às 34 semanas</Selo>
          ) : null}
          <Selo variante={semData ? "aviso" : "neutro"}>
            {ROTULO_STATUS_CONSULTA[consulta.status]}
          </Selo>
        </div>
      </div>

      {consulta.agendadaPara ? (
        <p className="rounded-2 bg-lavanda-clara text-corpo text-texto flex items-center gap-3 px-3 py-2">
          <TileIcone tom="lavanda" tamanho="p">
            <CalendarDays />
          </TileIcone>
          <span>
            Consulta em{" "}
            <span className="font-mono font-medium">
              {formatarDataHora(consulta.agendadaPara) ?? ""}
            </span>
          </span>
        </p>
      ) : null}

      {emAndamento && consulta.etapa ? (
        <BarraProgresso
          valor={consulta.etapa - 1}
          total={total}
          texto={ondeParou}
        />
      ) : (
        <p className="text-apoio text-texto-2">{ondeParou}</p>
      )}

      <Botao
        asChild
        variante="primario"
        tamanho="compacto"
        className="mt-auto self-start"
      >
        <Link href={`/prenatal/${consulta.familiaId}`}>{rotuloAcao}</Link>
      </Botao>
    </Cartao>
  );
}
