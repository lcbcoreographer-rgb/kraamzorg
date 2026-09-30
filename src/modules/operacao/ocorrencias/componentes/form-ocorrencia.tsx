"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, type OpcaoSelecao } from "@/components/ui/campo-selecao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { acaoRegistrarOcorrencia } from "../acoes";
import { estadoInicialOcorrencia } from "../estado-acoes";
import { PRIORIDADES, ROTULO_PRIORIDADE, ROTULO_TIPO, TIPOS } from "../rotulos";

/**
 * Abrir uma ocorrência (P42). Ocorrência de nota baixa na pesquisa nasce
 * sozinha e privada; aqui a equipe abre as outras. O SLA vem da prioridade
 * (parametro.ocorrencia_sla), então o formulário só pede a prioridade.
 */
export function FormOcorrencia({
  familias,
  profissionais,
  responsaveis,
  familiaInicial,
}: {
  familias: OpcaoSelecao[];
  profissionais: OpcaoSelecao[];
  responsaveis: OpcaoSelecao[];
  familiaInicial?: string;
}) {
  const [estado, enviar, enviando] = useActionState(
    acaoRegistrarOcorrencia,
    estadoInicialOcorrencia,
  );
  const [tipo, definirTipo] = React.useState<string>("");

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    React.startTransition(() => enviar(dados));
  }

  return (
    <form
      onSubmit={aoEnviar}
      className="flex max-w-[640px] flex-col gap-5"
      noValidate
    >
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      <CampoSelecao
        rotulo="Tipo"
        name="tipo"
        vazio="Escolha o tipo"
        opcoes={TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
        value={tipo}
        onChange={(e) => definirTipo(e.target.value)}
        erro={estado.campos?.tipo}
      />
      <CampoSelecao
        rotulo="Família"
        name="familiaId"
        vazio="Nenhuma família"
        opcoes={familias}
        defaultValue={familiaInicial ?? ""}
        erro={estado.campos?.familia}
        opcional
      />
      <CampoSelecao
        rotulo="Profissional envolvida"
        name="profissionalId"
        vazio="Nenhuma profissional"
        opcoes={profissionais}
        opcional
      />
      <CampoTexto
        rotulo="Título"
        name="titulo"
        maxLength={160}
        erro={estado.campos?.titulo}
        descricao="Uma frase que diga o assunto, por exemplo: contato perdido depois da visita do D3."
      />
      <CampoTexto
        rotulo="O que aconteceu"
        name="descricao"
        multilinha
        linhas={5}
        maxLength={4000}
        erro={estado.campos?.descricao}
        descricao="Escreva o que se sabe, sem dado clínico além do necessário."
      />
      <CampoSelecao
        rotulo="Prioridade"
        name="prioridade"
        opcoes={PRIORIDADES.map((p) => ({
          valor: p,
          rotulo: ROTULO_PRIORIDADE[p],
        }))}
        defaultValue="normal"
        descricao="A prioridade define o prazo de resposta."
      />
      <CampoSelecao
        rotulo="Quem cuida"
        name="responsavelId"
        vazio="Definir depois"
        opcoes={responsaveis}
        descricao="Ao escolher uma pessoa, ela recebe um aviso no app."
        opcional
      />
      {tipo === "detrator" ? (
        <p className="text-apoio text-texto-2">
          Este tipo é sempre privado: só a coordenação e a diretoria veem.
        </p>
      ) : (
        <label className="text-corpo text-texto min-h-toque flex items-center gap-3">
          <input type="checkbox" name="privada" className="size-5" />
          Ocorrência privada (só a coordenação e a diretoria veem)
        </label>
      )}
      <div>
        <Botao
          className="max-w-full text-balance whitespace-normal"
          type="submit"
          carregando={enviando}
          rotuloCarregando="Abrindo"
        >
          Abrir a ocorrência
        </Botao>
      </div>
    </form>
  );
}
