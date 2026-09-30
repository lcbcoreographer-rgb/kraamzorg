"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  House,
  OctagonPause,
  Search,
  Sun,
  Users,
} from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { FolhaLupa } from "@/components/ilustracoes";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import type { Tom } from "@/components/ui/tons";
import { localidade } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import {
  agruparPorFase,
  combinaComBusca,
  contarPorFiltro,
  FILTROS_FASE,
  ORDENS,
  ordenarFamilias,
  pareceTelefone,
  passaNoFiltro,
  TITULO_FASE,
  VAZIO_FILTRO,
  type FaseFamilia,
  type FiltroFase,
  type OrdemFamilias,
} from "../lista-familias";
import type { FamiliaListaTela } from "../tipos";

/**
 * Lista de famílias (pedido do dono em 30/09): filtros em pílula por fase
 * com a contagem, busca que filtra enquanto a pessoa digita, ordem por
 * nome, semanas ou cidade, e as famílias agrupadas pela fase. No
 * computador, linhas com colunas alinhadas; no celular, linhas compactas.
 *
 * A busca por nome, bairro e cidade acontece aqui, sem ir ao servidor e
 * sem gravar o texto na URL. Telefone vai ao servidor (o número não está
 * na lista): o formulário envia `?busca=` como antes.
 */

const TILE_FASE: Record<FaseFamilia, { tom?: Tom; icone: React.ReactNode }> = {
  gestando: { tom: "lavanda", icone: <CalendarClock /> },
  nasceu: { tom: "areia", icone: <House /> },
  atendimento: { tom: "dourado", icone: <Sun /> },
  sem_data: { tom: "areia", icone: <Users /> },
  // Sem tom: momento sensível (DESIGN.md, 11.8).
  freio: { icone: <OctagonPause /> },
};

/** O título da coluna do tempo muda com a fase. */
const COLUNA_TEMPO: Record<FaseFamilia, string> = {
  gestando: "Semanas",
  nasceu: "Nascimento ou alta",
  atendimento: "Atendimento",
  sem_data: "Data",
  freio: "Estado",
};

const ROTULO_FREIO: Record<FamiliaListaTela["estadoSensivel"], string> = {
  normal: "",
  atencao: "Freio em atenção",
  bloqueio_total: "Freio em bloqueio total",
  encerrado_sensivel: "Encerrado sensível",
};

// Classes estáticas (o Tailwind precisa ver a string inteira).
const GRADE_COM_PIPELINE =
  "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_1.25rem]";
const GRADE_SEM_PIPELINE =
  "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_1.25rem]";
/** No freio: família, cidade e o estado, sem as colunas do tempo e da venda. */
const GRADE_FREIO =
  "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.5fr)_minmax(0,3.7fr)_1.25rem]";

function gradeDa(fase: FaseFamilia, comPipeline: boolean): string {
  if (fase === "freio") return GRADE_FREIO;
  return comPipeline ? GRADE_COM_PIPELINE : GRADE_SEM_PIPELINE;
}

function Tempo({ familia }: { familia: FamiliaListaTela }) {
  if (!familia.tempo) return null;
  return (
    <span className="text-apoio text-texto inline-flex items-baseline gap-1.5">
      {familia.tempo.frase ? (
        <span className="text-texto-2">{familia.tempo.frase}</span>
      ) : null}
      <span className="font-mono font-medium tabular-nums">
        {familia.tempo.medida}
      </span>
    </span>
  );
}

function ProximoPasso({ familia }: { familia: FamiliaListaTela }) {
  const passo = familia.proximoPasso;
  if (!passo) return null;
  return (
    <span
      className={cn(
        "text-apoio inline-flex items-center gap-1.5",
        passo.tipo === "transferencia" || passo.tipo === "voce"
          ? "text-texto font-medium"
          : passo.tipo === "sem_responsavel"
            ? "text-aviso-texto font-medium"
            : "text-texto-2",
      )}
    >
      {passo.tipo === "transferencia" ? (
        <ArrowLeftRight
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={1.75}
        />
      ) : null}
      {passo.frase}
      {passo.data ? (
        <span className="font-mono tabular-nums">{passo.data}</span>
      ) : null}
    </span>
  );
}

