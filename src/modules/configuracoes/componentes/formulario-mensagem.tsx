"use client";

import * as React from "react";
import { useActionState, useMemo, useState } from "react";
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
  salvarRascunhoMensagemAction,
  type EstadoFormulario,
} from "../acoes/mensagens";
import {
  extrairVariaveis,
  montarPreviaMensagem,
} from "../dados/mensagem-preview";
import { CampoSelecao } from "./campo-selecao";
import type { MensagemModeloDetalhe } from "../dados/tipos";

const inicial: EstadoFormulario = {};

const CANAIS = [
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "site", rotulo: "Site" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "outro", rotulo: "Outro" },
];
const DESTINATARIOS = [
  { valor: "familia", rotulo: "Família" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "medico", rotulo: "Médico" },
  { valor: "agente", rotulo: "Agente" },
];

const VALOR_EXEMPLO: Record<string, string> = {
  nome: "Marina",
  semanas: "32 semanas",
  hora: "14h",
  link: "kraamzorgbrasil.com.br/exemplo",
  bebe: "Théo",
  dpp: "24/09/2026",
  enfermeira: "Talita",
};

export function FormularioMensagem({
  mensagem,
}: {
  mensagem: MensagemModeloDetalhe;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, definirTexto] = useState(mensagem.texto);
  const [estado, acao, enviando] = useActionState(
    async (anterior: EstadoFormulario, formulario: FormData) => {
      const resultado = await salvarRascunhoMensagemAction(
        anterior,
        formulario,
      );
      if (resultado.sucesso) setAberto(false);
      return resultado;
    },
    inicial,
  );

  const variaveis = useMemo(() => extrairVariaveis(texto), [texto]);
  const previa = useMemo(
    () => montarPreviaMensagem(texto, VALOR_EXEMPLO),
    [texto],
  );
  const temTravessao = /[—–]/.test(texto);

  return (
    <Dialogo open={aberto} onOpenChange={setAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="icone"
          aria-label={`Editar mensagem ${mensagem.chave}`}
          iconeEsquerda={<Pencil aria-hidden="true" className="size-4" />}
        />
      </DialogoGatilho>
      <DialogoConteudo titulo={mensagem.chave} rotuloFechar="Fechar sem salvar">
        <form action={acao} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="chave" value={mensagem.chave} />
          <div className="flex gap-3">
            <CampoSelecao
              rotulo="Canal"
              name="canal"
              defaultValue={mensagem.canal}
              opcoes={CANAIS}
              className="flex-1"
            />
            <CampoSelecao
              rotulo="Destinatário"
              name="destinatario"
              defaultValue={mensagem.destinatario}
              opcoes={DESTINATARIOS}
              className="flex-1"
            />
          </div>
          <CampoTexto
            rotulo="Texto"
            name="texto"
            multilinha
            linhas={6}
            value={texto}
            onChange={(evento) => definirTexto(evento.target.value)}
            descricao={`${texto.length} caracteres. Variáveis entre chaves, como {nome}.`}
            estado={temTravessao ? "aviso" : "normal"}
          />
          {temTravessao ? (
            <p className="text-apoio text-aviso-texto -mt-2">
              Este texto tem travessão ou meia-risca. Ao salvar, trocamos por
              vírgula: nenhum texto de interface usa travessão.
            </p>
          ) : null}

          <div className="rounded-2 border-linha bg-superficie-2 border p-4">
            <p className="text-apoio text-texto font-semibold">
              Prévia com valores de exemplo
            </p>
            {variaveis.length > 0 ? (
              <p className="text-apoio text-texto-2 mt-1">
                Variáveis: {variaveis.join(", ")}
              </p>
            ) : null}
            <p className="text-corpo text-texto mt-2 whitespace-pre-wrap">
              {previa}
            </p>
          </div>

          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo={estado.erro} />
          ) : null}
          {estado.sucesso ? (
            <p role="status" className="text-apoio text-sucesso">
              {estado.sucesso}
            </p>
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
              Salvar rascunho
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
