import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { JanelaManha } from "@/components/ilustracoes";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  eDataValida,
  hojeEmBrasilia,
  inicioDaSemana,
  somarDias,
} from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/formatacao";
import {
  ListaAgenda,
  SemanaEmBlocos,
} from "@/modules/operacao/equipe/componentes/lista-agenda";
import { rotuloSemana } from "@/modules/operacao/equipe/componentes/semana-equipe";
import {
  carregarAgenda,
  type AgendaTela,
} from "@/modules/operacao/equipe/dados";

export const metadata: Metadata = { title: "Agenda · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

const FEITO: Record<string, string> = {
  reagendada:
    "Visita reagendada. O dia novo já aparece abaixo e no Hoje da enfermeira.",
  cascata:
    "Visitas reagendadas. As datas novas já aparecem abaixo e no Hoje da enfermeira.",
};

/**
 * Agenda (P37 item 2): as visitas de todas as enfermeiras, ou de uma, por
 * dia ou por semana, junto com as conversas de orientação marcadas. Cada
 * visita traz os conflitos (limite por dia, período diferente do D1,
 * bloqueio, sobreposição) e, se ainda não começou, o caminho para
 * reagendar. Só coordenação e diretoria.
 */
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/agenda");
  const pesquisa = await searchParams;
  const hoje = hojeEmBrasilia();
  const pedida = um(pesquisa.data);
  const dia = pedida && eDataValida(pedida) ? pedida : hoje;
  const visao = um(pesquisa.visao) === "dia" ? "dia" : "semana";
  const profissionalPedido = um(pesquisa.profissional);
  const profissionalId =
    profissionalPedido && z.uuid().safeParse(profissionalPedido).success
      ? profissionalPedido
      : null;
  const feito = FEITO[um(pesquisa.feito) ?? ""];

  const desde = visao === "dia" ? dia : inicioDaSemana(dia);
  const ate = visao === "dia" ? dia : somarDias(desde, 6);
  const passo = visao === "dia" ? 1 : 7;

  let tela: AgendaTela | null = null;
  try {
    tela = await carregarAgenda({ desde, ate, profissionalId });
  } catch {
    tela = null;
  }

  const ligacao = (extra: {
    data?: string;
    visao?: string;
    profissional?: string | null;
  }) => {
    const p = new URLSearchParams();
    p.set("data", extra.data ?? dia);
    p.set("visao", extra.visao ?? visao);
    const prof = "profissional" in extra ? extra.profissional : profissionalId;
    if (prof) p.set("profissional", prof);
    return `/agenda?${p.toString()}`;
  };

  const comConflito =
    tela?.agenda.visitas.filter((v) => v.conflitos.length > 0).length ?? 0;
  const total = tela?.agenda.visitas.length ?? 0;
  const frase = tela
    ? total === 0
      ? "Nenhuma visita marcada neste período."
      : `${total === 1 ? "1 visita" : `${total} visitas`}${
          comConflito > 0
            ? `, ${comConflito === 1 ? "1 com conflito para resolver" : `${comConflito} com conflito para resolver`}`
            : ", nenhuma com conflito"
        }.`
    : null;

  return (
    <>
      <CabecalhoTela
        titulo="Agenda"
        subtitulo={
          tela
            ? `${visao === "dia" ? formatarData(dia) : rotuloSemana(desde, ate)}. ${frase}`
            : undefined
        }
      />
      <div className="flex flex-col gap-6 pt-4">
        {feito ? <FaixaAlerta variante="sucesso" titulo={feito} /> : null}

        <nav aria-label="Período e enfermeira" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <AbasPilula
              rotulo="Ver por dia ou por semana"
              ativa={visao}
              abas={[
                {
                  valor: "dia",
                  rotulo: "Dia",
                  href: ligacao({ visao: "dia" }),
                },
                {
                  valor: "semana",
                  rotulo: "Semana",
                  href: ligacao({ visao: "semana" }),
                },
              ]}
            />
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                iconeEsquerda={<ChevronLeft aria-hidden="true" />}
              >
                <Link href={ligacao({ data: somarDias(dia, -passo) })}>
                  {visao === "dia" ? "Dia anterior" : "Semana anterior"}
                </Link>
              </Botao>
              {dia !== hoje ? (
                <Botao asChild variante="fantasma" tamanho="compacto">
                  <Link href={ligacao({ data: hoje })}>Hoje</Link>
                </Botao>
              ) : null}
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                iconeDireita={<ChevronRight aria-hidden="true" />}
              >
                <Link href={ligacao({ data: somarDias(dia, passo) })}>
                  {visao === "dia" ? "Próximo dia" : "Próxima semana"}
                </Link>
              </Botao>
            </span>
          </div>
          {tela && tela.profissionais.length > 0 ? (
            <AbasPilula
              rotulo="Enfermeira"
              ativa={profissionalId ?? ""}
              className="self-start"
              abas={[
                {
                  valor: "",
                  rotulo: "Todas as enfermeiras",
                  href: ligacao({ profissional: null }),
                },
                ...tela.profissionais.map((p) => ({
                  valor: p.id,
                  rotulo: p.nome,
                  href: ligacao({ profissional: p.id }),
                })),
              ]}
            />
          ) : null}
        </nav>

        {tela && visao === "semana" ? (
          <SemanaEmBlocos
            dias={Array.from({ length: 7 }, (_, i) => somarDias(desde, i))}
            visitas={tela.agenda.visitas}
            hoje={hoje}
          />
        ) : null}

        {!tela ? (
          <FaixaAlerta variante="erro" titulo="A agenda não abriu agora">
            Nenhuma visita foi alterada. Recarregue a página; se continuar,
            avise a equipe técnica.
          </FaixaAlerta>
        ) : tela.agenda.visitas.length === 0 &&
          tela.sessoesDeVenda.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<JanelaManha tamanho={112} />}
            titulo="Nada marcado neste período"
            texto="Quando houver visitas, elas aparecem aqui por dia, com os conflitos marcados. Use as setas para ver outro dia ou outra semana."
          />
        ) : (
          <ListaAgenda
            visitas={tela.agenda.visitas}
            sessoes={tela.sessoesDeVenda}
            hoje={hoje}
            limiteVisitasDia={tela.agenda.limiteVisitasDia}
          />
        )}
      </div>
    </>
  );
}