function LinhaFamilia({
  familia,
  comPipeline,
}: {
  familia: FamiliaListaTela;
  comPipeline: boolean;
}) {
  const lugar = localidade(familia.bairro, familia.cidade);
  const emFreio = familia.fase === "freio";
  const seloFreio =
    familia.estadoSensivel !== "normal" ? (
      <Selo variante="sensivel" icone={<OctagonPause />}>
        {ROTULO_FREIO[familia.estadoSensivel]}
      </Selo>
    ) : null;
  return (
    <li>
      <Link
        href={`/familias/${familia.id}`}
        className={cn(
          "text-texto ease-estado hover:bg-marinho-08 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 no-underline transition-[background-color] duration-140 focus-visible:outline-offset-[-2px] lg:grid lg:min-h-14 lg:gap-x-4 lg:px-5 lg:py-2.5",
          gradeDa(familia.fase, comPipeline),
        )}
      >
        {/* Família: o nome e, embaixo, o que a equipe precisa saber antes
            de escrever (não contatar, freio em atenção). */}
        <span className="flex min-w-0 basis-full items-start justify-between gap-3 lg:basis-auto">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-corpo leading-snug font-semibold">
              {familia.nome}
            </span>
            {familia.naoContatar || (seloFreio && !emFreio) ? (
              <span className="flex flex-wrap gap-1.5">
                {familia.naoContatar ? (
                  <Selo variante="aviso">Não contatar</Selo>
                ) : null}
                {emFreio ? null : seloFreio}
              </span>
            ) : null}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-texto-2 mt-0.5 size-5 shrink-0 lg:hidden"
            strokeWidth={1.75}
          />
        </span>

        {emFreio ? (
          // Freio puxado: sem semana, sem estágio e sem próximo passo
          // comercial (DESIGN.md, 11.8 e 11.9). Fica onde a família mora, o
          // selo calmo e quem faz o contato.
          <>
            <span className="text-apoio text-texto-2 min-w-0">
              {lugar ?? ""}
            </span>
            <span className="flex min-w-0 basis-full flex-wrap items-center gap-x-3 gap-y-1 lg:basis-auto">
              {seloFreio}
              <span className="text-apoio text-texto-2">
                Só contato humano, pelo nome.
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0">
              <Tempo familia={familia} />
            </span>
            <span className="text-apoio text-texto-2 min-w-0">
              {lugar ?? ""}
            </span>
            {comPipeline ? (
              <>
                <span aria-hidden="true" className="h-0 basis-full lg:hidden" />
                <span className="text-apoio text-texto min-w-0">
                  {familia.estagio ?? ""}
                </span>
                <span className="min-w-0">
                  <ProximoPasso familia={familia} />
                </span>
              </>
            ) : null}
          </>
        )}

        <ChevronRight
          aria-hidden="true"
          className="text-texto-2 hidden size-5 lg:block"
          strokeWidth={1.75}
        />
      </Link>
    </li>
  );
}

function GrupoFase({
  fase,
  familias,
  comPipeline,
}: {
  fase: FaseFamilia;
  familias: FamiliaListaTela[];
  comPipeline: boolean;
}) {
  const tile = TILE_FASE[fase];
  const semTom = !tile.tom;
  return (
    <SecaoBloco
      idTitulo={`t-familias-${fase}`}
      titulo={TITULO_FASE[fase]}
      icone={tile.icone}
      tom={tile.tom ?? "areia"}
      semTom={semTom}
      contagem={familias.length}
      data-fase={fase}
      className={fase === "freio" ? "pt-2" : undefined}
    >
      <div
        className={cn(
          "rounded-3 bg-superficie overflow-hidden",
          semTom ? "border-linha border" : "shadow-1",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "border-linha text-mini text-texto-2 hidden gap-x-4 border-b px-5 py-3 font-semibold lg:grid",
            gradeDa(fase, comPipeline),
          )}
        >
          <span>Família</span>
          {fase === "freio" ? (
            <>
              <span>Cidade e bairro</span>
              <span>Estado</span>
            </>
          ) : (
            <>
              <span>{COLUNA_TEMPO[fase]}</span>
              <span>Cidade e bairro</span>
              {comPipeline ? (
                <>
                  <span>Estágio</span>
                  <span>Próximo passo</span>
                </>
              ) : null}
            </>
          )}
          <span />
        </div>
        <ul className="divide-linha divide-y">
          {familias.map((familia) => (
            <LinhaFamilia
              key={familia.id}
              familia={familia}
              comPipeline={comPipeline}
            />
          ))}
        </ul>
      </div>
    </SecaoBloco>
  );
}

