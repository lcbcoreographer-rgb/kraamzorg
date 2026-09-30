import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Selo } from "@/components/ui/selo";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarData, formatarTelefone } from "@/lib/formatacao";
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

function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
    >
      <h2 id={id} className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </h2>
      {children}
    </section>
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

  return (
    <>
      <CabecalhoTela titulo={f.nomeExibicao} lateral={<IndicadorPortal />} />
      <div className="flex flex-col gap-5 pt-4">
        <Link
          href="/minhas-familias"
          className="text-apoio text-texto min-h-toque inline-flex items-center gap-2 self-start underline underline-offset-4"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar às famílias
        </Link>

        {sensivel ? (
          <p className="text-corpo text-sensivel border-sensivel rounded-2 border-l-4 py-2 pl-4">
            {sensivel}
          </p>
        ) : null}

        <p className="text-corpo text-texto">
          {rotuloAcompanhamento(familia?.acompanhamento?.estado)}.{" "}
          {fraseProximaVisita(proxima)}
        </p>

        <Secao id="f-casa" titulo="Casa e contato">
          {endereco ? (
            <a
              href={ligacaoDeMapa(endereco)}
              className="text-corpo text-texto min-h-toque inline-flex items-start gap-2 underline underline-offset-4"
            >
              {endereco}
              <span className="sr-only">. Abre o mapa.</span>
            </a>
          ) : (
            <p className="text-corpo text-texto-2">
              Endereço ainda não cadastrado.
            </p>
          )}
          {f.endereco?.referencia ? (
            <p className="text-apoio text-texto-2">
              Referência: {f.endereco.referencia}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {ficha.pessoas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-corpo text-texto">
                  {p.nome}{" "}
                  <span className="text-apoio text-texto-2">
                    (
                    {(
                      ROTULO_PAPEL_PESSOA[
                        p.papel as keyof typeof ROTULO_PAPEL_PESSOA
                      ] ?? p.papel.replaceAll("_", " ")
                    ).toLowerCase()}
                    {p.contatoPrincipal ? ", contato principal" : ""})
                  </span>
                </span>
                {p.telefoneE164 ? (
                  <a
                    href={`tel:${p.telefoneE164}`}
                    className="text-corpo text-texto min-h-toque inline-flex items-center gap-2 underline underline-offset-4"
                    aria-label={`Ligar para ${p.nome.split(" ")[0]}, ${formatarTelefone(p.telefoneE164)}`}
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    <span className="font-mono">
                      {formatarTelefone(p.telefoneE164)}
                    </span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Secao>

        <Secao id="f-datas" titulo="Datas">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {f.dataNascimento ? (
              <>
                <dt className="text-apoio text-texto-2">Nascimento</dt>
                <dd className="text-corpo text-texto font-mono">
                  {formatarData(f.dataNascimento)}
                </dd>
              </>
            ) : f.dpp ? (
              <>
                <dt className="text-apoio text-texto-2">
                  Data provável do parto
                </dt>
                <dd className="text-corpo text-texto font-mono">
                  {formatarData(f.dpp)}
                  {f.idadeGestacional ? ` (${f.idadeGestacional})` : ""}
                </dd>
              </>
            ) : null}
            {f.dataAlta ? (
              <>
                <dt className="text-apoio text-texto-2">Alta</dt>
                <dd className="text-corpo text-texto font-mono">
                  {formatarData(f.dataAlta)}
                </dd>
              </>
            ) : null}
            {f.dataInicioEfetivo ? (
              <>
                <dt className="text-apoio text-texto-2">
                  Início do acompanhamento
                </dt>
                <dd className="text-corpo text-texto font-mono">
                  {formatarData(f.dataInicioEfetivo)}
                </dd>
              </>
            ) : null}
          </dl>
        </Secao>

        {ficha.bebes.length > 0 ? (
          <Secao
            id="f-bebes"
            titulo={ficha.bebes.length > 1 ? "Bebês" : "Bebê"}
          >
            <ul className="flex flex-col gap-2">
              {ficha.bebes.map((b) => (
                <li key={b.id} className="text-corpo text-texto">
                  {b.nome ?? `Bebê ${b.ordem}`}
                  {b.dataNascimento
                    ? `, nascido em ${formatarData(b.dataNascimento)}`
                    : ""}
                  {b.pesoNascimentoG
                    ? `, ao nascer ${b.pesoNascimentoG.toLocaleString("pt-BR")} g`
                    : ""}
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        {ficha.medicos.length > 0 ? (
          <Secao id="f-medicos" titulo="Médicos">
            <ul className="flex flex-col gap-2">
              {ficha.medicos.map((m) => (
                <li key={m.id} className="text-corpo text-texto">
                  {m.nome}{" "}
                  <span className="text-apoio text-texto-2">
                    (
                    {(
                      ROTULO_ESPECIALIDADE[
                        m.especialidade as keyof typeof ROTULO_ESPECIALIDADE
                      ] ?? m.especialidade.replaceAll("_", " ")
                    ).toLowerCase()}
                    {m.hospital ? `, ${m.hospital}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        {familia && familia.visitas.length > 0 ? (
          <Secao id="f-visitas" titulo="Visitas">
            <ul className="flex flex-col gap-2">
              {familia.visitas.map((v) => (
                <li
                  key={v.visitaId}
                  className="border-linha grid grid-cols-[1fr_auto] items-center gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-corpo text-texto">
                    Dia {v.diaNumero}, {diaEmFrase(v.data)}
                    {v.horaPrevista ? ` às ${v.horaPrevista}` : ""}
                  </span>
                  <Selo variante="neutro">
                    {ROTULO_ESTADO_VISITA[v.estado] ?? v.estado}
                  </Selo>
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}
      </div>
    </>
  );
}
