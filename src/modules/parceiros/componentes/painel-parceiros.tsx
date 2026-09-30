"use client";

import {
  CalendarClock,
  HeartHandshake,
  PhoneCall,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import * as React from "react";
import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { ParceiroMedico } from "@/lib/dados/tipos-relacao";
import { formatarData, formatarTelefone } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
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

/** Um par rótulo e valor da ficha do médico. */
function Dado({
  rotulo,
  children,
  largo = false,
}: {
  rotulo: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5",
        largo && "tablet:col-span-2",
      )}
    >
      <dt className="text-mini text-texto-2 font-semibold">{rotulo}</dt>
      <dd className="text-apoio text-texto min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SeloEstado({
  p,
  className,
}: {
  p: ParceiroMedico;
  className?: string;
}) {
  return (
    <Selo
      className={className}
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
  );
}

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
  const idTitulo = `parceiro-${p.medicoId}`;
  return (
    <li
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5 lg:p-6"
      data-parceiro={p.nome}
      aria-labelledby={idTitulo}
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="argila" forma="quadrado">
          <Stethoscope />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3
            id={idTitulo}
            className="font-titulo text-2 text-texto font-medium"
          >
            {p.nome}
          </h3>
          <p className="text-apoio text-texto-2 flex flex-wrap gap-x-3">
            <span>{ROTULO_ESPECIALIDADE[p.especialidade]}</span>
            {p.hospital ? <span>{p.hospital}</span> : null}
          </p>
          <SeloEstado p={p} className="tablet:hidden mt-1 self-start" />
        </div>
        <SeloEstado p={p} className="tablet:inline-flex hidden shrink-0" />
      </div>

      {p.precisaContato ? (
        <p className="rounded-2 bg-aviso-lavado text-apoio text-aviso-texto flex items-center gap-2 px-3 py-2 font-semibold">
          <CalendarClock
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
          Contato combinado para agora
        </p>
      ) : null}

      <dl className="tablet:grid-cols-2 grid gap-x-6 gap-y-3">
        <Dado rotulo="Indicações">
          {p.indicacoes === 0
            ? "Nenhuma recebida ainda"
            : `${p.indicacoes} ${p.indicacoes === 1 ? "recebida" : "recebidas"}, ${
                p.contratos === 0
                  ? "nenhuma virou contrato"
                  : `${p.contratos} ${p.contratos === 1 ? "virou contrato" : "viraram contrato"}`
              }`}
        </Dado>
        <Dado rotulo="Último contato">
          {p.ultimoContatoEm ? (
            <>
              <span className="font-mono tabular-nums">
                {formatarData(p.ultimoContatoEm)}
              </span>
              {p.diasSemContato !== null
                ? `, há ${p.diasSemContato} ${p.diasSemContato === 1 ? "dia" : "dias"}`
                : ""}
            </>
          ) : (
            "Ainda sem contato registrado"
          )}
        </Dado>
        <Dado rotulo="Próximo contato">
          {p.proximoContatoEm ? (
            <span className="font-mono tabular-nums">
              {formatarData(p.proximoContatoEm)}
            </span>
          ) : (
            "Nada combinado"
          )}
        </Dado>
        <Dado rotulo="Telefone">
          {p.telefoneE164 ? (
            <span className="font-mono tabular-nums">
              {formatarTelefone(p.telefoneE164) ?? p.telefoneE164}
            </span>
          ) : (
            "Sem telefone"
          )}
        </Dado>
        {p.email ? (
          <Dado rotulo="E-mail" largo>
            {p.email}
          </Dado>
        ) : null}
        {p.observacao ? (
          <Dado rotulo="Anotação" largo>
            {p.observacao}
          </Dado>
        ) : null}
        {p.tarefasAbertas > 0 ? (
          <Dado rotulo="Tarefas" largo>
            {p.tarefasAbertas}{" "}
            {p.tarefasAbertas === 1 ? "tarefa aberta" : "tarefas abertas"}, na
            tela Tarefas
          </Dado>
        ) : null}
      </dl>

      <div className="border-linha flex flex-col gap-4 border-t pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Botao
            type="button"
            variante="secundario"
            tamanho="compacto"
            disabled={ocupado}
            iconeEsquerda={
              <PhoneCall
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
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
        <form
          onSubmit={acaoTarefa}
          className="tablet:grid-cols-[12rem_auto_minmax(0,1fr)] tablet:items-end grid gap-3"
        >
          <input type="hidden" name="medicoId" value={p.medicoId} />
          <CampoTexto
            rotulo="Nova tarefa de relacionamento"
            name="titulo"
            required
            maxLength={120}
            placeholder="Enviar a apresentação institucional"
            containerClassName="tablet:col-span-3"
          />
          <CampoTexto
            rotulo="Para quando"
            name="venceEm"
            type="date"
            opcional
          />
          <Botao
            type="submit"
            variante="secundario"
            carregando={criando}
            rotuloCarregando="Criando"
            className="tablet:self-end self-start"
          >
            Criar tarefa
          </Botao>
          <span
            role="status"
            className="text-apoio text-texto-2 tablet:col-span-3"
          >
            {estadoTarefa.erro ?? estadoTarefa.sucesso ?? ""}
          </span>
        </form>
      </div>
    </li>
  );
}

