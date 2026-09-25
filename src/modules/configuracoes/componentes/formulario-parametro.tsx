"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoNumero } from "@/components/ui/campo-numero";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { SimNao } from "@/components/ui/sim-nao";
import { formatarDataHora } from "@/lib/formatacao";
import {
  atualizarParametroAction,
  type EstadoFormulario,
} from "../acoes/parametros";
import { ajudaPorTipo, listaParaTexto } from "../dados/parametro-tipo";
import type { HistoricoParametroItem, ParametroComTipo } from "../dados/tipos";

const inicial: EstadoFormulario = {};

function textoEditavel(parametro: ParametroComTipo): string {
  switch (parametro.tipo) {
    case "lista_texto":
      return listaParaTexto((parametro.valor as string[]) ?? []);
    case "texto":
      return String(parametro.valor);
    case "inteiro":
    case "decimal":
      return String(parametro.valor);
    case "objeto":
    case "nulo":
      return JSON.stringify(parametro.valor, null, 2);
    default:
      return "";
  }
}

export function FormularioParametro({
  parametro,
  historico,
}: {
  parametro: ParametroComTipo;
  historico: HistoricoParametroItem[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await atualizarParametroAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );
  const [valorBooleano, definirValorBooleano] = useState(
    parametro.tipo === "booleano" ? Boolean(parametro.valor) : false,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="icone"
          aria-label={`Editar ${parametro.chave}`}
          iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
        />
      </DialogoGatilho>
      <DialogoConteudo
        titulo={parametro.chave}
        descricao={parametro.descricao ?? undefined}
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="chave" value={parametro.chave} />
          <input type="hidden" name="tipo" value={parametro.tipo} />

          {parametro.tipo === "booleano" ? (
            <>
              <input
                type="hidden"
                name="valor"
                value={valorBooleano ? "true" : "false"}
              />
              <SimNao
                pergunta="Valor"
                name="valor-visivel"
                rotuloSim="Ligado"
                rotuloNao="Desligado"
                valor={valorBooleano ? "sim" : "nao"}
                onMudar={(v) => definirValorBooleano(v === "sim")}
              />
            </>
          ) : parametro.tipo === "inteiro" || parametro.tipo === "decimal" ? (
            <CampoNumero
              rotulo="Valor"
              name="valor"
              defaultValue={textoEditavel(parametro)}
              descricao={ajudaPorTipo(parametro.tipo)}
            />
          ) : parametro.tipo === "lista_texto" ? (
            <CampoTexto
              rotulo="Valor"
              name="valor"
              multilinha
              linhas={5}
              defaultValue={textoEditavel(parametro)}
              descricao={ajudaPorTipo(parametro.tipo)}
            />
          ) : (
            <CampoTexto
              rotulo="Valor"
              name="valor"
              multilinha={
                parametro.tipo === "objeto" || parametro.tipo === "nulo"
              }
              linhas={8}
              defaultValue={textoEditavel(parametro)}
              descricao={ajudaPorTipo(parametro.tipo)}
              className={
                parametro.tipo === "objeto" || parametro.tipo === "nulo"
                  ? "text-apoio font-mono"
                  : undefined
              }
            />
          )}

          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo={estado.erro} />
          ) : null}

          <DialogoRodape>
            <DialogoFechar asChild>
              <Botao variante="secundario">Cancelar</Botao>
            </DialogoFechar>
            <Botao
              type="submit"
              carregando={enviando}
              rotuloCarregando="Salvando"
            >
              Salvar
            </Botao>
          </DialogoRodape>
        </form>

        {historico.length > 0 ? (
          <div className="border-linha mt-6 border-t pt-4">
            <h3 className="text-apoio text-texto font-semibold">Histórico</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {historico.slice(0, 5).map((item) => (
                <li key={item.id} className="text-apoio text-texto-2">
                  <span className="font-mono">
                    {formatarDataHora(item.criadoEm)}
                  </span>
                  {": de "}
                  <span className="font-mono">
                    {JSON.stringify(item.valorAntes)}
                  </span>
                  {" para "}
                  <span className="font-mono">
                    {JSON.stringify(item.valorDepois)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogoConteudo>
    </Dialogo>
  );
}
