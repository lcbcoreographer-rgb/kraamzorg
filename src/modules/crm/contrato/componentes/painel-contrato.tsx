"use client";

import * as React from "react";
import Link from "next/link";
import {
  CircleCheck,
  FileText,
  LockKeyhole,
  PenLine,
  Send,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { TileIcone } from "@/components/ui/tile-icone";
import {
  Dialogo,
  DialogoConteudo,
  DialogoFechar,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { ProgressoEtapas } from "@/components/ui/progresso-etapas";
import { Selo } from "@/components/ui/selo";
import type {
  EtapaContrato,
  SituacaoContrato,
} from "@/lib/dados/tipos-contrato";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
} from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import {
  acaoEnviarContrato,
  acaoGerarContrato,
  acaoLiberarEnvio,
  acaoSimularAssinatura,
} from "../acoes";
import { acaoGerarCobranca } from "@/modules/financeiro/cobrancas/acoes";

const ETAPAS = ["dados", "contrato", "envio", "assinatura", "cobranca"];
const NOMES_ETAPAS = [
  "Dados da família",
  "Gerar o contrato",
  "Enviar para assinatura",
  "Assinaturas",
  "Cobrança",
];

/** Em que bloco da régua o contrato está (0 a 4). */
function blocoAtual(etapa: EtapaContrato): number {
  switch (etapa) {
    case "pronto_para_gerar":
      return 1;
    case "gerado":
      return 2;
    case "envio_em_andamento":
    case "aguardando_assinatura":
      return 3;
    case "assinado":
      return 4;
    default:
      return 0;
  }
}

const PAPEL_ASSINANTE: Record<string, string> = {
  gestante: "Gestante",
  kraamzorg: "Pela Kraamzorg",
  testemunha: "Testemunha",
};

const ROTULO_COBRANCA: Record<string, string> = {
  aberta: "Aguardando o pagamento",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

/**
 * Contrato e assinatura eletrônica, do lado da equipe (P31). Uma pergunta
 * por vez: o painel mostra só o próximo passo da etapa em que o contrato
 * está. O PDF é gerado pelo servidor a partir dos dados do formulário
 * seguro; o envio à Autentique passa por uma confirmação que lista quem vai
 * receber.
 */
export function PainelContrato({
  situacao,
  demonstracao,
}: {
  situacao: SituacaoContrato;
  demonstracao: boolean;
}) {
  const { contrato, familia } = situacao;
  const [erro, definirErro] = React.useState<string | null>(null);
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [confirmando, definirConfirmando] = React.useState(false);
  const [gerando, iniciarGeracao] = React.useTransition();
  const [enviando, iniciarEnvio] = React.useTransition();
  const [liberando, iniciarLiberacao] = React.useTransition();
  const [simulando, iniciarSimulacao] = React.useTransition();
  const [geraCobranca, iniciarCobranca] = React.useTransition();

  const propostaHref = `/familias/${familia.id}/proposta`;
  const pdfHref = `/familias/${familia.id}/contrato/pdf`;

  if (!contrato) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        titulo="Esta família ainda não tem proposta"
        texto="O contrato sai da proposta e dos dados que a família manda pelo formulário seguro."
        acao={
          <Botao asChild variante="secundario" tamanho="compacto">
            <Link href={propostaHref}>Ir para a proposta</Link>
          </Botao>
        }
      />
    );
  }

  const etapa = contrato.etapa;
  const cobranca = situacao.cobrancas[0] ?? null;
  const atual = blocoAtual(etapa);
  const primeiroNome = (situacao.assinantes[0]?.nome ?? "A família").split(
    " ",
  )[0];

  function executar(
    iniciar: (cb: () => Promise<void>) => void,
    chamar: () => Promise<{ erro?: string; sucesso?: string }>,
    aoFinal?: () => void,
  ) {
    definirErro(null);
    definirAviso(null);
    iniciar(async () => {
      const resultado = await chamar();
      if (resultado.erro) definirErro(resultado.erro);
      else definirAviso(resultado.sucesso ?? null);
      aoFinal?.();
    });
  }

  const gerar = () =>
    executar(iniciarGeracao, () => acaoGerarContrato(familia.id, contrato.id));
  const enviar = () =>
    executar(
      iniciarEnvio,
      () => acaoEnviarContrato(familia.id, contrato.id),
      () => definirConfirmando(false),
    );
  const liberar = () =>
    executar(iniciarLiberacao, () => acaoLiberarEnvio(familia.id, contrato.id));
  const simular = () =>
    executar(iniciarSimulacao, () =>
      acaoSimularAssinatura(familia.id, contrato.id),
    );

  const gerarCobranca = () =>
    executar(iniciarCobranca, () => acaoGerarCobranca(contrato.id, familia.id));

  const semFormulario =
    etapa === "sem_formulario" ||
    etapa === "aguardando_dados" ||
    etapa === "formulario_vencido";

  return (
    <div className="flex flex-col gap-6">
      {situacao.sensivel ? (
        <FaixaAlerta
          variante="sensivel"
          titulo="Esta família está com o freio acionado ou pediu para não ser contatada"
        >
          Nada do contrato sai enquanto isso valer: nem o PDF, nem o envio. O
          contato é da coordenação, pelo nome.
        </FaixaAlerta>
      ) : null}

      {!situacao.modelo.aprovado ? (
        <FaixaAlerta
          variante="prioritario"
          titulo="Modelo de contrato provisório"
        >
          O modelo {situacao.modelo.versao ?? ""} ainda espera a aprovação do
          jurídico e do Leonardo. Ele só vai para a Autentique de teste, sem
          validade, até ser aprovado em Configurações.
        </FaixaAlerta>
      ) : null}

      {/* O andamento num bloco próprio (direção "Colo"): a frase da etapa
          em cima, os blocos das cinco etapas embaixo. */}
      <section
        aria-label="Andamento do contrato"
        className="rounded-3 bg-areia-clara flex flex-col gap-3 p-5"
      >
        <p className="text-3 text-texto font-semibold" aria-live="polite">
          Etapa {atual + 1} de {ETAPAS.length}: {NOMES_ETAPAS[atual]}.
        </p>
        <ProgressoEtapas etapas={ETAPAS} atual={atual} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* O trabalho da etapa em branco; assinado, o bloco vira o que está
            feito (sálvia, DESIGN.md 2.5). */}
        <section
          className={cn(
            "rounded-3 flex flex-col gap-4 p-5 lg:p-6",
            etapa === "assinado" ? "bg-salvia-clara" : "bg-superficie shadow-1",
          )}
        >
          {semFormulario ? (
            <>
              <h2 className="text-3 text-texto font-semibold">
                O contrato sai depois do formulário
              </h2>
              <p className="text-corpo text-texto-2">
                {etapa === "formulario_vencido"
                  ? "O link do formulário venceu sem resposta. Gere outro na proposta."
                  : etapa === "aguardando_dados"
                    ? `O link do formulário está com ${primeiroNome}. Quando ela mandar os dados, o contrato aparece aqui pronto para gerar.`
                    : "Gere o link do formulário na proposta e envie para a família. Quando os dados chegarem, o contrato aparece aqui pronto para gerar."}
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <Link href={propostaHref}>Ir para a proposta</Link>
              </Botao>
            </>
          ) : null}

          {etapa === "pronto_para_gerar" ? (
            <>
              <h2 className="text-3 text-texto font-semibold">
                Os dados chegaram
              </h2>
              <p className="text-corpo text-texto-2">
                {contrato.formularioRecebidoEm
                  ? `A família mandou os dados em ${formatarDataHora(contrato.formularioRecebidoEm)}. `
                  : ""}
                O contrato sai a partir deles. Ao gerar, a leitura do CPF fica
                registrada.
              </p>
              <Botao
                onClick={gerar}
                carregando={gerando}
                rotuloCarregando="Gerando"
                disabled={!situacao.podeGerar}
                iconeEsquerda={
                  <FileText className="size-4" aria-hidden="true" />
                }
                className="self-start"
              >
                Gerar o contrato
              </Botao>
            </>
          ) : null}

          {etapa === "gerado" ? (
            <>
              <h2 className="text-3 text-texto font-semibold">
                Contrato gerado
              </h2>
              <p className="text-corpo text-texto-2">
                Abra o PDF e confira nome, CPF, pacote e valores. Depois do
                envio o contrato não muda mais.
              </p>
              <div className="flex flex-wrap gap-2">
                <Botao
                  asChild
                  variante="secundario"
                  iconeEsquerda={
                    <FileText className="size-4" aria-hidden="true" />
                  }
                >
                  <a href={pdfHref} target="_blank" rel="noreferrer noopener">
                    Abrir o PDF
                  </a>
                </Botao>
                <Botao
                  variante="secundario"
                  onClick={gerar}
                  carregando={gerando}
                  rotuloCarregando="Gerando"
                  disabled={!situacao.podeGerar}
                >
                  Gerar de novo
                </Botao>
                <Botao
                  onClick={() => definirConfirmando(true)}
                  disabled={!situacao.podeEnviar}
                  iconeEsquerda={<Send className="size-4" aria-hidden="true" />}
                >
                  Enviar para assinatura
                </Botao>
              </div>
            </>
          ) : null}

          {etapa === "envio_em_andamento" ? (
            <>
              <h2 className="text-3 text-texto font-semibold">
                Um envio ficou em andamento
              </h2>
              <FaixaAlerta
                variante="prioritario"
                titulo="Confira o painel da Autentique antes de mexer"
                anunciar={false}
              >
                Se o documento está lá, é só aguardar as assinaturas. Se não
                está, toque em Liberar o envio e envie de novo. Assim a
                Kraamzorg nunca cria dois documentos.
              </FaixaAlerta>
              <Botao
                variante="secundario"
                onClick={liberar}
                carregando={liberando}
                rotuloCarregando="Liberando"
                className="self-start"
              >
                Liberar o envio
              </Botao>
            </>
          ) : null}

          {etapa === "aguardando_assinatura" ? (
            <>
              <h2 className="text-3 text-texto font-semibold">
                Aguardando as assinaturas
              </h2>
              <p className="text-corpo text-texto-2">
                {contrato.enviadoEm
                  ? `Enviado em ${formatarDataHora(contrato.enviadoEm)}. `
                  : ""}
                A Autentique avisa a Kraamzorg quando todos assinarem, e a
                cobrança sai sozinha.
              </p>
              <div className="flex flex-wrap gap-2">
                <Botao asChild variante="secundario" tamanho="compacto">
                  <a href={pdfHref} target="_blank" rel="noreferrer noopener">
                    Abrir o PDF enviado
                  </a>
                </Botao>
                {demonstracao ? (
                  <Botao
                    variante="secundario"
                    tamanho="compacto"
                    onClick={simular}
                    carregando={simulando}
                    rotuloCarregando="Simulando"
                  >
                    Simular a assinatura (demonstração)
                  </Botao>
                ) : null}
              </div>
            </>
          ) : null}

          {etapa === "assinado" ? (
            <>
              <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
                <TileIcone tom="salvia" forma="quadrado">
                  <CircleCheck />
                </TileIcone>
                Contrato assinado
                {contrato.assinadoEm
                  ? ` em ${formatarData(contrato.assinadoEm)}`
                  : ""}
              </h2>
              <p className="text-corpo text-texto-2">
                O PDF assinado fica guardado em um lugar privado.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <a href={pdfHref} target="_blank" rel="noreferrer noopener">
                  Abrir o PDF assinado
                </a>
              </Botao>
              <div className="rounded-3 bg-superficie flex flex-col gap-2 p-4">
                <h3 className="text-corpo text-texto font-semibold">
                  Cobrança
                </h3>
                {cobranca ? (
                  <p className="text-corpo text-texto-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Selo
                      variante={
                        cobranca.status === "paga"
                          ? "sucesso"
                          : cobranca.status === "vencida"
                            ? "alerta"
                            : "aviso"
                      }
                    >
                      {ROTULO_COBRANCA[cobranca.status]}
                    </Selo>
                    <span>
                      Vence em{" "}
                      <span className="font-mono">
                        {formatarData(cobranca.vencimento)}
                      </span>
                      {cobranca.valorCentavos !== null
                        ? `, ${formatarMoeda(cobranca.valorCentavos)}`
                        : ""}
                      .
                    </span>
                  </p>
                ) : (
                  <p className="text-corpo text-texto-2">
                    A cobrança ainda não foi gerada.
                    {situacao.podeVerCobranca
                      ? " Ela sai sozinha depois da assinatura; se não saiu, gere agora."
                      : " O financeiro ou a diretoria geram."}
                  </p>
                )}
                {situacao.podeVerCobranca && !cobranca ? (
                  <Botao
                    variante="secundario"
                    tamanho="compacto"
                    onClick={gerarCobranca}
                    carregando={geraCobranca}
                    rotuloCarregando="Gerando"
                    className="self-start"
                  >
                    Gerar a cobrança
                  </Botao>
                ) : null}
                {situacao.podeVerCobranca && cobranca?.id ? (
                  <Botao
                    asChild
                    variante="secundario"
                    tamanho="compacto"
                    className="self-start"
                  >
                    <Link href={`/cobrancas/${cobranca.id}`}>
                      Ver a cobrança
                    </Link>
                  </Botao>
                ) : null}
              </div>
            </>
          ) : null}

          {erro ? <FaixaAlerta variante="erro" titulo={erro} /> : null}
          {aviso ? (
            <p role="status" className="text-apoio text-texto">
              {aviso}
            </p>
          ) : null}
        </section>

        <aside aria-label="Resumo do contrato" className="flex flex-col gap-3">
          <div className="rounded-3 bg-argila-clara flex flex-col gap-2 p-5">
            <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
              <TileIcone tom="argila" forma="quadrado" tamanho="p">
                <PenLine />
              </TileIcone>
              Quem assina
            </h2>
            <ul className="flex flex-col gap-2">
              {situacao.assinantes.map((a) => (
                <li key={a.papel} className="flex flex-col">
                  <span className="text-apoio text-texto-2">
                    {PAPEL_ASSINANTE[a.papel]}
                  </span>
                  <span className="text-corpo text-texto">
                    {a.nome ?? "Sem nome"}
                    {a.email ? (
                      <span className="text-texto-2 text-apoio font-mono">
                        {" "}
                        {a.email}
                      </span>
                    ) : null}
                  </span>
                  {!a.temContato ? (
                    <span className="text-apoio text-alerta">
                      Sem e-mail nem telefone. Peça na ficha.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {contrato.conta ? (
            <div className="rounded-3 bg-areia-clara flex flex-col gap-1 p-5">
              <h2 className="font-titulo text-2 text-texto font-medium">
                {contrato.variante === "presente"
                  ? "Contrato de presente"
                  : "Valores"}
              </h2>
              {contrato.variante === "presente" ? (
                <p className="text-apoio text-texto-2">
                  O contrato da gestante sai sem valores. Quem presenteia paga,
                  e o valor total é{" "}
                  <span className="font-mono">
                    {formatarMoeda(contrato.conta.totalCentavos)}
                  </span>
                  .
                </p>
              ) : (
                <p className="text-apoio text-texto-2">
                  Total de{" "}
                  <span className="font-mono">
                    {formatarMoeda(contrato.conta.totalCentavos)}
                  </span>
                  {contrato.conta.parcelas > 1
                    ? `, no cartão em até ${contrato.conta.parcelas} vezes sem juros`
                    : ", à vista"}
                  .
                </p>
              )}
            </div>
          ) : null}

          <p className="text-apoio text-texto-2 flex items-start gap-2 px-2">
            <LockKeyhole
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            Modelo {contrato.templateVersao}. O PDF fica guardado com nome pelo
            número do contrato, nunca pelo nome da família.
          </p>
        </aside>
      </div>

      <Dialogo open={confirmando} onOpenChange={definirConfirmando}>
        <DialogoConteudo
          titulo="Enviar para assinatura?"
          descricao="A Autentique manda o contrato por e-mail para as pessoas abaixo. Depois do envio, o PDF não muda mais."
          rotuloFechar="Fechar e revisar o PDF"
        >
          <ul className="flex flex-col gap-2">
            {situacao.assinantes.map((a) => (
              <li key={a.papel} className="text-corpo text-texto">
                <span className="text-texto-2">
                  {PAPEL_ASSINANTE[a.papel]}:{" "}
                </span>
                {a.nome ?? "Sem nome"}
                {a.email ? ` (${a.email})` : ""}
              </li>
            ))}
          </ul>
          <DialogoRodape>
            <DialogoFechar asChild>
              <Botao variante="secundario">Revisar o PDF</Botao>
            </DialogoFechar>
            <Botao
              onClick={enviar}
              carregando={enviando}
              rotuloCarregando="Enviando"
            >
              Enviar agora
            </Botao>
          </DialogoRodape>
        </DialogoConteudo>
      </Dialogo>
    </div>
  );
}
