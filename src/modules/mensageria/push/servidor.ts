import "server-only";
import webpush from "web-push";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import type { InscricaoPush } from "./repositorio";

/**
 * Envio de Web Push do servidor (P11 item 4), com VAPID. O aviso NUNCA leva
 * nome de família nem conteúdo: o texto sai fixo e genérico e o app mostra o
 * detalhe depois de aberto e autenticado. O aviso passa por servidores de
 * terceiros (Google, Apple, Mozilla); dado de paciente não pode passar por
 * lá (CLAUDE.md, "Segurança e LGPD"). A URL de abertura também é genérica.
 *
 * Configuração só por ambiente: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gere com `scripts/gerar-chaves-vapid.mjs`).
 * Sem elas, nada é enviado e o motivo volta para a rota mostrar.
 *
 * Lê as inscrições por `public.inscricoes_push` (só service_role) e apaga as
 * que o serviço de push devolve como expiradas (404 e 410).
 */
export interface PayloadPush {
  titulo: string;
  corpo: string;
  url: string;
}

export const PAYLOAD_GENERICO: PayloadPush = {
  titulo: "Kraamzorg",
  corpo: "Há um aviso novo para você. Abra o aplicativo para ver.",
  url: "/",
};

export interface ResultadoPush {
  ok: boolean;
  enviados: number;
  expirados: number;
  motivo?: string;
}

type EnviarUm = (inscricao: InscricaoPush, payload: string) => Promise<void>;

interface Dependencias {
  listar?: (usuarioIds: string[]) => Promise<InscricaoPush[]>;
  expirar?: (endpoint: string) => Promise<void>;
  enviarUm?: EnviarUm;
}

function configVapid() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const assunto = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !assunto) return null;
  return { publica, privada, assunto };
}

async function listarDoBanco(usuarioIds: string[]): Promise<InscricaoPush[]> {
  const cliente = criarClienteServico("push_servidor");
  const { data, error } = await cliente.rpc("inscricoes_push", {
    p_usuario_ids: usuarioIds,
  });
  if (error || !Array.isArray(data)) return [];
  const lista: InscricaoPush[] = [];
  for (const item of data) {
    const x = item as {
      endpoint?: unknown;
      chaves?: { p256dh?: unknown; auth?: unknown };
    };
    if (
      typeof x.endpoint === "string" &&
      typeof x.chaves?.p256dh === "string" &&
      typeof x.chaves.auth === "string"
    ) {
      lista.push({
        endpoint: x.endpoint,
        chaves: { p256dh: x.chaves.p256dh, auth: x.chaves.auth },
      });
    }
  }
  return lista;
}

async function expirarNoBanco(endpoint: string): Promise<void> {
  const cliente = criarClienteServico("push_servidor");
  await cliente.rpc("inscricao_push_expirada", { p_endpoint: endpoint });
}

/** Manda o aviso genérico para todos os aparelhos das pessoas. */
export async function enviarPushParaUsuarios(
  usuarioIds: string[],
  dependencias: Dependencias = {},
): Promise<ResultadoPush> {
  const vapid = configVapid();
  if (!vapid) {
    return {
      ok: false,
      enviados: 0,
      expirados: 0,
      motivo:
        "As chaves de aviso no celular (VAPID) não estão configuradas neste ambiente.",
    };
  }
  if (usuarioIds.length === 0) {
    return {
      ok: false,
      enviados: 0,
      expirados: 0,
      motivo: "Sem pessoa para receber o aviso no celular.",
    };
  }

  const listar = dependencias.listar ?? listarDoBanco;
  const expirar = dependencias.expirar ?? expirarNoBanco;
  const enviarUm: EnviarUm =
    dependencias.enviarUm ??
    (async (inscricao, corpo) => {
      await webpush.sendNotification(
        { endpoint: inscricao.endpoint, keys: inscricao.chaves },
        corpo,
        {
          vapidDetails: {
            subject: vapid.assunto,
            publicKey: vapid.publica,
            privateKey: vapid.privada,
          },
        },
      );
    });

  let inscricoes: InscricaoPush[];
  try {
    inscricoes = await listar(usuarioIds);
  } catch {
    return {
      ok: false,
      enviados: 0,
      expirados: 0,
      motivo: "Não deu para ler os aparelhos inscritos agora.",
    };
  }
  if (inscricoes.length === 0) {
    return {
      ok: false,
      enviados: 0,
      expirados: 0,
      motivo: "Essa pessoa não ligou os avisos no celular.",
    };
  }

  const corpo = JSON.stringify(PAYLOAD_GENERICO);
  let enviados = 0;
  let expirados = 0;
  for (const inscricao of inscricoes) {
    try {
      await enviarUm(inscricao, corpo);
      enviados += 1;
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        expirados += 1;
        await expirar(inscricao.endpoint).catch(() => undefined);
      }
    }
  }
  return {
    ok: enviados > 0,
    enviados,
    expirados,
    motivo:
      enviados > 0
        ? undefined
        : "O serviço de aviso não aceitou o envio agora.",
  };
}
