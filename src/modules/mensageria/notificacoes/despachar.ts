import "server-only";
import { criarMensageiro, type VerificadorFreio } from "@/lib/messaging";
import { enviarPushParaUsuarios } from "../push/servidor";
import { enviarEmail } from "./email";
import type { CanalNotificacao, PreferenciasNotificacao } from "./tipos";

/**
 * Assunto fixo e neutro: o título da notificação pode trazer o nome da
 * família, e nome de paciente nunca vai em assunto de e-mail (CLAUDE.md,
 * Segurança e LGPD). O título e o corpo seguem no texto do e-mail.
 */
const ASSUNTO_EMAIL = "Aviso interno do Kraamzorg OS";

/**
 * Grupo interno e avisos ao plantão (PRD 23.3) nunca passam pelo freio
 * (categoria "interna" sempre executa, PRD 8.2); este canal fixo evita
 * puxar `src/modules/mensageria/tarefas/verificador-freio.ts` para dentro
 * de um fluxo que não devia nem consultá-lo.
 */
const SEMPRE_LIBERADO: VerificadorFreio = async () => ({
  pode: true,
  motivo: "",
});

export interface DestinoWhatsAppInterno {
  telefoneOuJid: string;
}

export interface PedidoDespacho {
  titulo: string;
  corpo?: string | null;
  canais: CanalNotificacao[];
  whatsappInterno?: DestinoWhatsAppInterno[];
  emails?: string[];
  /**
   * Preferências da pessoa quando a notificação é de uma pessoa só (P18
   * item 3). Canal desligado por ela não sai. Aviso a grupo ou a papel vem
   * sem preferências e sai por todos os canais pedidos.
   */
  preferencias?: PreferenciasNotificacao;
  /** Quem recebe o aviso no celular (canal "push"): a pessoa da notificação. */
  usuarioId?: string;
}

export interface ResultadoCanal {
  canal: CanalNotificacao;
  destino: string;
  ok: boolean;
  motivo?: string;
}

/**
 * Despacha uma notificação pelos canais além de "app" (que já está
 * gravado na tabela `notificacao` por quem chamou esta rota, PRD 6.7).
 * "push" (P11) manda o aviso genérico, sem nome nem conteúdo, para os
 * aparelhos que a pessoa ligou (`../push/servidor.ts`); sem `usuarioId`, sem
 * VAPID ou sem aparelho inscrito, aparece como não enviado, com o motivo.
 */
export async function despacharNotificacao(
  pedido: PedidoDespacho,
): Promise<ResultadoCanal[]> {
  const texto = pedido.corpo
    ? `${pedido.titulo}\n${pedido.corpo}`
    : pedido.titulo;
  const resultados: ResultadoCanal[] = [];
  const ligado = (canal: Exclude<CanalNotificacao, "app">): boolean => {
    if (!pedido.canais.includes(canal)) return false;
    const preferencias = pedido.preferencias;
    if (!preferencias) return true;
    if (canal === "push") return preferencias.push;
    if (canal === "whatsapp_interno") return preferencias.whatsappInterno;
    return preferencias.email;
  };

  if (ligado("push")) {
    if (!pedido.usuarioId) {
      resultados.push({
        canal: "push",
        destino: "-",
        ok: false,
        motivo: "O aviso no celular precisa de uma pessoa como destino.",
      });
    } else {
      const push = await enviarPushParaUsuarios([pedido.usuarioId]);
      resultados.push({
        canal: "push",
        destino: "-",
        ok: push.ok,
        motivo: push.motivo,
      });
    }
  }

  if (ligado("whatsapp_interno")) {
    const mensageiro = criarMensageiro("uazapi");
    const destinos = pedido.whatsappInterno ?? [];
    for (const destino of destinos) {
      const resultado = await mensageiro.enviar(
        {
          categoria: "interna",
          destinatario: "equipe",
          telefoneOuJid: destino.telefoneOuJid,
          texto,
        },
        SEMPRE_LIBERADO,
      );
      resultados.push({
        canal: "whatsapp_interno",
        destino: destino.telefoneOuJid,
        ok: resultado.ok,
        motivo: resultado.ok ? undefined : resultado.motivo,
      });
    }
  }

  if (ligado("email")) {
    for (const destino of pedido.emails ?? []) {
      const resultado = await enviarEmail(destino, ASSUNTO_EMAIL, texto);
      resultados.push({
        canal: "email",
        destino,
        ok: resultado.ok,
        motivo: resultado.motivo,
      });
    }
  }

  return resultados;
}
