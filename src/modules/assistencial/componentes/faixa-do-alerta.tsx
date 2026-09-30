"use client";

import * as React from "react";
import {
  ChevronRight,
  ClipboardPen,
  PhoneCall,
  Siren,
  TriangleAlert,
  OctagonPause,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  camposFaltandoDoAcionamento,
  linkDeLigacao,
  tituloDoAchado,
  varianteDaFaixa,
} from "@/lib/checklist/alertas";
import { cn } from "@/lib/utils";
import { textos } from "../checklist/textos";
import type { AlertaNaTela } from "../tipos";

/**
 * Faixa de alerta clínico da enfermeira (DESIGN.md, seção 6; fluxos.md,
 * fluxo A passo 5). Código da regra, achado com o valor, conduta aprovada
 * sem paráfrase, o que falta registrar e as duas ações: ligar para a
 * supervisão (link de telefone, funciona sem dados) e registrar o
 * acionamento. Família em luto ou intercorrência usa a variante ameixa,
 * nunca o vermelho (DESIGN.md 11.3).
 */
export interface FaixaDoAlertaProps {
  alerta: AlertaNaTela;
  /** Telefone da supervisão médica em E.164 (parâmetro); vazio se não informado. */
  telefone: string;
  semSinal: boolean;
  aoRegistrar: (alerta: AlertaNaTela) => void;
  /** Só a primeira aparição anuncia (role="alert"). */
  anunciar?: boolean;
  fixa?: boolean;
  className?: string;
}

export function FaixaDoAlerta({
  alerta,
  telefone,
  semSinal,
  aoRegistrar,
  anunciar,
  fixa,
  className,
}: FaixaDoAlertaProps) {
  const link = linkDeLigacao(telefone);
  const faltam = camposFaltandoDoAcionamento(alerta.acionamento);
  const variante = varianteDaFaixa(alerta.severidade, alerta.sensivel);
  const titulo = tituloDoAchado(alerta.descricao, alerta.valorLegivel);

  return (
    <FaixaAlerta
      variante={variante}
      codigo={alerta.regraId}
      titulo={alerta.bebeRotulo ? `${titulo} (${alerta.bebeRotulo})` : titulo}
      anunciar={anunciar}
      fixa={fixa}
      className={className}
      meta={
        <>
          {faltam.length === 0
            ? textos.alerta.registrado
            : textos.alerta.antesDeFechar}
          {semSinal ? (
            <>
              <br />
              {textos.alerta.semSinalMeta}
            </>
          ) : null}
        </>
      }
      acoes={
        <>
          {link ? (
            <Botao
              asChild
              variante={variante === "imediato" ? "perigo" : "secundario"}
              tamanho="compacto"
            >
              <a href={link}>
                <PhoneCall className="size-[18px]" aria-hidden="true" />
                {textos.alerta.ligar}
              </a>
            </Botao>
          ) : (
            <span className="text-apoio text-texto font-semibold">
              {textos.alerta.ligarSemNumero}
            </span>
          )}
          <Botao
            variante="secundario"
            tamanho="compacto"
            onClick={() => aoRegistrar(alerta)}
          >
            <ClipboardPen className="size-[18px]" aria-hidden="true" />
            {textos.alerta.registrar}
          </Botao>
        </>
      }
    >
      {alerta.conduta}
    </FaixaAlerta>
  );
}

/**
 * Faixa presa no topo das outras etapas (fluxos.md, fluxo A): uma linha só,
 * sem o botão de ligar (a ligação continua na faixa cheia e na folha de
 * acionamento). Dois ou mais alertas viram "N alertas sem registro".
 * Ocorrência de saúde mental: só "Ocorrência privada. Registre o
 * acionamento." (a família pode estar no quarto e ler a tela).
 */
export function FaixaMiniAlerta({
  alertas,
  aoAbrir,
}: {
  alertas: AlertaNaTela[];
  aoAbrir: (alerta: AlertaNaTela | null) => void;
}) {
  if (alertas.length === 0) return null;
  const um = alertas.length === 1 ? alertas[0]! : null;
  const sensivel = alertas.some((a) => a.sensivel);
  const imediato = alertas.some((a) => a.severidade === "imediato");
  const cor = sensivel
    ? "bg-sensivel-lavado border-sensivel-borda text-sensivel"
    : imediato
      ? "bg-alerta-lavado border-alerta-borda text-alerta"
      : "bg-aviso-lavado border-aviso-borda text-aviso-texto";
  const Icone = sensivel ? OctagonPause : imediato ? Siren : TriangleAlert;
  const texto = um
    ? um.privado
      ? textos.alerta.ocorrenciaPrivada
      : tituloDoAchado(um.descricao, um.valorLegivel)
    : textos.alerta.variasSemRegistro(alertas.length);
  const codigo = um ? (um.privado ? um.regraId.slice(0, 2) : um.regraId) : null;

  return (
    <button
      type="button"
      onClick={() => aoAbrir(um)}
      aria-label={
        um
          ? `${codigo}, ${texto}. ${textos.alerta.registrar}`
          : `${texto}. ${textos.alerta.verLista}`
      }
      className={cn(
        "rounded-2 min-h-toque sticky top-[72px] z-10 flex w-full items-center gap-3 border px-3 py-2 text-left",
        cor,
      )}
    >
      <Icone className="size-5 shrink-0" aria-hidden="true" />
      {codigo ? (
        <span className="text-apoio font-mono font-medium">{codigo}</span>
      ) : null}
      <span className="text-apoio min-w-0 flex-1 truncate font-semibold">
        {texto}
      </span>
      {um ? (
        <span className="rounded-pilula bg-superficie text-texto text-mini px-3 py-1 font-semibold">
          {textos.alerta.registrarCurto}
        </span>
      ) : (
        <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
