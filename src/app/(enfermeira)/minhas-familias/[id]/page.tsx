import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Baby,
  CalendarDays,
  House,
  MapPin,
  OctagonPause,
  Phone,
  Stethoscope,
} from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarData, formatarTelefone } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import { ROTULO_PAPEL_PESSOA } from "@/modules/crm/ficha/rotulos";
import { ROTULO_ESPECIALIDADE } from "@/modules/relacao/rotulos";
import { ROTULO_ESTADO_VISITA } from "@/modules/operacao/equipe/textos";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import {
  diaEmFrase,
  enderecoEmTexto,
  fraseEstadoSensivel,
  fraseProximaVisita,
  ligacaoDeMapa,
  proximaVisitaDaFamilia,
  rotuloAcompanhamento,
} from "@/modules/operacao/portal/textos";

export const metadata: Metadata = { title: "Família · Kraamzorg OS" };

/**
 * Um assunto da ficha (direção "Colo"): o título com o tile e um bloco no
 * tom do assunto. Família em pausa perde o tom (DESIGN.md 11.8).
 */
const FUNDO_SECAO: Record<Tom, string> = {
  dourado: "bg-dourado-claro",
  areia: "bg-areia-clara",
  salvia: "bg-salvia-clara",
  lavanda: "bg-lavanda-clara",
  argila: "bg-argila-clara",
};

