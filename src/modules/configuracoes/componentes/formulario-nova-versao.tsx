"use client";

import { useActionState, useState } from "react";
import { CirclePlus } from "lucide-react";
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
import { formatarMoeda } from "@/lib/formatacao";
import {
  criarVersaoPacoteAction,
  type EstadoFormulario,
} from "../acoes/pacotes";
import type { VersaoPacote } from "../dados/tipos";

const inicial: EstadoFormulario = {};

/**
 * Data de calendário de hoje em Brasília ("aaaa-mm-dd"). `toISOString()`
 * sozinho devolve a data em UTC: entre 21h e 23h59 de Brasília (UTC-3) já é
 * o dia seguinte em UTC, e a vigência inicial nasceria adiantada em um dia.
 */
function hoje(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/**
 * Nova versão de preço (P13, "Fazer" item 2): preço novo sempre cria
 * versão com vigência; a atual nunca é editada. `versaoAtual` só mostra o
 * que vai ser fechado, não é enviado.
 */
export function FormularioNovaVersao({
  pacoteId,
  nomePacote,
  versaoAtual,
}: {
  pacoteId: string;
  nomePacote: string;
  versaoAtual: VersaoPacote | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await criarVersaoPacoteAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="secundario"
          tamanho="compacto"
          iconeEsquerda={<CirclePlus aria-hidden="true" className="size-4" />}
        >
          Nova versão de preço
        </Botao>
      </DialogoGatilho>
      <DialogoConteudo
        titulo={`Nova versão de preço: ${nomePacote}`}
        descricao={
          versaoAtual
            ? `A versão de ${formatarMoeda(versaoAtual.valorCentavos)}, vigente desde ${versaoAtual.vigenciaInicio.split("-").reverse().join("/")}, é fechada no dia anterior ao início da nova. Ela não é apagada nem editada: continua a mesma para quem já contratou.`
            : "Este pacote ainda não tem nenhuma versão de preço."
        }
        rotuloFechar="Fechar sem criar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="pacoteId" value={pacoteId} />
          <CampoTexto
            rotulo="Preço (R$)"
            name="valor"
            inputMode="decimal"
            placeholder="Ex.: 4200,00"
            required
          />
          <CampoNumero
            rotulo="Horas por visita"
            name="horasPorVisita"
            defaultValue={
              versaoAtual ? String(versaoAtual.horasPorVisita) : "4"
            }
            unidade="h"
          />
          <CampoNumero
            rotulo="Parcelas máximas sem juros"
            name="parcelasMaxSemJuros"
            defaultValue={
              versaoAtual ? String(versaoAtual.parcelasMaxSemJuros) : "3"
            }
          />
          <CampoTexto
            rotulo="Destaque"
            name="destaque"
            opcional
            placeholder="Ex.: mais escolhido"
            defaultValue={versaoAtual?.destaque ?? ""}
          />
          <CampoTexto
            rotulo="Vigência inicial"
            name="vigenciaInicio"
            type="date"
            defaultValue={hoje()}
            required
          />
          <CampoTexto
            rotulo="O que inclui"
            name="inclui"
            multilinha
            linhas={3}
            opcional
            descricao="Um item por linha."
            defaultValue={versaoAtual?.inclui.join("\n") ?? ""}
          />
          <CampoTexto
            rotulo="O que não inclui"
            name="naoInclui"
            multilinha
            linhas={2}
            opcional
            descricao="Um item por linha."
            defaultValue={versaoAtual?.naoInclui.join("\n") ?? ""}
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
              rotuloCarregando="Criando"
            >
              Criar versão
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
