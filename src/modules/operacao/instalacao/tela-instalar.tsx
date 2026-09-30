"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { plataformaDoNavegador } from "@/lib/pwa/plataforma";
import { registrarServiceWorker } from "@/lib/pwa/service-worker";
import { CONTEUDO, TEXTOS_INSTALAR } from "./textos";

/** O evento que o Chrome dispara quando o app pode ser instalado. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const semAssinatura = () => () => undefined;

/**
 * Instalação guiada (P11 item 2). Reconhece Android com Chrome, iPhone no
 * Safari, iPhone em outro navegador (orienta abrir no Safari) e computador, e
 * mostra o passo a passo curto de cada um. Quando o navegador oferece a
 * instalação (`beforeinstallprompt`), aparece o botão "Instalar agora".
 *
 * A plataforma vem do navegador depois de montar, para o HTML do servidor e o
 * da primeira pintura serem iguais.
 */
export function TelaInstalar() {
  const plataforma = useSyncExternalStore(
    semAssinatura,
    plataformaDoNavegador,
    () => null,
  );
  const [oferta, definirOferta] = useState<EventoInstalar | null>(null);
  const [aguardando, definirAguardando] = useState(false);
  const [instaladoAgora, definirInstaladoAgora] = useState(false);
  const [copiado, definirCopiado] = useState<"sim" | "nao" | null>(null);

  useEffect(() => {
    void registrarServiceWorker();
    const aoOferecer = (evento: Event) => {
      evento.preventDefault();
      definirOferta(evento as EventoInstalar);
    };
    const aoInstalar = () => {
      definirOferta(null);
      definirInstaladoAgora(true);
    };
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoOferecer);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  const instalar = useCallback(async () => {
    if (!oferta) return;
    definirAguardando(true);
    try {
      await oferta.prompt();
      const { outcome } = await oferta.userChoice;
      if (outcome === "accepted") definirInstaladoAgora(true);
    } finally {
      definirOferta(null);
      definirAguardando(false);
    }
  }, [oferta]);

  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/instalar`);
      definirCopiado("sim");
    } catch {
      definirCopiado("nao");
    }
  }, []);

  if (!plataforma) {
    return (
      <p role="status" className="text-corpo text-texto-2">
        {TEXTOS_INSTALAR.carregando}
      </p>
    );
  }

  const conteudo = CONTEUDO[plataforma];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-titulo text-display text-texto font-normal">
          {TEXTOS_INSTALAR.titulo}
        </h1>
        <p className="text-corpo text-texto max-w-[52ch]">
          {TEXTOS_INSTALAR.abertura}
        </p>
      </div>

      <Cartao
        variante="plano"
        className="flex flex-col gap-4"
        aria-labelledby="instalar-plataforma"
        data-plataforma={plataforma}
      >
        <h2
          id="instalar-plataforma"
          className="font-titulo text-2 text-texto font-medium"
        >
          {conteudo.titulo}
        </h2>
        <p className="text-corpo text-texto-2 max-w-[52ch]">{conteudo.texto}</p>

        {instaladoAgora ? (
          <p role="status" className="text-corpo text-sucesso font-medium">
            {TEXTOS_INSTALAR.instaladoAgora}
          </p>
        ) : null}

        {conteudo.botaoInstalar && oferta && !instaladoAgora ? (
          <Botao
            type="button"
            onClick={instalar}
            disabled={aguardando}
            iconeEsquerda={<Download aria-hidden className="size-5" />}
            className="self-start"
          >
            {aguardando
              ? TEXTOS_INSTALAR.instalando
              : TEXTOS_INSTALAR.instalarAgora}
          </Botao>
        ) : null}

        {conteudo.copiarEndereco ? (
          <div className="flex flex-col gap-2">
            <Botao
              type="button"
              variante="secundario"
              onClick={copiar}
              className="self-start"
            >
              {copiado === "sim"
                ? TEXTOS_INSTALAR.enderecoCopiado
                : TEXTOS_INSTALAR.copiarEndereco}
            </Botao>
            {copiado === "nao" ? (
              <p role="status" className="text-apoio text-texto-2">
                {TEXTOS_INSTALAR.copiarFalhou}
              </p>
            ) : null}
            {copiado === "nao" ? (
              <p className="text-apoio text-texto font-mono break-all">
                {typeof window === "undefined"
                  ? ""
                  : `${window.location.origin}/instalar`}
              </p>
            ) : null}
          </div>
        ) : null}

        {conteudo.passos.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-apoio text-texto font-semibold">
              {TEXTOS_INSTALAR.passosTitulo}
            </h3>
            <ol className="text-corpo text-texto flex list-decimal flex-col gap-2 pl-5">
              {conteudo.passos.map((passo) => (
                <li key={passo} className="max-w-[52ch] pl-1">
                  {passo}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {conteudo.aviso ? (
          <p className="text-apoio text-texto-2 max-w-[52ch]">
            {conteudo.aviso}
          </p>
        ) : null}
      </Cartao>

      <p className="text-corpo text-texto-2 max-w-[52ch]">
        {TEXTOS_INSTALAR.depois}
      </p>

      <div className="flex flex-wrap gap-3">
        <Botao
          asChild
          variante={plataforma === "instalado" ? "primario" : "secundario"}
        >
          <Link href={plataforma === "instalado" ? "/hoje" : "/entrar"}>
            {plataforma === "instalado"
              ? TEXTOS_INSTALAR.abrirHoje
              : TEXTOS_INSTALAR.irParaEntrar}
          </Link>
        </Botao>
      </div>
    </div>
  );
}
