import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ClipboardPen,
  FileSignature,
  MapPin,
  MessagesSquare,
  Radar,
  Siren,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { CabecalhoSaudacao } from "@/components/shell/cabecalho-saudacao";
import { saudacao } from "@/components/shell/saudacao";
import { BlocoAba } from "@/components/ui/bloco-aba";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { Selo } from "@/components/ui/selo";
import {
  hojeEmBrasilia,
  horaCurta,
  inicioDaSemana,
  somarDias,
} from "@/lib/agenda/datas";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { AlertaClinicoResumo } from "@/lib/dados/tipos-assistencial";
import type { AgendaPeriodo, EquipeVisao } from "@/lib/dados/tipos-equipe";
import type { Radar as RadarDados } from "@/lib/dados/tipos-operacao";
import type { CapacidadeVisao } from "@/lib/dados/tipos-gestao";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";
import { formatarDiaSemanaEData } from "@/lib/formatacao";
import { ROTULO_ESTADO_SENSIVEL } from "@/modules/crm/ficha/rotulos";
import { quandoSessao, separarAgenda } from "@/modules/crm/sessao-venda/agenda";
import { obterTelaCapacidade } from "@/modules/operacao/capacidade/dados";
import {
  fraseResumo,
  ROTULO_NIVEL,
  tituloDoAlerta,
} from "@/modules/operacao/capacidade/textos";
import { fraseSinteseEquipe } from "@/modules/operacao/equipe/textos";
import { obterTelaPainel, type DadosPainel } from "@/modules/painel/dados";
import { contraAnterior, fraseDoPainel } from "@/modules/painel/textos";
import {
  alertasEmOrdem,
  contextoFichas,
  contextoOfertas,
  contextoVisitasHoje,
  fichasSemAssinatura,
  fraseAlertas,
  fraseRadar,
  fraseSessoes,
  linhaDaEnfermeira,
  linhaNasceu,
  linhaRadar,
  radarDaSemana,
  ROTULO_SEVERIDADE,
  visitasPorEnfermeira,
  visitasQueContam,
  type VisitasDaEnfermeira,
} from "./textos-gestao";

/**
 * Início da coordenação e da diretoria [polimento] (fluxo C; DESIGN.md
 * 2.13 e 11.4), no mesmo padrão do Início do comercial e do Hoje da
 * enfermeira: o bloco do dia com o cumprimento em aba, o trio de números
 * (um em marinho, dois em tom médio) e, embaixo, os blocos com aba de cada
 * assunto. Só leituras que já existem; cada uma falha sozinha, sem derrubar
 * o Início (o bloco diz que não carregou).
 *
 * Tons por tela (no máximo quatro): dourado no bloco do dia, marinho no
 * número principal, argila para pessoas e conversas, lavanda para o tempo.
 * Alertas clínicos ficam no bloco neutro, sem tom de apoio (PRD 20.2
 * [v4.4], regra 3).
 */

async function tentar<T>(ler: () => Promise<T>): Promise<T | null> {
  try {
    return await ler();
  } catch {
    return null;
  }
}

interface DadosDoDia {
  hoje: string;
  equipe: EquipeVisao | null;
  semana: AgendaPeriodo | null;
  alertas: AlertaClinicoResumo[] | null;
}

async function lerDoDia(): Promise<DadosDoDia> {
  const repos = await obterRepositorios();
  const hoje = hojeEmBrasilia();
  const segunda = inicioDaSemana(hoje);
  const [equipe, semana, alertas] = await Promise.all([
    tentar(() => repos.equipe.obterEquipe({ dia: hoje })),
    tentar(() =>
      repos.equipe.obterAgenda({ desde: segunda, ate: somarDias(segunda, 6) }),
    ),
    tentar(() => repos.assistencial.listarAlertas("abertos")),
  ]);
  return { hoje, equipe, semana, alertas };
}

