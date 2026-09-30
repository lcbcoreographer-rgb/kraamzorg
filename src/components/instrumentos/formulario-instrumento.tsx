"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { cn } from "@/lib/utils";
import { ProgressoEtapas } from "@/components/ui/progresso-etapas";
import type {
  AlertaLigado,
  Bloco,
  Campo,
  DefinicaoInstrumento,
} from "@/lib/instrumentos/schema";
import {
  alertasSatisfeitos,
  blocoVisivel,
  camposOcultosComValor,
  campoVisivel,
  comValor,
  estaRespondido,
  etapasVisiveis,
  lerValor,
  pendenciasParaConcluir,
  respostasVazias,
  type BebeFormulario,
  type ContextoFormulario,
  type EnderecoCampo,
  type Pendencia,
  type RespostasFormulario,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import type {
  EstadoPersistencia,
  PersistenciaRespostas,
} from "@/lib/instrumentos/persistencia";
import { CampoInstrumento, idDom } from "./campo-instrumento";
import { textosFormulario as t } from "./textos";

/**
 * Gerador de formulário para celular a partir da definição de um
 * instrumento (P34 item 3). Uma etapa por bloco, na ordem da definição;
 * cada resposta grava na hora pelo motor offline (`persistencia`), sem
 * botão de salvar; bloco repetido por bebê vira uma aba por bebê em
 * gemelares; o botão de concluir só libera sem pendência obrigatória
 * (PRD 9.2 v4.2, bloco de amamentação inteiro obrigatório).
 *
 * P35 acrescenta o que a entrevista pré-natal (DOC 1) pede, sem mudar o
 * padrão de quem não usa:
 * - `plano`: outra sequência de etapas, a ordem da conversa e não a do papel
 *   (fluxos.md, fluxo B). Cada etapa junta campos de um ou mais blocos, sem
 *   mudar o endereço de nenhum campo; campo que o plano não cita vai para a
 *   última etapa, então nada se perde se a definição ganhar campo.
 * - `campoInicial`: reabre no campo onde a pessoa parou.
 * - `sugestoes`: valor que já está no cadastro da mesma família, com
 *   "Confirmar"; nada é gravado sem o toque.
 * - `listaDeEtapas` e `lateral`: no computador, a lista de etapas com o
 *   estado de cada uma (completa, em andamento, não iniciada) à esquerda e o
 *   contexto da família à direita; no celular, uma etapa por tela.
 *
 * Fica fora daqui (outras sessões): a faixa de alerta com a conduta (P40,
 * que se liga por `aoAvaliarAlertas`), assinatura e registro append-only
 * (P39), referência do dia anterior (P39) e a tela da coordenação (onda B).
 */

/** Uma etapa do plano: campos de um ou mais blocos, na ordem escrita aqui. */
export interface EtapaPlano {
  id: string;
  titulo: string;
  ajuda?: string;
  itens: { bloco: string; campos?: string[] }[];
}

/** Valor do cadastro da mesma família, oferecido para confirmar. */
export interface SugestaoCampo {
  valor: ValorCampo;
  /** Como aparece na tela ("03/11/2026"); padrão: o próprio valor em texto. */
  exibicao?: string;
}

export interface FormularioInstrumentoProps {
  definicao: DefinicaoInstrumento;
  persistencia: PersistenciaRespostas;
  respostasIniciais?: RespostasFormulario;
  /** Bebês do acompanhamento, para os blocos repetidos. */
  bebes?: BebeFormulario[];
  /** Valores para as condições de contexto (ex: `{ ultimo_dia: true }`). */
  contexto?: ContextoFormulario;
  /** Retomada: abre na etapa onde a pessoa parou (índice, começando em 0). */
  etapaInicial?: number;
  /** Retomada: leva o foco ao campo onde a pessoa parou. */
  campoInicial?: EnderecoCampo;
  /** Texto dos campos `automatico`, por caminho "bloco.campo". */
  valoresAutomaticos?: Record<string, string>;
  /** Etapas na ordem da conversa (fluxo B); sem plano, uma etapa por bloco. */
  plano?: EtapaPlano[];
  /** "bloco.campo" para o valor do cadastro que espera confirmação. */
  sugestoes?: Record<string, SugestaoCampo>;
  /** Lista de etapas à esquerda no computador. */
  listaDeEtapas?: boolean;
  /** Contexto à direita no computador; no celular fica acima da primeira etapa. */
  lateral?: React.ReactNode;
  /** Texto do botão da última etapa. */
  rotuloConcluir?: string;
  /** Relógio injetável (teste). Usado no preenchimento automático de hora e data. */
  agora?: () => Date;
  aoMudarEtapa?: (indice: number, bloco: Bloco) => void;
  /** Chamado a cada gravação com as ligações de alerta satisfeitas. */
  aoAvaliarAlertas?: (endereco: EnderecoCampo, alertas: AlertaLigado[]) => void;
  aoConcluir?: (respostas: RespostasFormulario) => void;
  className?: string;
}

const FUSO = "America/Sao_Paulo";

function partesAgora(data: Date) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(data);
  const parte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    data: `${parte("year")}-${parte("month")}-${parte("day")}`,
    hora: `${parte("hour")}:${parte("minute")}`,
  };
}

