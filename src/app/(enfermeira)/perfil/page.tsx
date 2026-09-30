import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CalendarOff,
  FileCheck,
  GraduationCap,
  House,
  Smartphone,
  UserRound,
} from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { hojeEmBrasilia, somarDias } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import { SeloEstadoProfissional } from "@/modules/operacao/equipe/componentes/selo-estado";
import {
  ROTULO_FUNCAO,
  ROTULO_SITUACAO_DOCUMENTO,
} from "@/modules/operacao/equipe/textos";
import { AvisosNoAparelho } from "@/modules/operacao/instalacao/avisos-no-aparelho";
import { BotaoSairPortal } from "@/modules/operacao/portal/componentes/botao-sair-portal";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import { diaEmFrase } from "@/modules/operacao/portal/textos";

export const metadata: Metadata = { title: "Perfil · Kraamzorg OS" };

const VARIANTE_SITUACAO = {
  vencido: "alerta",
  vencendo: "aviso",
  em_dia: "sucesso",
  sem_validade: "neutro",
} as const;

const FUNDO: Record<Tom, string> = {
  dourado: "bg-dourado-claro",
  areia: "bg-areia-clara",
  salvia: "bg-salvia-clara",
  lavanda: "bg-lavanda-clara",
  argila: "bg-argila-clara",
};

