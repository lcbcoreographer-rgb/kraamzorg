"use client";

import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { acaoSalvarCusto } from "../acoes";

/** Custo do mês de um canal (P47 item 3): quem lança é o financeiro ou a diretoria. */
export function FormularioCusto({
  canais,
  mesAtual,
}: {
  canais: { id: string; rotulo: string }[];
  /** aaaa-mm do mês de hoje. */
  mesAtual: string;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarCusto,
    estadoInicialRelacao,
  );
  return (
    <form
      onSubmit={acao}
      className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-4 p-5"
    >
      <h3 className="font-titulo text-2 text-texto font-medium">
        Custo do mês por canal
      </h3>
      <p className="text-apoio text-texto-2">
        Lance o que foi gasto no canal no mês. Se você lançar de novo o mesmo
        mês, o valor novo troca o anterior.
      </p>
      <CampoSelecao
        rotulo="Canal"
        name="canalId"
        required
        opcaoVazia="Escolha o canal"
        opcoes={canais.map((c) => ({ valor: c.id, rotulo: c.rotulo }))}
      />
      <CampoTexto
        rotulo="Mês"
        name="mes"
        type="month"
        required
        defaultValue={mesAtual}
      />
      <CampoTexto
        rotulo="Valor gasto em reais"
        name="valor"
        required
        inputMode="decimal"
        placeholder="1.500,00"
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="O custo não foi salvo">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          O relatório já usa o valor novo.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar custo
      </Botao>
    </form>
  );
}
