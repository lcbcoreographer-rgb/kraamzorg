import Link from "next/link";
import type { ReactNode } from "react";
import { Baby, Hospital, UserRound, UsersRound } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type {
  DesignadaNoRadar,
  RadarFamilia,
  RadarNasceu,
} from "@/lib/dados/tipos-operacao";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { fraseDias, ROTULO_STATUS_DESIGNACAO } from "../../comum/rotulos";
import { pontosDeAtencao } from "../agrupar";

function Designada({
  rotulo,
  d,
  icone,
  semTom,
}: {
  rotulo: string;
  d: DesignadaNoRadar | null;
  icone: ReactNode;
  semTom: boolean;
}) {
  const viva = d && !["recusada", "expirada", "cancelada"].includes(d.status);
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-mini text-texto-2 flex items-center gap-2">
        {semTom ? null : (
          <TileIcone tom="argila" tamanho="p" className="size-7 [&_svg]:size-4">
            {icone}
          </TileIcone>
        )}
        {rotulo}
      </dt>
      <dd
        className={cn(
          "text-corpo text-texto flex flex-wrap items-center gap-x-2 gap-y-1",
          semTom ? null : "pl-9",
        )}
      >
        {viva ? (
          <>
            <span className="font-semibold">{d.nome}</span>
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
 * Uma família no radar de nascimentos (P36 item 2; direção "Colo"): o
 * tempo da família em cima (IG em mono e a data provável como estimativa),
 * titular e backup num bloco de pessoas, os pontos de atenção em selo e a
 * ação que leva à alocação. Família em estado sensível fica sem tom de
 * apoio (PRD 20.2 [v4.4]).
 */
export function CartaoRadar({ familia: f }: { familia: RadarFamilia }) {
  const pontos = pontosDeAtencao(f);
  const sensivel = f.estadoSensivel !== "normal";
  return (
    <Cartao className="flex h-full flex-col gap-4" data-radar={f.familiaId}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-titulo text-2 text-texto font-medium">
            {f.nome}
          </h3>
          {f.gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
          {sensivel ? <Selo variante="sensivel">Estado sensível</Selo> : null}
        </div>
        <p className="text-apoio text-texto-2">
          <span className="text-texto text-dado font-mono font-medium">
            {f.ig}
          </span>
          {` · data provável ${formatarData(f.dpp) ?? f.dpp}, ${fraseDias(f.diasParaDpp)} (estimativa)`}
          {f.regiao ? `. ${f.regiao}.` : "."}
        </p>
      </div>
      <dl
        className={cn(
          "rounded-2 flex flex-col gap-3 p-3",
          sensivel ? "border-linha border" : "bg-areia-clara",
        )}
      >
        <Designada
          rotulo="Titular"
          d={f.titular}
          icone={<UserRound />}
          semTom={sensivel}
        />
        <Designada
          rotulo="Backup"
          d={f.backup}
          icone={<UsersRound />}
          semTom={sensivel}
        />
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
                className="py-1 leading-snug whitespace-normal"
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
        className="mt-auto self-start"
      >
        <Link href={`/radar/${f.familiaId}`}>Abrir alocação</Link>
      </Botao>
    </Cartao>
  );
}

/**
 * Quem já nasceu e espera a alta: o próximo registro é a alta. Bloco areia
 * (a família e o que já aconteceu), com a data do nascimento como fato.
 */
export function CartaoNasceu({ familia: n }: { familia: RadarNasceu }) {
  return (
    <Cartao
      variante="areia-clara"
      className="flex h-full flex-col gap-4"
      data-nasceu={n.familiaId}
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="areia" forma="quadrado">
          <Hospital />
        </TileIcone>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-titulo text-2 text-texto font-medium">
            {n.nome}
          </h3>
          <Selo variante="sucesso" icone={<Baby />} className="self-start">
            Nasceu em {formatarData(n.dataNascimento) ?? n.dataNascimento}
          </Selo>
        </div>
      </div>
      <p className="text-corpo text-texto-2">
        {n.previsaoAlta
          ? `Alta prevista para ${formatarData(n.previsaoAlta) ?? n.previsaoAlta} (estimativa).`
          : "Sem previsão de alta ainda."}
        {n.titular ? ` Titular: ${n.titular}.` : " Sem titular."}
      </p>
      <Botao
        asChild
        variante="primario"
        tamanho="compacto"
        className="mt-auto self-start"
      >
        <Link href={`/radar/${n.familiaId}`}>Registrar a alta</Link>
      </Botao>
    </Cartao>
  );
}