/** Um assunto do perfil (direção "Colo"): título com o tile e o bloco no tom. */
function Secao({
  id,
  titulo,
  icone,
  tom,
  children,
}: {
  id: string;
  titulo: string;
  icone: ReactNode;
  tom: Tom;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <TituloSecao id={id} icone={icone} tom={tom} titulo={titulo} />
      <div className={cn("rounded-3 flex flex-col gap-2 p-3", FUNDO[tom])}>
        {children}
      </div>
    </section>
  );
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/**
 * Perfil da enfermeira (P38 item 1): como a coordenação vê você agora (o
 * estado é calculado, você não marca), a semana com as visitas de cada dia,
 * a validade dos documentos e os bloqueios de agenda que a coordenação
 * cadastrou. Sair fica aqui porque o portal não tem barra lateral.
 */
export default async function PaginaPerfil() {
  const sessao = await exigirSessao("/perfil");
  const { portal } = await obterRepositorios();
  const [perfil, familias] = await Promise.all([
    portal.obterPerfil(),
    portal.listarFamilias(),
  ]);
  const hoje = hojeEmBrasilia();
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i));
  const visitasDoDia = (dia: string) =>
    familias
      .flatMap((f) =>
        f.visitas
          .filter(
            (v) =>
              v.data === dia &&
              v.estado !== "cancelada" &&
              v.estado !== "reagendada",
          )
          .map((v) => ({ ...v, nome: f.nomeExibicao })),
      )
      .sort((a, b) =>
        (a.horaPrevista ?? "99:99").localeCompare(b.horaPrevista ?? "99:99"),
      );

  const nome = perfil.profissional.nome || sessao.nome;
  const totalSemana = dias.reduce((n, dia) => n + visitasDoDia(dia).length, 0);

  return (
    <>
      <CabecalhoTela titulo="Perfil" lateral={<IndicadorPortal />} />
      <div className="flex flex-col gap-8 pt-6">
        <section
          aria-labelledby="p-estado"
          className="rounded-3 bg-argila-clara flex flex-col gap-4 p-5"
        >
          <div className="flex items-center gap-4">
            <TileIcone tom="argila" tamanho="g">
              <UserRound />
            </TileIcone>
            <div className="flex min-w-0 flex-col">
              <p className="font-titulo text-1 text-texto font-medium">
                {nome}
              </p>
              <p className="text-apoio text-texto-2">
                {ROTULO_FUNCAO[perfil.profissional.funcao] ??
                  perfil.profissional.funcao}
                {perfil.profissional.conselhoNumero
                  ? `, ${perfil.profissional.conselho ?? ""} ${perfil.profissional.conselhoNumero}${
                      perfil.profissional.conselhoUf
                        ? `/${perfil.profissional.conselhoUf}`
                        : ""
                    }`
                  : ""}
              </p>
            </div>
          </div>
          <div className="rounded-2 bg-superficie flex flex-col gap-2 px-4 py-3">
            <h2
              id="p-estado"
              className="text-apoio text-texto-2 flex flex-wrap items-center gap-3 font-normal"
            >
              Como você aparece agora
              <SeloEstadoProfissional estado={perfil.status} />
            </h2>
            <p className="text-apoio text-texto-2">
              O estado muda sozinho: em visita quando você chega, de volta ao
              anterior quando sai.
            </p>
          </div>
        </section>

        <Secao
          id="p-semana"
          titulo="Sua semana"
          icone={<CalendarDays />}
          tom="lavanda"
        >
          <p className="text-apoio text-texto-2 px-2 pt-1">
            {totalSemana === 0
              ? "Nenhuma visita marcada nos próximos sete dias."
              : totalSemana === 1
                ? "1 visita nos próximos sete dias."
                : `${totalSemana} visitas nos próximos sete dias.`}
          </p>
          <ol className="flex flex-col gap-2">
            {dias.map((dia) => {
              const lista = visitasDoDia(dia);
              const ehHoje = dia === hoje;
              const semana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
              return (
                <li
                  key={dia}
                  className={cn(
                    "rounded-2 grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 px-3 py-2.5",
                    ehHoje ? "bg-dourado-claro" : "bg-superficie",
                  )}
                  data-dia={dia}
                >
                  <p className="flex flex-col items-center leading-tight">
                    <span className="sr-only">
                      {ehHoje ? `Hoje, ${diaEmFrase(dia)}` : diaEmFrase(dia)}
                    </span>
                    <span aria-hidden="true" className="text-mini text-texto-2">
                      {ehHoje ? "hoje" : DIAS_CURTOS[semana]}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-titulo text-numero-sm text-texto font-medium tabular-nums"
                    >
                      {dia.slice(8, 10)}
                    </span>
                  </p>
                  <div className="flex min-h-11 flex-col justify-center gap-1">
                    {lista.length === 0 ? (
                      <p className="text-apoio text-texto-2">
                        Sem visita marcada.
                      </p>
                    ) : (
                      lista.map((v) => (
                        <p key={v.visitaId} className="text-corpo text-texto">
                          <span className="font-mono font-medium">
                            {v.horaPrevista ?? "sem hora"}
                          </span>{" "}
                          {v.nome}
                          <span className="text-apoio text-texto-2">
                            , dia {v.diaNumero}
                          </span>
                        </p>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Secao>

        <Secao
          id="p-documentos"
          titulo="Seus documentos"
          icone={<FileCheck />}
          tom="areia"
        >
          {perfil.documentos.length === 0 ? (
            <EstadoVazio
              nivelTitulo="h3"
              variante="tracejado"
              titulo="Nenhum documento cadastrado"
              texto="A coordenação cadastra a carteira do conselho e o que mais tiver validade. Ela avisa você antes de vencer."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {perfil.documentos.map((d) => (
                <li
                  key={d.id}
                  className="rounded-2 bg-superficie flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="flex flex-col">
                    <span className="text-corpo text-texto font-semibold">
                      {d.tipo}
                    </span>
                    <span className="text-apoio text-texto-2 font-mono">
                      {d.validade
                        ? `validade ${formatarData(d.validade)}`
                        : "sem validade"}
                    </span>
                  </span>
                  <Selo variante={VARIANTE_SITUACAO[d.situacao]}>
                    {ROTULO_SITUACAO_DOCUMENTO[d.situacao]}
                  </Selo>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {perfil.bloqueios.length > 0 ? (
          <Secao
            id="p-bloqueios"
            titulo="Dias em que você não recebe visitas"
            icone={<CalendarOff />}
            tom="lavanda"
          >
            <ul className="flex flex-col gap-2">
              {perfil.bloqueios.map((b) => (
                <li
                  key={b.id}
                  className="rounded-2 bg-superficie text-corpo text-texto px-4 py-3 font-mono"
                >
                  {formatarData(b.inicio)} a {formatarData(b.fim)}
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        <section aria-labelledby="p-mais" className="flex flex-col gap-3">
          <TituloSecao
            id="p-mais"
            icone={<House />}
            tom="areia"
            titulo="Para o seu dia a dia"
          />
          <ListaBlocos>
            <ItemBloco
              href="/ofertas"
              icone={<House />}
              tom="areia"
              titulo="Ver as ofertas"
              apoio="Convites da coordenação para acompanhar uma família, para aceitar ou recusar."
            />
            <ItemBloco
              href="/treinamentos"
              icone={<GraduationCap />}
              tom="areia"
              titulo="Ver os treinamentos"
              apoio="A trilha de leitura que a coordenação montou para a sua função."
            />
            <ItemBloco
              href="/manuais"
              icone={<BookOpen />}
              tom="areia"
              titulo="Ver os manuais"
              apoio="Os manuais e protocolos da sua função."
            />
            <ItemBloco
              href="/instalar"
              icone={<Smartphone />}
              tom="areia"
              titulo="Ver como instalar"
              apoio="Instalado, o aplicativo abre o Hoje mesmo sem sinal e guarda o que você registrar."
            />
          </ListaBlocos>
        </section>

        <AvisosNoAparelho />

        <BotaoSairPortal />
      </div>
    </>
  );
}
