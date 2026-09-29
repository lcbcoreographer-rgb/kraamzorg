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

export function FormularioTermo({
  termo,
  opcoesMensagem,
}: {
  termo?: TermoAlerta;
  /**
   * Textos para a família (`mensagem_modelo`), com o começo do texto como
   * rótulo. Sem a lista, o campo volta a pedir a chave digitada.
   */
  opcoesMensagem?: { valor: string; rotulo: string }[];
}) {
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
        descricao="Quando uma família escrever este termo, com ou sem acento, o sistema aplica a ação escolhida antes de a Isadora responder."
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
          {opcoesMensagem && opcoesMensagem.length > 0 ? (
            <CampoSelecao
              rotulo="Texto que a família recebe"
              name="mensagemChave"
              defaultValue={termo?.mensagemChave ?? "alerta_saude"}
              opcoes={opcoesMensagem}
            />
          ) : (
            <CampoTexto
              rotulo="Chave da mensagem enviada"
              name="mensagemChave"
              defaultValue={termo?.mensagemChave ?? "alerta_saude"}
              descricao="Ex.: alerta_saude, ou alerta_internacao para internação."
              required
            />
          )}
          <SimNao
            pergunta="Termo ativo"
            name="ativo-visivel"
            rotuloSim="Sim"
            rotuloNao="Não"
            valor={ativo ? "sim" : "nao"}
            onMudar={(v) => definirAtivo(v === "sim")}
          />

          {estado.erro ? (
            <FaixaAlerta variante="erro" titulo={estado.erro} />
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
