"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  bancoOffline,
  encerrarSessaoOffline,
  enviarLotePorFetch,
  ESTADOS_PENDENTES,
  iniciarMotorSincronizacao,
  processarFila,
  type BancoOffline,
  type EnviarLote,
} from "@/lib/sync";
import {
  guardarUsuarioDoAparelho,
  lerUsuarioDoAparelho,
  esquecerUsuarioDoAparelho,
} from "../cache-portal";

/**
 * Motor offline do portal (P38, sobre o P12): abre o banco do aparelho,
 * liga os gatilhos de envio (conexão de volta, foco da aba, espera
 * crescente), registra o service worker do app instalável e conta o que
 * ainda está só no aparelho, para o indicador de sincronização do cabeçalho.
 * Fica no layout da enfermeira e na página de sem sinal, para valer em
 * todas as abas do portal.
 */

export interface ContextoPortal {
  /** Só existe no navegador; nulo até montar. */
  db: BancoOffline | null;
  usuarioId: string | null;
  online: boolean;
  /** Itens da fila que ainda não subiram (rascunho, enviando ou com erro). */
  pendentes: number;
  comErro: number;
  comConflito: number;
  /** Hora (epoch ms) em que a fila esvaziou pela última vez neste aparelho. */
  sincronizadoEm: number | null;
  /** Sobe a fila agora, sem esperar a espera crescente. */
  tentarAgora: () => void;
  /** Lê a fila de novo (depois de gravar um campo). */
  atualizar: () => void;
  /** Sai: sobe o que der, apaga o cache do dia e o que já subiu, e vai para /sair. */
  sair: () => Promise<void>;
  /** Muda a cada leitura da fila; a tela relê as marcas quando muda. */
  versaoFila: number;
}

const Contexto = createContext<ContextoPortal | null>(null);

export function usePortal(): ContextoPortal {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("usePortal fora do ProvedorPortal");
  return contexto;
}

const INTERVALO_LEITURA_MS = 1_500;

export function ProvedorPortal({
  usuarioId: usuarioDoServidor,
  children,
}: {
  /** O usuário logado, quando a página vem do servidor; nulo na página de sem sinal. */
  usuarioId: string | null;
  children: ReactNode;
}) {
  const roteador = useRouter();
  const bancoRef = useRef<BancoOffline | null>(null);
  const [db, definirDb] = useState<BancoOffline | null>(null);
  const [usuarioId, definirUsuario] = useState<string | null>(
    usuarioDoServidor,
  );
  const [online, definirOnline] = useState(true);
  const [contagem, definirContagem] = useState({
    pendentes: 0,
    comErro: 0,
    comConflito: 0,
  });
  const [sincronizadoEm, definirSincronizadoEm] = useState<number | null>(null);
  const [versaoFila, definirVersaoFila] = useState(0);
  const pendentesAntes = useRef(0);

  const ler = useCallback(
    async (banco: BancoOffline) => {
      const [pendentes, comErro, comConflito] = await Promise.all([
        banco.fila.where("estado").anyOf(ESTADOS_PENDENTES).count(),
        banco.fila.where("estado").equals("erro").count(),
        banco.fila.where("estado").equals("conflito").count(),
      ]);
      definirContagem({ pendentes, comErro, comConflito });
      definirVersaoFila((v) => v + 1);
      if (pendentesAntes.current > 0 && pendentes === 0) {
        definirSincronizadoEm(Date.now());
        if (typeof navigator !== "undefined" && navigator.onLine)
          roteador.refresh();
      }
      pendentesAntes.current = pendentes;
    },
    [roteador],
  );

  useEffect(() => {
    const banco = bancoOffline();
    bancoRef.current = banco;

    // O envio da fila: se o servidor diz que não há sessão (revogada ou
    // vencida), o cache do dia sai do aparelho e a pessoa volta para entrar.
    const enviar: EnviarLote = async (itens) => {
      try {
        return await enviarLotePorFetch(itens);
      } catch (erro) {
        if (
          erro instanceof Error &&
          /respondeu (401|403)/.test(erro.message) &&
          navigator.onLine
        ) {
          await encerrarSessaoOffline(banco, async () => undefined);
          esquecerUsuarioDoAparelho();
          // Navegação completa de propósito: a página inteira é recarregada,
          // sem nada do portal na memória.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/entrar?aviso=sessao-encerrada");
        }
        throw erro;
      }
    };
    const parar = iniciarMotorSincronizacao(banco, {
      enviar,
      intervaloMs: 5_000,
    });

    const atualizarOnline = () => definirOnline(navigator.onLine);
    window.addEventListener("online", atualizarOnline);
    window.addEventListener("offline", atualizarOnline);

    if (usuarioDoServidor) guardarUsuarioDoAparelho(usuarioDoServidor);

    const inicio = window.setTimeout(() => {
      definirDb(banco);
      atualizarOnline();
      definirUsuario(usuarioDoServidor ?? lerUsuarioDoAparelho());
      void ler(banco);
    }, 0);
    const intervalo = window.setInterval(() => {
      atualizarOnline();
      void ler(banco);
    }, INTERVALO_LEITURA_MS);

    // App instalável: o service worker guarda só o casco do portal (script,
    // estilo, fonte e a página de sem sinal), nunca dado de família.
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      navigator.onLine
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then((registro) =>
          registro.active?.postMessage({ tipo: "precarregar" }),
        )
        .catch(() => undefined);
    }

    return () => {
      parar();
      window.clearTimeout(inicio);
      window.clearInterval(intervalo);
      window.removeEventListener("online", atualizarOnline);
      window.removeEventListener("offline", atualizarOnline);
    };
  }, [usuarioDoServidor, ler]);

  const tentarAgora = useCallback(() => {
    const banco = bancoRef.current;
    if (!banco) return;
    processarFila(banco, undefined, undefined, { ignorarEspera: true })
      .catch(() => undefined)
      .finally(() => void ler(banco));
  }, [ler]);

  const atualizar = useCallback(() => {
    const banco = bancoRef.current;
    if (banco) void ler(banco);
  }, [ler]);

  const sair = useCallback(async () => {
    const banco = bancoRef.current;
    if (banco) {
      await encerrarSessaoOffline(banco, () =>
        processarFila(banco, undefined, undefined, { ignorarEspera: true }),
      );
    }
    esquecerUsuarioDoAparelho();
    try {
      const registro = await navigator.serviceWorker?.getRegistration();
      registro?.active?.postMessage({ tipo: "limpar" });
    } catch {
      // sem service worker
    }
    const formulario = document.createElement("form");
    formulario.method = "post";
    formulario.action = "/sair";
    document.body.appendChild(formulario);
    formulario.submit();
  }, []);

  const valor = useMemo<ContextoPortal>(
    () => ({
      db,
      usuarioId,
      online,
      ...contagem,
      sincronizadoEm,
      tentarAgora,
      atualizar,
      sair,
      versaoFila,
    }),
    [
      db,
      usuarioId,
      online,
      contagem,
      sincronizadoEm,
      tentarAgora,
      atualizar,
      sair,
      versaoFila,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
