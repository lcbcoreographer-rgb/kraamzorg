"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  Banknote,
  CircleCheck,
  Copy,
  ExternalLink,
  Link2,
  Paperclip,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { CobrancaDetalhe } from "@/lib/dados/tipos-contrato";
import { cn } from "@/lib/utils";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
} from "@/lib/formatacao";
import {
  acaoBaixarManual,
  acaoGerarLinkPagamento,
  acaoSimularPagamento,
} from "../acoes";
import { estadoInicialCobranca } from "../estado-acoes";
import {
  ROTULO_METODO,
  ROTULO_NOTA,
  ROTULO_SITUACAO,
  VARIANTE_SITUACAO,
} from "../rotulos";
import { centavosParaCampo } from "../valor";

/**
 * Uma cobrança, do lado do financeiro (P32). Mostra a situação, o link de
 * pagamento (gerar, copiar, abrir), o pagamento confirmado (método, parcelas
 * do cartão, recibo, nota fiscal) e a baixa manual de Pix recebido fora do
 * sistema, com comprovante e motivo.
 */
export function PainelCobranca({
  cobranca,
  demonstracao,
}: {
  cobranca: CobrancaDetalhe;
  demonstracao: boolean;
}) {
  const [erro, definirErro] = React.useState<string | null>(null);
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [gerando, iniciarGeracao] = React.useTransition();
  const [simulando, iniciarSimulacao] = React.useTransition();
  const [estadoBaixa, acaoBaixa, baixando] = useActionState(
    acaoBaixarManual,
    estadoInicialCobranca,
  );
  const [nomeArquivo, definirNomeArquivo] = React.useState<string | null>(null);

  const paga = cobranca.situacao === "paga";
  const encerrada =
    cobranca.situacao === "cancelada" || cobranca.situacao === "estornada";

  function gerarLink() {
    definirErro(null);
    definirAviso(null);
    iniciarGeracao(async () => {
      const r = await acaoGerarLinkPagamento(cobranca.id, cobranca.familiaId);
      if (r.erro) definirErro(r.erro);
      else definirAviso(r.sucesso ?? null);
    });
  }

  function simular() {
    definirErro(null);
    definirAviso(null);
    iniciarSimulacao(async () => {
      const r = await acaoSimularPagamento(cobranca.id, cobranca.familiaId);
      if (r.erro) definirErro(r.erro);
      else definirAviso(r.sucesso ?? null);
    });
  }

  async function copiar() {
    if (!cobranca.linkPagamento) return;
    try {
      await navigator.clipboard.writeText(cobranca.linkPagamento);
      definirAviso("Link copiado. Cole na conversa com a família.");
    } catch {
      definirAviso("Não deu para copiar daqui. Selecione o link e copie.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* O valor é o número da cobrança (DESIGN.md, 2.6): em Jost, grande,
          num bloco com a cor do que ela é. Paga é o feito (sálvia); a
          receber é o agora (dourado); encerrada fica em branco. O estado
          continua no selo, com a palavra. */}
      <section
        aria-label="Situação da cobrança"
        className={cn(
          "rounded-3 flex flex-col gap-3 p-5 lg:p-6",
          paga
            ? "bg-salvia-clara"
            : encerrada
              ? "bg-superficie border-linha border"
              : "bg-dourado-claro",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Selo variante={VARIANTE_SITUACAO[cobranca.situacao]}>
            {ROTULO_SITUACAO[cobranca.situacao]}
          </Selo>
          {cobranca.nota ? (
            <Selo
              variante={
                cobranca.nota.status === "emitida" ? "sucesso" : "neutro"
              }
            >
              {ROTULO_NOTA[cobranca.nota.status] ?? cobranca.nota.status}
            </Selo>
          ) : null}
        </div>
        <p className="font-titulo text-numero text-texto font-medium tabular-nums">
          {formatarMoeda(cobranca.valorCentavos)}
        </p>
        <p className="text-corpo text-texto">
          {paga && cobranca.pagoEm ? (
            <>
              Pago em{" "}
              <span className="font-mono">
                {formatarDataHora(cobranca.pagoEm)}
              </span>
              {cobranca.metodo
                ? `, ${ROTULO_METODO[cobranca.metodo] ?? cobranca.metodo}`
                : ""}
              {cobranca.parcelasCartao && cobranca.parcelasCartao > 1
                ? ` em ${cobranca.parcelasCartao} vezes`
                : ""}
              .
            </>
          ) : encerrada ? (
            "Esta cobrança foi encerrada."
          ) : (
            <>
              Vence em{" "}
              <span className="font-mono">
                {formatarData(cobranca.vencimento)}
              </span>
              .
              {cobranca.pagadorNome
                ? ` Quem paga: ${cobranca.pagadorNome}.`
                : ""}
            </>
          )}
        </p>
        {paga && cobranca.nota ? (
          <p className="text-apoio text-texto-2">
            {cobranca.nota.status === "pendente"
              ? "A nota fiscal ainda não foi emitida."
              : cobranca.nota.numero
                ? `Nota fiscal número ${cobranca.nota.numero}.`
                : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Botao asChild variante="secundario" tamanho="compacto">
            <Link href={`/familias/${cobranca.familiaId}/contrato`}>
              Ver o contrato
            </Link>
          </Botao>
          {cobranca.comprovante === "arquivo" ? (
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              iconeEsquerda={
                <Paperclip className="size-4" aria-hidden="true" />
              }
            >
              <a
                href={`/cobrancas/${cobranca.id}/comprovante`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Abrir o comprovante
              </a>
            </Botao>
          ) : null}
          {cobranca.reciboUrl ? (
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              iconeEsquerda={
                <ExternalLink className="size-4" aria-hidden="true" />
              }
            >
              <a
                href={cobranca.reciboUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Abrir o recibo
              </a>
            </Botao>
          ) : null}
        </div>
      </section>

      {!paga && !encerrada ? (
        <section className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5">
          <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
            <TileIcone tom="areia" forma="quadrado" tamanho="p">
              <Link2 />
            </TileIcone>
            Link de pagamento
          </h2>
          {cobranca.acimaDoLimite ? (
            <FaixaAlerta
              variante="prioritario"
              titulo="Parcelamento acima do limite do link"
              anunciar={false}
            >
              O contrato tem {cobranca.parcelasContrato} parcelas e o link
              permite até {cobranca.parcelasMax ?? 1} sem juros. Combine a
              cobrança à mão com a família e dê a baixa abaixo quando o
              pagamento chegar.
            </FaixaAlerta>
          ) : cobranca.linkPagamento ? (
            <>
              <p className="text-corpo text-texto-2">
                A tarefa com o texto para a família está com o comercial. Aqui
                você copia o link se precisar.
              </p>
              <p
                className="text-apoio text-texto font-mono break-all"
                data-link-pagamento
              >
                {cobranca.linkPagamento}
              </p>
              <div className="flex flex-wrap gap-2">
                <Botao
                  variante="secundario"
                  tamanho="compacto"
                  onClick={() => void copiar()}
                  iconeEsquerda={<Copy className="size-4" aria-hidden="true" />}
                >
                  Copiar o link
                </Botao>
                <Botao asChild variante="secundario" tamanho="compacto">
                  <a
                    href={cobranca.linkPagamento}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Abrir o link
                  </a>
                </Botao>
              </div>
            </>
          ) : (
            <>
              <p className="text-corpo text-texto-2">
                Esta cobrança ainda não tem link. Ao gerar, o cartão fica em até{" "}
                {Math.min(
                  cobranca.parcelasContrato,
                  cobranca.parcelasMax ?? cobranca.parcelasContrato,
                )}{" "}
                {Math.min(
                  cobranca.parcelasContrato,
                  cobranca.parcelasMax ?? cobranca.parcelasContrato,
                ) === 1
                  ? "vez"
                  : "vezes"}{" "}
                sem juros, e a tarefa com o texto sai para o comercial.
              </p>
              <Botao
                onClick={gerarLink}
                carregando={gerando}
                rotuloCarregando="Gerando"
                disabled={!cobranca.podeGerarLink}
                className="self-start"
              >
                Gerar o link de pagamento
              </Botao>
            </>
          )}
        </section>
      ) : null}

      {cobranca.podeBaixarManual ? (
        <section className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5 lg:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
              <TileIcone tom="areia" forma="quadrado" tamanho="p">
                <Banknote />
              </TileIcone>
              Pix recebido fora do sistema
            </h2>
            <p className="text-corpo text-texto-2">
              Use só quando o pagamento chegou por outro caminho. Anexe o
              comprovante e escreva o motivo: os dois ficam registrados com o
              seu nome.
            </p>
          </div>
          <form action={acaoBaixa} className="flex flex-col gap-4">
            <input type="hidden" name="cobrancaId" value={cobranca.id} />
            <input type="hidden" name="familiaId" value={cobranca.familiaId} />
            <CampoTexto
              rotulo="Valor recebido (R$)"
              name="valor"
              inputMode="decimal"
              defaultValue={centavosParaCampo(cobranca.valorCentavos)}
              erro={estadoBaixa.campos?.valor}
              descricao="Igual ou maior que o da cobrança."
              autoComplete="off"
            />
            <div className="flex flex-col gap-2">
              <span className="text-corpo text-texto font-medium">
                Comprovante
              </span>
              <label className="rounded-pilula border-borda-campo bg-superficie text-texto hover:bg-marinho-08 min-h-toque text-apoio inline-flex w-fit cursor-pointer items-center gap-2 border-[1.5px] px-4 font-semibold focus-within:outline-2">
                <Paperclip className="size-4" aria-hidden="true" />
                {nomeArquivo ?? "Escolher o arquivo"}
                <input
                  type="file"
                  name="comprovante"
                  accept="application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  onChange={(e) =>
                    definirNomeArquivo(e.target.files?.[0]?.name ?? null)
                  }
                />
              </label>
              <p className="text-apoio text-texto-2">PDF, PNG ou JPG.</p>
              {estadoBaixa.campos?.comprovante ? (
                <p role="alert" className="text-apoio text-alerta font-medium">
                  {estadoBaixa.campos.comprovante}
                </p>
              ) : null}
            </div>
            <CampoTexto
              rotulo="Motivo da baixa"
              name="motivo"
              multilinha
              linhas={3}
              maxLength={200}
              erro={estadoBaixa.campos?.motivo}
              descricao="Por exemplo: Pix recebido na conta em 29/09, conferido no extrato."
            />
            <Botao
              type="submit"
              carregando={baixando}
              rotuloCarregando="Registrando"
              className="self-start"
            >
              Dar a baixa
            </Botao>
          </form>
          {estadoBaixa.erro ? (
            <FaixaAlerta variante="erro" titulo={estadoBaixa.erro} />
          ) : null}
        </section>
      ) : null}

      {demonstracao && !paga && !encerrada ? (
        <section className="rounded-3 bg-superficie-2 flex flex-col gap-2 p-5">
          <p className="text-apoio text-texto-2">
            Demonstração: faz o que o webhook da InfinitePay faria depois de
            confirmar o pagamento.
          </p>
          <Botao
            variante="secundario"
            tamanho="compacto"
            onClick={simular}
            carregando={simulando}
            rotuloCarregando="Simulando"
            className="self-start"
          >
            Simular o pagamento (demonstração)
          </Botao>
        </section>
      ) : null}

      {estadoBaixa.sucesso ? (
        <p
          role="status"
          className="text-sucesso text-corpo flex items-start gap-2 font-medium"
        >
          <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          {estadoBaixa.sucesso}
        </p>
      ) : null}
      {erro ? <FaixaAlerta variante="erro" titulo={erro} /> : null}
      {aviso ? (
        <p role="status" className="text-apoio text-texto">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
