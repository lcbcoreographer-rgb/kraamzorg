"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
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
import {
  atualizarFaixaReguaAction,
  type EstadoFormulario,
} from "../acoes/regua";
import { CampoSelecao, type OpcaoSelecao } from "./campo-selecao";
import type { ReguaFaixaDetalhe } from "../dados/tipos";

const inicial: EstadoFormulario = {};

export function FormularioFaixa({
  faixa,
  opcoesMensagem,
}: {
  faixa: ReguaFaixaDetalhe;
  opcoesMensagem: OpcaoSelecao[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await atualizarFaixaReguaAction(anterior, formulario);
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="icone"
          aria-label={`Editar faixa ${faixa.ordem}`}
          iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
        />
      </DialogoGatilho>
      <DialogoConteudo
        titulo={`Faixa ${faixa.ordem}`}
        rotuloFechar="Fechar sem salvar"
      >
        <form action={acao} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="id" value={faixa.id} />
          <CampoTexto
            rotulo="Objetivo"
            name="objetivo"
            defaultValue={faixa.objetivo}
            required
          />
          <CampoTexto
            rotulo="Gatilho comercial"
            name="gatilhoComercial"
            defaultValue={faixa.gatilhoComercial}
            required
          />
          <CampoSelecao
            rotulo="Mensagem enviada"
            name="mensagemChave"
            defaultValue={faixa.mensagemChave}
            opcoes={opcoesMensagem}
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
