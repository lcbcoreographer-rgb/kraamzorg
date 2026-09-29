"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { ItemResumo, ResumoSessao } from "@/lib/dados/tipos-venda";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoGerarResumo, acaoSalvarResumo } from "../acoes";
import { estadoInicialSessao, type ResumoGerado } from "../estado-acoes";

/**
 * Resumo da conversa (P29 item 3): dúvidas, objeções ditas, plano de
 * interesse e próximos passos. A IA (quando ligada) preenche os campos e
 * mostra, embaixo de cada um, o trecho da transcrição que sustenta cada
 * item; item sem trecho que confira nem chega aqui. Nada é salvo sem a
 * pessoa revisar e tocar em "Salvar resumo".
 */

const CAMPOS = [
  { chave: "duvidas", rotulo: "Dúvidas da família" },
  { chave: "objecoes", rotulo: "Objeções que a família disse" },
  { chave: "proximosPassos", rotulo: "Próximos passos combinados" },
] as const;

type ChaveLista = (typeof CAMPOS)[number]["chave"];

function paraTexto(itens: string[] | ItemResumo[]): string {
  return itens
    .map((item) => (typeof item === "string" ? item : item.texto))
    .join("\n");
}

export function EditorResumo({
  sessaoId,
  resumo,
  iaLigada,
}: {
  sessaoId: string;
  resumo: ResumoSessao | null;
  iaLigada: boolean;
}) {
  const [estado, acao, salvando] = useActionState(
    acaoSalvarResumo,
    estadoInicialSessao,
  );
  const [valores, definirValores] = React.useState({
    duvidas: paraTexto(resumo?.duvidas ?? []),
    objecoes: paraTexto(resumo?.objecoes ?? []),
    proximosPassos: paraTexto(resumo?.proximosPassos ?? []),
    planoInteresse: resumo?.planoInteresse ?? "",
  });
  const [gerado, definirGerado] = React.useState<ResumoGerado | null>(null);
  const [erroIa, definirErroIa] = React.useState<string | null>(null);
  const [gerando, iniciarGeracao] = React.useTransition();

  function gerar() {
    definirErroIa(null);
    iniciarGeracao(async () => {
      const resultado = await acaoGerarResumo(sessaoId);
      if (!resultado.ok) {
        definirErroIa(resultado.erro);
        return;
      }
      definirGerado(resultado.resumo);
      definirValores({
        duvidas: paraTexto(resultado.resumo.duvidas),
        objecoes: paraTexto(resultado.resumo.objecoes),
        proximosPassos: paraTexto(resultado.resumo.proximosPassos),
        planoInteresse: resultado.resumo.planoInteresse?.texto ?? "",
      });
    });
  }

  const trechos = (chave: ChaveLista | "planoInteresse"): ItemResumo[] => {
    if (!gerado) return [];
    if (chave === "planoInteresse") {
      return gerado.planoInteresse ? [gerado.planoInteresse] : [];
    }
    return gerado[chave];
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {iaLigada ? (
          <Botao
            variante="secundario"
            onClick={gerar}
            carregando={gerando}
            rotuloCarregando="Lendo a transcrição"
            className="self-start"
          >
            Preencher com o resumo automático
          </Botao>
        ) : (
          <p className="text-corpo text-texto-2 max-w-leitura">
            O resumo automático está desligado neste ambiente. Escreva o resumo
            nos campos abaixo, um item por linha; ele fica guardado do mesmo
            jeito.
          </p>
        )}
        {erroIa ? <FaixaAlerta variante="erro" titulo={erroIa} /> : null}
        {gerado ? (
          <p className="text-apoio text-texto-2" role="status">
            Revise antes de salvar. Cada item veio com o trecho da conversa que
            o sustenta
            {gerado.descartados > 0
              ? `; ${gerado.descartados === 1 ? "um item ficou" : `${gerado.descartados} itens ficaram`} de fora porque não aparece${gerado.descartados === 1 ? "" : "m"} na transcrição.`
              : "."}
          </p>
        ) : null}
      </div>

      <form action={acao} className="flex flex-col gap-5">
        <input type="hidden" name="sessaoId" value={sessaoId} />
        <input type="hidden" name="origem" value={gerado ? "ia" : "pessoa"} />
        <input type="hidden" name="modelo" value={gerado?.modelo ?? ""} />

        {CAMPOS.map((campo) => (
          <div key={campo.chave} className="flex flex-col gap-2">
            <CampoTexto
              rotulo={campo.rotulo}
              name={campo.chave}
              multilinha
              linhas={3}
              value={valores[campo.chave]}
              onChange={(evento) =>
                definirValores((atuais) => ({
                  ...atuais,
                  [campo.chave]: evento.target.value,
                }))
              }
              descricao="Um item por linha."
            />
            <Trechos itens={trechos(campo.chave)} />
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <CampoTexto
            rotulo="Plano de interesse"
            name="planoInteresse"
            value={valores.planoInteresse}
            onChange={(evento) =>
              definirValores((atuais) => ({
                ...atuais,
                planoInteresse: evento.target.value,
              }))
            }
            opcional
          />
          <Trechos itens={trechos("planoInteresse")} />
        </div>

        {estado.erro ? (
          <FaixaAlerta variante="erro" titulo={estado.erro} />
        ) : null}
        {estado.sucesso ? (
          <FaixaAlerta variante="sucesso" titulo={estado.sucesso} anunciar />
        ) : null}
        {resumo?.salvoEm && !estado.sucesso ? (
          <p className="text-apoio text-texto-2">
            Último resumo salvo em {formatarDataHora(resumo.salvoEm)}
            {resumo.origem === "ia" ? ", a partir do resumo automático." : "."}
          </p>
        ) : null}

        <Botao
          type="submit"
          carregando={salvando}
          rotuloCarregando="Salvando"
          className="self-start"
        >
          Salvar resumo
        </Botao>
      </form>
    </div>
  );
}

function Trechos({ itens }: { itens: ItemResumo[] }) {
  const comTrecho = itens.filter((item) => item.trecho);
  if (comTrecho.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {comTrecho.map((item, i) => (
        <li
          key={`${i}-${item.texto}`}
          className="rounded-2 bg-superficie-2 text-apoio text-texto p-3"
        >
          <span className="text-texto-2">Na conversa: </span>
          <q>{item.trecho}</q>
        </li>
      ))}
    </ul>
  );
}
