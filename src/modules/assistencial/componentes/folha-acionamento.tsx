"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoRodape,
} from "@/components/ui/dialogo";
import {
  camposFaltandoDoAcionamento,
  tituloDoAchado,
} from "@/lib/checklist/alertas";
import type { AcionamentoAlerta } from "@/lib/checklist/registro";
import { textos } from "../checklist/textos";
import type { AlertaNaTela } from "../tipos";

/**
 * Folha "Registrar acionamento" (fluxos.md, fluxo A passo 6): os quatro
 * campos obrigatórios do DOC 3 antes de fechar um alerta. O sinal já vem da
 * regra (editável), a hora vem do relógio (editável) e a orientação médica
 * e a conduta são texto. Salvar grava o que foi preenchido; o alerta só
 * fecha com os quatro (coordenação, P40 item 4).
 */

const FUSO = "America/Sao_Paulo";

/** "10:14" no horário de Brasília para a data dada. */
export function horaAgoraEmBrasilia(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("hour")}:${valor("minute")}`;
}

/** Data de hoje em Brasília (aaaa-mm-dd). */
export function dataHojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** "10:14" de hoje em Brasília vira data e hora ISO 8601 com fuso. */
export function horarioParaIso(
  hora: string,
  agora: Date = new Date(),
): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const data = dataHojeEmBrasilia(agora);
  // Brasília: UTC-3 o ano todo desde 2019 (sem horário de verão).
  const instante = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

export interface FolhaAcionamentoProps {
  aberto: boolean;
  aoFechar: () => void;
  alerta: AlertaNaTela | null;
  aoSalvar: (acionamento: AcionamentoAlerta) => void | Promise<void>;
  /** Relógio injetável (teste). */
  agora?: () => Date;
}

export function FolhaAcionamento({
  aberto,
  aoFechar,
  alerta,
  aoSalvar,
  agora = () => new Date(),
}: FolhaAcionamentoProps) {
  return (
    <Dialogo open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      {alerta ? (
        <DialogoConteudo
          titulo={textos.folhaAcionamento.titulo}
          rotuloFechar={textos.alerta.fecharJanela}
        >
          {/* A chave reinicia o formulário a cada alerta aberto. */}
          <Formulario
            key={alerta.chave}
            alerta={alerta}
            aoFechar={aoFechar}
            aoSalvar={aoSalvar}
            agora={agora}
          />
        </DialogoConteudo>
      ) : null}
    </Dialogo>
  );
}

function Formulario({
  alerta,
  aoFechar,
  aoSalvar,
  agora,
}: {
  alerta: AlertaNaTela;
  aoFechar: () => void;
  aoSalvar: FolhaAcionamentoProps["aoSalvar"];
  agora: () => Date;
}) {
  const inicial = alerta.acionamento;
  const [sinal, definirSinal] = React.useState(
    inicial?.sinalIdentificado ??
      tituloDoAchado(alerta.descricao, alerta.valorLegivel),
  );
  const [hora, definirHora] = React.useState(() =>
    inicial?.acionadoEm
      ? horaAgoraEmBrasilia(new Date(inicial.acionadoEm))
      : horaAgoraEmBrasilia(agora()),
  );
  const [orientacao, definirOrientacao] = React.useState(
    inicial?.orientacaoMedica ?? "",
  );
  const [conduta, definirConduta] = React.useState(
    inicial?.condutaAdotada ?? "",
  );
  const [erroHora, definirErroHora] = React.useState<string | null>(null);
  const [salvando, definirSalvando] = React.useState(false);

  const iso = horarioParaIso(hora, agora());
  const montado: AcionamentoAlerta = {
    regraId: alerta.regraId,
    bebeId: alerta.bebeId,
    sinalIdentificado: sinal,
    acionadoEm: iso ?? "",
    orientacaoMedica: orientacao,
    condutaAdotada: conduta,
  };
  const faltam = camposFaltandoDoAcionamento(montado);

  async function salvar() {
    if (!iso) {
      definirErroHora(textos.folhaAcionamento.horaInvalida);
      return;
    }
    if (new Date(iso).getTime() > agora().getTime() + 5 * 60_000) {
      definirErroHora(textos.folhaAcionamento.horaNoFuturo);
      return;
    }
    definirErroHora(null);
    definirSalvando(true);
    try {
      await aoSalvar(montado);
      aoFechar();
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="text-corpo">
        <dt className="text-apoio text-texto-2">
          {textos.folhaAcionamento.sinal}
        </dt>
        <dd className="text-texto">
          <span className="text-apoio mr-2 font-mono font-medium">
            {alerta.regraId}
          </span>
          {alerta.privado
            ? textos.alerta.ocorrenciaPrivada
            : tituloDoAchado(alerta.descricao, alerta.valorLegivel)}
        </dd>
      </dl>
      <CampoTexto
        id="acionamento-sinal"
        rotulo={textos.folhaAcionamento.sinalIdentificado}
        value={sinal}
        onChange={(e) => definirSinal(e.target.value)}
      />
      <CampoTexto
        id="acionamento-hora"
        rotulo={textos.folhaAcionamento.horario}
        descricao={textos.folhaAcionamento.horarioAjuda}
        type="time"
        value={hora}
        onChange={(e) => definirHora(e.target.value)}
        erro={erroHora ?? undefined}
      />
      <CampoTexto
        id="acionamento-orientacao"
        rotulo={textos.folhaAcionamento.orientacao}
        multilinha
        linhas={3}
        value={orientacao}
        onChange={(e) => definirOrientacao(e.target.value)}
      />
      <CampoTexto
        id="acionamento-conduta"
        rotulo={textos.folhaAcionamento.conduta}
        multilinha
        linhas={3}
        value={conduta}
        onChange={(e) => definirConduta(e.target.value)}
      />
      {faltam.length > 0 ? (
        <p className="text-apoio text-texto-2" role="status">
          {textos.folhaAcionamento.faltamCampos}{" "}
          {faltam.map((f) => textos.folhaAcionamento.campoDe[f]).join(", ")}.
        </p>
      ) : null}
      <DialogoRodape>
        <Botao variante="secundario" onClick={aoFechar}>
          {textos.folhaAcionamento.agoraNao}
        </Botao>
        <Botao onClick={salvar} carregando={salvando}>
          {textos.folhaAcionamento.salvar}
        </Botao>
      </DialogoRodape>
    </div>
  );
}
