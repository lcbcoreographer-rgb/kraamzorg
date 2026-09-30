"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import {
  situacaoGuardada,
  type SituacaoArmazenamento,
} from "@/lib/pwa/armazenamento";
import {
  desligarPush,
  ligarPush,
  situacaoDoPush,
  type SituacaoPush,
} from "@/lib/push/cliente";
import { TituloSecao } from "../comum/titulo-secao";
import { TEXTOS_ARMAZENAMENTO, TEXTOS_AVISOS } from "./textos";

const MENSAGEM: Record<SituacaoPush, string> = {
  sem_suporte: TEXTOS_AVISOS.semSuporte,
  sem_chave: TEXTOS_AVISOS.semChave,
  bloqueado: TEXTOS_AVISOS.bloqueado,
  desligado: TEXTOS_AVISOS.desligado,
  ligado: TEXTOS_AVISOS.ligado,
};

/**
 * Cartão do perfil da enfermeira (P11 itens 3 e 4): liga e desliga o aviso no
 * celular (Web Push) e diz se o navegador está guardando com segurança o que
 * ela registra sem sinal. O aviso nunca leva nome de família.
 */
export function AvisosNoAparelho() {
  const [situacao, definirSituacao] = useState<SituacaoPush | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [falhou, definirFalhou] = useState(false);
  const [armazenamento, definirArmazenamento] =
    useState<SituacaoArmazenamento | null>(null);

  useEffect(() => {
    let ativo = true;
    void situacaoDoPush().then((s) => ativo && definirSituacao(s));
    // A leitura vem de fora do React (localStorage do aparelho).
    const lido = window.setTimeout(() => {
      if (ativo) definirArmazenamento(situacaoGuardada());
    }, 0);
    return () => {
      ativo = false;
      window.clearTimeout(lido);
    };
  }, []);

  const alternar = useCallback(async () => {
    definirOcupado(true);
    definirFalhou(false);
    try {
      if (situacao === "ligado") {
        await desligarPush();
        definirSituacao(await situacaoDoPush());
      } else {
        const depois = await ligarPush();
        definirSituacao(depois);
        definirFalhou(depois === "desligado");
      }
    } finally {
      definirOcupado(false);
    }
  }, [situacao]);

  const podeAlternar = situacao === "ligado" || situacao === "desligado";
  const textoArmazenamento = armazenamento
    ? TEXTOS_ARMAZENAMENTO[armazenamento]
    : "";

  return (
    <section
      aria-labelledby="p-avisos"
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
    >
      <TituloSecao
        id="p-avisos"
        icone={<BellRing />}
        tom="argila"
        titulo={TEXTOS_AVISOS.titulo}
      />
      <p className="text-corpo text-texto-2 max-w-[52ch]">
        {TEXTOS_AVISOS.texto}
      </p>
      {situacao ? (
        <p role="status" className="text-corpo text-texto max-w-[52ch]">
          {MENSAGEM[situacao]}
        </p>
      ) : null}
      {falhou ? (
        <p role="alert" className="text-apoio text-alerta max-w-[52ch]">
          {TEXTOS_AVISOS.falhou}
        </p>
      ) : null}
      {podeAlternar ? (
        <Botao
          type="button"
          variante={situacao === "ligado" ? "secundario" : "primario"}
          onClick={alternar}
          disabled={ocupado}
          className="self-start"
        >
          {ocupado
            ? TEXTOS_AVISOS.trabalhando
            : situacao === "ligado"
              ? TEXTOS_AVISOS.desligar
              : TEXTOS_AVISOS.ligar}
        </Botao>
      ) : null}
      {textoArmazenamento ? (
        <p className="text-apoio text-texto-2 max-w-[52ch]">
          {textoArmazenamento}
        </p>
      ) : null}
    </section>
  );
}
