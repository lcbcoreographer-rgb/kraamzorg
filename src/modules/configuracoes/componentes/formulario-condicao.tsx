"use client";

import { useActionState, useState } from "react";
import { CirclePlus, Pencil } from "lucide-react";
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
import {
  salvarCondicaoComercialAction,
  type EstadoFormulario,
} from "../acoes/condicoes";
import { CampoSelecao } from "./campo-selecao";
import type { CondicaoComercial } from "../dados/tipos";

const inicial: EstadoFormulario = {};

const OPCOES_TIPO = [
  { valor: "desconto_pct", rotulo: "Desconto (%)" },
  { valor: "parcelamento", rotulo: "Parcelamento (parcelas)" },
  { valor: "bonificacao", rotulo: "Bonificação" },
];

export function FormularioCondicao({
  condicao,
}: {
  condicao?: CondicaoComercial;
}) {
  const [aberto, setAberto] = useState(false);
  const [requerAprovacao, definirRequerAprovacao] = useState(
    condicao?.requerAprovacao ?? true,
  );
  const [ativa, definirAtiva] = useState(condicao?.ativa ?? true);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await salvarCondicaoComercialAction(
        anterior,
        formulario,
      );
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        {condicao ? (
          <Botao
            variante="icone"
            aria-label={`Editar ${condicao.nome}`}
            iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
          />
        ) : (
          <Botao
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<CirclePlus aria-hidden="true" className="size-4" />}
          >
            Nova condição
          </Botao>
        )}
      </DialogoGatilho>
      <DialogoConteudo
        titulo={
          condicao ? `Editar ${condicao.nome}` : "Nova condição comercial"
        }
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          {condicao ? (
            <input type="hidden" name="id" value={condicao.id} />
          ) : null}
          <input
            type="hidden"
            name="requerAprovacao"
            value={requerAprovacao ? "true" : "false"}
          />
          <input type="hidden" name="ativa" value={ativa ? "true" : "false"} />
          <CampoTexto
            rotulo="Nome"
            name="nome"
            defaultValue={condicao?.nome}
            required
          />
          <CampoSelecao
            rotulo="Tipo"
            name="tipo"
            defaultValue={condicao?.tipo}
            opcoes={OPCOES_TIPO}
          />
          <CampoNumero
            rotulo="Valor"
            name="valor"
            defaultValue={condicao ? String(condicao.valor) : undefined}
            descricao="Percentual, número de parcelas ou o que a bonificação representa."
          />
          <CampoTexto
            rotulo="Observação"
            name="observacao"
            multilinha
            linhas={2}
            opcional
            defaultValue={condicao?.observacao ?? ""}
          />
          <SimNao
            pergunta="Exige aprovação antes de usar"
            name="requerAprovacao-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={requerAprovacao ? "sim" : "nao"}
            onMudar={(v) => definirRequerAprovacao(v === "sim")}
          />
          <SimNao
            pergunta="Condição ativa"
            name="ativa-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={ativa ? "sim" : "nao"}
            onMudar={(v) => definirAtiva(v === "sim")}
          />

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
      </DialogoConteudo>
    </Dialogo>
  );
}
