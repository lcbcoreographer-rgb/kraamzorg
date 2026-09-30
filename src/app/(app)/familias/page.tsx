import type { Metadata } from "next";
import Link from "next/link";
import type * as React from "react";
import {
  CalendarClock,
  House,
  Kanban,
  OctagonPause,
  Search,
  Users,
} from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { ChaveDeCasa, FolhaLupa } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { Selo } from "@/components/ui/selo";
import type { Tom } from "@/components/ui/tons";
import { exigirSessao } from "@/lib/auth/sessao";
import { localidade } from "@/lib/formatacao";
import { listarFamiliasTela } from "@/modules/crm/ficha/dados";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

function texto(pesquisa: Pesquisa, chave: string): string | undefined {
  const valor = pesquisa[chave];
  const primeiro = Array.isArray(valor) ? valor[0] : valor;
  return primeiro?.trim() || undefined;
}

type Familia = Awaited<ReturnType<typeof listarFamiliasTela>>[number];
type ChaveGrupo = "gestando" | "nasceu" | "sem_data" | "freio";

const GRUPOS: {
  chave: ChaveGrupo;
  titulo: string;
  icone: React.ReactNode;
  /** Sem tom: o grupo das famílias com o freio (momento sensível). */
  tom?: Tom;
}[] = [
  {
    chave: "gestando",
    titulo: "Gestando",
    icone: <CalendarClock />,
    tom: "lavanda",
  },
  {
    chave: "nasceu",
    titulo: "O bebê já nasceu",
    icone: <House />,
    tom: "areia",
  },
  {
    chave: "sem_data",
    titulo: "Sem data registrada",
    icone: <Users />,
    tom: "areia",
  },
  { chave: "freio", titulo: "Com o freio puxado", icone: <OctagonPause /> },
];

function grupoDa(familia: Familia): ChaveGrupo {
  if (
    familia.estadoSensivel === "bloqueio_total" ||
    familia.estadoSensivel === "encerrado_sensivel"
  ) {
    return "freio";
  }
  if (familia.dataNascimento) return "nasceu";
  if (familia.dpp) return "gestando";
  return "sem_data";
}

/**
 * Uma família na lista: bloco no tom do grupo com a casa num tile; a ficha
 * abre com um toque. Com o freio, bloco branco, sem tile e sem tom.
 */
function LinhaFamilia({ familia, tom }: { familia: Familia; tom?: Tom }) {
  const lugar = localidade(familia.bairro, familia.cidade);
  const comFreio = familia.estadoSensivel !== "normal";
  return (
    <ItemBloco
      href={`/familias/${familia.id}`}
      fundo={tom && !comFreio ? "tom" : "branco"}
      tom={tom ?? "areia"}
      icone={tom && !comFreio ? <House /> : undefined}
      titulo={familia.nome}
      apoio={
        <span className="flex flex-col gap-1.5">
          {familia.idadeGestacional || lugar ? (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5">
              {familia.idadeGestacional ? (
                <span className="font-mono">{familia.idadeGestacional}</span>
              ) : null}
              {lugar ? <span>{lugar}</span> : null}
            </span>
          ) : null}
          {familia.naoContatar || comFreio ? (
            // Selo abaixo do bairro e da cidade, nunca ao lado do nome
            // (crítica do CRM, P1 item 17).
            <span className="flex flex-wrap gap-1.5">
              {familia.naoContatar ? (
                <Selo variante="aviso">Não contatar</Selo>
              ) : null}
              {comFreio ? (
                <Selo
                  variante="sensivel"
                  icone={<OctagonPause aria-hidden="true" />}
                >
                  {familia.estadoSensivel === "bloqueio_total"
                    ? "Freio em bloqueio total"
                    : familia.estadoSensivel === "atencao"
                      ? "Freio em atenção"
                      : "Encerrado sensível"}
                </Selo>
              ) : null}
            </span>
          ) : null}
        </span>
      }
    />
  );
}