function valorAutomaticoDeHora(campo: Campo, agora: Date): string | undefined {
  if (campo.tipo === "hora") return partesAgora(agora).hora;
  if (campo.tipo === "data") return partesAgora(agora).data;
  return undefined;
}

/**
 * Preenche hora e data marcadas como automáticas (`preenchimento`) que ainda
 * estão vazias. Função pura: devolve as respostas novas e o que gravar.
 */
function preencherAutomaticos(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  momento: "ao_abrir" | "ao_concluir",
  agora: Date,
): {
  respostas: RespostasFormulario;
  preenchidos: { endereco: EnderecoCampo; valor: string }[];
} {
  let atual = respostas;
  const preenchidos: { endereco: EnderecoCampo; valor: string }[] = [];
  for (const b of definicao.blocos) {
    if (b.repete_por_bebe) continue;
    for (const c of b.campos) {
      if (!("preenchimento" in c) || c.preenchimento !== momento) continue;
      const endereco = { bloco: b.id, campo: c.id };
      if (lerValor(atual, endereco) !== undefined) continue;
      const valor = valorAutomaticoDeHora(c, agora);
      if (!valor) continue;
      atual = comValor(atual, endereco, valor);
      preenchidos.push({ endereco, valor });
    }
  }
  return { respostas: atual, preenchidos };
}

function tituloDoBloco(bloco: Bloco): React.ReactNode {
  const numerado = /^(\d+(\.\d+)*|[A-Z])$/.test(bloco.id);
  return numerado ? (
    <>
      <span className="text-texto-2 font-mono">{bloco.id}</span> {bloco.titulo}
    </>
  ) : (
    bloco.titulo
  );
}

/** Uma etapa como a tela a mostra: campos de um ou mais blocos. */
interface EtapaView {
  id: string;
  titulo: React.ReactNode;
  rotuloCurto: string;
  ajuda?: string;
  repetePorBebe: boolean;
  itens: { bloco: Bloco; campos: Campo[] }[];
}

