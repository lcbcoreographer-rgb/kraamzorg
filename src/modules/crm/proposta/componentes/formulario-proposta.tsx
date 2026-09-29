"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { PacoteProposta, Proposta } from "@/lib/dados/tipos-venda";
import { formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { acaoSalvarProposta } from "../acoes";
import {
  contaDaEscolha,
  parcelasMaximas,
  percentualDaEscolha,
  precisaAprovacao,
  type EscolhaProposta,
} from "../calculo";
import { estadoInicialProposta } from "../estado-acoes";
import { ReciboConta, ReguaFina } from "./recibo-conta";

/**
 * Proposta (P30 item 1; D-16). Pacote vigente em cartões com a régua fina
 * dos dias, condição da tabela em pílulas, parcelas dentro do que o pacote
 * e a condição permitem, e quem paga. O resumo ao lado refaz a conta do
 * banco enquanto a pessoa escolhe (calculo.ts), com as parcelas em blocos
 * da régua; quem vale é a conta que o banco faz ao salvar.
 */

const SEM_CONDICAO = "sem";
const OUTRA_PESSOA = "outra";

function descricaoPacote(p: PacoteProposta): string {
  const visitas = `${p.dias} visitas de ${p.horasPorVisita} h`;
  return p.linha ? `${p.linha}, ${visitas}` : visitas;
}

export function FormularioProposta({
  proposta,
  temContrato,
  fechada = false,
  lateral,
}: {
  proposta: Proposta;
  /** Já há proposta salva: salvar vira ação secundária (um primário por tela). */
  temContrato: boolean;
  /**
   * A família aceitou (P2 em "Ganho" ou adiante): a proposta não muda mais
   * (api.salvar_proposta recusa). A coluna lateral continua no mesmo lugar
   * da árvore, para o painel do formulário não perder o link recém-gerado
   * quando a página se atualiza depois de gerar.
   */
  fechada?: boolean;
  /** Aprovação e formulário, abaixo do resumo. */
  lateral?: React.ReactNode;
}) {
  const [estado, acao, salvando] = useActionState(
    acaoSalvarProposta,
    estadoInicialProposta,
  );
  const { oportunidade, familia, contrato } = proposta;
  const pacotes = React.useMemo(() => {
    const doTipo = proposta.pacotes.filter(
      (p) => p.gemelar === familia.gemelar,
    );
    return doTipo.length > 0 ? doTipo : proposta.pacotes;
  }, [proposta.pacotes, familia.gemelar]);

  const pacoteInicial =
    pacotes.find((p) => p.pacoteVersaoId === contrato?.pacoteVersaoId) ??
    pacotes.find((p) => p.pacoteId === oportunidade.planoInteressePacoteId) ??
    null;
  const [pacoteId, definirPacoteId] = React.useState(
    pacoteInicial?.pacoteVersaoId ?? "",
  );
  const [condicaoId, definirCondicaoId] = React.useState(
    oportunidade.condicaoId ?? SEM_CONDICAO,
  );
  const [parcelas, definirParcelas] = React.useState(
    contrato?.conta.parcelas ?? 1,
  );
  const [descontoPct, definirDescontoPct] = React.useState(
    oportunidade.descontoPct > 0 ? String(oportunidade.descontoPct) : "",
  );
  const [descontoMotivo, definirDescontoMotivo] = React.useState("");
  const [paraQuem, definirParaQuem] = React.useState(
    oportunidade.paraQuem ?? "propria",
  );
  const [pagador, definirPagador] = React.useState(
    oportunidade.pagadorPessoaId ?? "",
  );
  const [pagadorNome, definirPagadorNome] = React.useState("");

  const pacote = pacotes.find((p) => p.pacoteVersaoId === pacoteId) ?? null;
  const condicao = proposta.condicoes.find((c) => c.id === condicaoId) ?? null;
  const pct = Number(descontoPct.replace(",", ".")) || 0;
  const escolha: EscolhaProposta = {
    pacote,
    condicao,
    parcelas,
    descontoPct: condicao?.tipo === "desconto_pct" ? 0 : pct,
    taxaCentavos: familia.cidade?.taxaCentavos ?? 0,
  };
  const maximo = parcelasMaximas(escolha);
  const parcelasValidas = Math.min(Math.max(parcelas, 1), maximo);
  const conta = contaDaEscolha({ ...escolha, parcelas: parcelasValidas });
  const pedeAprovacao = precisaAprovacao(escolha);
  const pctAplicado = percentualDaEscolha(escolha);
  const pagaveis = proposta.pessoas.filter((p) => p.papel !== "mae");

  const pacoteFechado =
    proposta.pacotes.find((p) => p.pacoteVersaoId === contrato?.pacoteVersaoId)
      ?.nome ?? "Pacote da proposta";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {fechada ? (
        <section
          aria-labelledby="proposta-fechada"
          className="flex min-w-0 flex-col gap-3"
        >
          <h2
            id="proposta-fechada"
            className="font-titulo text-2 text-texto font-medium"
          >
            Proposta fechada
          </h2>
          <p className="text-corpo text-texto max-w-leitura">
            A família aceitou a proposta e os valores não mudam mais por aqui.
            Se precisar mudar alguma coisa, fale com a diretoria.
          </p>
        </section>
      ) : (
        <form action={acao} className="flex min-w-0 flex-col gap-8">
          <input type="hidden" name="familiaId" value={familia.id} />
          <input type="hidden" name="oportunidadeId" value={oportunidade.id} />
          <input type="hidden" name="pacoteVersaoId" value={pacoteId} />
          <input
            type="hidden"
            name="condicaoId"
            value={condicaoId === SEM_CONDICAO ? "" : condicaoId}
          />
          <input type="hidden" name="parcelas" value={parcelasValidas} />
          <input type="hidden" name="paraQuem" value={paraQuem} />
          <input
            type="hidden"
            name="pagadorPessoaId"
            value={
              paraQuem === "presente" && pagador !== OUTRA_PESSOA ? pagador : ""
            }
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="font-titulo text-2 text-texto mb-3 font-medium">
              Pacote
            </legend>
            {pacotes.map((p) => {
              const marcado = p.pacoteVersaoId === pacoteId;
              return (
                <label
                  key={p.pacoteVersaoId}
                  className={cn(
                    "rounded-3 bg-superficie ease-estado flex cursor-pointer flex-col gap-3 border-[1.5px] p-4 transition-[border-color,box-shadow] duration-140",
                    "has-[:focus-visible]:outline-foco has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                    marcado
                      ? "border-dourado shadow-1"
                      : "border-linha hover:border-marinho-50",
                  )}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="pacote-escolha"
                      value={p.pacoteVersaoId}
                      checked={marcado}
                      onChange={() => definirPacoteId(p.pacoteVersaoId)}
                      className="mt-1 size-5 shrink-0"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-3 text-texto font-semibold">
                        {p.nome}
                      </span>
                      <span className="text-apoio text-texto-2">
                        {descricaoPacote(p)}
                      </span>
                    </span>
                    <span className="text-dado text-texto font-mono tabular-nums">
                      {formatarMoeda(p.valorCentavos)}
                    </span>
                  </span>
                  <ReguaFina total={p.dias} preenchida={marcado} />
                </label>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-5">
            <h2 className="font-titulo text-2 text-texto font-medium">
              Condição e parcelas
            </h2>
            <EscolhaUnica
              rotulo="Condição da tabela"
              name="condicao-escolha"
              opcoes={[
                { valor: SEM_CONDICAO, rotulo: "Sem condição especial" },
                ...proposta.condicoes.map((c) => ({
                  valor: c.id,
                  rotulo: c.nome,
                })),
              ]}
              valor={condicaoId}
              onMudar={definirCondicaoId}
              descricao={
                condicao?.requerAprovacao
                  ? "Esta condição precisa da aprovação da diretoria antes do link do formulário."
                  : undefined
              }
            />
            {condicao?.tipo !== "desconto_pct" ? (
              <div className="tablet:grid-cols-[12rem_minmax(0,1fr)] grid grid-cols-1 gap-5">
                <CampoTexto
                  rotulo="Desconto fora da tabela"
                  name="descontoPct"
                  inputMode="decimal"
                  value={descontoPct}
                  onChange={(evento) =>
                    definirDescontoPct(
                      evento.target.value.replace(/[^\d,.]/g, ""),
                    )
                  }
                  placeholder="0"
                  opcional
                  descricao="Em %. Precisa de aprovação da diretoria."
                  acessorio={<span className="text-texto-2 pr-4">%</span>}
                />
                {pct > 0 ? (
                  <CampoTexto
                    rotulo="Motivo do desconto"
                    name="descontoMotivo"
                    value={descontoMotivo}
                    onChange={(evento) =>
                      definirDescontoMotivo(evento.target.value)
                    }
                    descricao="Uma linha para a diretoria decidir."
                  />
                ) : null}
              </div>
            ) : (
              <input type="hidden" name="descontoPct" value="0" />
            )}
            <EscolhaUnica
              rotulo="Parcelas"
              name="parcelas-escolha"
              opcoes={Array.from({ length: maximo }, (_, i) => ({
                valor: String(i + 1),
                rotulo: i === 0 ? "À vista" : `${i + 1}x`,
              }))}
              valor={String(parcelasValidas)}
              onMudar={(valor) => definirParcelas(Number(valor))}
              descricao={`Até ${maximo}x sem juros neste pacote${condicao?.tipo === "parcelamento" ? " com esta condição" : ""}.`}
            />
          </div>

          <div className="flex flex-col gap-5">
            <h2 className="font-titulo text-2 text-texto font-medium">
              Quem paga
            </h2>
            <EscolhaUnica
              rotulo="O acompanhamento é"
              name="para-quem-escolha"
              opcoes={[
                { valor: "propria", rotulo: "Para a própria família" },
                { valor: "presente", rotulo: "Um presente de outra pessoa" },
                ...(oportunidade.paraQuem === "outro"
                  ? [{ valor: "outro", rotulo: "Para outra pessoa da família" }]
                  : []),
              ]}
              valor={paraQuem}
              onMudar={(valor) => definirParaQuem(valor as typeof paraQuem)}
            />
            {paraQuem === "presente" ? (
              <>
                <EscolhaUnica
                  rotulo="Quem dá o presente"
                  name="pagador-escolha"
                  opcoes={[
                    ...pagaveis.map((p) => ({ valor: p.id, rotulo: p.nome })),
                    { valor: OUTRA_PESSOA, rotulo: "Outra pessoa" },
                  ]}
                  valor={pagador || (pagaveis.length === 0 ? OUTRA_PESSOA : "")}
                  onMudar={definirPagador}
                  descricao="O contrato fica no nome da gestante; os dados de pagamento são de quem dá o presente."
                />
                {pagador === OUTRA_PESSOA || pagaveis.length === 0 ? (
                  <CampoTexto
                    rotulo="Nome de quem dá o presente"
                    name="pagadorNome"
                    value={pagadorNome}
                    onChange={(evento) =>
                      definirPagadorNome(evento.target.value)
                    }
                    autoComplete="off"
                  />
                ) : null}
              </>
            ) : null}
          </div>

          {estado.erro ? (
            <FaixaAlerta variante="erro" titulo={estado.erro} />
          ) : null}
          {estado.sucesso ? (
            <FaixaAlerta variante="sucesso" titulo={estado.sucesso} anunciar />
          ) : null}

          <Botao
            type="submit"
            variante={temContrato ? "secundario" : "primario"}
            carregando={salvando}
            rotuloCarregando="Salvando"
            disabled={!pacote}
            largaTotal
            className="tablet:w-auto self-start"
          >
            {temContrato ? "Salvar as mudanças" : "Salvar a proposta"}
          </Botao>
        </form>
      )}

      <aside
        className="flex min-w-0 flex-col gap-4"
        aria-label="Resumo da proposta"
      >
        <section className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5 lg:sticky lg:top-24">
          <h2 className="font-titulo text-2 text-texto font-medium">Resumo</h2>
          {fechada && contrato ? (
            <ReciboConta
              conta={contrato.conta}
              nomePacote={pacoteFechado}
              percentualDesconto={null}
              cidade={familia.cidade?.nome ?? null}
            />
          ) : conta && pacote ? (
            <>
              <ReciboConta
                conta={conta}
                nomePacote={pacote.nome}
                percentualDesconto={pctAplicado}
                cidade={familia.cidade?.nome ?? null}
              />
              {pedeAprovacao ? (
                <p className="text-apoio text-aviso-texto">
                  Com este desconto ou condição, o link do formulário só sai
                  depois da aprovação da diretoria.
                </p>
              ) : null}
              {familia.cidade?.requerConfirmacao ? (
                <p className="text-apoio text-texto-2">
                  {familia.cidade.nome} pede confirmação de disponibilidade da
                  equipe antes de fechar.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-corpo text-texto-2">
              Escolha um pacote para ver o total e as parcelas.
            </p>
          )}
        </section>
        {lateral}
      </aside>
    </div>
  );
}
