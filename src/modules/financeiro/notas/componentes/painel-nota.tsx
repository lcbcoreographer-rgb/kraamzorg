"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Copy, FileText, Paperclip, RefreshCw, Send } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { cn } from "@/lib/utils";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { NotaDetalhe } from "@/lib/dados/tipos-nota";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
} from "@/lib/formatacao";
import {
  acaoAjustarDemonstracaoNota,
  acaoConsultarNota,
  acaoEmitirNota,
  acaoRegistrarNotaManual,
  acaoVerDadosDaNota,
} from "../acoes";
import { estadoInicialNota, type EstadoAcaoNota } from "../estado-acoes";
import { fraseProximoPasso, ROTULO_ESTADO, VARIANTE_ESTADO } from "../rotulos";

/**
 * Uma nota fiscal (P43): o estado, o motivo quando voltou com erro, a emissão
 * pelo provedor (com reenvio) e a emissão manual assistida (dados para copiar
 * e registro do número, do PDF e do XML). O tomador é quem paga (C-10).
 */
function Mensagem({ estado }: { estado: EstadoAcaoNota }) {
  if (estado.erro) return <FaixaAlerta variante="erro" titulo={estado.erro} />;
  if (estado.sucesso) {
    return <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />;
  }
  return null;
}

function LinhaDado({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null;
}) {
  const [copiado, definirCopiado] = React.useState(false);
  if (!valor) return null;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor!);
      definirCopiado(true);
    } catch {
      definirCopiado(false);
    }
  }
  return (
    <div className="border-linha flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2">
      <dt className="text-apoio text-texto-2 w-40 shrink-0">{rotulo}</dt>
      <dd className="text-corpo text-texto min-w-0 flex-1 break-words">
        {valor}
      </dd>
      <Botao
        variante="icone"
        aria-label={`Copiar ${rotulo.toLowerCase()}`}
        onClick={copiar}
      >
        <Copy className="size-4" aria-hidden="true" />
      </Botao>
      {copiado ? (
        <span className="text-apoio text-sucesso" role="status">
          Copiado
        </span>
      ) : null}
    </div>
  );
}

