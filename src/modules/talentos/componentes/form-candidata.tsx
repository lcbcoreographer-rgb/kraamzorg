"use client";

import * as React from "react";
import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { UserPlus } from "lucide-react";
import { TileIcone } from "@/components/ui/tile-icone";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { DetalheCandidata } from "@/lib/dados/tipos-relacao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { ROTULO_ESTADO_CANDIDATA } from "@/modules/relacao/rotulos";
import { ESTADOS_CANDIDATA } from "@/lib/dados/tipos-relacao";
import { acaoMudarEstadoCandidata, acaoSalvarCandidata } from "../acoes";

/** Cadastro manual ou edição de uma candidata (P51 item 3). */
export function FormularioCandidata({
  candidata,
}: {
  candidata?: DetalheCandidata;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarCandidata,
    estadoInicialRelacao,
  );
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (estado.sucesso && !candidata) ref.current?.reset();
  }, [estado, candidata]);
  return (
    <form
      ref={ref}
      onSubmit={acao}
      className="rounded-3 bg-superficie shadow-1 flex w-full max-w-[560px] flex-col gap-4 p-5 lg:p-6"
    >
      <h3 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="dourado" forma="quadrado" tamanho="p">
          <UserPlus />
        </TileIcone>
        {candidata ? "Dados da candidata" : "Nova candidata"}
      </h3>
      {candidata ? (
        <input type="hidden" name="candidataId" value={candidata.id} />
      ) : null}
      <CampoTexto
        rotulo="Nome"
        name="nome"
        required
        maxLength={120}
        defaultValue={candidata?.nome ?? ""}
      />
      <CampoTexto
        rotulo="Telefone"
        name="telefone"
        inputMode="tel"
        opcional
        defaultValue={candidata?.telefoneE164 ?? ""}
        descricao="Com o DDD."
      />
      <CampoTexto
        rotulo="E-mail"
        name="email"
        type="email"
        opcional
        defaultValue={candidata?.email ?? ""}
      />
      <CampoTexto
        rotulo="Cidade"
        name="cidade"
        maxLength={80}
        opcional
        defaultValue={candidata?.cidade ?? ""}
      />
      <CampoTexto
        rotulo="Conselho e número"
        name="conselho"
        maxLength={60}
        opcional
        defaultValue={candidata?.conselho ?? ""}
      />
      <CampoTexto
        rotulo="Apresentação"
        name="apresentacao"
        multilinha
        linhas={4}
        maxLength={1500}
        opcional
        defaultValue={candidata?.apresentacao ?? ""}
      />
      <CampoTexto
        rotulo="Anotações da equipe"
        name="observacoes"
        multilinha
        linhas={3}
        maxLength={1000}
        opcional
        defaultValue={candidata?.observacoes ?? ""}
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="A candidata não foi salva">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          Ela já aparece no banco de talentos.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar candidata
      </Botao>
    </form>
  );
}

/** Etapa da candidata no processo de seleção. */
export function MudarEtapa({
  candidataId,
  estado,
}: {
  candidataId: string;
  estado: string;
}) {
  const [valor, definirValor] = React.useState(estado);
  const [aviso, definirAviso] = React.useState<{
    erro?: string;
    sucesso?: string;
  }>({});
  const [ocupado, iniciar] = React.useTransition();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <CampoSelecao
        rotulo="Etapa"
        name="estado"
        value={valor}
        onChange={(e) => definirValor(e.target.value)}
        opcoes={ESTADOS_CANDIDATA.map((e) => ({
          valor: e,
          rotulo: ROTULO_ESTADO_CANDIDATA[e],
        }))}
      />
      <Botao
        type="button"
        variante="secundario"
        tamanho="compacto"
        disabled={ocupado || valor === estado}
        onClick={() =>
          iniciar(async () =>
            definirAviso(await acaoMudarEstadoCandidata(candidataId, valor)),
          )
        }
      >
        Mudar etapa
      </Botao>
      <span role="status" className="text-apoio text-texto-2">
        {aviso.erro ?? aviso.sucesso ?? ""}
      </span>
    </div>
  );
}