export function ListaFamilias({
  familias,
  buscaInicial = "",
  resultadoBusca,
  ordemInicial = "nome",
  truncada = false,
}: {
  /** Todas as famílias que o papel vê (até o limite da lista). */
  familias: FamiliaListaTela[];
  /** O `?busca=` com que a página abriu. */
  buscaInicial?: string;
  /**
   * O que o servidor achou para `buscaInicial` (nome ou telefone, além do
   * limite da lista). Vale enquanto a busca digitada for a mesma.
   */
  resultadoBusca?: FamiliaListaTela[];
  ordemInicial?: OrdemFamilias;
  /** A lista chegou no limite: nem toda família está aqui sem busca. */
  truncada?: boolean;
}) {
  const [consulta, definirConsulta] = React.useState(buscaInicial);
  const [filtro, definirFiltro] = React.useState<FiltroFase>("todas");
  const [ordem, definirOrdem] = React.useState<OrdemFamilias>(ordemInicial);
  const idFormulario = React.useId();

  const comPipeline = familias.some((f) => f.estagio !== null);
  const buscaDoServidor =
    resultadoBusca && consulta.trim() === buscaInicial.trim();

  const achadas = React.useMemo(() => {
    const porTexto = pareceTelefone(consulta)
      ? []
      : familias.filter((f) => combinaComBusca(f, consulta));
    if (!buscaDoServidor) return porTexto;
    const ids = new Set(porTexto.map((f) => f.id));
    return [...porTexto, ...resultadoBusca!.filter((f) => !ids.has(f.id))];
  }, [familias, consulta, buscaDoServidor, resultadoBusca]);

  const contagem = contarPorFiltro(achadas);
  const visiveis = ordenarFamilias(
    achadas.filter((f) => passaNoFiltro(f, filtro)),
    ordem,
  );
  const grupos = agruparPorFase(visiveis);
  const telefonePendente = pareceTelefone(consulta) && !buscaDoServidor;
  const algumFiltro = consulta.trim() !== "" || filtro !== "todas";
  const total = Math.max(familias.length, achadas.length);

  function limpar() {
    definirConsulta("");
    definirFiltro("todas");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3 bg-areia-clara flex flex-col gap-4 p-4 lg:p-5">
        <form
          id={idFormulario}
          role="search"
          method="get"
          action="/familias"
          className="tablet:flex-row tablet:items-end flex flex-col gap-3"
        >
          <CampoTexto
            rotulo="Buscar"
            name="busca"
            type="search"
            value={consulta}
            onChange={(evento) => definirConsulta(evento.target.value)}
            placeholder="Nome, bairro, cidade ou telefone"
            autoComplete="off"
            containerClassName="min-w-0 flex-1"
            acessorio={
              <Search
                aria-hidden="true"
                className="text-texto-2 mr-3 size-4 shrink-0"
              />
            }
          />
          {telefonePendente ? (
            <Botao type="submit" variante="secundario">
              Buscar pelo telefone
            </Botao>
          ) : null}
        </form>

        <div
          role="group"
          aria-label="Filtrar pela fase da família"
          className="flex flex-wrap gap-2"
        >
          {FILTROS_FASE.map((item) => {
            const ativo = filtro === item.valor;
            return (
              <button
                key={item.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => definirFiltro(item.valor)}
                className={cn(
                  "min-h-toque rounded-pilula text-apoio ease-estado inline-flex items-center gap-2 border-[1.5px] px-4 font-semibold transition-[background-color,color,border-color] duration-140",
                  ativo
                    ? "border-marinho bg-marinho text-texto-inverso"
                    : "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
                )}
              >
                {item.valor === "com_freio" ? (
                  <OctagonPause
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                ) : null}
                {item.rotulo}
                <span className="text-mini font-mono font-medium tabular-nums">
                  <span className="sr-only">, </span>
                  {contagem[item.valor]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className="text-apoio text-texto-2 max-w-[62ch]">
          {telefonePendente
            ? "Para achar pelo telefone, toque em Buscar pelo telefone."
            : visiveis.length === total
              ? `${total} ${total === 1 ? "família" : "famílias"}.`
              : `Mostrando ${visiveis.length} de ${total} famílias.`}
          {truncada && !algumFiltro
            ? " A lista mostra as primeiras em ordem de nome; busque pelo nome ou pelo telefone para achar as outras."
            : ""}
        </p>
        {/* A ordem vai junto quando o formulário busca pelo telefone. */}
        <label className="text-apoio text-texto-2 inline-flex items-center gap-2">
          Ordenar por
          <span className="relative inline-flex">
            <select
              name="ordem"
              form={idFormulario}
              value={ordem}
              onChange={(evento) =>
                definirOrdem(evento.target.value as OrdemFamilias)
              }
              className="rounded-pilula border-borda-campo bg-superficie text-apoio text-texto min-h-toque hover:bg-marinho-08 ease-estado cursor-pointer appearance-none border-[1.5px] pr-10 pl-4 font-semibold transition-[background-color] duration-140"
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="text-texto pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
              strokeWidth={1.75}
            />
          </span>
        </label>
      </div>

      {grupos.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={<FolhaLupa tamanho={104} />}
          titulo="Nenhuma família nesta busca"
          texto={
            filtro !== "todas" && consulta.trim() === ""
              ? VAZIO_FILTRO[filtro]
              : consulta.trim()
                ? `Nada com "${consulta.trim()}"${filtro !== "todas" ? " neste filtro" : ""}. Confira a grafia, busque pelo bairro ou tente o telefone.`
                : "Nenhuma família nesta lista."
          }
          acao={
            algumFiltro ? (
              <Botao
                type="button"
                variante="secundario"
                tamanho="compacto"
                onClick={limpar}
              >
                Limpar busca e filtros
              </Botao>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {grupos.map((grupo) => (
            <GrupoFase
              key={grupo.fase}
              fase={grupo.fase}
              familias={grupo.familias}
              comPipeline={comPipeline}
            />
          ))}
        </div>
      )}
    </div>
  );
}