function montarEtapas(
  definicao: DefinicaoInstrumento,
  ambiente: Parameters<typeof etapasVisiveis>[0],
  plano: EtapaPlano[] | undefined,
): EtapaView[] {
  if (!plano) {
    return etapasVisiveis(ambiente).map((b) => ({
      id: b.id,
      titulo: tituloDoBloco(b),
      rotuloCurto: `${b.id} ${b.titulo}`,
      ajuda: b.ajuda,
      repetePorBebe: b.repete_por_bebe === true,
      itens: [{ bloco: b, campos: b.campos }],
    }));
  }

  // campos que o plano cita; o resto vai para a última etapa
  const citados = new Set<string>();
  for (const etapa of plano) {
    for (const item of etapa.itens) {
      const bloco = definicao.blocos.find((b) => b.id === item.bloco);
      for (const c of item.campos ?? bloco?.campos.map((x) => x.id) ?? []) {
        citados.add(`${item.bloco}.${c}`);
      }
    }
  }
  const sobras = definicao.blocos
    .map((b) => ({
      bloco: b,
      campos: b.campos.filter((c) => !citados.has(`${b.id}.${c.id}`)),
    }))
    .filter((i) => i.campos.length > 0);

  const etapas: EtapaView[] = plano.map((etapa, indice) => {
    const itens: EtapaView["itens"] = [];
    for (const item of etapa.itens) {
      const bloco = definicao.blocos.find((b) => b.id === item.bloco);
      if (!bloco || !blocoVisivel(bloco, ambiente)) continue;
      const campos = item.campos
        ? item.campos
            .map((id) => bloco.campos.find((c) => c.id === id))
            .filter((c): c is Campo => c !== undefined)
        : bloco.campos;
      itens.push({ bloco, campos });
    }
    if (indice === plano.length - 1) itens.push(...sobras);
    return {
      id: etapa.id,
      titulo: etapa.titulo,
      rotuloCurto: `${etapa.id} ${etapa.titulo}`,
      ajuda: etapa.ajuda,
      repetePorBebe: false,
      itens,
    };
  });

  // etapa sem nenhum campo visível não aparece
  return etapas.filter((e) =>
    e.itens.some((i) =>
      i.campos.some((c) => campoVisivel(c, { ...ambiente, bebe: undefined })),
    ),
  );
}

function textoSincronizacao(estado: EstadoPersistencia): string {
  switch (estado.estado) {
    case "enviando":
      return t.sincronizacao.enviando(estado.pendentes);
    case "sincronizado":
      return t.sincronizacao.sincronizado(
        estado.sincronizadoEm ? partesAgora(estado.sincronizadoEm).hora : "",
      );
    case "erro":
      return t.sincronizacao.erro;
    default:
      return t.sincronizacao.local;
  }
}

/** Leva o foco ao campo pelo id do DOM (input direto ou o primeiro controle do grupo). */
function focarCampo(endereco: EnderecoCampo): void {
  const id = idDom(endereco);
  const alvo =
    document.getElementById(id) ??
    document.querySelector<HTMLElement>(
      `[data-campo="${id}"] :is(input, textarea, button, select)`,
    );
  if (alvo instanceof HTMLElement) {
    alvo.focus({ preventScroll: true });
    alvo.scrollIntoView?.({ block: "center" });
  }
}

