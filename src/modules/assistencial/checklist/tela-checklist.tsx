"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BookOpen,
  CircleCheck,
  ClipboardList,
  Droplet,
  House,
  PenLine,
  Sprout,
  Thermometer,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { AnelProgresso } from "@/components/ui/anel-progresso";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { Botao } from "@/components/ui/botao";
import { BotaoFreio } from "@/components/ui/botao-freio";
import {
  Dialogo,
  DialogoConteudo,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { Comemoracao } from "@/components/ui/comemoracao";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import {
  caminhosDoInstrumento,
  sinaisDoSeletor,
} from "@/lib/checklist/alertas";
import { calcularCurvaPeso, type CurvaPeso } from "@/lib/checklist/curva-peso";
import {
  estadoDaEtapa,
  montarEtapas,
  type EtapaMontada,
} from "@/lib/checklist/etapas";
import { fraseDoErro } from "@/lib/checklist/erros";
import {
  valorObservadoEmTexto,
  formatarComUnidade,
} from "@/lib/checklist/formato";
import {
  bebesDoFormulario,
  dadosParaRespostas,
  montarDados,
  pendenciasDoRegistro,
  resumoDoDia,
  chaveAlerta,
  lerDoRegistro,
} from "@/lib/checklist/registro";
import {
  referenciaDoDiaAnterior,
  textosAguardandoConfirmacao,
} from "@/lib/checklist/referencia";
import type { AcionamentoAlerta } from "@/lib/checklist/registro";
import type { ChecklistVisita } from "@/lib/dados/tipos-assistencial";
import {
  acharCampo,
  campoVisivel,
  estaRespondido,
  lerValor,
  separarCaminho,
  type EnderecoCampo,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import type { Bloco, Campo } from "@/lib/instrumentos/schema";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { CampoDoChecklist } from "../componentes/campo-do-checklist";
import { CurvaDePeso } from "../componentes/curva-de-peso";
import { FaixaDoAlerta, FaixaMiniAlerta } from "../componentes/faixa-do-alerta";
import {
  FolhaAcionamento,
  horaAgoraEmBrasilia,
} from "../componentes/folha-acionamento";
import { FolhaSinais } from "../componentes/folha-sinais";
import { GravadorAudio } from "../componentes/gravador-audio";
import { JanelaApoio } from "../componentes/janela-apoio";
import { VisaoDosDados } from "../componentes/visao-dos-dados";
import type { AlertaNaTela } from "../tipos";
import { acaoAcionarFreioDoChecklist } from "./acoes";
import { textos } from "./textos";
import { useChecklist, type Aparelho } from "./use-checklist";

/**
 * Checklist diário (DOC 2) na casa da família (P39, fluxos.md fluxo A):
 * oito etapas, uma por tela, um toque por pergunta, cada resposta gravada
 * no aparelho na mesma hora, sem conexão como estado normal. Nada vem
 * marcado. O alerta clínico dispara no campo, no próprio aparelho, e a
 * faixa mostra a conduta aprovada. O registro se assina uma vez, no
 * aparelho, e depois só muda por adendo.
 */
export interface TelaChecklistProps {
  checklist: ChecklistVisita;
  usuarioId: string;
  /** Para onde o botão de voltar leva ("/hoje" para a enfermeira). */
  voltarPara: string;
  /** Injetáveis (teste); em uso normal são os do aparelho. */
  aparelho?: Aparelho;
  agora?: () => Date;
}

export function TelaChecklist(props: TelaChecklistProps) {
  const { checklist } = props;

  if (!checklist.instrumento) {
    return (
      <div className="pt-6">
        <EstadoVazio
          nivelTitulo="h2"
          titulo={textos.semInstrumentoTitulo}
          texto={textos.semInstrumentoTexto}
        />
      </div>
    );
  }
  return <ChecklistComInstrumento {...props} />;
}

const ESTADOS_QUE_ACEITAM_REGISTRO = [
  "iniciada",
  "concluida",
  "ficha_pendente",
  "ficha_entregue",
  "encerrada",
];

function ChecklistComInstrumento({
  checklist,
  usuarioId,
  voltarPara,
  aparelho,
  agora = () => new Date(),
}: TelaChecklistProps) {
  const router = useRouter();
  const c = useChecklist({ checklist, usuarioId, aparelho, agora });
  const definicao = checklist.instrumento!.definicao;
  const { rascunho } = c;
  const familia = checklist.familia;
  const sensivel =
    familia.estadoSensivel === "bloqueio_total" ||
    familia.estadoSensivel === "encerrado_sensivel";

  // Registro assinado que subiu: o rascunho do aparelho já não faz falta.
  React.useEffect(() => {
    if (rascunho?.assinadoEmMs && c.fila.registro?.estado === "sincronizado") {
      void c.limparRascunho().then(() => router.refresh());
    }
  }, [rascunho?.assinadoEmMs, c.fila.registro?.estado, c, router]);

  if (checklist.registro) {
    return (
      <VisaoAssinada
        checklist={checklist}
        c={c}
        voltarPara={voltarPara}
        usuarioId={usuarioId}
      />
    );
  }
  if (!ESTADOS_QUE_ACEITAM_REGISTRO.includes(checklist.visita.estado)) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <Link href={voltarPara} className="text-apoio text-texto underline">
          {textos.voltarParaHoje}
        </Link>
        <EstadoVazio
          nivelTitulo="h2"
          titulo={textos.visitaNaoIniciadaTitulo}
          texto={textos.visitaNaoIniciadaTexto}
        />
      </div>
    );
  }
  if (!c.carregado || !rascunho) {
    return (
      <p className="text-corpo text-texto-2 pt-6" role="status">
        {textos.carregando}
      </p>
    );
  }
  if (rascunho.assinadoEmMs) {
    return (
      <AguardandoEnvio
        checklist={checklist}
        c={c}
        voltarPara={voltarPara}
        definicao={definicao}
      />
    );
  }
  return (
    <Edicao
      checklist={checklist}
      c={c}
      voltarPara={voltarPara}
      usuarioId={usuarioId}
      sensivel={sensivel}
      agora={agora}
    />
  );
}

type Controle = ReturnType<typeof useChecklist>;

/**
 * Ícone do assunto de cada etapa, no tile do bloco da etapa (DESIGN.md,
 * 2.7). Só identifica a etapa; estado continua na faixa e no selo.
 */
const ICONE_DA_ETAPA: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  chegada: House,
  puerpera: UserRound,
  sinais_vitais: Thermometer,
  mamas: Droplet,
  bebe: Baby,
  orientacoes: BookOpen,
  emocional: Sprout,
  resumo: PenLine,
};

