import type { PortalFamiliaCompleto } from "@/lib/dados/tipos-relacao";

/**
 * Os próximos passos da família (P49), montados só dos fatos que o banco
 * devolve. As datas de fato (nascimento, alta, início) nunca se confundem com
 * a estimativa (DPP): a DPP aparece à parte, com a marca "estimativa", e nunca
 * decide um passo. Os títulos e as frases do que vem agora são de
 * mensagem_modelo (textos do portal), não escritos aqui.
 */
export type ChavePasso =
  | "contrato"
  | "pagamento"
  | "prenatal"
  | "enfermeira"
  | "nascimento"
  | "alta"
  | "visitas";

export type EstadoPasso = "feito" | "agora" | "depois";

export interface Passo {
  chave: ChavePasso;
  titulo: string;
  estado: EstadoPasso;
  /** Data do que já aconteceu ou do que está marcado (ISO). */
  data: string | null;
  /** O que a data quer dizer: "marcada" só para o que ainda vai acontecer. */
  dataMarcada: boolean;
  /** Frase do que acontece agora, só no passo do momento. */
  apoio: string | null;
}

const ORDEM: ChavePasso[] = [
  "contrato",
  "pagamento",
  "prenatal",
  "enfermeira",
  "nascimento",
  "alta",
  "visitas",
];

function proximaVisita(
  portal: PortalFamiliaCompleto,
  hoje: string,
): string | null {
  return portal.visitas.find((v) => !v.feita && v.data >= hoje)?.data ?? null;
}

export function montarPassos(
  portal: PortalFamiliaCompleto,
  hoje: string,
): Passo[] {
  const t = portal.textos;
  const feito: Record<ChavePasso, boolean> = {
    contrato: Boolean(portal.contratoAssinadoEm),
    pagamento: Boolean(portal.pagamentoConfirmadoEm),
    prenatal: portal.prenatal?.estado === "realizada",
    enfermeira: portal.enfermeira !== null,
    nascimento: Boolean(portal.datas.dataNascimento),
    alta: Boolean(portal.datas.dataAlta),
    visitas:
      portal.acompanhamento !== null &&
      ["encerrado", "ultima_visita_realizada"].includes(
        portal.acompanhamento.estado,
      ),
  };
  const dataDe: Record<ChavePasso, string | null> = {
    contrato: portal.contratoAssinadoEm,
    pagamento: portal.pagamentoConfirmadoEm,
    prenatal:
      portal.prenatal?.realizadaEm ?? portal.prenatal?.agendadaPara ?? null,
    enfermeira: null,
    nascimento: portal.datas.dataNascimento,
    alta: portal.datas.dataAlta,
    visitas: proximaVisita(portal, hoje),
  };

  let atual: ChavePasso | null = null;
  return ORDEM.map((chave) => {
    let estado: EstadoPasso;
    if (feito[chave]) estado = "feito";
    else if (atual === null) {
      estado = "agora";
      atual = chave;
    } else estado = "depois";
    const agendada =
      chave === "prenatal" && portal.prenatal?.estado === "agendada";
    return {
      chave,
      titulo: t[`passo_${chave}`] ?? chave,
      estado,
      data: dataDe[chave],
      dataMarcada:
        estado !== "feito" &&
        dataDe[chave] !== null &&
        (agendada || chave === "visitas"),
      apoio: estado === "agora" ? (t[`agora_${chave}`] ?? null) : null,
    };
  });
}
