"use client";

import * as React from "react";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { SimNao } from "@/components/ui/sim-nao";
import { obter, type CampoEditavel, type Dados } from "../campos";

/**
 * Um campo da evolução desenhado a partir do descritor de `campos.ts`. O
 * valor inicial vem da entrada salva; o nome do campo no formulário é o
 * caminho com pontos (`conclusao.amamentacao`), o mesmo que
 * `aplicarFormulario` lê no servidor. Sem estado próprio: o formulário inteiro
 * é lido de uma vez ao salvar.
 */

function textoInicial(valor: unknown): string {
  if (valor === undefined || valor === null) return "";
  if (Array.isArray(valor)) return valor.map(String).join("\n");
  return typeof valor === "number"
    ? String(valor).replace(".", ",")
    : String(valor);
}

function faixaInicial(valor: unknown): { min: string; max: string } {
  if (valor && typeof valor === "object") {
    const f = valor as { min?: unknown; max?: unknown };
    return {
      min: textoInicial(f.min),
      max: textoInicial(f.max),
    };
  }
  return { min: "", max: "" };
}

export function CampoEvolucao({
  campo,
  dados,
  desabilitado,
}: {
  campo: CampoEditavel;
  dados: Dados;
  desabilitado: boolean;
}) {
  const valor = obter(dados, campo.caminho);
  const rotulo = campo.unidade
    ? `${campo.rotulo} (${campo.unidade})`
    : campo.rotulo;
  const opcional = !campo.obrigatorio;

  switch (campo.tipo) {
    case "texto":
      return (
        <CampoTexto
          rotulo={rotulo}
          name={campo.caminho}
          defaultValue={textoInicial(valor)}
          descricao={campo.ajuda}
          opcional={opcional}
          disabled={desabilitado}
          maxLength={300}
        />
      );
    case "textolongo":
      return (
        <CampoTexto
          rotulo={rotulo}
          name={campo.caminho}
          defaultValue={textoInicial(valor)}
          descricao={campo.ajuda}
          opcional={opcional}
          disabled={desabilitado}
          multilinha
          linhas={4}
          maxLength={2000}
        />
      );
    case "lista":
      return (
        <CampoTexto
          rotulo={rotulo}
          name={campo.caminho}
          defaultValue={textoInicial(valor)}
          descricao={campo.ajuda}
          opcional={opcional}
          disabled={desabilitado}
          multilinha
          linhas={4}
          maxLength={2000}
        />
      );
    case "numero":
      return (
        <CampoTexto
          rotulo={rotulo}
          name={campo.caminho}
          defaultValue={textoInicial(valor)}
          descricao={campo.ajuda}
          opcional={opcional}
          disabled={desabilitado}
          inputMode="decimal"
          autoComplete="off"
          containerClassName="max-w-[220px]"
        />
      );
    case "data":
      return (
        <CampoTexto
          rotulo={rotulo}
          name={campo.caminho}
          type="date"
          defaultValue={typeof valor === "string" ? valor : ""}
          descricao={campo.ajuda}
          opcional={opcional}
          disabled={desabilitado}
          containerClassName="max-w-[220px]"
        />
      );
    case "faixa": {
      const inicial = faixaInicial(valor);
      return (
        <fieldset className="flex flex-col gap-2" disabled={desabilitado}>
          <legend className="text-apoio text-texto font-semibold">
            {rotulo}
            {opcional ? (
              <span className="text-texto-2 font-normal"> (opcional)</span>
            ) : null}
          </legend>
          <div className="grid max-w-[360px] grid-cols-2 gap-3">
            <CampoTexto
              rotulo="Menor valor"
              name={`${campo.caminho}.min`}
              defaultValue={inicial.min}
              inputMode="decimal"
              autoComplete="off"
            />
            <CampoTexto
              rotulo="Maior valor"
              name={`${campo.caminho}.max`}
              defaultValue={inicial.max}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          {campo.ajuda ? (
            <p className="text-apoio text-texto-2">{campo.ajuda}</p>
          ) : null}
        </fieldset>
      );
    }
    case "simnao":
      return (
        <SimNao
          pergunta={campo.rotulo}
          name={campo.caminho}
          valorPadrao={
            valor === true ? "sim" : valor === false ? "nao" : undefined
          }
          rotuloSim="Sim"
          rotuloNao="Não"
          disabled={desabilitado}
        />
      );
    case "opcao":
      return (
        <EscolhaUnica
          rotulo={rotulo}
          name={campo.caminho}
          opcoes={[
            ...(campo.opcoes ?? []),
            ...(opcional ? [{ valor: "", rotulo: "Não informar" }] : []),
          ]}
          valorPadrao={
            typeof valor === "string" ? valor : opcional ? "" : undefined
          }
          descricao={campo.ajuda}
          disabled={desabilitado}
        />
      );
  }
}