export async function InicioCoordenacao({ sessao }: { sessao: SessaoUsuario }) {
  const repos = await obterRepositorios();
  const [dia, radar, sessoes] = await Promise.all([
    lerDoDia(),
    tentar(() => repos.operacao.radar(null)),
    tentar(() => repos.venda.listarSessoes()),
  ]);
  const porEnfermeira = dia.semana
    ? visitasPorEnfermeira(dia.semana.visitas, dia.hoje)
    : [];

  return (
    <>
      <CabecalhoSaudacao
        saudacao={saudacao(sessao.nome)}
        titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
        frase={
          dia.equipe
            ? `Equipe agora: ${fraseSinteseEquipe(dia.equipe.resumo)}`
            : undefined
        }
      >
        <TrioDoDia dia={dia} porEnfermeira={porEnfermeira} />
      </CabecalhoSaudacao>
      <div className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-2">
        <BlocoAlertas alertas={dia.alertas} />
        <BlocoVisitasHoje
          porEnfermeira={dia.semana ? porEnfermeira : null}
          limite={dia.semana?.limiteVisitasDia ?? null}
        />
        <BlocoRadar radar={radar} hoje={dia.hoje} />
        <BlocoSessoes sessoes={sessoes} />
      </div>
    </>
  );
}

export async function InicioDiretoria({ sessao }: { sessao: SessaoUsuario }) {
  const [dia, painel, capacidade] = await Promise.all([
    lerDoDia(),
    tentar(() => obterTelaPainel(sessao, null)),
    tentar(() => obterTelaCapacidade(sessao)),
  ]);
  const porEnfermeira = dia.semana
    ? visitasPorEnfermeira(dia.semana.visitas, dia.hoje)
    : [];
  const dadosPainel = painel?.situacao === "ok" ? painel.dados : null;

  return (
    <>
      <CabecalhoSaudacao
        saudacao={saudacao(sessao.nome)}
        titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
        frase={
          dadosPainel
            ? fraseDoPainel(dadosPainel.atual)
            : dia.equipe
              ? `Equipe agora: ${fraseSinteseEquipe(dia.equipe.resumo)}`
              : undefined
        }
      >
        {dadosPainel ? (
          <TrioDoMes dados={dadosPainel} />
        ) : (
          <TrioDoDia dia={dia} porEnfermeira={porEnfermeira} />
        )}
      </CabecalhoSaudacao>
      <div className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-2">
        <BlocoAlertas alertas={dia.alertas} />
        <BlocoVisitasHoje
          porEnfermeira={dia.semana ? porEnfermeira : null}
          limite={dia.semana?.limiteVisitasDia ?? null}
        />
        <BlocoCapacidade
          visao={capacidade?.situacao === "ok" ? capacidade.visao : null}
        />
        <BlocoPainel mostrarMes={Boolean(dadosPainel)} />
      </div>
    </>
  );
}

// --- Trio de números ------------------------------------------------------------

function Trio({ children }: { children: React.ReactNode }) {
  return (
    <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:max-w-[760px] lg:gap-3">
      {children}
    </div>
  );
}

function TrioDoDia({
  dia,
  porEnfermeira,
}: {
  dia: DadosDoDia;
  porEnfermeira: VisitasDaEnfermeira[];
}) {
  const visitasHoje = dia.semana
    ? visitasQueContam(dia.semana.visitas).filter((v) => v.data === dia.hoje)
        .length
    : null;
  const fichas = dia.semana ? fichasSemAssinatura(dia.semana.visitas) : null;
  const ofertas = dia.equipe?.resumo.ofertaPendente ?? null;
  return (
    <Trio>
      {visitasHoje !== null ? (
        <CartaoResumo
          destaque
          className="tablet:col-span-1 col-span-2"
          fundo="marinho"
          tom="argila"
          icone={<MapPin />}
          valor={visitasHoje}
          rotulo={visitasHoje === 1 ? "visita hoje" : "visitas hoje"}
          contexto={contextoVisitasHoje(porEnfermeira)}
          href="#inicio-visitas"
        />
      ) : null}
      {fichas ? (
        <CartaoResumo
          fundo="medio"
          tom="argila"
          icone={<ClipboardPen />}
          valor={fichas.length}
          rotulo={
            fichas.length === 1
              ? "ficha sem assinatura"
              : "fichas sem assinatura"
          }
          contexto={contextoFichas(fichas.length)}
          href="/agenda"
        />
      ) : null}
      {ofertas !== null ? (
        <CartaoResumo
          fundo="medio"
          tom="lavanda"
          icone={<UserRoundCheck />}
          valor={ofertas}
          rotulo={
            ofertas === 1 ? "oferta sem resposta" : "ofertas sem resposta"
          }
          contexto={contextoOfertas(
            ofertas,
            dia.equipe?.resumo.ofertaMaisAntigaHoras ?? null,
          )}
          href="/equipe"
        />
      ) : null}
    </Trio>
  );
}

