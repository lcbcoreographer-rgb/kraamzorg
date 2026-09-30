import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { ChaveDeCasa } from "@/components/ilustracoes";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import {
  eDataValida,
  hojeEmBrasilia,
  inicioDaSemana,
  somarDias,
} from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  LegendaSemana,
  SemanaEquipe,
  rotuloSemana,
} from "@/modules/operacao/equipe/componentes/semana-equipe";
import {
  carregarEscala,
  type EscalaTela,
} from "@/modules/operacao/equipe/dados";

export const metadata: Metadata = { title: "Escala da semana · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Escala semanal (P37 item 5): sete dias por dois turnos para cada
 * enfermeira, com visita, folga, reservada, backup e oferta, e o conflito
 * ou a sobrecarga marcados. Calculada das visitas, das designações e dos
 * bloqueios; nada é digitado.
 */
export default async function PaginaEscala({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/equipe");
  const pesquisa = await searchParams;
  const hoje = hojeEmBrasilia();
  const pedida = um(pesquisa.semana);
  const semana = inicioDaSemana(pedida && eDataValida(pedida) ? pedida : hoje);
  const regiaoId = um(pesquisa.praca);

  let tela: EscalaTela | null = null;
  try {
    tela = await carregarEscala({ semana, regiaoId });
  } catch {
    tela = null;
  }

  const anterior = somarDias(semana, -7);
  const proxima = somarDias(semana, 7);
  const fim = somarDias(semana, 6);
  const sufixo = regiaoId ? `&praca=${regiaoId}` : "";

  return (
    <>
      <CabecalhoTela
        titulo="Escala da semana"
        subtitulo={`De ${rotuloSemana(semana, fim)}. Cada enfermeira em dois turnos por dia.`}
      />
      <div className="flex flex-col gap-6 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/equipe"
            className="text-apoio text-texto-2 hover:text-texto min-h-toque mr-auto -ml-1 inline-flex items-center gap-1.5 font-medium no-underline"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
            Voltar para a equipe
          </Link>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<ChevronLeft aria-hidden="true" />}
          >
            <Link href={`/equipe/escala?semana=${anterior}${sufixo}`}>
              Semana anterior
            </Link>
          </Botao>
          {semana !== inicioDaSemana(hoje) ? (
            <Botao asChild variante="fantasma" tamanho="compacto">
              <Link
                href={`/equipe/escala${regiaoId ? `?praca=${regiaoId}` : ""}`}
              >
                Esta semana
              </Link>
            </Botao>
          ) : null}
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            iconeDireita={<ChevronRight aria-hidden="true" />}
          >
            <Link href={`/equipe/escala?semana=${proxima}${sufixo}`}>
              Próxima semana
            </Link>
          </Botao>
        </div>

        {!tela ? (
          <FaixaAlerta variante="erro" titulo="A escala não abriu agora">
            Nada foi alterado. Recarregue a página; se continuar, avise a equipe
            técnica.
          </FaixaAlerta>
        ) : (
          <>
            <div className="rounded-3 bg-areia-clara px-5 py-4">
              <LegendaSemana />
            </div>
            {tela.escala.profissionais.length === 0 ? (
              <EstadoVazio
                nivelTitulo="h2"
                ilustracao={<ChaveDeCasa tamanho={112} />}
                titulo="Nenhuma enfermeira na escala"
                texto="Quando houver enfermeiras ativas, cada uma aparece aqui com a semana dela em turnos."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                {tela.escala.profissionais.map((linha) => {
                  const sobrecarga = linha.dias.filter((d) => d.sobrecarga);
                  return (
                    <li
                      key={linha.profissionalId}
                      className="rounded-3 bg-lavanda-clara flex min-w-0 flex-col gap-4 p-4 lg:p-5"
                    >
                      <div className="flex items-center gap-3">
                        <TileIcone tom="argila" tamanho="p">
                          <UserRound />
                        </TileIcone>
                        <h2 className="font-titulo text-2 text-texto font-medium">
                          {linha.nome}
                        </h2>
                      </div>
                      <SemanaEquipe
                        dias={linha.dias}
                        hoje={hoje}
                        nome={linha.nome}
                      />
                      {sobrecarga.length > 0 ? (
                        <Selo
                          variante="aviso"
                          icone={<TriangleAlert />}
                          className="self-start py-1 leading-snug whitespace-normal"
                        >
                          Passa de {tela.escala.limiteVisitasDia} visitas em{" "}
                          {sobrecarga.length === 1
                            ? "um dia"
                            : `${sobrecarga.length} dias`}{" "}
                          desta semana.
                        </Selo>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
