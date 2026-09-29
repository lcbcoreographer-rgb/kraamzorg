import Link from "next/link";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";
import { formatarDataHora } from "@/lib/formatacao";
import { ROTULO_STATUS_CONSULTA } from "../../comum/rotulos";
import { frasePorOndeParou } from "../agrupar";
import { PLANO_ENTREVISTA_PRENATAL } from "../plano-etapas";

/**
 * Uma consulta pré-natal na lista da coordenação: quem é, em que semana
 * está, quando é a consulta e onde a entrevista parou. O botão diz o que
 * acontece: começar, retomar da etapa N, marcar ou ver a entrevista.
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

  const rotuloAcao = concluida
    ? "Ver entrevista"
    : semData
      ? "Marcar a consulta"
      : emAndamento && consulta.etapa
        ? `Retomar da etapa ${consulta.etapa}`
        : "Começar entrevista";

  return (
    <Cartao className="flex flex-col gap-3" data-consulta={consulta.familiaId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-titulo text-2 text-texto font-medium">
          {consulta.nome}
        </h3>
        {consulta.urgente ? <Selo variante="alerta">Urgente</Selo> : null}
        {consulta.chegouAlerta && !concluida ? (
          <Selo variante="aviso">Chegou às 34 semanas</Selo>
        ) : null}
        <Selo variante={concluida ? "sucesso" : semData ? "aviso" : "neutro"}>
          {ROTULO_STATUS_CONSULTA[consulta.status]}
        </Selo>
      </div>
      <p className="text-corpo text-texto-2">
        {consulta.ig ? (
          <>
            <span className="text-texto font-mono">{consulta.ig}</span>
            {consulta.cidade ? `, ${consulta.cidade}` : ""}
          </>
        ) : (
          "Sem data provável do parto"
        )}
        {consulta.agendadaPara && !concluida
          ? `. Consulta em ${formatarDataHora(consulta.agendadaPara) ?? ""}.`
          : "."}
      </p>
      <p className="text-apoio text-texto-2">
        {frasePorOndeParou(consulta, total, formatarDataHora)}
      </p>
      <Botao
        asChild
        variante={concluida ? "secundario" : "primario"}
        tamanho="compacto"
        className="self-start"
      >
        <Link href={`/prenatal/${consulta.familiaId}`}>{rotuloAcao}</Link>
      </Botao>
    </Cartao>
  );
}