/**
 * Lista de famílias (P16), porta de entrada da ficha 360 para quem não vem
 * de um cartão do pipeline (coordenação, financeiro, diretoria). Busca por
 * nome, como `FamiliasRepositorio.listarFamilias` já lê hoje (a busca por
 * telefone precisaria de um filtro novo na fundação, fora desta pasta:
 * ver `docs/sessoes/p16-ficha.md`, pendências).
 */
export default async function PaginaFamilias({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/familias");
  const pesquisa = await searchParams;
  const busca = texto(pesquisa, "busca");

  let familias: Awaited<ReturnType<typeof listarFamiliasTela>> = [];
  let falhou = false;
  try {
    familias = await listarFamiliasTela({ busca });
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Famílias"
        lateral={
          <Botao
            asChild
            variante="fantasma"
            tamanho="compacto"
            iconeEsquerda={<Kanban aria-hidden="true" className="size-4" />}
          >
            <Link href="/pipeline">Ver pelo pipeline</Link>
          </Botao>
        }
      />

      {/* A busca num bloco macio (direção "Colo", DESIGN.md 2.3), como os
          filtros do pipeline. */}
      <form
        method="get"
        action="/familias"
        className="rounded-3 bg-areia-clara tablet:flex-row tablet:items-end mt-2 flex flex-col gap-3 p-4"
      >
        <CampoTexto
          rotulo="Buscar"
          name="busca"
          defaultValue={busca}
          placeholder="Nome da família"
          containerClassName="min-w-48 flex-1"
          acessorio={
            <Search
              aria-hidden="true"
              className="text-texto-2 mr-3 size-4 shrink-0"
            />
          }
        />
        <Botao type="submit" variante="secundario" className="tablet:self-end">
          Buscar
        </Botao>
      </form>

      <div className="pt-8">
        {falhou ? (
          <FaixaAlerta
            variante="erro"
            titulo="Não foi possível carregar as famílias agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : familias.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={
              busca ? (
                <FolhaLupa tamanho={104} />
              ) : (
                <ChaveDeCasa tamanho={104} />
              )
            }
            titulo={
              busca
                ? "Nenhuma família encontrada"
                : "Nenhuma família cadastrada ainda"
            }
            texto={
              busca
                ? `Nenhum nome parecido com "${busca}". Confira a grafia ou busque pelo sobrenome.`
                : "Quando a primeira família chegar pela Isadora ou for cadastrada no pipeline, ela entra nesta lista, com a ficha a um toque."
            }
          />
        ) : (
          // Três blocos pela fase da família (DESIGN.md, 6.1, item 1): quem
          // está gestando (o tempo até a DPP, lavanda), quem já teve o bebê
          // (areia, a família) e quem está com o freio em bloqueio ou
          // encerrada em estado sensível, em branco e sem tom, fora da
          // palavra "gestando" (seção 11.8). Freio em atenção fica na fase
          // dela, com o selo.
          <div className="flex flex-col gap-10">
            {GRUPOS.map((grupo) => {
              const doGrupo = familias.filter(
                (f) => grupoDa(f) === grupo.chave,
              );
              if (doGrupo.length === 0) return null;
              return (
                <SecaoBloco
                  key={grupo.chave}
                  idTitulo={`t-familias-${grupo.chave}`}
                  titulo={grupo.titulo}
                  icone={grupo.icone}
                  tom={grupo.tom ?? "areia"}
                  semTom={!grupo.tom}
                  contagem={doGrupo.length}
                >
                  <ListaBlocos className="tablet:grid tablet:grid-cols-2 lg:grid-cols-3">
                    {doGrupo.map((familia) => (
                      <LinhaFamilia
                        key={familia.id}
                        familia={familia}
                        tom={grupo.tom}
                      />
                    ))}
                  </ListaBlocos>
                </SecaoBloco>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