export function PainelNota({
  nota,
  demonstracao,
}: {
  nota: NotaDetalhe;
  demonstracao: boolean;
}) {
  const [estado, definirEstado] =
    React.useState<EstadoAcaoNota>(estadoInicialNota);
  const [ocupado, iniciar] = React.useTransition();
  const [estadoManual, registrarManual, registrando] = useActionState(
    acaoRegistrarNotaManual,
    estadoInicialNota,
  );
  const [nomePdf, definirNomePdf] = React.useState<string | null>(null);
  const [nomeXml, definirNomeXml] = React.useState<string | null>(null);

  function executar(acao: () => Promise<EstadoAcaoNota>) {
    definirEstado(estadoInicialNota);
    iniciar(async () => {
      definirEstado(await acao());
    });
  }

  function aoEnviarManual(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    React.startTransition(() => registrarManual(dados));
  }

  const emitida = nota.status === "emitida";
  const cancelada = nota.status === "cancelada";
  const semDados = estado.dados;

  return (
    <div className="flex flex-col gap-6">
      {/* O valor da nota em número grande (DESIGN.md, 2.6). Emitida é o
          feito (sálvia); as outras ficam em branco, porque o estado dela
          (a emitir, com erro, no provedor) mora no selo, com a palavra. */}
      <section
        aria-label="Situação da nota"
        className={cn(
          "rounded-3 flex flex-col gap-3 p-5 lg:p-6",
          emitida ? "bg-salvia-clara" : "bg-superficie shadow-1",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Selo variante={VARIANTE_ESTADO[nota.status]}>
            {ROTULO_ESTADO[nota.status]}
          </Selo>
          {nota.manual ? <Selo variante="neutro">Emitida à mão</Selo> : null}
          {nota.tentativas > 0 ? (
            <Selo variante="neutro">
              {nota.tentativas === 1
                ? "1 tentativa no provedor"
                : `${nota.tentativas} tentativas no provedor`}
            </Selo>
          ) : null}
        </div>
        <p className="font-titulo text-numero text-texto font-medium tabular-nums">
          {formatarMoeda(nota.valorCentavos)}
        </p>
        <p className="text-corpo text-texto-2">
          Parcela {nota.parcela}
          {nota.pagoEm ? (
            <>
              , paga em{" "}
              <span className="font-mono">{formatarData(nota.pagoEm)}</span>
            </>
          ) : null}
          .{" "}
          {nota.tomadorNome
            ? `Quem paga, e por isso o tomador da nota: ${nota.tomadorNome}.`
            : ""}
        </p>
        {emitida ? (
          <p className="text-corpo text-texto">
            Nota número <span className="font-mono">{nota.numero}</span>
            {nota.emitidaEm ? (
              <>
                , emitida em{" "}
                <span className="font-mono">
                  {formatarDataHora(nota.emitidaEm)}
                </span>
              </>
            ) : null}
            .
          </p>
        ) : null}
        <p className="text-apoio text-texto-2">
          {fraseProximoPasso(nota.status, nota.emissaoAutomatica)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao
            className="max-w-full text-balance whitespace-normal"
            asChild
            variante="secundario"
            tamanho="compacto"
          >
            <Link href={`/cobrancas/${nota.cobrancaId}`}>Ver a cobrança</Link>
          </Botao>
          <Botao
            className="max-w-full text-balance whitespace-normal"
            asChild
            variante="secundario"
            tamanho="compacto"
          >
            <Link href={`/familias/${nota.familiaId}/contrato`}>
              Ver o contrato
            </Link>
          </Botao>
          {nota.temPdf ? (
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              iconeEsquerda={
                <FileText
                  className="size-4 max-w-full text-balance whitespace-normal"
                  aria-hidden="true"
                />
              }
            >
              <a
                href={`/notas/${nota.id}/arquivo/pdf`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Abrir o PDF
              </a>
            </Botao>
          ) : null}
          {nota.temXml ? (
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              iconeEsquerda={
                <Paperclip
                  className="size-4 max-w-full text-balance whitespace-normal"
                  aria-hidden="true"
                />
              }
            >
              <a
                href={`/notas/${nota.id}/arquivo/xml`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Abrir o XML
              </a>
            </Botao>
          ) : null}
        </div>
        {emitida && (!nota.temPdf || !nota.temXml) ? (
          <p className="text-apoio text-texto-2">
            {!nota.temPdf && !nota.temXml
              ? "Os arquivos desta nota não foram guardados aqui. O número vale; se precisar do PDF, baixe no portal do provedor."
              : !nota.temPdf
                ? "O PDF desta nota não foi guardado aqui."
                : "O XML desta nota não foi guardado aqui."}
          </p>
        ) : null}
      </section>

      {nota.status === "erro" && nota.erro ? (
        <FaixaAlerta
          variante="erro"
          titulo="O provedor não emitiu esta nota"
          acoes={
            nota.podeEmitir && nota.emissaoAutomatica ? (
              <Botao
                tamanho="compacto"
                iconeEsquerda={
                  <RefreshCw
                    className="size-4 max-w-full text-balance whitespace-normal"
                    aria-hidden="true"
                  />
                }
                carregando={ocupado}
                rotuloCarregando="Reenviando"
                onClick={() => executar(() => acaoEmitirNota(nota.id))}
              >
                Reenviar a nota
              </Botao>
            ) : null
          }
        >
          {nota.erro}
        </FaixaAlerta>
      ) : null}

      <Mensagem estado={estado} />
      {/* O aviso do registro manual fica fora da seção: ao registrar, a seção sai da tela. */}
      {estadoManual.sucesso ? (
        <Mensagem estado={{ sucesso: estadoManual.sucesso }} />
      ) : null}

      {!emitida && !cancelada ? (
        <section
          aria-labelledby="emissao"
          className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
        >
          <h2
            id="emissao"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="dourado" forma="quadrado" tamanho="p">
              <FileText />
            </TileIcone>
            Emitir a nota
          </h2>
          {nota.status === "processando" ? (
            <>
              <p className="text-corpo text-texto">
                O pedido está no provedor
                {nota.providerRef
                  ? ""
                  : ", mas ainda sem referência para consultar"}
                . Toque em Consultar para ver se a nota saiu.
              </p>
              <div>
                <Botao
                  variante="secundario"
                  disabled={!nota.podeConsultar}
                  carregando={ocupado}
                  rotuloCarregando="Consultando"
                  iconeEsquerda={
                    <RefreshCw
                      className="size-4 max-w-full text-balance whitespace-normal"
                      aria-hidden="true"
                    />
                  }
                  onClick={() => executar(() => acaoConsultarNota(nota.id))}
                >
                  Consultar no provedor
                </Botao>
              </div>
            </>
          ) : null}

          {nota.podeEmitir &&
          nota.emissaoAutomatica &&
          nota.status !== "erro" ? (
            <div className="flex flex-col gap-2">
              <p className="text-corpo text-texto">
                O sistema emite a nota sozinho depois do pagamento. Se ela ainda
                está aqui, envie ao provedor agora.
              </p>
              <div>
                <Botao
                  carregando={ocupado}
                  rotuloCarregando="Enviando"
                  iconeEsquerda={
                    <Send
                      className="size-4 max-w-full text-balance whitespace-normal"
                      aria-hidden="true"
                    />
                  }
                  onClick={() => executar(() => acaoEmitirNota(nota.id))}
                >
                  Emitir a nota pelo provedor
                </Botao>
              </div>
            </div>
          ) : null}

          {nota.podeEmitir ? (
            <div className="border-linha flex flex-col gap-4 border-t pt-4">
              <div>
                <h3 className="text-corpo text-texto font-semibold">
                  Emitir à mão, com a contadora
                </h3>
                <p className="text-apoio text-texto-2 mt-1 max-w-[60ch]">
                  Emita no portal do provedor com os dados abaixo e registre
                  aqui o número, a data e, se tiver, o PDF e o XML.
                </p>
              </div>
              {semDados ? (
                <dl aria-label="Dados para emitir a nota">
                  <LinhaDado rotulo="Quem paga" valor={semDados.tomadorNome} />
                  <LinhaDado rotulo="CPF" valor={semDados.tomadorCpf} />
                  <LinhaDado rotulo="E-mail" valor={semDados.tomadorEmail} />
                  <LinhaDado rotulo="Endereço" valor={semDados.endereco} />
                  <LinhaDado rotulo="Valor" valor={semDados.valor} />
                  <LinhaDado
                    rotulo="Código do serviço"
                    valor={semDados.codigoServico}
                  />
                  <LinhaDado
                    rotulo="Descrição do serviço"
                    valor={semDados.descricaoServico}
                  />
                </dl>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-apoio text-texto-2">
                    O CPF de quem paga só aparece sob pedido, e a abertura fica
                    registrada.
                  </p>
                  <div>
                    <Botao
                      className="max-w-full text-balance whitespace-normal"
                      variante="secundario"
                      tamanho="compacto"
                      carregando={ocupado}
                      rotuloCarregando="Abrindo"
                      onClick={() =>
                        executar(() => acaoVerDadosDaNota(nota.id))
                      }
                    >
                      Ver os dados para emitir
                    </Botao>
                  </div>
                </div>
              )}

              <form
                onSubmit={aoEnviarManual}
                className="flex max-w-[520px] flex-col gap-4"
                noValidate
              >
                <input type="hidden" name="notaId" value={nota.id} />
                <CampoTexto
                  rotulo="Número da nota"
                  name="numero"
                  maxLength={60}
                  erro={estadoManual.campos?.numero}
                  autoComplete="off"
                />
                <CampoTexto
                  rotulo="Data de emissão"
                  name="emitidaEm"
                  type="date"
                  erro={estadoManual.campos?.emitidaEm}
                  containerClassName="max-w-[240px]"
                />
                <CampoTexto
                  rotulo="Provedor"
                  name="provedor"
                  maxLength={60}
                  opcional
                  descricao="Por exemplo o portal em que a contadora emitiu."
                />
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="nota-pdf"
                    className="text-apoio text-texto font-semibold"
                  >
                    PDF da nota{" "}
                    <span className="text-texto-2 font-normal">(opcional)</span>
                  </label>
                  <input
                    id="nota-pdf"
                    name="pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) =>
                      definirNomePdf(e.target.files?.[0]?.name ?? null)
                    }
                    className="text-corpo text-texto"
                    aria-describedby={
                      estadoManual.campos?.pdf ? "nota-pdf-erro" : undefined
                    }
                  />
                  {nomePdf ? <span className="sr-only">{nomePdf}</span> : null}
                  {estadoManual.campos?.pdf ? (
                    <p
                      id="nota-pdf-erro"
                      role="alert"
                      className="text-apoio text-alerta font-medium"
                    >
                      {estadoManual.campos.pdf}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="nota-xml"
                    className="text-apoio text-texto font-semibold"
                  >
                    XML da nota{" "}
                    <span className="text-texto-2 font-normal">(opcional)</span>
                  </label>
                  <input
                    id="nota-xml"
                    name="xml"
                    type="file"
                    accept="application/xml,text/xml,.xml"
                    onChange={(e) =>
                      definirNomeXml(e.target.files?.[0]?.name ?? null)
                    }
                    className="text-corpo text-texto"
                    aria-describedby={
                      estadoManual.campos?.xml ? "nota-xml-erro" : undefined
                    }
                  />
                  {nomeXml ? <span className="sr-only">{nomeXml}</span> : null}
                  {estadoManual.campos?.xml ? (
                    <p
                      id="nota-xml-erro"
                      role="alert"
                      className="text-apoio text-alerta font-medium"
                    >
                      {estadoManual.campos.xml}
                    </p>
                  ) : null}
                </div>
                <Mensagem estado={{ erro: estadoManual.erro }} />
                <div>
                  <Botao
                    className="max-w-full text-balance whitespace-normal"
                    type="submit"
                    variante="secundario"
                    carregando={registrando}
                    rotuloCarregando="Registrando"
                  >
                    Registrar a nota emitida
                  </Botao>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {demonstracao ? (
        <section
          aria-labelledby="demo"
          className="rounded-3 border-marinho-50 flex flex-col gap-3 border-[1.5px] border-dashed p-5"
        >
          <h2 id="demo" className="text-3 text-texto font-semibold">
            Só na demonstração
          </h2>
          <p className="text-apoio text-texto-2">
            O provedor é de mentira. Ligue a emissão automática e combine uma
            falha para ver o motivo e o reenvio.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao
              className="max-w-full text-balance whitespace-normal"
              variante="secundario"
              tamanho="compacto"
              onClick={() =>
                executar(() =>
                  acaoAjustarDemonstracaoNota(
                    nota.id,
                    nota.emissaoAutomatica
                      ? "automatica_desligada"
                      : "automatica_ligada",
                  ),
                )
              }
            >
              {nota.emissaoAutomatica
                ? "Desligar a emissão automática"
                : "Ligar a emissão automática"}
            </Botao>
            <Botao
              className="max-w-full text-balance whitespace-normal"
              variante="secundario"
              tamanho="compacto"
              onClick={() =>
                executar(() =>
                  acaoAjustarDemonstracaoNota(nota.id, "falha_proxima"),
                )
              }
            >
              Simular falha na próxima emissão
            </Botao>
          </div>
        </section>
      ) : null}
    </div>
  );
}
