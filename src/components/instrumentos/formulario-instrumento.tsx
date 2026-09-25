"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { cn } from "@/lib/utils";
import type {
  AlertaLigado,
  Bloco,
  Campo,
  DefinicaoInstrumento,
} from "@/lib/instrumentos/schema";
import {
  alertasSatisfeitos,
  camposOcultosComValor,
  campoVisivel,
  comValor,
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
import { CampoInstrumento } from "./campo-instrumento";
import { textosFormulario as t } from "./textos";

/**
 * Gerador de formulário para celular a partir da definição de um
 * instrumento (P34 item 3). Uma etapa por bloco, na ordem da definição;
 * cada resposta grava na hora pelo motor offline (`persistencia`), sem
 * botão de salvar; bloco repetido por bebê vira uma aba por bebê em
 * gemelares; o botão de concluir só libera sem pendência obrigatória
 * (PRD 9.2 v4.2, bloco de amamentação inteiro obrigatório).
 *
 * Fica fora daqui (outras sessões): a faixa de alerta com a conduta (P40,
 * que se liga por `aoAvaliarAlertas`), assinatura e registro append-only
 * (P39), referência do dia anterior (P39) e a tela da coordenação (onda B).
 */
export interface FormularioInstrumentoProps {
  definicao: DefinicaoInstrumento;
  persistencia: PersistenciaRespostas;
  respostasIniciais?: RespostasFormulario;
  /** Bebês do acompanhamento, para os blocos repetidos. */
  bebes?: BebeFormulario[];
  /** Valores para as condições de contexto (ex: `{ ultimo_dia: true }`). */
  contexto?: ContextoFormulario;
  /** Retomada: abre na etapa onde a pessoa parou. */
  etapaInicial?: number;
  /** Texto dos campos `automatico`, por caminho "bloco.campo". */
  valoresAutomaticos?: Record<string, string>;
  /** Relógio injetável (teste). Usado no preenchimento automático de hora e data. */
  agora?: () => Date;
  aoMudarEtapa?: (indice: number, bloco: Bloco) => void;
  /** Chamado a cada gravação com as ligações de alerta cuja condição foi satisfeita. */
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

export function FormularioInstrumento({
  definicao,
  persistencia,
  respostasIniciais,
  bebes = [],
  contexto,
  etapaInicial = 0,
  valoresAutomaticos,
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
  const etapas = etapasVisiveis(ambiente);
  const [indice, definirIndice] = React.useState(() =>
    Math.min(Math.max(etapaInicial, 0), Math.max(etapas.length - 1, 0)),
  );
  const indiceAtual = Math.min(indice, Math.max(etapas.length - 1, 0));
  const bloco = etapas[indiceAtual];
  const [bebeAtivo, definirBebeAtivo] = React.useState<string | undefined>(
    bebes[0]?.id,
  );
  const tituloRef = React.useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = React.useRef(true);

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
    if (bloco) aoMudarEtapa?.(indiceAtual, bloco);
    // aoMudarEtapa fica fora das dependências de propósito: só a troca de etapa dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceAtual]);

  function irPara(proximo: number) {
    definirIndice(Math.min(Math.max(proximo, 0), etapas.length - 1));
  }

  function irParaPendencia(p: Pendencia) {
    const alvo = etapas.findIndex((b) => b.id === p.bloco);
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

  function renderizarCampos(b: Bloco, bebe?: BebeFormulario) {
    const ambienteBebe = { ...ambiente, bebe: bebe?.id };
    return b.campos
      .filter((c) => campoVisivel(c, ambienteBebe))
      .map((c) => {
        const endereco: EnderecoCampo = {
          bloco: b.id,
          campo: c.id,
          bebe: bebe?.id,
        };
        return (
          <CampoInstrumento
            key={`${b.id}.${c.id}.${bebe?.id ?? ""}`}
            campo={c}
            endereco={endereco}
            valor={lerValor(respostas, endereco)}
            valorAutomatico={valoresAutomaticos?.[`${b.id}.${c.id}`]}
            aoMudar={(valor, salvar) => gravar(endereco, c, valor, salvar)}
          />
        );
      });
  }

  const estadoIndicador: EstadoSincronizacao = estadoSinc?.estado ?? "local";

  if (!bloco) return null;

  return (
    <section
      aria-label={definicao.titulo}
      className={cn("bg-fundo flex min-h-full flex-col", className)}
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
        <div
          className="bg-marinho-14 rounded-pilula h-1.5 w-full overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="bg-acao rounded-pilula h-full"
            style={{ width: `${((indiceAtual + 1) / etapas.length) * 100}%` }}
          />
        </div>
        {estadoSinc?.online === false ? (
          <p className="text-apoio text-texto-2">{t.sincronizacao.semSinal}</p>
        ) : null}
        <h2
          ref={tituloRef}
          tabIndex={-1}
          className="font-titulo text-1 text-texto outline-none"
        >
          {tituloDoBloco(bloco)}
        </h2>
        {bloco.ajuda ? (
          <p className="text-apoio text-texto-2">{bloco.ajuda}</p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-1 px-4 pb-4">
        {bloco.repete_por_bebe ? (
          bebes.length === 0 ? (
            <p className="text-corpo text-texto-2 py-4">{t.semBebe}</p>
          ) : bebes.length === 1 ? (
            renderizarCampos(bloco, bebes[0])
          ) : (
            <AbasBebes
              bebes={bebes}
              ativo={bebeAtivo ?? bebes[0]?.id}
              aoTrocar={definirBebeAtivo}
              idBloco={bloco.id}
              conteudo={(bebe) => renderizarCampos(bloco, bebe)}
            />
          )
        ) : (
          renderizarCampos(bloco)
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
            {t.concluir}
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