function Secao({
  id,
  titulo,
  icone,
  tom,
  semTom,
  children,
}: {
  id: string;
  titulo: string;
  icone: ReactNode;
  tom: Tom;
  semTom: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <TituloSecao
        id={id}
        icone={icone}
        tom={semTom ? "neutro" : tom}
        titulo={titulo}
      />
      <div
        className={cn(
          "rounded-3 flex flex-col gap-2 p-3",
          semTom ? "bg-superficie border-linha border" : FUNDO_SECAO[tom],
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Uma linha branca dentro do bloco do assunto. */
function Linha({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-2 bg-superficie flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5",
        className,
      )}
    >
      {children}
    </li>
  );
}

/**
 * Ficha da família para a enfermeira (P38): contato, endereço, datas, bebês,
 * médicos e as visitas do acompanhamento. Só famílias atribuídas a ela: para
 * as outras o banco não devolve nada e a página diz que não encontrou. A
 * leitura fica no log de auditoria. Exige sinal (a ficha não é guardada no
 * aparelho); o Hoje guarda o essencial do dia.
 */
export default async function PaginaFamiliaDaEnfermeira({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await exigirSessao(`/minhas-familias/${id}`);
  const { portal } = await obterRepositorios();
  const [ficha, familias] = await Promise.all([
    portal.obterFichaAssistencial(id),
    portal.listarFamilias(),
  ]);
  if (!ficha) notFound();
  const familia = familias.find((f) => f.familiaId === id) ?? null;
  const f = ficha.familia;
  const endereco = enderecoEmTexto(f.endereco, f.cidade, f.bairro);
  const sensivel = fraseEstadoSensivel(f.estadoSensivel);
  const proxima = familia
    ? proximaVisitaDaFamilia(familia, hojeEmBrasilia())
    : null;

  const pausa =
    f.estadoSensivel === "bloqueio_total" ||
    f.estadoSensivel === "encerrado_sensivel";
  const hoje = hojeEmBrasilia();
  const total = familia?.acompanhamento?.diasContratados ?? null;
  const regua: DiaRegua[] | null =
    familia && total
      ? Array.from({ length: total }, (_, i): DiaRegua => {
          const numero = i + 1;
          const v = familia.visitas.find((x) => x.diaNumero === numero);
          if (v?.estado === "concluida")
            return { numero, estado: "feito", rotuloEstado: "feito" };
          if (v?.estado === "ficha_pendente")
            return {
              numero,
              estado: "pendente",
              rotuloEstado: "ficha pendente",
            };
          if (v?.data === hoje && proxima?.diaNumero === numero)
            return { numero, estado: "hoje", rotuloEstado: "hoje" };
          return { numero, estado: "futuro" };
        })
      : null;

  const datas: { rotulo: string; marca: string; valor: string }[] = [];
  if (f.dataNascimento)
    datas.push({
      rotulo: "Nascimento",
      marca: "fato",
      valor: formatarData(f.dataNascimento) ?? f.dataNascimento,
    });
  else if (f.dpp)
    datas.push({
      rotulo: "Data provável do parto",
      marca: "estimativa",
      valor: `${formatarData(f.dpp) ?? f.dpp}${f.idadeGestacional ? ` (${f.idadeGestacional})` : ""}`,
    });
  if (f.dataAlta)
    datas.push({
      rotulo: "Alta",
      marca: "fato",
      valor: formatarData(f.dataAlta) ?? f.dataAlta,
    });
  if (f.dataInicioEfetivo)
    datas.push({
      rotulo: "Início do acompanhamento",
      marca: "fato",
      valor: formatarData(f.dataInicioEfetivo) ?? f.dataInicioEfetivo,
    });
  const proximaHoje = proxima?.data === hoje;

  return (
    <>
      <CabecalhoTela titulo={f.nomeExibicao} lateral={<IndicadorPortal />} />
      <div className="flex flex-col gap-8 pt-4">
        <Link
          href="/minhas-familias"
          className="text-apoio text-texto min-h-toque -mb-4 inline-flex items-center gap-2 self-start underline underline-offset-4"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar às famílias
        </Link>

        {sensivel ? (
          <p className="text-corpo text-sensivel bg-sensivel-lavado border-sensivel-borda rounded-2 flex items-start gap-3 border px-4 py-3">
            <OctagonPause className="mt-1 size-5 shrink-0" aria-hidden="true" />
            {sensivel}
          </p>
        ) : null}

        <section
          aria-label="Onde a família está"
          className={cn(
            "rounded-3 flex flex-col gap-4 p-5",
            pausa ? "bg-superficie border-linha border" : "bg-areia-clara",
          )}
        >
          <p className="text-3 text-texto">
            {rotuloAcompanhamento(familia?.acompanhamento?.estado)}.
          </p>
          {regua && !pausa ? (
            <ReguaDias
              dias={regua}
              rotulo={`Acompanhamento de ${total} dias`}
            />
          ) : null}
          <p
            className={cn(
              "rounded-2 text-corpo text-texto flex items-center gap-3 px-3 py-2",
              pausa
                ? "border-linha border"
                : proximaHoje
                  ? "bg-dourado-claro"
                  : "bg-superficie",
            )}
          >
            {pausa ? null : (
              <TileIcone tom={proximaHoje ? "dourado" : "lavanda"} tamanho="p">
                <CalendarDays />
              </TileIcone>
            )}
            <span>{fraseProximaVisita(proxima)}</span>
          </p>
        </section>

        <Secao
          id="f-casa"
          titulo="Casa e contato"
          icone={<House />}
          tom="areia"
          semTom={pausa}
        >
          <ul className="flex flex-col gap-2">
            <Linha>
              {pausa ? null : (
                <TileIcone tom="areia" tamanho="p">
                  <MapPin />
                </TileIcone>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                {endereco ? (
                  <a
                    href={ligacaoDeMapa(endereco)}
                    className="text-corpo text-texto min-h-toque inline-flex items-center underline underline-offset-4"
                  >
                    {endereco}
                    <span className="sr-only">. Abre o mapa.</span>
                  </a>
                ) : (
                  <span className="text-corpo text-texto-2">
                    Endereço ainda não cadastrado.
                  </span>
                )}
                {f.endereco?.referencia ? (
                  <span className="text-apoio text-texto-2">
                    Referência: {f.endereco.referencia}
                  </span>
                ) : null}
              </span>
            </Linha>
            {ficha.pessoas.map((p) => (
              <Linha key={p.id}>
                {pausa ? null : (
                  <TileIcone tom="argila" tamanho="p">
                    <Phone />
                  </TileIcone>
                )}
                <span className="flex min-w-[12rem] flex-1 flex-col">
                  <span className="text-corpo text-texto font-semibold">
                    {p.nome}
                  </span>
                  <span className="text-apoio text-texto-2">
                    {(
                      ROTULO_PAPEL_PESSOA[
                        p.papel as keyof typeof ROTULO_PAPEL_PESSOA
                      ] ?? p.papel.replaceAll("_", " ")
                    ).toLowerCase()}
                    {p.contatoPrincipal ? ", contato principal" : ""}
                  </span>
                </span>
                {p.telefoneE164 ? (
                  <a
                    href={`tel:${p.telefoneE164}`}
                    className={cn(
                      "text-corpo text-texto min-h-toque tablet:pl-0 inline-flex items-center gap-2 underline underline-offset-4",
                      pausa ? null : "pl-12",
                    )}
                    aria-label={`Ligar para ${p.nome.split(" ")[0]}, ${formatarTelefone(p.telefoneE164)}`}
                  >
                    <span className="font-mono">
                      {formatarTelefone(p.telefoneE164)}
                    </span>
                  </a>
                ) : null}
              </Linha>
            ))}
          </ul>
        </Secao>

        {datas.length > 0 ? (
          <Secao
            id="f-datas"
            titulo="Datas"
            icone={<CalendarDays />}
            tom="lavanda"
            semTom={pausa}
          >
            <dl className="tablet:grid-cols-3 grid grid-cols-1 gap-2">
              {datas.map((d) => (
                <div
                  key={d.rotulo}
                  className="rounded-2 bg-superficie flex flex-col gap-0.5 px-4 py-2.5"
                >
                  <dt className="text-apoio text-texto-2">
                    {d.rotulo} <em>({d.marca})</em>
                  </dt>
                  <dd className="text-corpo text-texto font-mono font-medium">
                    {d.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </Secao>
        ) : null}

        {ficha.bebes.length > 0 ? (
          <Secao
            id="f-bebes"
            titulo={ficha.bebes.length > 1 ? "Bebês" : "Bebê"}
            icone={<Baby />}
            tom="areia"
            semTom={pausa}
          >
            <ul className="flex flex-col gap-2">
              {ficha.bebes.map((b) => (
                <Linha key={b.id}>
                  <span className="text-corpo text-texto font-semibold">
                    {b.nome ?? `Bebê ${b.ordem}`}
                  </span>
                  <span className="text-apoio text-texto-2">
                    {b.dataNascimento ? (
                      <>
                        nascido em{" "}
                        <span className="font-mono">
                          {formatarData(b.dataNascimento)}
                        </span>
                      </>
                    ) : null}
                    {b.pesoNascimentoG ? (
                      <>
                        {b.dataNascimento ? ", " : ""}ao nascer{" "}
                        <span className="font-mono">
                          {b.pesoNascimentoG.toLocaleString("pt-BR")} g
                        </span>
                      </>
                    ) : null}
                  </span>
                </Linha>
              ))}
            </ul>
          </Secao>
        ) : null}

        {ficha.medicos.length > 0 ? (
          <Secao
            id="f-medicos"
            titulo="Médicos"
            icone={<Stethoscope />}
            tom="argila"
            semTom={pausa}
          >
            <ul className="flex flex-col gap-2">
              {ficha.medicos.map((m) => (
                <Linha key={m.id}>
                  <span className="text-corpo text-texto font-semibold">
                    {m.nome}
                  </span>
                  <span className="text-apoio text-texto-2">
                    {(
                      ROTULO_ESPECIALIDADE[
                        m.especialidade as keyof typeof ROTULO_ESPECIALIDADE
                      ] ?? m.especialidade.replaceAll("_", " ")
                    ).toLowerCase()}
                    {m.hospital ? `, ${m.hospital}` : ""}
                  </span>
                </Linha>
              ))}
            </ul>
          </Secao>
        ) : null}

        {familia && familia.visitas.length > 0 ? (
          <Secao
            id="f-visitas"
            titulo="Visitas"
            icone={<CalendarDays />}
            tom="lavanda"
            semTom={pausa}
          >
            <ul className="flex flex-col gap-2">
              {familia.visitas.map((v) => (
                <Linha
                  key={v.visitaId}
                  className="grid grid-cols-[auto_1fr_auto] items-center"
                >
                  <span className="text-dado text-texto font-mono font-semibold">
                    D{v.diaNumero}
                  </span>
                  <span className="text-corpo text-texto">
                    {diaEmFrase(v.data)}
                    {v.horaPrevista ? (
                      <>
                        {" "}
                        às <span className="font-mono">{v.horaPrevista}</span>
                      </>
                    ) : null}
                  </span>
                  <Selo
                    variante={
                      v.estado === "concluida"
                        ? "sucesso"
                        : v.estado === "ficha_pendente"
                          ? "aviso"
                          : "neutro"
                    }
                  >
                    {ROTULO_ESTADO_VISITA[v.estado] ?? v.estado}
                  </Selo>
                </Linha>
              ))}
            </ul>
          </Secao>
        ) : null}
      </div>
    </>
  );
}
