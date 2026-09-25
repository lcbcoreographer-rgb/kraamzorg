"use client";

import { useActionState, useState } from "react";
import { CirclePlus, Pencil } from "lucide-react";
import { Botao } from "@/components/ui/botao";
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
import { salvarCidadeAction, type EstadoFormulario } from "../acoes/regioes";
import { CampoSelecao } from "./campo-selecao";
import type { Cidade, RegiaoDetalhe } from "../dados/tipos";

const inicial: EstadoFormulario = {};

export function FormularioCidade({
  cidade,
  regioes,
}: {
  cidade?: Cidade;
  regioes: RegiaoDetalhe[];
}) {
  const [aberto, setAberto] = useState(false);
  const [atendida, definirAtendida] = useState(cidade?.atendida ?? true);
  const [requerConfirmacao, definirRequerConfirmacao] = useState(
    cidade?.requerConfirmacao ?? false,
  );
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await salvarCidadeAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        {cidade ? (
          <Botao
            variante="icone"
            aria-label={`Editar ${cidade.nome}`}
            iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
          />
        ) : (
          <Botao
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<CirclePlus aria-hidden="true" className="size-4" />}
          >
            Nova cidade
          </Botao>
        )}
      </DialogoGatilho>
      <DialogoConteudo
        titulo={cidade ? `Editar ${cidade.nome}` : "Nova cidade"}
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          {cidade ? <input type="hidden" name="id" value={cidade.id} /> : null}
          <input
            type="hidden"
            name="atendida"
            value={atendida ? "true" : "false"}
          />
          <input
            type="hidden"
            name="requerConfirmacao"
            value={requerConfirmacao ? "true" : "false"}
          />
          <div className="flex gap-3">
            <CampoTexto
              rotulo="Cidade"
              name="nome"
              defaultValue={cidade?.nome}
              containerClassName="flex-1"
              required
            />
            <CampoTexto
              rotulo="UF"
              name="uf"
              defaultValue={cidade?.uf}
              maxLength={2}
              containerClassName="w-20"
              required
            />
          </div>
          <CampoSelecao
            rotulo="Região"
            name="regiaoId"
            defaultValue={cidade?.regiaoId ?? undefined}
            opcaoVazia="Escolha a região"
            opcoes={regioes.map((r) => ({ valor: r.id, rotulo: r.nome }))}
          />
          <CampoTexto
            rotulo="Taxa de deslocamento (R$)"
            name="taxaDeslocamentoCentavos"
            inputMode="decimal"
            descricao="Ex.: 60,00"
            defaultValue={
              cidade
                ? (cidade.taxaDeslocamentoCentavos / 100)
                    .toFixed(2)
                    .replace(".", ",")
                : "0"
            }
          />
          <CampoTexto
            rotulo="Outros nomes usados para esta cidade"
            name="aliases"
            multilinha
            linhas={2}
            opcional
            descricao="Um por linha (ex.: Sampa, SP capital)."
            defaultValue={cidade?.aliases.join("\n") ?? ""}
          />
          <CampoTexto
            rotulo="Observação"
            name="observacao"
            multilinha
            linhas={2}
            opcional
            defaultValue={cidade?.observacao ?? ""}
          />
          <SimNao
            pergunta="Cidade atendida hoje"
            name="atendida-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={atendida ? "sim" : "nao"}
            onMudar={(v) => definirAtendida(v === "sim")}
          />
          <SimNao
            pergunta="Exige confirmação antes de oferecer"
            name="requerConfirmacao-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={requerConfirmacao ? "sim" : "nao"}
            onMudar={(v) => definirRequerConfirmacao(v === "sim")}
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
