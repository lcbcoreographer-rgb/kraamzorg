"use client";

import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { ResumoManual, Trilha } from "@/lib/dados/tipos-relacao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { ROTULO_PAPEL_ALVO } from "@/modules/relacao/rotulos";
import { acaoSalvarTrilha } from "../acoes";

/** Trilha de treinamento: nome, papel e os manuais na ordem em que serão lidos (P51 item 2). */
export function FormularioTrilha({
  manuais,
  trilha,
}: {
  manuais: ResumoManual[];
  trilha?: Trilha;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarTrilha,
    estadoInicialRelacao,
  );
  const naTrilha = new Set(trilha?.itens.map((i) => i.manualId) ?? []);
  return (
    <form
      onSubmit={acao}
      className="rounded-3 bg-superficie-2 flex max-w-[720px] flex-col gap-4 p-5"
    >
      <h3 className="font-titulo text-2 text-texto font-medium">
        {trilha
          ? `Editar a trilha ${trilha.nome}`
          : "Nova trilha de treinamento"}
      </h3>
      {trilha ? (
        <input type="hidden" name="trilhaId" value={trilha.id} />
      ) : null}
      <CampoTexto
        rotulo="Nome da trilha"
        name="nome"
        required
        maxLength={120}
        defaultValue={trilha?.nome ?? ""}
      />
      <CampoSelecao
        rotulo="Para quem"
        name="papelAlvo"
        defaultValue={trilha?.papelAlvo ?? "enfermeira"}
        opcoes={Object.entries(ROTULO_PAPEL_ALVO).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-corpo text-texto font-medium">
          Manuais da trilha
        </legend>
        <p className="text-apoio text-texto-2">A ordem é a da lista abaixo.</p>
        {manuais
          .filter((m) => m.ativo)
          .map((m) => (
            <label
              key={m.id}
              className="text-corpo text-texto min-h-toque flex items-center gap-2"
            >
              <input
                type="checkbox"
                name="manualIds"
                value={m.id}
                defaultChecked={naTrilha.has(m.id)}
                className="size-5"
              />
              {m.titulo}
            </label>
          ))}
      </fieldset>
      <input type="hidden" name="ativa" value="nao" />
      <label className="text-corpo text-texto min-h-toque flex items-center gap-2">
        <input
          type="checkbox"
          name="ativa"
          value="sim"
          defaultChecked={trilha?.ativa ?? true}
          className="size-5"
        />
        Trilha em uso
      </label>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="A trilha não foi salva">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          Ela já aparece para quem deve fazer.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar trilha
      </Botao>
    </form>
  );
}