export function FormularioInstrumento({
  definicao,
  persistencia,
  respostasIniciais,
  bebes = [],
  contexto,
  etapaInicial = 0,
  campoInicial,
  valoresAutomaticos,
  plano,
  sugestoes,
  listaDeEtapas = false,
  lateral,
  rotuloConcluir,
  agora = () => new Date(),
  aoMudarEtapa,
  aoAvaliarAlertas,
  aoConcluir,
  className,
}: FormularioInstrumentoProps) {
  // Hora e data "preenchidas automaticamente, editáveis" (PRD 9.1): ao abrir.
  const [inicial] = React.useState(() =>
    preencherAutomaticos(
      definicao,
      respostasIniciais ?? respostasVazias(),
      "ao_abrir",
      agora(),
    ),
  );
  const [respostas, definirRespostas] = React.useState<RespostasFormulario>(
    inicial.respostas,
  );
  React.useEffect(() => {
    for (const { endereco, valor } of inicial.preenchidos) {
      void persistencia.salvarCampo(endereco, valor);
    }
  }, [inicial, persistencia]);

  const [estadoSinc, definirEstadoSinc] =
    React.useState<EstadoPersistencia | null>(null);
  React.useEffect(
    () => persistencia.observarEstado?.(definirEstadoSinc),
    [persistencia],
  );

  const ambiente = { definicao, respostas, contexto };
  const etapas = montarEtapas(definicao, ambiente, plano);
  const [indice, definirIndice] = React.useState(() =>
    Math.min(Math.max(etapaInicial, 0), Math.max(etapas.length - 1, 0)),
  );
  const indiceAtual = Math.min(indice, Math.max(etapas.length - 1, 0));
  const etapa = etapas[indiceAtual];
  const [bebeAtivo, definirBebeAtivo] = React.useState<string | undefined>(
    bebes[0]?.id,
  );
  const tituloRef = React.useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = React.useRef(true);

  // Retomada: o foco volta ao campo onde a pessoa parou.
  const campoInicialRef = React.useRef(campoInicial);
  React.useEffect(() => {
    const alvo = campoInicialRef.current;
    if (!alvo) return;
    campoInicialRef.current = undefined;
    const quadro = window.requestAnimationFrame(() => focarCampo(alvo));
    return () => window.cancelAnimationFrame(quadro);
  }, []);

  function gravar(
    endereco: EnderecoCampo,
    campo: Campo,
    valor: ValorCampo | null,
    salvar: boolean,
  ) {
    let proximas = comValor(respostas, endereco, valor);
    // Resposta que deixou de se aplicar (condição para aparecer) é apagada e
    // a remoção grava na hora, para o registro não levar dado escondido.
    const ocultos = camposOcultosComValor(definicao, proximas, {
      bebes,
      contexto,
    });
    for (const oculto of ocultos) proximas = comValor(proximas, oculto, null);
    definirRespostas(proximas);
    for (const oculto of ocultos) void persistencia.salvarCampo(oculto, null);
    if (!salvar) return;
    void persistencia.salvarCampo(endereco, valor);
    aoAvaliarAlertas?.(
      endereco,
      alertasSatisfeitos(campo, endereco, {
        definicao,
        respostas: proximas,
        contexto,
      }),
    );
  }

  // Troca de etapa: foco no título, para leitor de tela e teclado.
  React.useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    tituloRef.current?.focus();
    const bloco = etapa?.itens[0]?.bloco;
    if (bloco) aoMudarEtapa?.(indiceAtual, bloco);
    // aoMudarEtapa fica fora das dependências de propósito: só a troca de etapa dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceAtual]);

  function irPara(proximo: number) {
    definirIndice(Math.min(Math.max(proximo, 0), etapas.length - 1));
  }

  function irParaPendencia(p: Pendencia) {
    const alvo = etapas.findIndex((e) =>
      e.itens.some(
        (i) => i.bloco.id === p.bloco && i.campos.some((c) => c.id === p.campo),
      ),
    );
    if (alvo >= 0) irPara(alvo);
    if (p.bebe) definirBebeAtivo(p.bebe);
  }

  const pendencias = pendenciasParaConcluir(definicao, respostas, {
    bebes,
    contexto,
  });
  const ultima = indiceAtual === etapas.length - 1;

  function concluir() {
    if (pendencias.length > 0) return;
    const final = preencherAutomaticos(
      definicao,
      respostas,
      "ao_concluir",
      agora(),
    );
    if (final.preenchidos.length > 0) {
      definirRespostas(final.respostas);
      for (const { endereco, valor } of final.preenchidos) {
        void persistencia.salvarCampo(endereco, valor);
      }
    }
    aoConcluir?.(final.respostas);
  }

  function renderizarCampos(b: Bloco, campos: Campo[], bebe?: BebeFormulario) {
    const ambienteBebe = { ...ambiente, bebe: bebe?.id };
    return campos
      .filter((c) => campoVisivel(c, ambienteBebe))
      .map((c) => {
        const endereco: EnderecoCampo = {
          bloco: b.id,
          campo: c.id,
          bebe: bebe?.id,
        };
        const valor = lerValor(respostas, endereco);
        const sugestao = sugestoes?.[`${b.id}.${c.id}`];
        return (
          <React.Fragment key={`${b.id}.${c.id}.${bebe?.id ?? ""}`}>
            {sugestao && valor === undefined ? (
              <div
                data-sugestao={`${b.id}.${c.id}`}
                className="bg-areia/60 rounded-2 my-1 flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <p className="text-apoio text-texto">
                  <span className="font-semibold">
                    {t.sugestao.veioDoCadastro}
                  </span>
                  {": "}
                  {sugestao.exibicao ?? String(sugestao.valor)}
                </p>
                <Botao
                  type="button"
                  variante="secundario"
                  tamanho="compacto"
                  aria-label={t.sugestao.confirmarEste(c.rotulo)}
                  onClick={() => gravar(endereco, c, sugestao.valor, true)}
                >
                  {t.sugestao.confirmar}
                </Botao>
              </div>
            ) : null}
            <CampoInstrumento
              campo={c}
              endereco={endereco}
              valor={valor}
              valorAutomatico={valoresAutomaticos?.[`${b.id}.${c.id}`]}
              aoMudar={(v, salvar) => gravar(endereco, c, v, salvar)}
            />
          </React.Fragment>
        );
      });
  }

  const estadoIndicador: EstadoSincronizacao = estadoSinc?.estado ?? "local";

  if (!etapa) return null;

  /** Situação de cada etapa para a lista do computador. */
  function situacao(e: EtapaView): { respondidas: number; total: number } {
    let total = 0;
    let respondidas = 0;
    for (const item of e.itens) {
      for (const c of item.campos) {
        if (c.tipo === "automatico") continue;
        if (!campoVisivel(c, ambiente)) continue;
        total += 1;
        const valor = lerValor(respostas, {
          bloco: item.bloco.id,
          campo: c.id,
        });
        if (estaRespondido(c, valor)) respondidas += 1;
      }
    }
    return { respondidas, total };
  }

  const conteudo = (
    <section
      aria-label={definicao.titulo}
      className={cn("bg-fundo flex min-h-full min-w-0 flex-col", className)}
    >
      <header className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-apoio text-texto-2 font-mono"
            aria-live="polite"
          >
            {t.etapa(indiceAtual + 1, etapas.length)}
          </span>
          {estadoSinc ? (
            <IndicadorSincronizacao
              estado={estadoIndicador}
              texto={textoSincronizacao(estadoSinc)}
              aoTentarNovamente={
                estadoSinc.estado === "erro" && persistencia.tentarNovamente
                  ? () => persistencia.tentarNovamente?.()
                  : undefined
              }
              rotuloTentarNovamente={t.sincronizacao.tentarAgora}
            />
          ) : null}
        </div>
        <ProgressoEtapas etapas={etapas.map((e) => e.id)} atual={indiceAtual} />
        {estadoSinc?.online === false ? (
          <p className="text-apoio text-texto-2">{t.sincronizacao.semSinal}</p>
        ) : null}
        <h2
          ref={tituloRef}
          tabIndex={-1}
          className="font-titulo text-1 text-texto outline-none"
        >
          {etapa.titulo}
        </h2>
        {etapa.ajuda ? (
          <p className="text-apoio text-texto-2">{etapa.ajuda}</p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-1 px-4 pb-4">
        {etapa.repetePorBebe && etapa.itens[0] ? (
          bebes.length === 0 ? (
            <p className="text-corpo text-texto-2 py-4">{t.semBebe}</p>
          ) : bebes.length === 1 ? (
            renderizarCampos(
              etapa.itens[0].bloco,
              etapa.itens[0].campos,
              bebes[0],
            )
          ) : (
            <AbasBebes
              bebes={bebes}
              ativo={bebeAtivo ?? bebes[0]?.id}
              aoTrocar={definirBebeAtivo}
              idBloco={etapa.itens[0].bloco.id}
              conteudo={(bebe) =>
                renderizarCampos(
                  etapa.itens[0]!.bloco,
                  etapa.itens[0]!.campos,
                  bebe,
                )
              }
            />
          )
        ) : (
          etapa.itens.map((item) => (
            <div
              key={item.bloco.id}
              className="flex flex-col gap-1"
              data-bloco={item.bloco.id}
            >
              {etapa.itens.length > 1 && plano ? (
                <h3 className="text-apoio text-texto-2 pt-3 font-semibold">
                  {item.bloco.titulo}
                </h3>
              ) : null}
              {renderizarCampos(item.bloco, item.campos)}
            </div>
          ))
        )}

        {ultima ? (
          <div className="border-linha mt-4 flex flex-col gap-2 border-t pt-4">
            {pendencias.length > 0 ? (
              <>
                <p className="text-apoio text-texto font-semibold">
                  {t.faltaParaConcluir}
                </p>
                <ul className="flex flex-col gap-1">
                  {pendencias.map((p) => {
                    const rotulo = [p.rotuloBloco, p.rotuloBebe, p.rotulo]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <li key={`${p.bloco}.${p.campo}.${p.bebe ?? ""}`}>
                        <Botao
                          type="button"
                          variante="fantasma"
                          tamanho="compacto"
                          className="h-auto text-left whitespace-normal"
                          aria-label={t.irPara(rotulo)}
                          onClick={() => irParaPendencia(p)}
                        >
                          {rotulo}
                        </Botao>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-apoio text-sucesso font-semibold">
                {t.tudoRespondido}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <nav
        aria-label={t.listaDeEtapas}
        className="border-linha bg-superficie shadow-2 sticky bottom-0 z-(--z-barra) grid grid-cols-2 gap-3 border-t px-4 py-3"
      >
        <Botao
          type="button"
          variante="secundario"
          largaTotal
          disabled={indiceAtual === 0}
          onClick={() => irPara(indiceAtual - 1)}
        >
          {t.voltar}
        </Botao>
        {ultima ? (
          <Botao
            type="button"
            largaTotal
            aria-disabled={pendencias.length > 0 || undefined}
            onClick={concluir}
          >
            {rotuloConcluir ?? t.concluir}
          </Botao>
        ) : (
          <Botao
            type="button"
            largaTotal
            onClick={() => irPara(indiceAtual + 1)}
          >
            {t.proximaEtapa}
          </Botao>
        )}
      </nav>
    </section>
  );

  if (!listaDeEtapas && !lateral) return conteudo;

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_20rem] lg:gap-6">
      {listaDeEtapas ? (
        <nav
          aria-label={t.todasAsEtapas}
          className="hidden lg:block"
          data-lista-etapas
        >
          <ol className="flex flex-col gap-1">
            {etapas.map((e, i) => {
              const { respondidas, total } = situacao(e);
              const estado =
                total > 0 && respondidas === total
                  ? t.estadoEtapa.completa
                  : respondidas > 0
                    ? t.estadoEtapa.emAndamento(respondidas, total)
                    : t.estadoEtapa.naoIniciada;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => irPara(i)}
                    aria-current={i === indiceAtual ? "step" : undefined}
                    className={cn(
                      "min-h-toque rounded-2 flex w-full flex-col items-start justify-center border-l-2 px-3 py-2 text-left",
                      i === indiceAtual
                        ? "border-dourado bg-superficie shadow-1"
                        : "hover:bg-areia/40 border-transparent",
                    )}
                  >
                    <span className="text-corpo text-texto font-medium">
                      {e.rotuloCurto}
                    </span>
                    <span className="text-apoio text-texto-2">{estado}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {conteudo}
      {lateral ? (
        <aside className="px-4 pt-4 lg:px-0 lg:pt-0" data-lateral>
          {lateral}
        </aside>
      ) : null}
    </div>
  );
}

function AbasBebes({
  bebes,
  ativo,
  aoTrocar,
  idBloco,
  conteudo,
}: {
  bebes: BebeFormulario[];
  ativo: string | undefined;
  aoTrocar: (id: string) => void;
  idBloco: string;
  conteudo: (bebe: BebeFormulario) => React.ReactNode;
}) {
  const base = `abas-${idBloco.replace(/\W/g, "_")}`;
  const atual = bebes.find((b) => b.id === ativo) ?? bebes[0];
  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label={t.abasBebes}
        className="border-linha flex gap-2 overflow-x-auto border-b"
      >
        {bebes.map((bebe) => {
          const selecionada = bebe.id === atual?.id;
          return (
            <button
              key={bebe.id}
              type="button"
              role="tab"
              id={`${base}-aba-${bebe.id}`}
              aria-selected={selecionada}
              aria-controls={`${base}-painel-${bebe.id}`}
              onClick={() => aoTrocar(bebe.id)}
              className={cn(
                "min-h-toque text-corpo text-texto border-b-2 px-4 font-semibold whitespace-nowrap",
                selecionada
                  ? "border-dourado"
                  : "text-texto-2 border-transparent",
              )}
            >
              {bebe.rotulo}
            </button>
          );
        })}
      </div>
      {atual ? (
        <div
          role="tabpanel"
          id={`${base}-painel-${atual.id}`}
          aria-labelledby={`${base}-aba-${atual.id}`}
        >
          {conteudo(atual)}
        </div>
      ) : null}
    </div>
  );
}