/**
 * Perguntas respondidas e perguntas visíveis da etapa (a barra "5 de 9
 * respondidas"). Na etapa por bebê, conta o bebê da aba aberta. Campo
 * automático e o bloco da assinatura não contam: ninguém responde a eles.
 */
function contagemDaEtapa(
  etapa: EtapaMontada,
  definicao: NonNullable<ChecklistVisita["instrumento"]>["definicao"],
  respostas: import("@/lib/instrumentos/respostas").RespostasFormulario,
  contexto: { ultimo_dia: boolean },
  bebe: string | undefined,
): { respondidas: number; total: number } {
  let respondidas = 0;
  let total = 0;
  for (const bloco of etapa.blocosDaDefinicao) {
    if (bloco.id === "assinatura") continue;
    const alvo = bloco.repete_por_bebe ? bebe : undefined;
    for (const campo of bloco.campos) {
      if (campo.tipo === "automatico") continue;
      const ambiente = { definicao, respostas, contexto, bebe: alvo };
      if (!campoVisivel(campo, ambiente)) continue;
      total += 1;
      const valor = lerValor(respostas, {
        bloco: bloco.id,
        campo: campo.id,
        bebe: alvo,
      });
      if (estaRespondido(campo, valor)) respondidas += 1;
    }
  }
  return { respondidas, total };
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

function estadoParaIndicador(c: Controle): {
  estado: EstadoSincronizacao;
  texto: string;
} {
  const { fila, online } = c;
  if (fila.comErro > 0) {
    return { estado: "erro", texto: textos.sincronizacao.erro };
  }
  if (fila.pendentes > 0) {
    return online
      ? {
          estado: "enviando",
          texto: textos.sincronizacao.enviando(fila.pendentes),
        }
      : { estado: "local", texto: textos.sincronizacao.local };
  }
  if (fila.sincronizadoEm) {
    return {
      estado: "sincronizado",
      texto: textos.sincronizacao.sincronizado(
        horaAgoraEmBrasilia(fila.sincronizadoEm),
      ),
    };
  }
  return { estado: "local", texto: textos.sincronizacao.local };
}

function Sincronizacao({ c }: { c: Controle }) {
  const { estado, texto } = estadoParaIndicador(c);
  return (
    <IndicadorSincronizacao
      estado={estado}
      texto={texto}
      aoTentarNovamente={estado === "erro" ? c.tentarEnviar : undefined}
      rotuloTentarNovamente={textos.sincronizacao.tentarAgora}
    />
  );
}

function AvisoSemSinal({ c }: { c: Controle }) {
  if (c.online) return null;
  return (
    <FaixaAlerta
      variante="info"
      titulo={textos.semSinalTitulo}
      className="mt-3"
    >
      {textos.semSinalTexto}
    </FaixaAlerta>
  );
}

// ---------------------------------------------------------------------------
// Alertas na tela
// ---------------------------------------------------------------------------

function comUnidade(
  definicao: ChecklistVisita["instrumento"] extends infer T
    ? T extends { definicao: infer D }
      ? D
      : never
    : never,
  caminho: string | null,
  texto: string | null,
): string | null {
  if (!texto) return null;
  if (!caminho) return texto;
  const achado = acharCampo(definicao, caminho);
  if (achado?.campo.tipo === "numero" && achado.campo.unidade) {
    return `${texto} ${achado.campo.unidade}`;
  }
  return texto;
}

function useAlertasNaTela(
  checklist: ChecklistVisita,
  c: Controle,
  sensivel: boolean,
): AlertaNaTela[] {
  const { rascunho } = c;
  const definicao = checklist.instrumento!.definicao;
  return React.useMemo(() => {
    if (!rascunho) return [];
    const resultado = new Map<string, AlertaNaTela>();
    const rotuloBebe = (id: string | null) =>
      id ? (c.bebes.find((b) => b.id === id)?.rotulo ?? null) : null;

    const montar = (
      regraId: string,
      bebeId: string | null,
      campo: string | null,
      valor: string | null,
      servidor?: AlertaNaTela["servidor"],
    ) => {
      const regra = checklist.regras.find((r) => r.id === regraId);
      if (!regra) return;
      const chave = chaveAlerta(regraId, bebeId);
      const doRascunho = rascunho.acionamentos.find(
        (a) => chaveAlerta(a.regraId, a.bebeId) === chave,
      );
      const doServidor = checklist.alertas.find(
        (a) => chaveAlerta(a.regraId, a.bebeId) === chave,
      );
      const acionamento: AcionamentoAlerta | undefined =
        doRascunho ??
        (doServidor?.sinalIdentificado && doServidor.acionadoEm
          ? {
              regraId,
              bebeId,
              sinalIdentificado: doServidor.sinalIdentificado,
              acionadoEm: doServidor.acionadoEm,
              orientacaoMedica: doServidor.orientacaoMedica ?? "",
              condutaAdotada: doServidor.condutaAdotada ?? "",
            }
          : undefined);
      resultado.set(chave, {
        chave,
        regraId,
        bebeId,
        bebeRotulo: rotuloBebe(bebeId),
        grupo: regra.grupo,
        severidade: regra.severidade as AlertaNaTela["severidade"],
        descricao: regra.descricao,
        conduta: regra.conduta,
        campo,
        valorLegivel: comUnidade(definicao, campo, valor),
        acionamento,
        servidor:
          servidor ??
          (doServidor
            ? {
                id: doServidor.id,
                versao: doServidor.versao,
                fechado: Boolean(doServidor.fechadoEm),
              }
            : undefined),
        privado:
          regra.grupo === "saude_mental" && regra.severidade === "imediato",
        sensivel,
      });
    };

    for (const a of checklist.alertas) {
      montar(a.regraId, a.bebeId, a.campo, a.valorObservado, {
        id: a.id,
        versao: a.versao,
        fechado: Boolean(a.fechadoEm),
      });
    }
    for (const d of rascunho.disparados) {
      montar(d.regraId, d.bebeId, d.campo, d.valorObservado);
    }
    return [...resultado.values()];
  }, [
    rascunho,
    checklist.alertas,
    checklist.regras,
    definicao,
    c.bebes,
    sensivel,
  ]);
}

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

function Edicao({
  checklist,
  c,
  voltarPara,
  usuarioId,
  sensivel,
  agora,
}: {
  checklist: ChecklistVisita;
  c: Controle;
  voltarPara: string;
  usuarioId: string;
  sensivel: boolean;
  agora: () => Date;
}) {
  const rascunho = c.rascunho!;
  const definicao = checklist.instrumento!.definicao;
  const contexto = { ultimo_dia: checklist.ultimoDia };
  const familia = checklist.familia;

  const etapas = React.useMemo(
    () => montarEtapas(definicao, rascunho.respostas, contexto),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definicao, rascunho.respostas, checklist.ultimoDia],
  );
  const indice = Math.min(Math.max(rascunho.etapa, 0), etapas.length - 1);
  const etapa = etapas[indice]!;
  const ehResumo = etapa.id === "resumo";

  const [bebeAtivo, definirBebeAtivo] = React.useState(c.bebes[0]?.id);
  const [listaAberta, definirListaAberta] = React.useState(false);
  const [sinaisAberto, definirSinaisAberto] = React.useState(false);
  const [alertaAberto, definirAlertaAberto] =
    React.useState<AlertaNaTela | null>(null);
  const [apoio, definirApoio] = React.useState<{
    bloco: Bloco;
    alvo: EnderecoCampo;
  } | null>(null);
  const [freioAvisoAberto, definirFreioAviso] = React.useState<
    "ok" | "erro" | null
  >(null);
  const [freioLigado, definirFreioLigado] = React.useState(false);
  const [assinarAberto, definirAssinarAberto] = React.useState(false);
  const [avisoAcionamento, definirAvisoAcionamento] = React.useState<
    string | null
  >(null);
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    tituloRef.current?.focus();
  }, [indice]);

  const alertas = useAlertasNaTela(checklist, c, sensivel);
  const semRegistro = alertas.filter(
    (a) => !a.servidor?.fechado && !acionamentoCompleto(a.acionamento),
  );

  const pendencias = React.useMemo(
    () =>
      pendenciasDoRegistro({
        definicao,
        respostas: rascunho.respostas,
        bebes: c.bebes,
        ultimoDia: checklist.ultimoDia,
      }),
    [definicao, rascunho.respostas, c.bebes, checklist.ultimoDia],
  );

  const blocosComAlerta = new Set<string>();
  for (const a of semRegistro) {
    if (a.campo) blocosComAlerta.add(separarCaminho(a.campo).bloco);
  }

  const doc4 = checklist.instrumentoDoc4;
  const apoiosDoCampo = (bloco: string, campo: string): Bloco[] =>
    (doc4?.blocos ?? []).filter(
      (b) => b.apoia_campo?.split(":")[1] === `${bloco}.${campo}`,
    );

  const nomesDeOutras: string[] = []; // o aparelho guarda só as famílias do dia (P38)

  const semBebe = c.bebes.length === 0;

  function campoDe(endereco: EnderecoCampo): Campo | undefined {
    return acharCampo(definicao, `${endereco.bloco}.${endereco.campo}`)?.campo;
  }

  const aguardando = textosAguardandoConfirmacao(
    rascunho.trazidos,
    rascunho.respostas,
    campoDe,
  );

  function abrirAcionamento(alerta: AlertaNaTela | null) {
    if (alerta) definirAlertaAberto(alerta);
    else definirListaAberta(true);
  }

  function usarNota(alvo: EnderecoCampo, valor: number) {
    const campo = campoDe(alvo);
    if (campo?.tipo !== "escala") return;
    const atual = lerValor(rascunho.respostas, alvo);
    const complemento =
      atual && typeof atual === "object" && "complemento" in atual
        ? atual.complemento
        : undefined;
    c.aoMudarCampo(
      alvo,
      campo.complemento ? { valor, complemento } : valor,
      true,
    );
  }

  function renderCampo(bloco: Bloco, campo: Campo, bebe?: string) {
    const endereco: EnderecoCampo = { bloco: bloco.id, campo: campo.id, bebe };
    const ambiente = {
      definicao,
      respostas: rascunho.respostas,
      contexto,
      bebe,
    };
    if (!campoVisivel(campo, ambiente)) return null;
    const caminho = `${bloco.id}.${campo.id}`;
    const doCampo = semRegistro.filter(
      (a) => a.campo === caminho && (a.bebeId ?? undefined) === bebe,
    );
    const destaque = doCampo.length
      ? doCampo.some((a) => a.sensivel)
        ? "sensivel"
        : doCampo.some((a) => a.severidade === "imediato")
          ? "imediato"
          : "prioritario"
      : null;
    const chaveTrazido = `${bloco.id}|${campo.id}|${bebe ?? ""}`;
    return (
      <div key={`${caminho}-${bebe ?? ""}`} className="flex flex-col gap-3">
        <CampoDoChecklist
          campo={
            bloco.id === "ultimo_dia"
              ? comJustificativaDeAusencia(campo)
              : campo
          }
          endereco={endereco}
          valor={lerValor(rascunho.respostas, endereco)}
          aoMudar={(valor, salvar) => c.aoMudarCampo(endereco, valor, salvar)}
          referencia={referenciaDoDiaAnterior(checklist.anteriores, endereco)}
          trazido={rascunho.trazidos[chaveTrazido]}
          aoTrazer={() => c.trazer(endereco)}
          aoConfirmarTrazido={(texto) => c.confirmarTrazido(endereco, texto)}
          aoDescartarTrazido={() => c.descartarTrazido(endereco)}
          alerta={destaque}
          apoios={apoiosDoCampo(bloco.id, campo.id)}
          aoAbrirApoio={(b) => definirApoio({ bloco: b, alvo: endereco })}
          nomeDaFamilia={familia.nomeExibicao}
          nomesDeOutrasFamilias={nomesDeOutras}
          valorAutomatico={
            campo.tipo === "automatico"
              ? textoAutomatico(campo, checklist)
              : undefined
          }
          semTom={semTom}
        />
        {doCampo.map((a, i) => (
          <FaixaDoAlerta
            key={a.chave}
            alerta={a}
            telefone={checklist.parametros.supervisaoTelefone}
            semSinal={!c.online}
            aoRegistrar={definirAlertaAberto}
            anunciar={i === 0}
          />
        ))}
      </div>
    );
  }

  function renderBloco(bloco: Bloco, bebe?: string) {
    const numerado = /^(\d+(\.\d+)*)$/.test(bloco.id);
    return (
      <section
        key={`${bloco.id}-${bebe ?? ""}`}
        aria-labelledby={`bloco-${bloco.id}-${bebe ?? "g"}`}
        className="flex flex-col gap-3"
      >
        <div className="pt-2">
          <h3
            id={`bloco-${bloco.id}-${bebe ?? "g"}`}
            className="font-titulo text-2 text-texto flex items-baseline gap-2 font-medium"
          >
            {numerado ? (
              <span className="rounded-pilula bg-areia text-apoio text-texto inline-flex min-h-7 items-center px-2.5 font-mono font-medium">
                {bloco.id}
              </span>
            ) : null}
            <span>{bloco.titulo}</span>
          </h3>
          {bloco.ajuda ? (
            <p className="text-apoio text-texto-2 mt-1">{bloco.ajuda}</p>
          ) : null}
        </div>
        {bloco.campos.map((campo) =>
          campo.tipo === "automatico" && bloco.id === "assinatura"
            ? null
            : renderCampo(bloco, campo, bebe),
        )}
      </section>
    );
  }

  function conteudoDaEtapa() {
    if (etapa.porBebe) {
      if (semBebe) {
        return (
          <EstadoVazio
            nivelTitulo="h3"
            titulo={textos.semBebeTitulo}
            texto={textos.semBebeTexto}
          />
        );
      }
      const ativo = c.bebes.find((b) => b.id === bebeAtivo) ?? c.bebes[0]!;
      return (
        <div className="flex flex-col gap-6">
          {c.bebes.length > 1 ? (
            <AbasPilula
              rotulo={textos.abasBebes}
              ativa={ativo.id}
              aoEscolher={definirBebeAtivo}
              abas={c.bebes.map((b) => ({ valor: b.id, rotulo: b.rotulo }))}
              className="self-start"
            />
          ) : (
            <p className="text-apoio text-texto-2">{ativo.rotulo}</p>
          )}
          {etapa.blocosDaDefinicao.map((b) => renderBloco(b, ativo.id))}
          <CurvaDePeso
            curva={curvaDoBebe(checklist, ativo.id, rascunho.respostas)}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-8">
        {etapa.blocosDaDefinicao
          .filter((b) => b.id !== "assinatura")
          .map((b) => renderBloco(b))}
      </div>
    );
  }

  const seletorSinais = React.useMemo(
    () => sinaisDoSeletor(checklist.regras, definicao),
    [checklist.regras, definicao],
  );
  void caminhosDoInstrumento;

  async function acionarFreio() {
    const r = await acaoAcionarFreioDoChecklist(familia.id);
    definirFreioLigado(r.ok);
    definirFreioAviso(r.ok ? "ok" : "erro");
    if (r.ok) c.tentarEnviar();
  }

  const freioAtivo = familia.estadoSensivel !== "normal" || freioLigado;
  // Família em freio, perda ou intercorrência: nada de tom de apoio (PRD
  // 20.2 [v4.4], regra 3). O bloco da etapa e as perguntas respondidas
  // ficam em branco.
  const semTom = sensivel || freioAtivo;

  const estadosDasEtapas = etapas.map((e) =>
    estadoDaEtapa({
      etapa: e,
      respostas: rascunho.respostas,
      bebes: c.bebes,
      pendencias,
      blocosComAlerta,
    }),
  );
  const segmentos = etapas.map((_, i) =>
    i === indice
      ? ("atual" as const)
      : estadosDasEtapas[i] === "completa"
        ? ("feito" as const)
        : ("futuro" as const),
  );
  const contagem = contagemDaEtapa(
    etapa,
    definicao,
    rascunho.respostas,
    contexto,
    etapa.porBebe ? (bebeAtivo ?? c.bebes[0]?.id) : undefined,
  );
  const IconeEtapa = ICONE_DA_ETAPA[etapa.id] ?? ClipboardList;

  return (
    <div className="pb-60">
      <header className="bg-fundo sticky top-0 z-[var(--z-barra)] -mx-4 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Link
            href={voltarPara}
            aria-label={textos.voltarParaHoje}
            className="size-toque rounded-pilula bg-superficie shadow-1 text-texto hover:bg-areia-clara flex shrink-0 items-center justify-center"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <p className="min-w-0 flex-1">
            <span className="text-3 text-texto block truncate leading-tight font-semibold">
              {familia.nomeExibicao}
            </span>
            <span className="text-apoio text-texto-2 font-mono">
              {textos.diaDeTotal(
                checklist.visita.diaNumero,
                checklist.diasContratados,
              )}
            </span>
          </p>
          {!freioAtivo ? (
            <BotaoFreio
              aria-label={textos.freioRotulo}
              onClick={() => void acionarFreio()}
            >
              {textos.freio}
            </BotaoFreio>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Sincronizacao c={c} />
          <button
            type="button"
            onClick={() => definirListaAberta(true)}
            aria-label={textos.verEtapas(indice + 1, etapas.length)}
            className="rounded-pilula bg-superficie shadow-1 min-h-toque hover:bg-areia-clara ease-estado inline-flex shrink-0 items-center gap-2 py-1 pr-4 pl-1 transition-colors duration-140"
          >
            <AnelProgresso segmentos={segmentos} tamanho={36} espessura={4} />
            <span className="text-apoio text-texto font-semibold">
              {textos.etapas}
            </span>
          </button>
        </div>
      </header>

      <AvisoSemSinal c={c} />
      {freioAtivo ? (
        <FaixaAlerta variante="sensivel" titulo={textos.freio} className="mt-3">
          {freioAvisoAberto === "ok"
            ? textos.freioAcionado(familia.nomeExibicao)
            : textos.freioAtivo}
        </FaixaAlerta>
      ) : null}
      {freioAvisoAberto === "erro" ? (
        <FaixaAlerta variante="erro" titulo={textos.freio} className="mt-3">
          {textos.freioFalhou}
        </FaixaAlerta>
      ) : null}

      {avisoAcionamento ? (
        <p role="status" className="text-apoio text-sucesso mt-3 font-semibold">
          {avisoAcionamento}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        <FaixaMiniAlerta
          alertas={semRegistro.filter(
            (a) =>
              !a.campo || !etapa.blocos.includes(separarCaminho(a.campo).bloco),
          )}
          aoAbrir={abrirAcionamento}
        />
      </div>

      <h1 className="sr-only">
        {textos.paginaTitulo(checklist.visita.diaNumero)}
      </h1>
      <div className="mt-3 flex flex-col gap-4">
        {/* Bloco da etapa (DESIGN.md, 2.5): o agora em dourado-claro, em
            forma colo, com o assunto no tile e a barra das perguntas. */}
        <section
          aria-labelledby="titulo-etapa"
          className={cn(
            "flex flex-col gap-4 px-5 pt-5",
            semTom
              ? "rounded-3 bg-superficie border-linha border pb-5"
              : "rounded-colo bg-dourado-claro pb-11",
          )}
        >
          <div className="flex items-start gap-4">
            <TileIcone
              tom={semTom ? "branco" : "dourado"}
              forma="quadrado"
              tamanho="g"
              className={semTom ? "border-linha border" : undefined}
            >
              <IconeEtapa />
            </TileIcone>
            <div className="min-w-0">
              <p className="text-apoio text-texto-2 font-medium">
                {textos.etapa(indice + 1, etapas.length)}
              </p>
              <h2
                id="titulo-etapa"
                ref={tituloRef}
                tabIndex={-1}
                className="font-titulo text-display text-texto outline-none"
              >
                {etapa.rotulo}
              </h2>
            </div>
          </div>
          {!ehResumo && contagem.total > 0 ? (
            <BarraProgresso
              valor={contagem.respondidas}
              total={contagem.total}
              trilha={semTom ? "neutra" : "dourada"}
              texto={textos.respondidasNaEtapa(
                contagem.respondidas,
                contagem.total,
              )}
              textoCompleta={textos.etapaRespondida}
            />
          ) : null}
        </section>

        {conteudoDaEtapa()}

        {ehResumo ? (
          <ResumoEAssinatura
            checklist={checklist}
            c={c}
            usuarioId={usuarioId}
            etapas={etapas}
            pendencias={pendencias}
            aguardando={aguardando}
            campoDe={campoDe}
            semRegistro={semRegistro}
            irParaEtapa={c.irParaEtapa}
            semBebe={semBebe}
            aoAssinar={() => definirAssinarAberto(true)}
            renderBloco={renderBloco}
            comemorar={!semTom && alertas.length === 0}
          />
        ) : null}
      </div>

      {/* Barra de ação, na zona do polegar, logo acima da navegação em
          pílula (DESIGN.md, 2.9). */}
      <div
        className="fixed inset-x-0 z-[var(--z-barra)] px-3 pb-2"
        style={{
          bottom: "calc(var(--altura-abas) + env(safe-area-inset-bottom))",
        }}
      >
        <div className="max-w-portal rounded-3 bg-superficie shadow-2 mx-auto flex flex-col gap-1 p-2">
          <Botao
            variante="fantasma"
            tamanho="compacto"
            className="self-start"
            onClick={() => definirSinaisAberto(true)}
          >
            <TriangleAlert className="size-[18px]" aria-hidden="true" />
            {textos.registrarOutroSinal}
          </Botao>
          <div className="grid grid-cols-2 gap-2">
            <Botao
              variante="secundario"
              disabled={indice === 0}
              onClick={() => c.irParaEtapa(indice - 1)}
            >
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
              {textos.voltar}
            </Botao>
            {!ehResumo ? (
              <Botao onClick={() => c.irParaEtapa(indice + 1)}>
                {textos.proximaEtapa}
                <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Botao>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      {/* Lista de etapas */}
      <Dialogo open={listaAberta} onOpenChange={definirListaAberta}>
        <DialogoConteudo
          titulo={textos.etapas}
          descricao={textos.etapasAjuda}
          rotuloFechar={textos.alerta.fecharJanela}
        >
          <ul className="flex flex-col gap-2">
            {etapas.map((e, i) => {
              const estado = estadosDasEtapas[i]!;
              const Icone = ICONE_DA_ETAPA[e.id] ?? ClipboardList;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-current={i === indice ? "step" : undefined}
                    onClick={() => {
                      c.irParaEtapa(i);
                      definirListaAberta(false);
                    }}
                    className={cn(
                      "rounded-2 min-h-toque ease-estado flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-140",
                      i === indice
                        ? "bg-dourado-claro"
                        : "bg-superficie shadow-1 hover:bg-areia-clara",
                      semTom &&
                        i === indice &&
                        "bg-superficie border-dourado border-2",
                    )}
                  >
                    <TileIcone
                      tom={
                        estado === "completa" && !semTom ? "salvia" : "areia"
                      }
                      forma="quadrado"
                      tamanho="p"
                    >
                      <Icone />
                    </TileIcone>
                    <span className="text-corpo text-texto min-w-0 flex-1 font-medium">
                      {e.rotulo}
                    </span>
                    <Selo
                      variante={
                        estado === "com_alerta"
                          ? sensivel
                            ? "sensivel"
                            : "alerta"
                          : estado === "com_pendencia"
                            ? "aviso"
                            : estado === "completa"
                              ? "sucesso"
                              : "contorno"
                      }
                    >
                      {textos.estadoDaEtapa[estado]}
                    </Selo>
                  </button>
                </li>
              );
            })}
          </ul>
          {semRegistro.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-3 text-texto font-semibold">
                {textos.alerta.listaTitulo}
              </p>
              {semRegistro.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  onClick={() => {
                    definirListaAberta(false);
                    definirAlertaAberto(a);
                  }}
                  className="rounded-2 min-h-toque border-linha bg-superficie flex items-center gap-3 border px-4 py-3 text-left"
                >
                  <span className="text-apoio font-mono font-medium">
                    {a.regraId}
                  </span>
                  <span className="text-corpo text-texto">
                    {a.privado ? textos.alerta.ocorrenciaPrivada : a.descricao}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </DialogoConteudo>
      </Dialogo>

      <FolhaAcionamento
        aberto={alertaAberto !== null}
        aoFechar={() => definirAlertaAberto(null)}
        alerta={alertaAberto}
        aoSalvar={async (a) => {
          await c.salvarAcionamento(a);
          definirAvisoAcionamento(
            acionamentoCompleto(a)
              ? `${textos.alerta.registrado}.`
              : textos.folhaAcionamento.salvoParcial,
          );
        }}
        agora={agora}
      />

      <FolhaSinais
        aberto={sinaisAberto}
        aoFechar={() => definirSinaisAberto(false)}
        ativo={checklist.parametros.seletorSinaisAtivo}
        telefone={checklist.parametros.supervisaoTelefone}
        sinais={seletorSinais}
        bebes={c.bebes}
        familiaSensivel={sensivel}
        aoRegistrar={c.registrarSinal}
      />

      <JanelaApoio
        bloco={apoio?.bloco ?? null}
        aberto={apoio !== null}
        aoFechar={() => definirApoio(null)}
        aoUsar={(valor) => apoio && usarNota(apoio.alvo, valor)}
      />

      <FolhaAssinar
        aberto={assinarAberto}
        aoFechar={() => definirAssinarAberto(false)}
        dia={checklist.visita.diaNumero}
        assinando={c.assinando}
        erro={c.erroAoAssinar}
        aoAssinar={async () => {
          const ok = await c.assinar();
          if (ok) definirAssinarAberto(false);
        }}
      />
    </div>
  );
}

function acionamentoCompleto(a: AcionamentoAlerta | undefined): boolean {
  return (
    !!a &&
    a.sinalIdentificado.trim() !== "" &&
    a.acionadoEm.trim() !== "" &&
    a.orientacaoMedica.trim() !== "" &&
    a.condutaAdotada.trim() !== ""
  );
}

/** Contato do último dia: "Não consegui, justificar" vale para os dois médicos (PRD 7.3). */
function comJustificativaDeAusencia(campo: Campo): Campo {
  if (
    campo.tipo === "texto" &&
    campo.id.startsWith("contato_") &&
    !campo.justificar_ausencia
  ) {
    return {
      ...campo,
      justificar_ausencia: {
        rotulo_acao: textos.resumo.naoConsegui,
        rotulo_justificativa: textos.resumo.justificativa,
      },
    };
  }
  return campo;
}

function textoAutomatico(campo: Campo, checklist: ChecklistVisita): string {
  if (campo.tipo !== "automatico") return "";
  const p = checklist.profissional;
  const registro = [p.conselho, p.conselhoUf, p.conselhoNumero]
    .filter(Boolean)
    .join(" ");
  return registro ? `${p.nome}, ${registro}` : p.nome;
}

/** Curva de peso do bebê com o peso digitado hoje (ainda não assinado). */
function curvaDoBebe(
  checklist: ChecklistVisita,
  bebeId: string,
  respostas: import("@/lib/instrumentos/respostas").RespostasFormulario,
): CurvaPeso | null {
  const bebe = checklist.bebes.find((b) => b.id === bebeId);
  if (!bebe) return null;
  const pesos: { data: string; pesoG: number }[] = [];
  for (const anterior of checklist.anteriores) {
    const peso = lerDoRegistro(anterior.dados, {
      bloco: "3.1",
      campo: "peso",
      bebe: bebeId,
    });
    if (typeof peso === "number")
      pesos.push({ data: anterior.data, pesoG: peso });
  }
  const hoje = lerValor(respostas, {
    bloco: "3.1",
    campo: "peso",
    bebe: bebeId,
  });
  if (typeof hoje === "number") {
    pesos.push({ data: checklist.visita.data, pesoG: hoje });
  }
  return calcularCurvaPeso({
    pesoNascimentoG: bebe.pesoNascimentoG,
    dataNascimento: bebe.dataNascimento,
    pesoAltaG: bebe.pesoAltaG,
    dataAlta: checklist.familia.dataAlta,
    pesosDasVisitas: pesos,
  });
}

// ---------------------------------------------------------------------------
// Resumo e assinatura
// ---------------------------------------------------------------------------

function ResumoEAssinatura({
  checklist,
  c,
  usuarioId,
  etapas,
  pendencias,
  aguardando,
  campoDe,
  semRegistro,
  irParaEtapa,
  semBebe,
  aoAssinar,
  comemorar,
}: {
  checklist: ChecklistVisita;
  c: Controle;
  usuarioId: string;
  etapas: EtapaMontada[];
  pendencias: ReturnType<typeof pendenciasDoRegistro>;
  aguardando: EnderecoCampo[];
  campoDe: (e: EnderecoCampo) => Campo | undefined;
  semRegistro: AlertaNaTela[];
  irParaEtapa: (i: number) => void;
  semBebe: boolean;
  aoAssinar: () => void;
  renderBloco: (b: Bloco, bebe?: string) => React.ReactNode;
  /** Sem alerta na visita e sem estado sensível: o checklist completo ganha a comemoração (DESIGN.md, 2.11). */
  comemorar: boolean;
}) {
  const indiceDaEtapa = (bloco: string) =>
    etapas.findIndex((e) => e.blocos.includes(bloco));
  const podeAssinar = pendencias.length === 0 && !semBebe;
  const falta = pendencias.length + aguardando.length + (semBebe ? 1 : 0);

  return (
    <section aria-labelledby="falta-titulo" className="flex flex-col gap-6">
      <GravadorAudio
        visitaId={checklist.visita.id}
        usuarioId={usuarioId}
        parametros={checklist.parametros}
        audios={checklist.audios}
        aoAnexar={() => window.location.reload()}
        armazem={c.aparelho?.armazem}
      />

      {falta === 0 && semRegistro.length === 0 ? (
        <>
          <h3 id="falta-titulo" className="sr-only">
            {textos.resumo.tudoRespondido}
          </h3>
          {comemorar ? (
            <Comemoracao
              titulo={textos.resumo.completoTitulo(checklist.visita.diaNumero)}
              texto={textos.resumo.completoTexto}
              acao={
                <Botao
                  disabled={!podeAssinar}
                  onClick={aoAssinar}
                  aria-describedby="falta-titulo"
                  className="whitespace-normal"
                >
                  {textos.resumo.assinar(checklist.visita.diaNumero)}
                </Botao>
              }
            />
          ) : (
            <>
              <p
                className="text-corpo text-sucesso flex items-center gap-2"
                role="status"
              >
                <CircleCheck className="size-5" aria-hidden="true" />
                {textos.resumo.tudoRespondido}
              </p>
              <Botao
                largaTotal
                disabled={!podeAssinar}
                onClick={aoAssinar}
                aria-describedby="falta-titulo"
              >
                {textos.resumo.assinar(checklist.visita.diaNumero)}
              </Botao>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h3
              id="falta-titulo"
              className="text-3 text-texto flex items-center gap-2 font-semibold"
            >
              {textos.resumo.faltaParaAssinar}
              {falta > 0 ? (
                <span className="rounded-pilula bg-areia text-apoio inline-flex min-h-7 min-w-7 items-center justify-center px-2 font-mono font-medium">
                  <span className="sr-only">: </span>
                  {falta}
                </span>
              ) : null}
            </h3>
            <ul className="flex flex-col gap-2">
              {semBebe ? (
                <li className="text-corpo text-texto">
                  {textos.resumo.semBebe}
                </li>
              ) : null}
              {pendencias.map((p) => {
                const alvo = indiceDaEtapa(p.bloco);
                return (
                  <li key={`${p.bloco}.${p.campo}.${p.bebe ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => alvo >= 0 && irParaEtapa(alvo)}
                      className="rounded-2 min-h-toque text-corpo text-texto bg-superficie shadow-1 hover:bg-areia-clara ease-estado w-full px-4 py-2.5 text-left transition-colors duration-140"
                      aria-label={textos.resumo.irPara(
                        `${p.rotulo}${p.rotuloBebe ? `, ${p.rotuloBebe}` : ""}`,
                      )}
                    >
                      {p.rotulo}
                      {p.rotuloBebe ? ` (${p.rotuloBebe})` : ""}
                      <span className="text-texto-2 text-apoio block">
                        {p.rotuloBloco}
                      </span>
                    </button>
                  </li>
                );
              })}
              {aguardando.map((e) => {
                const campo = campoDe(e);
                const alvo = indiceDaEtapa(e.bloco);
                return (
                  <li key={`agu-${e.bloco}.${e.campo}.${e.bebe ?? ""}`}>
                    <button
                      type="button"
                      onClick={() => alvo >= 0 && irParaEtapa(alvo)}
                      className="rounded-2 min-h-toque text-corpo text-texto border-dourado bg-dourado-lavado w-full border-2 border-dashed px-4 py-2 text-left"
                    >
                      {textos.resumo.textoAguardando(campo?.rotulo ?? e.campo)}
                    </button>
                  </li>
                );
              })}
              {semRegistro.map((a) => (
                <li key={`al-${a.chave}`} className="text-apoio text-texto-2">
                  {textos.resumo.alertaSemRegistro(a.regraId)}
                </li>
              ))}
            </ul>
          </div>

          <Botao
            largaTotal
            disabled={!podeAssinar}
            onClick={aoAssinar}
            aria-describedby="falta-titulo"
          >
            {textos.resumo.assinar(checklist.visita.diaNumero)}
          </Botao>
        </>
      )}
    </section>
  );
}

function FolhaAssinar({
  aberto,
  aoFechar,
  dia,
  assinando,
  erro,
  aoAssinar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  dia: number;
  assinando: boolean;
  erro: boolean;
  aoAssinar: () => void | Promise<void>;
}) {
  return (
    <Dialogo open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      <DialogoConteudo
        titulo={textos.assinatura.titulo(dia)}
        descricao={textos.assinatura.aviso}
        rotuloFechar={textos.alerta.fecharJanela}
      >
        {erro ? (
          <p className="text-apoio text-alerta mb-3 font-medium" role="alert">
            {textos.assinatura.falhou}
          </p>
        ) : null}
        <DialogoRodape>
          <Botao variante="secundario" onClick={aoFechar}>
            {textos.assinatura.revisar}
          </Botao>
          <Botao
            onClick={() => void aoAssinar()}
            carregando={assinando}
            rotuloCarregando={textos.assinatura.assinando}
          >
            {textos.assinatura.assinarAgora}
          </Botao>
        </DialogoRodape>
      </DialogoConteudo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Assinado no aparelho, esperando subir
// ---------------------------------------------------------------------------

function AguardandoEnvio({
  checklist,
  c,
  voltarPara,
  definicao,
}: {
  checklist: ChecklistVisita;
  c: Controle;
  voltarPara: string;
  definicao: NonNullable<ChecklistVisita["instrumento"]>["definicao"];
}) {
  const rascunho = c.rascunho!;
  const assinadoEm = new Date(rascunho.assinadoEmMs!);
  const erro = c.fila.registro?.estado === "erro";
  return (
    <div className="flex flex-col gap-6 pt-4 pb-8">
      <header className="flex flex-col gap-3">
        <Link
          href={voltarPara}
          className="rounded-pilula bg-superficie shadow-1 text-apoio text-texto min-h-toque hover:bg-areia-clara inline-flex items-center gap-2 self-start pr-4 pl-3 font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {textos.voltarParaHoje}
        </Link>
        <h1 className="font-titulo text-display text-texto">
          {textos.paginaTitulo(checklist.visita.diaNumero)}
        </h1>
        <div className="flex">
          <Sincronizacao c={c} />
        </div>
      </header>
      <AvisoSemSinal c={c} />
      <FaixaAlerta
        variante={erro ? "erro" : "sucesso"}
        titulo={textos.assinatura.assinadoAs(horaAgoraEmBrasilia(assinadoEm))}
      >
        {erro
          ? fraseDoErro(
              c.fila.registro?.erroMensagem ?? "",
              "enviar o registro",
            )
          : c.online
            ? textos.assinatura.servidorRecebeu
            : textos.assinatura.sobeQuandoHouverSinal}
      </FaixaAlerta>
      <VisaoDosDados
        definicao={definicao}
        respostas={rascunho.respostas}
        bebes={c.bebes}
        contexto={{ ultimo_dia: checklist.ultimoDia }}
        semTom={checklist.familia.estadoSensivel !== "normal"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registro assinado (leitura) e adendo
// ---------------------------------------------------------------------------

function VisaoAssinada({
  checklist,
  c,
  voltarPara,
  usuarioId,
}: {
  checklist: ChecklistVisita;
  c: Controle;
  voltarPara: string;
  usuarioId: string;
}) {
  const router = useRouter();
  const registro = checklist.registro!;
  const definicao = checklist.instrumento!.definicao;
  const respostas = dadosParaRespostas(definicao, registro.dados);
  const [adendoAberto, definirAdendoAberto] = React.useState(false);
  const [motivo, definirMotivo] = React.useState("");
  const [texto, definirTexto] = React.useState("");
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [enviado, definirEnviado] = React.useState(false);

  // O adendo subiu: relê a visita para mostrá-lo na lista. A fila é lida a
  // cada poucos segundos, então o adendo pode subir antes de ela o enxergar:
  // se ela nunca o viu pendente, relê depois de uma espera curta.
  const viuPendente = React.useRef(false);
  React.useEffect(() => {
    if (!enviado) return;
    if (c.fila.pendentes > 0) {
      viuPendente.current = true;
      return;
    }
    const espera = window.setTimeout(
      () => {
        viuPendente.current = false;
        definirEnviado(false);
        router.refresh();
      },
      viuPendente.current ? 0 : 2500,
    );
    return () => window.clearTimeout(espera);
  }, [enviado, c.fila.pendentes, router]);

  async function salvarAdendo() {
    if (!motivo.trim() || !texto.trim()) {
      definirAviso(textos.leitura.adendoVazio);
      return;
    }
    await c.fazerAdendo(motivo, texto);
    definirAviso(
      c.online ? textos.leitura.adendoSalvo : textos.leitura.adendoSemSinal,
    );
    definirEnviado(true);
    definirMotivo("");
    definirTexto("");
    definirAdendoAberto(false);
  }

  const alertasDaVisita = checklist.alertas.map((a) => ({
    a,
    regra: checklist.regras.find((r) => r.id === a.regraId),
  }));
  const dono = checklist.profissional.id === registro.profissionalId;
  void dono;
  void usuarioId;

  return (
    <div className="flex flex-col gap-6 pt-4 pb-8">
      <header className="flex flex-col gap-3">
        <Link
          href={voltarPara}
          className="rounded-pilula bg-superficie shadow-1 text-apoio text-texto min-h-toque hover:bg-areia-clara inline-flex items-center gap-2 self-start pr-4 pl-3 font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {textos.voltarParaHoje}
        </Link>
        <div>
          <h1 className="font-titulo text-display text-texto">
            {textos.paginaTitulo(checklist.visita.diaNumero)}
          </h1>
          <p className="text-corpo text-texto-2">
            {checklist.familia.nomeExibicao},{" "}
            <span className="font-mono">
              {textos.diaDeTotal(
                checklist.visita.diaNumero,
                checklist.diasContratados,
              )}
            </span>
          </p>
        </div>
        <div className="flex">
          <Sincronizacao c={c} />
        </div>
      </header>
      <AvisoSemSinal c={c} />

      <FaixaAlerta
        variante="sucesso"
        titulo={textos.leitura.assinadoPor(
          checklist.profissional.nome,
          formatarDataHora(registro.assinadoEm) ?? registro.assinadoEm,
        )}
      >
        {textos.leitura.naoMuda}
      </FaixaAlerta>

      <div>
        <Botao onClick={() => definirAdendoAberto(true)}>
          {textos.leitura.fazerAdendo}
        </Botao>
        {aviso && !adendoAberto ? (
          <p className="text-apoio text-texto-2 mt-2" role="status">
            {aviso}
          </p>
        ) : null}
      </div>

      <section
        aria-labelledby="resumo-lido"
        className="rounded-3 bg-superficie shadow-1 flex flex-col gap-2 p-4"
      >
        <h2 id="resumo-lido" className="text-3 text-texto font-semibold">
          {textos.leitura.resumoDescritivo}
        </h2>
        <p className="text-corpo text-texto max-w-[68ch] whitespace-pre-line">
          {registro.resumoDescritivo}
        </p>
      </section>

      <VisaoDosDados
        definicao={definicao}
        respostas={respostas}
        bebes={c.bebes}
        contexto={{ ultimo_dia: checklist.ultimoDia }}
        semTom={checklist.familia.estadoSensivel !== "normal"}
      />

      {alertasDaVisita.length > 0 ? (
        <section
          aria-labelledby="alertas-lidos"
          className="flex flex-col gap-2"
        >
          <h2 id="alertas-lidos" className="text-3 text-texto font-semibold">
            {textos.alerta.listaTitulo}
          </h2>
          <ul className="flex flex-col gap-2">
            {alertasDaVisita.map(({ a, regra }) => (
              <li key={a.id} className="rounded-2 border-linha border p-3">
                <p className="text-corpo text-texto">
                  <span className="text-apoio mr-2 font-mono font-medium">
                    {a.regraId}
                  </span>
                  {a.bebeId ? "" : null}
                  {regra?.descricao ?? ""}
                  {a.valorObservado
                    ? `. Registrado: ${valorObservadoEmTexto(a.valorObservado)}`
                    : ""}
                </p>
                <p className="text-apoio text-texto-2">
                  {a.fechadoEm
                    ? "Fechado pela coordenação."
                    : a.acionadoEm
                      ? "Aberto na coordenação, com o acionamento registrado."
                      : "Aberto na coordenação."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="adendos-lidos" className="flex flex-col gap-2">
        <h2 id="adendos-lidos" className="text-3 text-texto font-semibold">
          {textos.leitura.adendos}
        </h2>
        {registro.adendos.length === 0 ? (
          <p className="text-corpo text-texto-2">{textos.leitura.semAdendos}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {registro.adendos.map((ad) => (
              <li
                key={ad.id}
                className="rounded-2 border-linha bg-superficie border p-4"
              >
                <p className="text-corpo text-texto font-semibold">
                  {ad.motivo}
                </p>
                <p className="text-corpo text-texto whitespace-pre-line">
                  {ad.conteudo}
                </p>
                <p className="text-apoio text-texto-2 mt-1">
                  {ad.autor ? `${ad.autor}, ` : ""}
                  {formatarDataHora(ad.criadoEm) ?? ad.criadoEm}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GravadorAudio
        visitaId={checklist.visita.id}
        usuarioId={usuarioId}
        parametros={checklist.parametros}
        audios={checklist.audios}
        aoAnexar={() => router.refresh()}
        armazem={c.aparelho?.armazem}
        somenteLeitura
      />

      <Dialogo open={adendoAberto} onOpenChange={definirAdendoAberto}>
        <DialogoConteudo
          titulo={textos.leitura.adendoTitulo}
          descricao={textos.leitura.adendoAjuda}
          rotuloFechar={textos.alerta.fecharJanela}
        >
          <div className="flex flex-col gap-4">
            <CampoAdendo
              id="adendo-motivo"
              rotulo={textos.leitura.adendoMotivo}
              valor={motivo}
              aoMudar={definirMotivo}
            />
            <CampoAdendo
              id="adendo-texto"
              rotulo={textos.leitura.adendoTexto}
              valor={texto}
              aoMudar={definirTexto}
              longo
            />
            {adendoAberto && aviso === textos.leitura.adendoVazio ? (
              <p
                className="text-apoio text-aviso-texto font-medium"
                role="status"
              >
                {aviso}
              </p>
            ) : null}
            <DialogoRodape>
              <Botao
                variante="secundario"
                onClick={() => definirAdendoAberto(false)}
              >
                {textos.alerta.fecharJanela}
              </Botao>
              <Botao onClick={() => void salvarAdendo()}>
                {textos.leitura.adendoSalvar}
              </Botao>
            </DialogoRodape>
          </div>
        </DialogoConteudo>
      </Dialogo>
    </div>
  );
}

function CampoAdendo({
  id,
  rotulo,
  valor,
  aoMudar,
  longo,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  longo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-apoio text-texto font-semibold">
        {rotulo}
      </label>
      {longo ? (
        <textarea
          id={id}
          rows={4}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="rounded-2 border-borda-campo bg-superficie text-corpo text-texto min-h-24 border-[1.5px] p-3"
        />
      ) : (
        <input
          id={id}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="rounded-2 border-borda-campo bg-superficie text-corpo text-texto min-h-12 border-[1.5px] px-3"
        />
      )}
    </div>
  );
}

// Reexportações usadas por testes de componente.
export { bebesDoFormulario, montarDados, resumoDoDia, formatarComUnidade };
export type { ValorCampo };
