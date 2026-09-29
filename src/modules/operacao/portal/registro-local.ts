import type { EstadoVisita, VisitaPortal } from "@/lib/dados/tipos-equipe";
import {
  estadoDoCampo,
  salvarCampo,
  type BancoOffline,
  type EstadoItemFila,
} from "@/lib/sync";

/**
 * Chegada e saída da enfermeira sobre o motor offline do P12 (P38): tocar
 * em "Cheguei" grava a hora do aparelho no rascunho e na fila no mesmo
 * instante (`salvarCampo`), com ou sem sinal; o motor sobe a fila quando a
 * conexão volta. A tela mostra o que está no aparelho por cima do que o
 * servidor devolveu (as "marcas locais"), com o estado de cada uma.
 */

export type CampoMarca = "checkin_em" | "checkout_em";

export interface MarcaLocal {
  /** Hora (ISO) gravada no aparelho. */
  valor: string;
  estadoItem: EstadoItemFila;
  /** Mensagem do último erro de envio, se houve. */
  erro?: string;
}

export interface MarcasDaVisita {
  chegada: MarcaLocal | null;
  saida: MarcaLocal | null;
}

export type SituacaoEnvio =
  "sincronizado" | "no_aparelho" | "erro" | "conflito";

/** A visita como a tela mostra: o servidor mais o que ainda está só no aparelho. */
export interface VisitaNaTela extends VisitaPortal {
  chegadaSituacao: SituacaoEnvio | null;
  saidaSituacao: SituacaoEnvio | null;
  erroEnvio: string | null;
}

async function lerMarca(
  db: BancoOffline,
  visitaId: string,
  campo: CampoMarca,
): Promise<MarcaLocal | null> {
  const achado = await estadoDoCampo(db, "visita", visitaId, campo);
  if (!achado || typeof achado.valor !== "string") return null;
  return {
    valor: achado.valor,
    estadoItem: achado.item?.estado ?? "rascunho_local",
    erro: achado.item?.erroMensagem,
  };
}

export async function lerMarcasLocais(
  db: BancoOffline,
  visitaId: string,
): Promise<MarcasDaVisita> {
  const [chegada, saida] = await Promise.all([
    lerMarca(db, visitaId, "checkin_em"),
    lerMarca(db, visitaId, "checkout_em"),
  ]);
  return { chegada, saida };
}

function situacao(marca: MarcaLocal | null): SituacaoEnvio | null {
  if (!marca) return null;
  switch (marca.estadoItem) {
    case "sincronizado":
      return "sincronizado";
    case "conflito":
      return "conflito";
    case "erro":
      return "erro";
    default:
      return "no_aparelho";
  }
}

/**
 * Junta a visita do servidor com as marcas do aparelho. A hora do servidor
 * vale quando já existe; a do aparelho aparece enquanto o servidor ainda
 * não a devolveu. O estado da visita acompanha: com chegada e sem saída,
 * "iniciada"; com saída, "ficha_pendente" (a ficha do dia ainda falta).
 */
export function aplicarMarcasLocais(
  visita: VisitaPortal,
  marcas: MarcasDaVisita,
): VisitaNaTela {
  const checkinEm = visita.checkinEm ?? marcas.chegada?.valor ?? null;
  const checkoutEm = visita.checkoutEm ?? marcas.saida?.valor ?? null;
  let estado: EstadoVisita = visita.estado;
  if (
    checkoutEm &&
    (estado === "agendada" ||
      estado === "confirmada" ||
      estado === "a_caminho" ||
      estado === "iniciada")
  ) {
    estado = "ficha_pendente";
  } else if (
    checkinEm &&
    (estado === "agendada" || estado === "confirmada" || estado === "a_caminho")
  ) {
    estado = "iniciada";
  }
  const chegadaSituacao =
    visita.checkinEm && !marcas.chegada
      ? "sincronizado"
      : (situacao(marcas.chegada) ??
        (visita.checkinEm ? "sincronizado" : null));
  const saidaSituacao =
    visita.checkoutEm && !marcas.saida
      ? "sincronizado"
      : (situacao(marcas.saida) ?? (visita.checkoutEm ? "sincronizado" : null));
  return {
    ...visita,
    estado,
    checkinEm,
    checkoutEm,
    chegadaSituacao,
    saidaSituacao,
    erroEnvio: marcas.chegada?.erro ?? marcas.saida?.erro ?? null,
  };
}

/** O que a enfermeira pode fazer agora com a visita. */
export type ProximoPasso = "chegar" | "sair" | "nenhum";

export function proximoPasso(visita: VisitaNaTela): ProximoPasso {
  if (visita.checkoutEm) return "nenhum";
  if (visita.checkinEm) return "sair";
  if (
    visita.estado === "agendada" ||
    visita.estado === "confirmada" ||
    visita.estado === "a_caminho"
  ) {
    return "chegar";
  }
  return "nenhum";
}

export async function registrarChegadaNoAparelho(
  db: BancoOffline,
  usuarioId: string,
  visita: Pick<VisitaPortal, "visitaId" | "versao">,
  agora: Date = new Date(),
) {
  return salvarCampo(db, {
    usuarioId,
    entidade: "visita",
    entidadeId: visita.visitaId,
    campo: "checkin_em",
    valor: agora.toISOString(),
    versaoBase: visita.versao,
  });
}

export async function registrarSaidaNoAparelho(
  db: BancoOffline,
  usuarioId: string,
  visita: Pick<VisitaPortal, "visitaId" | "versao">,
  agora: Date = new Date(),
) {
  return salvarCampo(db, {
    usuarioId,
    entidade: "visita",
    entidadeId: visita.visitaId,
    campo: "checkout_em",
    valor: agora.toISOString(),
    versaoBase: visita.versao,
  });
}
