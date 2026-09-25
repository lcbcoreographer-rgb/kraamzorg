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
import {
  salvarTermoAlertaAction,
  type EstadoFormulario,
} from "../acoes/termos-alerta";
import { CampoSelecao } from "./campo-selecao";
import type { TermoAlerta } from "../dados/tipos";

const inicial: EstadoFormulario = {};

const OPCOES_ACAO = [
  { valor: "handoff_saude", rotulo: "Transferir para a equipe de saúde" },
  { valor: "bloqueio_total", rotulo: "Bloqueio total (freio)" },
];

export function FormularioTermo({ termo }: { termo?: TermoAlerta }) {
  const [aberto, setAberto] = useState(false);
  const [ativo, definirAtivo] = useState(termo?.ativo ?? true);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await salvarTermoAlertaAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        {termo ? (
          <Botao
            variante="icone"
            aria-label={`Editar termo ${termo.termo}`}
            iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
          />
        ) : (
          <Botao
            variante="secundario"
            tamanho="compacto"
            iconeEsquerda={<CirclePlus aria-hidden="true" className="size-4" />}
          >
            Novo termo
          </Botao>
        )}
      </DialogoGatilho>
      <DialogoConteudo
        titulo={termo ? `Editar termo: ${termo.termo}` : "Novo termo de alerta"}
        descricao="Quando a família escrever este termo para a Isadora, sem acento e em minúsculas, o sistema aplica a ação escolhida."
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          {termo ? <input type="hidden" name="id" value={termo.id} /> : null}
          <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />
          <CampoTexto
            rotulo="Termo"
            name="termo"
            defaultValue={termo?.termo}
            descricao="Comparado sem acento e em minúsculas."
            required
          />
          <CampoSelecao
            rotulo="Ação"
            name="acao"
            defaultValue={termo?.acao ?? "handoff_saude"}
            opcoes={OPCOES_ACAO}
          />
          <CampoTexto
            rotulo="Chave da mensagem enviada"
            name="mensagemChave"
            defaultValue={termo?.mensagemChave ?? "alerta_saude"}
            descricao="Ex.: alerta_saude, ou alerta_internacao para internação."
            required
          />
          <SimNao
            pergunta="Termo ativo"
            name="ativo-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={ativo ? "sim" : "nao"}
            onMudar={(v) => definirAtivo(v === "sim")}
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
