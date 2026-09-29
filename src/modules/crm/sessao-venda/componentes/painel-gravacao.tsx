"use client";

import * as React from "react";
import { useActionState } from "react";
import { FileText } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { GravacaoSessao } from "@/lib/dados/tipos-venda";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoRegistrarGravacao } from "../acoes";
import { estadoInicialSessao } from "../estado-acoes";
import { textoDaTranscricao } from "../resumo";

/**
 * Consentimento e transcrição da conversa (P29 item 3). O termo que a
 * pessoa lê para a família fica em areia (é a fala que vai para ela); a
 * resposta, a versão do termo e o horário ficam registrados. A transcrição
 * entra colada ou por arquivo de texto (.txt, ou .vtt do Meet, Zoom e
 * Teams), lido aqui no navegador: nada sobe antes de "Guardar".
 */
export function PainelGravacao({
  sessaoId,
  gravacao,
  termo,
}: {
  sessaoId: string;
  gravacao: GravacaoSessao | null;
  termo: string | null;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoRegistrarGravacao,
    estadoInicialSessao,
  );
  const [consentimento, definirConsentimento] = React.useState(
    gravacao ? (gravacao.consentimento ? "sim" : "nao") : "",
  );
  const [transcricao, definirTranscricao] = React.useState(
    gravacao?.transcricao ?? "",
  );
  const [avisoArquivo, definirAvisoArquivo] = React.useState<string | null>(
    null,
  );
  const idArquivo = React.useId();

  async function lerArquivo(arquivo: File | undefined) {
    definirAvisoArquivo(null);
    if (!arquivo) return;
    if (!/\.(txt|vtt)$/i.test(arquivo.name)) {
      definirAvisoArquivo(
        "Esse arquivo não é de texto. Use o .txt ou o .vtt da transcrição, ou cole o texto no campo.",
      );
      return;
    }
    try {
      definirTranscricao(textoDaTranscricao(await arquivo.text()));
    } catch {
      definirAvisoArquivo(
        "Não deu para ler esse arquivo. Abra no computador e cole o texto no campo.",
      );
    }
  }

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="sessaoId" value={sessaoId} />
      <input type="hidden" name="consentimento" value={consentimento} />

      {termo ? (
        <div className="rounded-2 bg-superficie-2 flex flex-col gap-2 p-4">
          <p className="text-apoio text-texto-2">
            Leia para a família antes de gravar
          </p>
          <p className="text-corpo text-texto max-w-leitura">{termo}</p>
        </div>
      ) : (
        <FaixaAlerta
          variante="prioritario"
          titulo="O termo de gravação ainda não tem texto aprovado"
        >
          Sem o texto, peça o consentimento com as suas palavras e registre a
          resposta. A diretoria aprova o texto em Configurações.
        </FaixaAlerta>
      )}

      <EscolhaUnica
        rotulo="A família autorizou a gravação?"
        name="consentimento-escolha"
        opcoes={[
          { valor: "sim", rotulo: "Autorizou" },
          { valor: "nao", rotulo: "Não autorizou" },
        ]}
        valor={consentimento}
        onMudar={definirConsentimento}
        descricao={
          gravacao?.consentimento && gravacao.consentimentoEm
            ? `Autorização registrada em ${formatarDataHora(gravacao.consentimentoEm)}, termo ${gravacao.consentimentoVersao ?? "sem versão"}.`
            : "Sem autorização, nada da conversa fica guardado."
        }
      />

      {consentimento === "sim" ? (
        <div className="flex flex-col gap-3">
          <CampoTexto
            rotulo="Transcrição da conversa"
            name="transcricao"
            multilinha
            linhas={10}
            value={transcricao}
            onChange={(evento) => definirTranscricao(evento.target.value)}
            opcional
            descricao="Cole o texto ou escolha o arquivo que o Meet, o Zoom ou o Teams gera."
          />
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={idArquivo}
              className="rounded-pilula border-borda-campo bg-superficie text-apoio text-texto hover:bg-marinho-08 min-h-toque has-[:focus-visible]:outline-foco inline-flex cursor-pointer items-center gap-2 border-[1.5px] px-4 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <FileText
                className="size-4"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              Escolher arquivo de texto
              <input
                id={idArquivo}
                type="file"
                accept=".txt,.vtt,text/plain,text/vtt"
                className="sr-only"
                onChange={(evento) => void lerArquivo(evento.target.files?.[0])}
              />
            </label>
            {avisoArquivo ? (
              <p role="alert" className="text-apoio text-alerta font-medium">
                {avisoArquivo}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} anunciar />
      ) : null}

      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Guardando"
        disabled={!consentimento}
        // Com a transcrição já guardada, o passo principal da tela passa a
        // ser o resumo (um primário por tela, DESIGN.md seção 6).
        variante={gravacao?.transcricao ? "secundario" : "primario"}
        className="self-start"
      >
        {consentimento === "nao" ? "Registrar que não autorizou" : "Guardar"}
      </Botao>
    </form>
  );
}
