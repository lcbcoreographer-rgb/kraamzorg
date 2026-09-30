"use client";

import * as React from "react";
import { Mic, Paperclip, Square } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { conferirAudio } from "@/lib/checklist/audio";
import {
  armazemDoAparelho,
  type ArmazemDeAudios,
  type AudioPendente,
} from "@/lib/checklist/rascunho";
import type {
  AudioDaVisita,
  ParametrosChecklist,
} from "@/lib/dados/tipos-assistencial";
import { textos } from "../checklist/textos";

/**
 * Áudio da visita (P39 item 6): grava ou anexa um áudio com o resumo. Vai
 * para o armazenamento privado por `POST /api/visitas/[id]/audio`; sem sinal,
 * fica no aparelho e sobe sozinho quando a conexão voltar. Ouvir pede uma
 * URL assinada de poucos segundos. A transcrição está desligada por
 * parâmetro (L-04): aqui só se anexa e se ouve.
 */
export interface GravadorAudioProps {
  visitaId: string;
  usuarioId: string;
  parametros: ParametrosChecklist;
  audios: AudioDaVisita[];
  /** Depois de anexar, a tela relê a visita. */
  aoAnexar: () => void;
  armazem?: ArmazemDeAudios;
  somenteLeitura?: boolean;
}

type Aviso = { tipo: "info" | "erro"; texto: string } | null;