/** A frase de comparação vira contexto do cartão: minúscula, sem ponto. */
function emContexto(frase: string): string {
  const sem = frase.replace(/\.$/, "");
  return sem.charAt(0).toLowerCase() + sem.slice(1);
}

function TrioDoMes({ dados }: { dados: DadosPainel }) {
  const { atual, anterior } = dados;
  const c = atual.comercial;
  const o = atual.operacao;
  return (
    <Trio>
      <CartaoResumo
        destaque
        className="tablet:col-span-1 col-span-2"
        fundo="marinho"
        tom="argila"
        icone={<FileSignature />}
        valor={c.contratosAssinados}
        rotulo={
          c.contratosAssinados === 1
            ? "contrato assinado no mês"
            : "contratos assinados no mês"
        }
        contexto={`meta de ${atual.metas.contratosMes}`}
        href="/painel"
      />
      <CartaoResumo
        fundo="medio"
        tom="argila"
        icone={<Users />}
        valor={o.familiasAtivas}
        rotulo={
          o.familiasAtivas === 1
            ? "família em atendimento"
            : "famílias em atendimento"
        }
        contexto={
          o.familiasIniciadas === 1
            ? "1 começou no mês"
            : `${o.familiasIniciadas} começaram no mês`
        }
        href="/equipe"
      />
      <CartaoResumo
        fundo="medio"
        tom="lavanda"
        icone={<CalendarDays />}
        valor={o.visitasRealizadas}
        rotulo={
          o.visitasRealizadas === 1
            ? "visita realizada no mês"
            : "visitas realizadas no mês"
        }
        contexto={emContexto(
          contraAnterior(
            o.visitasRealizadas,
            anterior?.operacao.visitasRealizadas,
            atual.mes,
          ) ?? "sem mês anterior para comparar",
        )}
        href="/agenda"
      />
    </Trio>
  );
}

// --- Blocos ------------------------------------------------------------------------

function NaoCarregou({ oque }: { oque: string }) {
  return (
    <p className="rounded-2 bg-superficie text-apoio text-texto p-4">
      {oque} não carregou agora. Nada se perdeu: confira a conexão e recarregue
      a página.
    </p>
  );
}

function Frase({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-corpo text-texto max-w-[60ch] px-1 pb-1">{children}</p>
  );
}

function Linha({
  href,
  titulo,
  apoio,
  lateral,
}: {
  href: string;
  titulo: React.ReactNode;
  apoio?: React.ReactNode;
  lateral?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="rounded-2 bg-superficie ease-estado hover:shadow-1 flex min-h-[64px] items-center gap-3 px-4 py-3 text-inherit no-underline transition-shadow duration-140"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-corpo text-texto leading-snug font-semibold">
            {titulo}
          </span>
          {apoio ? (
            <span className="text-apoio text-texto-2">{apoio}</span>
          ) : null}
        </span>
        {lateral}
      </Link>
    </li>
  );
}

