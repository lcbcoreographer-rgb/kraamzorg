import Link from "next/link";
import { TriangleAlert, UserRound } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { LinhaEscala, ProfissionalEquipe } from "@/lib/dados/tipos-equipe";
import { formatarData } from "@/lib/formatacao";
import { ROTULO_FUNCAO, ROTULO_VINCULO } from "../textos";
import { SeloEstadoProfissional } from "./selo-estado";
import { SemanaEquipe } from "./semana-equipe";

/** Régua fina do acompanhamento: os dias já iniciados em marinho, o resto tracejado. */
function reguaDaFamilia(diaAtual: number | null, total: number): DiaRegua[] {
  return Array.from({ length: total }, (_, i) => ({
    numero: i + 1,
    estado: diaAtual !== null && i + 1 <= diaAtual ? "feito" : "futuro",
  }));
}

/**
 * Cartão de uma enfermeira na tela de Equipe (fluxo C, passo 1): nome, selo
 * de hoje, as famílias em curso com a régua fina, os avisos (documento,
 * oferta sem resposta) e a semana em turnos. No celular a semana é a linha
 * de baixo do cartão. O cartão inteiro leva ao cadastro.
 */
export function CartaoProfissional({
  profissional: p,
  linhaEscala,
  hoje,
  nomesRegioes,
}: {
  profissional: ProfissionalEquipe;
  linhaEscala: LinhaEscala | null;
  hoje: string;
  nomesRegioes: Map<string, string>;
}) {
  const pracas = p.regioes.map((r) => nomesRegioes.get(r)).filter(Boolean);
  const avisosDocumento = p.documentos.filter(
    (d) => d.situacao === "vencido" || d.situacao === "vencendo",
  );
  return (
    <Cartao data-profissional={p.id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <TileIcone tom="argila">
            <UserRound />
          </TileIcone>
          <div className="min-w-0">
            <h3
              id={`prof-${p.id}`}
              className="font-titulo text-2 text-texto font-medium"
            >
              {p.nome}
            </h3>
            <p className="text-apoio text-texto-2">
              {[
                ROTULO_FUNCAO[p.funcao] ?? p.funcao,
                ROTULO_VINCULO[p.vinculo],
                pracas.join(" e "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {p.status ? (
          <SeloEstadoProfissional estado={p.status} />
        ) : (
          <Selo variante="neutro">Inativa</Selo>
        )}
      </div>

      {p.familias.length > 0 ? (
        <ul
          className="rounded-2 bg-areia-clara flex flex-col gap-3 p-3"
          aria-label="Famílias em curso"
        >
          {p.familias.map((f) => (
            <li key={f.acompanhamentoId} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <Link
                  href={`/familias/${f.familiaId}`}
                  className="text-corpo text-texto font-medium underline-offset-4 hover:underline"
                >
                  {f.nomeExibicao}
                </Link>
                <span className="text-apoio text-texto-2 font-mono">
                  {f.papel === "backup" ? "backup · " : ""}
                  {f.diaAtual !== null
                    ? `D${f.diaAtual} de ${f.diasContratados}`
                    : f.dataNascimento
                      ? "acompanhamento por começar"
                      : f.dpp
                        ? `DPP ${formatarData(f.dpp)} (estimativa)`
                        : "aguardando o nascimento"}
                </span>
              </div>
              {f.diaAtual !== null ? (
                <ReguaDias
                  fina
                  dias={reguaDaFamilia(f.diaAtual, f.diasContratados)}
                  rotulo={`Acompanhamento de ${f.diasContratados} dias, ${f.diaAtual} já feitos`}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : p.ativa && p.atendeVisitas ? (
        <p className="text-apoio text-texto-2">
          Nenhuma família em curso agora.
        </p>
      ) : null}

      {p.ofertasPendentes > 0 || avisosDocumento.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Avisos">
          {p.ofertasPendentes > 0 ? (
            <li>
              <Selo variante="destaque">
                {p.ofertasPendentes === 1
                  ? "1 oferta sem resposta"
                  : `${p.ofertasPendentes} ofertas sem resposta`}
              </Selo>
            </li>
          ) : null}
          {avisosDocumento.map((d) => (
            <li key={d.id}>
              <Selo
                variante={d.situacao === "vencido" ? "alerta" : "aviso"}
                icone={<TriangleAlert />}
                className="h-auto py-1 leading-snug whitespace-normal"
              >
                {d.situacao === "vencido" ? "Vencido" : "Vence"} em{" "}
                {d.validade ? formatarData(d.validade) : ""}: {d.tipo}
              </Selo>
            </li>
          ))}
        </ul>
      ) : null}

      {linhaEscala ? (
        <SemanaEquipe dias={linhaEscala.dias} hoje={hoje} nome={p.nome} />
      ) : null}

      <Botao
        asChild
        variante="secundario"
        tamanho="compacto"
        className="self-start"
      >
        <Link
          href={`/equipe/${p.id}`}
          aria-label={`Abrir o cadastro de ${p.nome}`}
        >
          Abrir o cadastro
        </Link>
      </Botao>
    </Cartao>
  );
}
