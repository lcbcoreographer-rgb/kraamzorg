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
import { salvarRegiaoAction, type EstadoFormulario } from "../acoes/regioes";
import type { RegiaoDetalhe } from "../dados/tipos";

const inicial: EstadoFormulario = {};

export function FormularioRegiao({ regiao }: { regiao?: RegiaoDetalhe }) {
  const [aberto, setAberto] = useState(false);
  const [ativa, definirAtiva] = useState(regiao?.ativa ?? true);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await salvarRegiaoAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        {regiao ? (
          <Botao
            variante="icone"
            aria-label={`Editar ${regiao.nome}`}
            iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
          />
        ) : (
          <Botao
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<CirclePlus aria-hidden="true" className="size-4" />}
          >
            Nova região
          </Botao>
        )}
      </DialogoGatilho>
      <DialogoConteudo
        titulo={regiao ? `Editar ${regiao.nome}` : "Nova região"}
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          {regiao ? <input type="hidden" name="id" value={regiao.id} /> : null}
          <input type="hidden" name="ativa" value={ativa ? "true" : "false"} />
          <CampoTexto
            rotulo="Nome"
            name="nome"
            defaultValue={regiao?.nome}
            required
          />
          <CampoTexto
            rotulo="Praça"
            name="praca"
            defaultValue={regiao?.praca}
            descricao="Como aparece para quem escolhe o atendimento."
            required
          />
          <CampoNumero
            rotulo="Limite de famílias por semana"
            name="limiteFamiliasSemana"
            defaultValue={
              regiao ? String(regiao.limiteFamiliasSemana) : undefined
            }
          />
          <CampoTexto
            rotulo="Taxa de deslocamento (R$)"
            name="taxaDeslocamentoCentavos"
            inputMode="decimal"
            descricao="Ex.: 60,00"
            defaultValue={
              regiao
                ? (regiao.taxaDeslocamentoCentavos / 100)
                    .toFixed(2)
                    .replace(".", ",")
                : "0"
            }
          />
          <SimNao
            pergunta="Região ativa"
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
