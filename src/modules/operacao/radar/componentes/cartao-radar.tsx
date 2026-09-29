import Link from "next/link";
import { Baby } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type {
  DesignadaNoRadar,
  RadarFamilia,
  RadarNasceu,
} from "@/lib/dados/tipos-operacao";
import { formatarData } from "@/lib/formatacao";
import { fraseDias, ROTULO_STATUS_DESIGNACAO } from "../../comum/rotulos";
import { pontosDeAtencao } from "../agrupar";

function Designada({
  rotulo,
  d,
}: {
  rotulo: string;
  d: DesignadaNoRadar | null;
}) {
  const viva = d && !["recusada", "expirada", "cancelada"].includes(d.status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <dt className="text-texto-2">{rotulo}</dt>
      <dd className="text-texto flex flex-wrap items-center gap-2">
        {viva ? (
          <>
            {d.nome}
            <Selo variante={d.status === "aceita" ? "sucesso" : "destaque"}>
              {ROTULO_STATUS_DESIGNACAO[d.status]}
            </Selo>
          </>
        ) : (
          <span className="text-texto-2">ninguém ainda</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Uma família no radar de nascimentos (P36 item 2): idade gestacional e DPP
 * (estimativa), titular e backup, e os pontos de atenção em frase. O botão
 * leva à alocação, onde se designa, se registra o nascimento e a alta.
 */
export function CartaoRadar({ familia: f }: { familia: RadarFamilia }) {
  const pontos = pontosDeAtencao(f);
  return (
    <Cartao className="flex flex-col gap-3" data-radar={f.familiaId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-titulo text-2 text-texto font-medium">{f.nome}</h3>
        {f.gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
        {f.estadoSensivel !== "normal" ? (
          <Selo variante="sensivel">Estado sensível</Selo>
        ) : null}
        {f.naJanela ? (
          <Selo variante="destaque">Na janela do parto</Selo>
        ) : null}
      </div>
      <p className="text-corpo text-texto-2">
        <span className="text-texto font-mono">{f.ig}</span>
        {`. Data provável ${formatarData(f.dpp) ?? f.dpp} (${fraseDias(f.diasParaDpp)}, estimativa).`}
        {f.regiao ? ` ${f.regiao}.` : ""}
      </p>
      <dl className="text-corpo flex flex-col gap-1">
        <Designada rotulo="Titular" d={f.titular} />
        <Designada rotulo="Backup" d={f.backup} />
      </dl>
      {pontos.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Pontos de atenção">
          {pontos.map((p) => (
            <li key={p.chave}>
              <Selo
                variante={
                  p.tom === "alerta"
                    ? "alerta"
                    : p.tom === "aviso"
                      ? "aviso"
                      : "neutro"
                }
              >
                {p.texto}
              </Selo>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-apoio text-texto-2">Nada pendente nesta família.</p>
      )}
      <Botao
        asChild
        variante="secundario"
        tamanho="compacto"
        className="self-start"
      >
        <Link href={`/radar/${f.familiaId}`}>Abrir alocação</Link>
      </Botao>
    </Cartao>
  );
}

/** Quem já nasceu e espera a alta: o próximo registro é a alta. */
export function CartaoNasceu({ familia: n }: { familia: RadarNasceu }) {
  return (
    <Cartao className="flex flex-col gap-3" data-nasceu={n.familiaId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-titulo text-2 text-texto font-medium">{n.nome}</h3>
        <Selo variante="sucesso" icone={<Baby />}>
          Nasceu em {formatarData(n.dataNascimento) ?? n.dataNascimento}
        </Selo>
      </div>
      <p className="text-corpo text-texto-2">
        {n.previsaoAlta
          ? `Alta prevista para ${formatarData(n.previsaoAlta) ?? n.previsaoAlta} (estimativa).`
          : "Sem previsão de alta ainda."}
        {n.titular ? ` Titular: ${n.titular}.` : " Sem titular."}
      </p>
      <Botao
        asChild
        variante="secundario"
        tamanho="compacto"
        className="self-start"
      >
        <Link href={`/radar/${n.familiaId}`}>Registrar a alta</Link>
      </Botao>
    </Cartao>
  );
}
