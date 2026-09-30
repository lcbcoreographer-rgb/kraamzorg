"use client";

import * as React from "react";
import Link from "next/link";
import {
  CircleCheck,
  Copy,
  FileCheck,
  FileText,
  MessageCircle,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { TileIcone } from "@/components/ui/tile-icone";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { SituacaoFormulario } from "@/lib/dados/tipos-venda";
import { formatarDataHora } from "@/lib/formatacao";
import {
  acaoGerarLinkFormulario,
  acaoRegistrarEnvioFormulario,
} from "../acoes";
import type { ResultadoLinkFormulario } from "../estado-acoes";

/**
 * Formulário seguro do contrato, do lado da equipe (P30 itens 2 e 3). O
 * link vale uma vez e o banco só guarda o resumo dele: ele aparece aqui,
 * dentro do texto aprovado para a família, e some ao sair da tela. Gerar
 * outro invalida o anterior. "Abrir no WhatsApp" passa pelo adaptador de
 * mensageria (freio conferido antes do link existir); "Enviei" registra o
 * envio com o link trocado por uma marca e conclui a tarefa.
 */
export function PainelFormulario({
  familiaId,
  oportunidadeId,
  situacao,
  expiraEm,
  recebidoEm,
  validadeHoras,
  bloqueio,
}: {
  familiaId: string;
  oportunidadeId: string;
  situacao: SituacaoFormulario | null;
  expiraEm: string | null;
  recebidoEm: string | null;
  validadeHoras: number | null;
  /** Por que o link não pode sair agora (sem proposta, sem aprovação). */
  bloqueio: string | null;
}) {
  const [gerado, definirGerado] = React.useState<Extract<
    ResultadoLinkFormulario,
    { ok: true }
  > | null>(null);
  const [erro, definirErro] = React.useState<string | null>(null);
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const [gerando, iniciarGeracao] = React.useTransition();
  const [registrando, iniciarRegistro] = React.useTransition();

  function gerar() {
    definirErro(null);
    definirAviso(null);
    iniciarGeracao(async () => {
      const resultado = await acaoGerarLinkFormulario(
        oportunidadeId,
        familiaId,
      );
      if (resultado.ok) definirGerado(resultado);
      else definirErro(resultado.erro);
    });
  }

  function registrarEnvio() {
    if (!gerado?.tarefaId) return;
    definirErro(null);
    iniciarRegistro(async () => {
      const resultado = await acaoRegistrarEnvioFormulario(
        gerado.tarefaId!,
        familiaId,
      );
      if (resultado.erro) definirErro(resultado.erro);
      else {
        definirAviso(resultado.sucesso ?? null);
        definirGerado(null);
      }
    });
  }

  async function copiar() {
    if (!gerado) return;
    try {
      await navigator.clipboard.writeText(gerado.texto);
      definirAviso("Texto copiado, com o link. Cole na conversa da família.");
    } catch {
      definirAviso("Não deu para copiar daqui. Selecione o texto e copie.");
    }
  }

  if (situacao === "recebido") {
    return (
      <section className="rounded-3 bg-salvia-clara flex flex-col gap-3 p-5">
        <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
          <TileIcone tom="salvia" forma="quadrado" tamanho="p">
            <FileCheck />
          </TileIcone>
          Formulário do contrato
        </h2>
        <p className="text-corpo text-texto flex items-start gap-2 font-medium">
          <CircleCheck
            className="mt-1 size-4 shrink-0"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          Dados recebidos
          {recebidoEm ? ` em ${formatarDataHora(recebidoEm)}` : ""}.
        </p>
        <p className="text-corpo text-texto-2">
          O contrato sai a partir destes dados. O CPF fica mascarado na ficha,
          na aba Comercial.
        </p>
        <Botao
          asChild
          variante="secundario"
          tamanho="compacto"
          className="self-start"
        >
          <Link href={`/familias/${familiaId}/contrato`}>
            Preparar o contrato
          </Link>
        </Botao>
      </section>
    );
  }

  const frase =
    situacao === "aguardando" && expiraEm
      ? `Um link foi gerado e vale até ${formatarDataHora(expiraEm)}. Se a família perdeu a mensagem, gere outro: o anterior deixa de valer.`
      : situacao === "vencido"
        ? "O último link venceu sem resposta. Gere outro para a família."
        : validadeHoras
          ? `O link vale uma vez, por ${validadeHoras} horas. Ele aparece só aqui, no texto para a família.`
          : "O link vale uma vez e aparece só aqui, no texto para a família.";

  return (
    <section className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5">
      <h2 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="areia" forma="quadrado" tamanho="p">
          <FileText />
        </TileIcone>
        Formulário do contrato
      </h2>
      {bloqueio ? (
        <p className="text-corpo text-texto-2">{bloqueio}</p>
      ) : gerado ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-3 bg-argila-clara rounded-tl-1 flex flex-col gap-2 p-4">
            <p className="text-apoio text-texto-2">Texto para a família</p>
            <p
              className="text-corpo text-texto break-words"
              data-texto-formulario
            >
              {gerado.texto}
            </p>
          </div>
          <p className="text-apoio text-texto-2">
            Vale até {formatarDataHora(gerado.expiraEm)}. Nada sai antes de você
            tocar em enviar no WhatsApp.
          </p>
          {gerado.motivoSemWhatsapp ? (
            <FaixaAlerta
              variante="prioritario"
              titulo={gerado.motivoSemWhatsapp}
              anunciar={false}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {gerado.whatsapp ? (
              <Botao
                asChild
                iconeEsquerda={
                  <MessageCircle className="size-4" aria-hidden="true" />
                }
              >
                <a
                  href={gerado.whatsapp}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Abrir no WhatsApp
                </a>
              </Botao>
            ) : null}
            <Botao
              variante="secundario"
              onClick={() => void copiar()}
              iconeEsquerda={
                <Copy
                  className="size-4"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              }
            >
              Copiar o texto
            </Botao>
            {gerado.tarefaId ? (
              <Botao
                variante="secundario"
                onClick={registrarEnvio}
                carregando={registrando}
                rotuloCarregando="Registrando"
              >
                Enviei
              </Botao>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <p className="text-corpo text-texto-2">{frase}</p>
          <Botao
            onClick={gerar}
            carregando={gerando}
            rotuloCarregando="Gerando"
            variante={situacao === "aguardando" ? "secundario" : "primario"}
            className="self-start"
          >
            {situacao === "aguardando" || situacao === "vencido"
              ? "Gerar outro link"
              : "Gerar o link do formulário"}
          </Botao>
        </>
      )}
      {erro ? <FaixaAlerta variante="erro" titulo={erro} /> : null}
      {aviso ? (
        <p role="status" className="text-apoio text-texto">
          {aviso}
        </p>
      ) : null}
    </section>
  );
}
