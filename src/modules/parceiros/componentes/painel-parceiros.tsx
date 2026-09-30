"use client";

import { HeartHandshake, Stethoscope, UserPlus } from "lucide-react";
import * as React from "react";
import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { ParceiroMedico } from "@/lib/dados/tipos-relacao";
import { formatarData, formatarTelefone } from "@/lib/formatacao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import {
  ROTULO_ESPECIALIDADE,
  ROTULO_ESTADO_PARCEIRO,
} from "@/modules/relacao/rotulos";
import {
  acaoCriarTarefaParceiro,
  acaoRegistrarContato,
  acaoRegistrarIndicacao,
  acaoSalvarParceiro,
} from "../acoes";

function CartaoParceiro({ p }: { p: ParceiroMedico }) {
  const [aviso, definirAviso] = React.useState<{
    erro?: string;
    sucesso?: string;
  }>({});
  const [ocupado, iniciar] = React.useTransition();
  const [estadoTarefa, acaoTarefa, criando] = useFormularioSemReset(
    acaoCriarTarefaParceiro,
    estadoInicialRelacao,
  );
  return (
    <li
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
      data-parceiro={p.nome}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TileIcone tom="argila" forma="quadrado">
          <Stethoscope />
        </TileIcone>
        <h3 className="font-titulo text-2 text-texto font-medium">{p.nome}</h3>
        <Selo variante="contorno">{ROTULO_ESPECIALIDADE[p.especialidade]}</Selo>
        <Selo
          variante={
            p.estado === "ativo"
              ? "sucesso"
              : p.estado === "prospeccao"
                ? "neutro"
                : "aviso"
          }
        >
          {ROTULO_ESTADO_PARCEIRO[p.estado]}
        </Selo>
        {p.precisaContato ? (
          <Selo variante="aviso">Contato combinado para agora</Selo>
        ) : null}
      </div>
      <p className="text-corpo text-texto-2">
        {p.hospital ? `${p.hospital}. ` : ""}
        {p.telefoneE164
          ? `${formatarTelefone(p.telefoneE164) ?? p.telefoneE164}. `
          : ""}
        {p.email ?? ""}
      </p>
      <p className="text-corpo text-texto">
        {p.indicacoes === 0
          ? "Nenhuma indicação recebida ainda."
          : `${p.indicacoes} ${p.indicacoes === 1 ? "indicação recebida" : "indicações recebidas"}, ${
              p.contratos === 0
                ? "nenhuma virou contrato"
                : `${p.contratos} ${p.contratos === 1 ? "virou contrato" : "viraram contrato"}`
            }.`}{" "}
        {p.ultimoContatoEm
          ? `Último contato em ${formatarData(p.ultimoContatoEm)}${p.diasSemContato !== null ? `, há ${p.diasSemContato} ${p.diasSemContato === 1 ? "dia" : "dias"}` : ""}.`
          : "Ainda sem contato registrado."}{" "}
        {p.proximoContatoEm
          ? `Próximo contato combinado: ${formatarData(p.proximoContatoEm)}.`
          : ""}
      </p>
      {p.observacao ? (
        <p className="text-corpo text-texto-2 max-w-[60ch]">{p.observacao}</p>
      ) : null}
      {p.tarefasAbertas > 0 ? (
        <p className="text-apoio text-texto-2">
          {p.tarefasAbertas}{" "}
          {p.tarefasAbertas === 1 ? "tarefa aberta" : "tarefas abertas"} em
          Tarefas.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Botao
          type="button"
          variante="secundario"
          tamanho="compacto"
          disabled={ocupado}
          aria-label={`Registrar contato de hoje com ${p.nome}`}
          onClick={() =>
            iniciar(async () =>
              definirAviso(await acaoRegistrarContato(p.medicoId)),
            )
          }
        >
          Registrar contato de hoje
        </Botao>
        <span role="status" className="text-apoio text-texto-2">
          {aviso.erro ?? aviso.sucesso ?? ""}
        </span>
      </div>
      <form onSubmit={acaoTarefa} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="medicoId" value={p.medicoId} />
        <CampoTexto
          rotulo="Nova tarefa de relacionamento"
          name="titulo"
          required
          maxLength={120}
          placeholder="Enviar a apresentação institucional"
          containerClassName="min-w-[16rem] flex-1"
        />
        <CampoTexto rotulo="Para quando" name="venceEm" type="date" opcional />
        <Botao
          type="submit"
          variante="secundario"
          tamanho="compacto"
          carregando={criando}
          rotuloCarregando="Criando"
        >
          Criar tarefa
        </Botao>
        <span role="status" className="text-apoio text-texto-2 basis-full">
          {estadoTarefa.erro ?? estadoTarefa.sucesso ?? ""}
        </span>
      </form>
    </li>
  );
}

function FormularioParceiro() {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarParceiro,
    estadoInicialRelacao,
  );
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (estado.sucesso) ref.current?.reset();
  }, [estado]);
  return (
    <form
      ref={ref}
      onSubmit={acao}
      className="rounded-3 bg-dourado-claro flex w-full max-w-[560px] flex-col gap-4 p-5 lg:p-6"
    >
      <h3 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="dourado" forma="quadrado" tamanho="p">
          <UserPlus />
        </TileIcone>
        Novo médico parceiro
      </h3>
      <CampoTexto rotulo="Nome" name="nome" required maxLength={120} />
      <CampoSelecao
        rotulo="Especialidade"
        name="especialidade"
        defaultValue="obstetra"
        opcoes={Object.entries(ROTULO_ESPECIALIDADE).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
      />
      <CampoTexto
        rotulo="Hospital ou consultório"
        name="hospital"
        maxLength={120}
        opcional
      />
      <CampoTexto
        rotulo="Telefone"
        name="telefone"
        inputMode="tel"
        opcional
        descricao="Com o DDD."
      />
      <CampoTexto rotulo="E-mail" name="email" type="email" opcional />
      <CampoTexto
        rotulo="Anotação"
        name="observacao"
        multilinha
        linhas={3}
        maxLength={1000}
        opcional
        descricao="Como conheceu a Kraamzorg, o que combinaram. Não escreva dado de paciente."
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="O médico não foi salvo">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          Ele já aparece na lista.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar médico
      </Botao>
    </form>
  );
}

