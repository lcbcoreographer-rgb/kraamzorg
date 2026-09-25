"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
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
import { CampoSelecao } from "./campo-selecao";
import { acaoCriarLead, estadoInicialPipeline } from "../acoes";
import {
  ORIGENS_LEAD,
  PAPEIS_PESSOA,
  ROTULO_ORIGEM_LEAD,
  ROTULO_PAPEL_PESSOA,
} from "../estagios";

/**
 * Cadastro manual de lead pelo comercial (P15 item 4): família, pessoa e
 * oportunidade com origem. A oportunidade nasce em Novo, no pipeline de
 * entrada; a semana gestacional e a cidade se ajustam depois, na ficha.
 */
export function FormularioLead() {
  const [aberto, definirAberto] = React.useState(false);
  const [estado, acao, enviando] = useActionState(
    async (_anterior: typeof estadoInicialPipeline, formulario: FormData) => {
      const resultado = await acaoCriarLead(estadoInicialPipeline, formulario);
      if (resultado.sucesso) definirAberto(false);
      return resultado;
    },
    estadoInicialPipeline,
  );

  return (
    <Dialogo open={aberto} onOpenChange={definirAberto}>
      <DialogoGatilho asChild>
        <Botao
          variante="secundario"
          tamanho="compacto"
          iconeEsquerda={<UserPlus aria-hidden="true" className="size-4" />}
        >
          Cadastrar lead
        </Botao>
      </DialogoGatilho>
      <DialogoConteudo
        titulo="Cadastrar lead"
        descricao="Família, contato e origem. A oportunidade nasce em Novo."
        rotuloFechar="Fechar sem cadastrar"
      >
        <form action={acao} className="flex flex-col gap-4">
          <CampoTexto rotulo="Nome da família" name="nomeFamilia" required />
          <CampoTexto rotulo="Nome do contato" name="nomeContato" required />
          <CampoSelecao
            rotulo="Quem é o contato"
            name="papelContato"
            defaultValue="mae"
            opcoes={PAPEIS_PESSOA.map((papel) => ({
              valor: papel,
              rotulo: ROTULO_PAPEL_PESSOA[papel],
            }))}
          />
          <CampoTexto
            rotulo="Telefone do contato"
            name="telefoneE164"
            type="tel"
            placeholder="(11) 90000-0000"
            descricao="Com DDD. Grava em E.164."
            required
          />
          <CampoTexto
            rotulo="DPP"
            name="dpp"
            type="date"
            opcional
            descricao="Data provável do parto, se a família já sabe."
          />
          <CampoTexto rotulo="Bairro" name="bairro" opcional />
          <CampoTexto
            rotulo="Cidade"
            name="cidadeInformada"
            opcional
            descricao="Como a família escreveu; a cidade cadastrada se resolve depois."
          />
          <CampoSelecao
            rotulo="Origem"
            name="origem"
            defaultValue="outro"
            opcoes={ORIGENS_LEAD.map((origem) => ({
              valor: origem,
              rotulo: ROTULO_ORIGEM_LEAD[origem],
            }))}
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
              rotuloCarregando="Cadastrando"
            >
              Cadastrar
            </Botao>
          </DialogoRodape>
        </form>
      </DialogoConteudo>
    </Dialogo>
  );
}