function BlocoAlertas({ alertas }: { alertas: AlertaClinicoResumo[] | null }) {
  const lista = alertas ? alertasEmOrdem(alertas) : [];
  return (
    <BlocoAba
      tom="neutro"
      icone={<Siren />}
      titulo="Alertas clínicos"
      idTitulo="inicio-alertas"
      contagem={alertas ? alertas.length : undefined}
      acao={{ rotulo: "Abrir os alertas clínicos", href: "/alertas-clinicos" }}
    >
      {alertas === null ? (
        <NaoCarregou oque="A lista de alertas" />
      ) : (
        <>
          <Frase>{fraseAlertas(alertas)}</Frase>
          {lista.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {lista.slice(0, 4).map((a) => (
                <Linha
                  key={a.id}
                  href="/alertas-clinicos"
                  titulo={a.nomeFamilia}
                  apoio={
                    a.diaNumero
                      ? `D${a.diaNumero}, ${a.acionadoEm ? "acionamento registrado" : "espera o registro do acionamento"}`
                      : a.acionadoEm
                        ? "acionamento registrado"
                        : "espera o registro do acionamento"
                  }
                  lateral={
                    <Selo
                      variante={
                        a.estadoSensivel !== "normal"
                          ? "sensivel"
                          : a.severidade === "imediato"
                            ? "alerta"
                            : a.severidade === "prioritario"
                              ? "aviso"
                              : "neutro"
                      }
                    >
                      {ROTULO_SEVERIDADE[a.severidade]}
                    </Selo>
                  }
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </BlocoAba>
  );
}

function BlocoVisitasHoje({
  porEnfermeira,
  limite,
}: {
  porEnfermeira: VisitasDaEnfermeira[] | null;
  limite: number | null;
}) {
  return (
    <BlocoAba
      tom="argila"
      icone={<MapPin />}
      titulo="Visitas de hoje"
      idTitulo="inicio-visitas"
      contagem={
        porEnfermeira
          ? porEnfermeira.reduce((s, e) => s + e.visitas.length, 0)
          : undefined
      }
      acao={{ rotulo: "Ver a agenda do dia", href: "/agenda?visao=dia" }}
    >
      {porEnfermeira === null ? (
        <NaoCarregou oque="A agenda de hoje" />
      ) : porEnfermeira.length === 0 ? (
        <Frase>
          Nenhuma visita marcada para hoje. As visitas aparecem aqui por
          enfermeira, na ordem do dia.
        </Frase>
      ) : (
        <ul className="flex flex-col gap-2">
          {porEnfermeira.map((e) => (
            <li
              key={e.profissionalId}
              className="rounded-2 bg-superficie flex flex-col gap-2 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-corpo text-texto font-semibold">
                  {e.nome}
                </span>
                {limite ? (
                  <span className="text-apoio text-texto-2">
                    {linhaDaEnfermeira(e.visitas.length, limite)}
                  </span>
                ) : null}
              </div>
              {limite ? (
                <span aria-hidden="true" className="flex gap-1">
                  {Array.from({
                    length: Math.max(limite, e.visitas.length),
                  }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < e.visitas.length
                          ? "rounded-pilula bg-marinho h-2 flex-1"
                          : "rounded-pilula bg-argila-media h-2 flex-1"
                      }
                    />
                  ))}
                </span>
              ) : null}
              <span className="text-apoio text-texto-2">
                {e.visitas
                  .map(
                    (v) =>
                      `${horaCurta(v.horaPrevista) ?? (v.turno === "tarde" ? "tarde" : "manhã")} ${v.nomeExibicao}`,
                  )
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlocoAba>
  );
}

function BlocoRadar({
  radar,
  hoje,
}: {
  radar: RadarDados | null;
  hoje: string;
}) {
  const domingo = somarDias(inicioDaSemana(hoje), 6);
  const semana = radar ? radarDaSemana(radar.familias, hoje, domingo) : [];
  return (
    <BlocoAba
      tom="lavanda"
      icone={<Radar />}
      titulo="Radar da semana"
      idTitulo="inicio-radar"
      contagem={radar ? semana.length + radar.nasceram.length : undefined}
      acao={{ rotulo: "Abrir o radar", href: "/radar" }}
    >
      {radar === null ? (
        <NaoCarregou oque="O radar" />
      ) : (
        <>
          <Frase>{fraseRadar(semana.length, radar.nasceram.length)}</Frase>
          {semana.length + radar.nasceram.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {radar.nasceram.slice(0, 3).map((n) => (
                <Linha
                  key={`n-${n.familiaId}`}
                  href={`/radar/${n.familiaId}`}
                  titulo={n.nome}
                  apoio={linhaNasceu(n)}
                />
              ))}
              {semana.slice(0, 4).map((f) => (
                <Linha
                  key={f.familiaId}
                  href={`/radar/${f.familiaId}`}
                  titulo={f.nome}
                  apoio={linhaRadar(f)}
                  lateral={
                    f.estadoSensivel !== "normal" ? (
                      <Selo variante="sensivel">
                        {ROTULO_ESTADO_SENSIVEL[f.estadoSensivel]}
                      </Selo>
                    ) : !f.titular ? (
                      <Selo variante="aviso">Sem titular</Selo>
                    ) : null
                  }
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </BlocoAba>
  );
}

function BlocoSessoes({ sessoes }: { sessoes: SessaoVenda[] | null }) {
  const agenda = sessoes ? separarAgenda(sessoes) : null;
  const proximas = agenda
    ? agenda.proximas.reduce((s, g) => s + g.sessoes.length, 0)
    : 0;
  return (
    <BlocoAba
      tom="argila"
      icone={<MessagesSquare />}
      titulo="Conversas de orientação"
      idTitulo="inicio-sessoes"
      contagem={agenda ? agenda.pedemRegistro.length : undefined}
      acao={{ rotulo: "Abrir as sessões de venda", href: "/sessoes-venda" }}
    >
      {agenda === null ? (
        <NaoCarregou oque="A agenda das conversas" />
      ) : (
        <>
          <Frase>{fraseSessoes(agenda.pedemRegistro.length, proximas)}</Frase>
          {agenda.pedemRegistro.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {agenda.pedemRegistro.slice(0, 3).map((s) => (
                <Linha
                  key={s.id}
                  href={`/sessoes-venda/${s.id}`}
                  titulo={s.nomeFamilia}
                  apoio={s.agendadaPara ? quandoSessao(s.agendadaPara) : null}
                  lateral={<Selo variante="aviso">Espera registro</Selo>}
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </BlocoAba>
  );
}

function BlocoCapacidade({ visao }: { visao: CapacidadeVisao | null }) {
  return (
    <BlocoAba
      tom="lavanda"
      icone={<BarChart3 />}
      titulo="Capacidade"
      idTitulo="inicio-capacidade"
      contagem={visao ? visao.alertas.length : undefined}
      acao={{ rotulo: "Abrir a capacidade", href: "/capacidade" }}
    >
      {visao === null ? (
        <NaoCarregou oque="A capacidade" />
      ) : (
        <>
          <Frase>{fraseResumo(visao)}</Frase>
          {visao.alertas.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {visao.alertas.slice(0, 4).map((a) => (
                <Linha
                  key={`${a.regiaoId}-${a.semana}`}
                  href="/capacidade"
                  titulo={tituloDoAlerta(a)}
                  lateral={
                    <Selo
                      variante={a.nivel === "sobrevenda" ? "alerta" : "aviso"}
                    >
                      {ROTULO_NIVEL[a.nivel]}
                    </Selo>
                  }
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </BlocoAba>
  );
}

function BlocoPainel({ mostrarMes }: { mostrarMes: boolean }) {
  return (
    <BlocoAba
      tom="argila"
      icone={<Users />}
      titulo="Painel executivo"
      idTitulo="inicio-painel"
      acao={{ rotulo: "Abrir o painel executivo", href: "/painel" }}
    >
      <Frase>
        {mostrarMes
          ? "Venda, marketing, operação, experiência e dinheiro do mês, cada um comparado com o mês anterior e com a meta."
          : "Os números do mês pedem a verificação em duas etapas. Abra o painel para confirmar o código e ver venda, operação e dinheiro."}
      </Frase>
    </BlocoAba>
  );
}