function FormularioIndicacao({
  parceiros,
  familias,
}: {
  parceiros: ParceiroMedico[];
  familias: { id: string; nome: string }[];
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoRegistrarIndicacao,
    estadoInicialRelacao,
  );
  const quem = [
    ...parceiros.map((p) => ({
      valor: `medico:${p.medicoId}`,
      rotulo: `Médico parceiro: ${p.nome}`,
    })),
    ...familias.map((f) => ({
      valor: `familia:${f.id}`,
      rotulo: `Família: ${f.nome}`,
    })),
  ];
  return (
    <form
      onSubmit={acao}
      className="rounded-3 bg-argila-clara flex w-full max-w-[560px] flex-col gap-4 p-5 lg:p-6"
    >
      <h3 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="argila" forma="quadrado" tamanho="p">
          <HeartHandshake />
        </TileIcone>
        Registrar uma indicação
      </h3>
      <CampoSelecao
        rotulo="Família que foi indicada"
        name="familiaId"
        required
        opcaoVazia="Escolha a família"
        opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))}
      />
      <CampoSelecao
        rotulo="Quem indicou"
        name="quem"
        required
        opcaoVazia="Escolha o médico parceiro ou a família"
        opcoes={quem}
      />
      <CampoTexto
        rotulo="Anotação"
        name="observacao"
        maxLength={500}
        opcional
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="A indicação não foi registrada">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          Ela já entra no relatório de origem do marketing.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Registrando"
        className="self-start"
      >
        Registrar indicação
      </Botao>
    </form>
  );
}

export function PainelParceiros({
  parceiros,
  familias,
}: {
  parceiros: ParceiroMedico[];
  familias: { id: string; nome: string }[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {parceiros.length === 0 ? (
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          Nenhum médico parceiro ainda. Cadastre o primeiro abaixo; o contato e
          as indicações passam a ficar registrados aqui.
        </p>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {parceiros.map((p) => (
            <CartaoParceiro key={p.medicoId} p={p} />
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FormularioParceiro />
        <FormularioIndicacao parceiros={parceiros} familias={familias} />
      </div>
    </div>
  );
}