export function GravadorAudio({
  visitaId,
  usuarioId,
  parametros,
  audios,
  aoAnexar,
  armazem,
  somenteLeitura,
}: GravadorAudioProps) {
  const [aviso, definirAviso] = React.useState<Aviso>(null);
  const [gravando, definirGravando] = React.useState(false);
  const [segundos, definirSegundos] = React.useState(0);
  const [enviando, definirEnviando] = React.useState(false);
  const [ouvindo, definirOuvindo] = React.useState<{
    id: string;
    url: string;
  } | null>(null);
  const [temMicrofone, definirTemMicrofone] = React.useState(false);
  const gravador = React.useRef<MediaRecorder | null>(null);
  const pedacos = React.useRef<Blob[]>([]);
  const cronometro = React.useRef<number | null>(null);
  const inicio = React.useRef(0);

  const guardado = React.useCallback(
    () => armazem ?? armazemDoAparelho(),
    [armazem],
  );

  React.useEffect(() => {
    const espera = window.setTimeout(
      () =>
        definirTemMicrofone(
          typeof MediaRecorder !== "undefined" &&
            Boolean(navigator.mediaDevices?.getUserMedia),
        ),
      0,
    );
    return () => window.clearTimeout(espera);
  }, []);

  const enviar = React.useCallback(
    async (conteudo: Blob, duracaoSeg: number | null): Promise<boolean> => {
      const dados = new FormData();
      dados.set(
        "arquivo",
        new File([conteudo], "audio", { type: conteudo.type }),
      );
      if (duracaoSeg !== null) dados.set("duracao", String(duracaoSeg));
      const resposta = await fetch(`/api/visitas/${visitaId}/audio`, {
        method: "POST",
        body: dados,
      });
      if (resposta.status === 422) {
        const corpo = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
        };
        definirAviso({
          tipo: "erro",
          texto:
            corpo.erro === "tipo_nao_aceito"
              ? textos.audio.tipoNaoAceito
              : textos.audio.grande,
        });
        return true; // recusa definitiva: não fica na fila
      }
      if (!resposta.ok) throw new Error(`áudio: ${resposta.status}`);
      return true;
    },
    [visitaId],
  );

  const enviarPendentes = React.useCallback(async () => {
    if (!navigator.onLine) return;
    const lista = await guardado().listar(visitaId);
    let algum = false;
    for (const audio of lista) {
      try {
        await enviar(audio.conteudo, audio.duracaoSeg);
        await guardado().remover(audio.id);
        algum = true;
      } catch {
        return; // sem conexão de verdade: tenta na próxima
      }
    }
    if (algum) {
      definirAviso({ tipo: "info", texto: textos.audio.enviado });
      aoAnexar();
    }
  }, [enviar, guardado, visitaId, aoAnexar]);

  React.useEffect(() => {
    const espera = window.setTimeout(() => void enviarPendentes(), 0);
    window.addEventListener("online", enviarPendentes);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener("online", enviarPendentes);
    };
  }, [enviarPendentes]);

  const receber = React.useCallback(
    async (conteudo: Blob, duracaoSeg: number | null) => {
      const problema = conferirAudio(parametros.audio, {
        tipo: conteudo.type,
        tamanhoBytes: conteudo.size,
        duracaoSeg,
      });
      if (problema) {
        definirAviso({
          tipo: "erro",
          texto:
            problema === "tipo"
              ? textos.audio.tipoNaoAceito
              : textos.audio.grande,
        });
        return;
      }
      definirEnviando(true);
      try {
        if (!navigator.onLine) throw new Error("sem sinal");
        await enviar(conteudo, duracaoSeg);
        definirAviso({ tipo: "info", texto: textos.audio.enviado });
        aoAnexar();
      } catch {
        const pendente: AudioPendente = {
          id: crypto.randomUUID(),
          visitaId,
          usuarioId,
          tipo: conteudo.type,
          duracaoSeg,
          conteudo,
          criadoEm: new Date().toISOString(),
        };
        await guardado().guardar(pendente);
        definirAviso({ tipo: "info", texto: textos.audio.salvoNoAparelho });
      } finally {
        definirEnviando(false);
      }
    },
    [parametros.audio, enviar, aoAnexar, guardado, visitaId, usuarioId],
  );

  async function comecar() {
    definirAviso(null);
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      pedacos.current = [];
      const g = new MediaRecorder(fluxo);
      g.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.current.push(e.data);
      };
      g.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop());
        const duracao = Math.max(
          1,
          Math.round((Date.now() - inicio.current) / 1000),
        );
        const tipo = g.mimeType || "audio/webm";
        void receber(new Blob(pedacos.current, { type: tipo }), duracao);
      };
      gravador.current = g;
      inicio.current = Date.now();
      g.start();
      definirGravando(true);
      definirSegundos(0);
      cronometro.current = window.setInterval(
        () => definirSegundos(Math.round((Date.now() - inicio.current) / 1000)),
        1000,
      );
    } catch {
      definirAviso({ tipo: "info", texto: textos.audio.naoTemMicrofone });
    }
  }

  function parar() {
    if (cronometro.current) window.clearInterval(cronometro.current);
    definirGravando(false);
    gravador.current?.stop();
  }

  function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (arquivo) void receber(arquivo, null);
  }

  async function ouvir(audio: AudioDaVisita) {
    try {
      const resposta = await fetch(
        `/api/visitas/${visitaId}/audio/${audio.id}`,
        {
          cache: "no-store",
        },
      );
      if (!resposta.ok) throw new Error(String(resposta.status));
      const corpo = (await resposta.json()) as { url: string };
      definirOuvindo({ id: audio.id, url: corpo.url });
    } catch {
      definirAviso({ tipo: "erro", texto: textos.audio.falhou });
    }
  }

  return (
    <section aria-labelledby="audio-titulo" className="flex flex-col gap-3">
      <h3 id="audio-titulo" className="text-3 text-texto font-semibold">
        {textos.audio.titulo}
      </h3>
      <p className="text-apoio text-texto-2">{textos.audio.ajuda}</p>

      {!somenteLeitura ? (
        <div className="flex flex-wrap gap-2">
          {temMicrofone ? (
            gravando ? (
              <Botao variante="secundario" onClick={parar}>
                <Square className="size-[18px]" aria-hidden="true" />
                {textos.audio.parar} · {textos.audio.gravando(segundos)}
              </Botao>
            ) : (
              <Botao
                variante="secundario"
                onClick={comecar}
                carregando={enviando}
              >
                <Mic className="size-[18px]" aria-hidden="true" />
                {textos.audio.gravar}
              </Botao>
            )
          ) : null}
          <Botao variante="secundario" asChild>
            <label className="cursor-pointer">
              <Paperclip className="size-[18px]" aria-hidden="true" />
              {textos.audio.anexar}
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                data-testid="anexar-audio"
                onChange={aoEscolherArquivo}
              />
            </label>
          </Botao>
        </div>
      ) : null}

      {aviso ? (
        <p
          role="status"
          className={
            aviso.tipo === "erro"
              ? "text-apoio text-alerta font-medium"
              : "text-apoio text-texto-2"
          }
        >
          {aviso.texto}
        </p>
      ) : null}

      {audios.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-apoio text-texto font-semibold">
            {textos.audio.lista}
          </p>
          <ul className="flex flex-col gap-2">
            {audios.map((audio, i) => (
              <li
                key={audio.id}
                className="rounded-2 border-linha flex flex-col gap-2 border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-corpo text-texto">
                    Áudio {i + 1}
                    {audio.duracaoSeg
                      ? ` · ${textos.audio.duracao(audio.duracaoSeg)}`
                      : ""}
                  </span>
                  <Botao
                    variante="secundario"
                    tamanho="compacto"
                    onClick={() => void ouvir(audio)}
                  >
                    {textos.audio.ouvir}
                  </Botao>
                </div>
                {ouvindo?.id === audio.id ? (
                  <>
                    <audio controls src={ouvindo.url} className="w-full" />
                    <p className="text-apoio text-texto-2">
                      {textos.audio.urlExpira(
                        parametros.audioUrlAssinadaSegundos,
                      )}
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!parametros.transcricaoAudioAtiva ? (
        <p className="text-apoio text-texto-2">{textos.audio.semTranscricao}</p>
      ) : null}
    </section>
  );
}
