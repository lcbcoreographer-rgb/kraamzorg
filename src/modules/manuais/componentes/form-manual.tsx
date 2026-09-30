"use client";

import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { DetalheManual } from "@/lib/dados/tipos-relacao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { ROTULO_PAPEL_ALVO } from "@/modules/relacao/rotulos";
import { acaoSalvarManual } from "../acoes";

/** Cadastro e edição de manual ou protocolo (coordenação e diretoria, P51 item 2). */
export function FormularioManual({ manual }: { manual?: DetalheManual }) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarManual,
    estadoInicialRelacao,
  );
  return (
    <form
      onSubmit={acao}
      className="rounded-3 bg-superficie-2 flex max-w-[720px] flex-col gap-4 p-5"
    >
      <h3 className="font-titulo text-2 text-texto font-medium">
        {manual ? "Editar este manual" : "Novo manual ou protocolo"}
      </h3>
      {manual ? (
        <input type="hidden" name="manualId" value={manual.id} />
      ) : null}
      <CampoTexto
        rotulo="Título"
        name="titulo"
        required
        maxLength={160}
        defaultValue={manual?.titulo ?? ""}
      />
      <CampoSelecao
        rotulo="Tipo"
        name="categoria"
        defaultValue={manual?.categoria ?? "manual"}
        opcoes={[
          { valor: "manual", rotulo: "Manual" },
          { valor: "protocolo", rotulo: "Protocolo" },
        ]}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-corpo text-texto font-medium">
          Quem precisa ler
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {Object.entries(ROTULO_PAPEL_ALVO).map(([papel, rotulo]) => (
            <label
              key={papel}
              className="text-corpo text-texto min-h-toque flex items-center gap-2"
            >
              <input
                type="checkbox"
                name="papeisAlvo"
                value={papel}
                defaultChecked={manual?.papeisAlvo.includes(papel) ?? false}
                className="size-5"
              />
              {rotulo}
            </label>
          ))}
        </div>
        <p className="text-apoio text-texto-2">
          Sem ninguém marcado, o manual fica aberto a todos, sem cobrança de
          leitura.
        </p>
      </fieldset>
      <CampoTexto
        rotulo="Texto"
        name="conteudo"
        multilinha
        linhas={14}
        required
        maxLength={60000}
        defaultValue={manual?.conteudo ?? ""}
        descricao="Texto simples. Protocolo clínico só entra com a aprovação da Edilaine."
      />
      <CampoTexto
        rotulo="O que mudou nesta versão"
        name="resumoMudanca"
        maxLength={300}
        opcional={!manual}
        descricao="Obrigatório quando o texto muda. Uma frase basta."
      />
      <input type="hidden" name="ativo" value="nao" />
      <label className="text-corpo text-texto min-h-toque flex items-center gap-2">
        <input
          type="checkbox"
          name="ativo"
          value="sim"
          defaultChecked={manual?.ativo ?? true}
          className="size-5"
        />
        Manual em uso
      </label>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="O manual não foi salvo">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          A lista já mostra a mudança.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar manual
      </Botao>
    </form>
  );
}