function FormularioParceiro({
  aberto,
  definirAberto,
}: {
  aberto: boolean;
  definirAberto: (aberto: boolean) => void;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarParceiro,
    estadoInicialRelacao,
  );
  const ref = React.useRef<HTMLFormElement>(null);
  const idCampos = React.useId();
  React.useEffect(() => {
    if (estado.sucesso) ref.current?.reset();
  }, [estado]);
  return (
    <section
      aria-labelledby={`${idCampos}-titulo`}
      className="rounded-3 bg-areia-clara flex w-full flex-col gap-4 p-5 lg:p-6"
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="areia" forma="quadrado" tamanho="p">
          <UserPlus />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3
            id={`${idCampos}-titulo`}
            className="font-titulo text-2 text-texto font-medium"
          >
            Novo médico parceiro
          </h3>
          <p className="text-apoio text-texto-2">
            Quem conheceu a Kraamzorg. Depois do cadastro, o contato e as
            indicações dele ficam registrados aqui.
          </p>
        </div>
      </div>
      {aberto ? null : (
        <Botao
          type="button"
          variante="secundario"
          tamanho="compacto"
          className="self-start"
          aria-expanded={false}
          aria-controls={idCampos}
          onClick={() => definirAberto(true)}
        >
          Cadastrar um médico
        </Botao>
      )}
      {aberto ? (
        <form
          ref={ref}
          id={idCampos}
          onSubmit={acao}
          className="flex flex-col gap-4"
        >
          <CampoTexto rotulo="Nome" name="nome" required maxLength={120} />
          <CampoSelecao
            rotulo="Especialidade"
            name="especialidade"
            defaultValue="obstetra"
            opcoes={Object.entries(ROTULO_ESPECIALIDADE).map(
              ([valor, rotulo]) => ({
                valor,
                rotulo,
              }),
            )}
          />
          <CampoTexto
            rotulo="Hospital ou consultório"
            name="hospital"
            maxLength={120}
            opcional
          />
          <div className="tablet:grid-cols-2 grid gap-4">
            <CampoTexto
              rotulo="Telefone"
              name="telefone"
              inputMode="tel"
              opcional
              descricao="Com o DDD."
            />
            <CampoTexto rotulo="E-mail" name="email" type="email" opcional />
          </div>
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
          <div className="flex flex-wrap gap-3">
            <Botao
              type="submit"
              carregando={salvando}
              rotuloCarregando="Salvando"
            >
              Salvar médico
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => definirAberto(false)}
            >
              Fechar o cadastro
            </Botao>
          </div>
        </form>
      ) : null}
    </section>
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
      className="rounded-3 bg-argila-clara flex w-full flex-col gap-4 p-5 lg:p-6"
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="argila" forma="quadrado" tamanho="p">
          <HeartHandshake />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-titulo text-2 text-texto font-medium">
            Registrar uma indicação
          </h3>
          <p className="text-apoio text-texto-2">
            A família chegou por um médico parceiro ou por outra família.
          </p>
        </div>
      </div>
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

/** Frase do topo da lista: quantos médicos e quantos esperam contato. */
function fraseParceiros(parceiros: ParceiroMedico[]): string {
  const ativos = parceiros.filter((p) => p.estado === "ativo").length;
  const contato = parceiros.filter((p) => p.precisaContato).length;
  const partes = [
    `${parceiros.length} ${parceiros.length === 1 ? "médico" : "médicos"}, ${ativos} ${ativos === 1 ? "parceiro ativo" : "parceiros ativos"}.`,
  ];
  partes.push(
    contato === 0
      ? "Nenhum contato combinado para agora."
      : `${contato} ${contato === 1 ? "tem contato combinado" : "têm contato combinado"} para agora.`,
  );
  return partes.join(" ");
}

/**
 * Parceiros médicos (P50, refeito em 30/09: "tem buracos na construção").
 * No computador, duas colunas: a lista dos médicos, cada um numa ficha
 * inteira da largura da coluna (sem grade de cartões de alturas
 * diferentes), e ao lado o que se registra (indicação e médico novo). No
 * celular, a mesma ordem numa coluna só.
 */
export function PainelParceiros({
  parceiros,
  familias,
}: {
  parceiros: ParceiroMedico[];
  familias: { id: string; nome: string }[];
}) {
  const [cadastroAberto, definirCadastroAberto] = React.useState(
    parceiros.length === 0,
  );
  const comContato = [...parceiros].sort(
    (a, b) =>
      Number(b.precisaContato) - Number(a.precisaContato) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <SecaoBloco
        idTitulo="t-parceiros-medicos"
        titulo="Médicos parceiros"
        icone={<Stethoscope />}
        tom="argila"
        contagem={parceiros.length}
        apoio={parceiros.length > 0 ? fraseParceiros(parceiros) : undefined}
      >
        {parceiros.length === 0 ? (
          <EstadoVazio
            variante="tracejado"
            titulo="Nenhum médico parceiro ainda"
            texto="Cadastre o primeiro ao lado. O contato combinado e as indicações dele passam a ficar registrados aqui."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {comContato.map((p) => (
              <CartaoParceiro key={p.medicoId} p={p} />
            ))}
          </ul>
        )}
      </SecaoBloco>
      {/* No computador, a coluna do registro acompanha a rolagem enquanto
          o cadastro está fechado (ela cabe na tela); aberto, rola junto. */}
      <div
        className={cn(
          "flex flex-col gap-6",
          !cadastroAberto && "lg:sticky lg:top-24",
        )}
      >
        <FormularioIndicacao parceiros={parceiros} familias={familias} />
        <FormularioParceiro
          aberto={cadastroAberto}
          definirAberto={definirCadastroAberto}
        />
      </div>
    </div>
  );
}
