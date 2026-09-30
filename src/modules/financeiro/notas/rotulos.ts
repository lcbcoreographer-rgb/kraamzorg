import type { EstadoNota } from "@/lib/dados/tipos-nota";

/** Rótulos da nota fiscal de serviço (P43, PRD 14). Texto de interface, revisado contra docs/design/voz.md. */
export type VarianteSelo =
  "neutro" | "sucesso" | "aviso" | "alerta" | "sensivel" | "destaque";

export const ESTADOS: readonly EstadoNota[] = [
  "pendente",
  "processando",
  "emitida",
  "erro",
  "cancelada",
];

export const ROTULO_ESTADO: Record<EstadoNota, string> = {
  pendente: "A emitir",
  processando: "Em processamento",
  emitida: "Emitida",
  erro: "Com erro",
  cancelada: "Cancelada",
};

export const VARIANTE_ESTADO: Record<EstadoNota, VarianteSelo> = {
  pendente: "aviso",
  processando: "neutro",
  emitida: "sucesso",
  erro: "alerta",
  cancelada: "neutro",
};

export const FILTROS_NOTA: { valor: EstadoNota | undefined; rotulo: string }[] =
  [
    { valor: undefined, rotulo: "Todas" },
    { valor: "pendente", rotulo: "A emitir" },
    { valor: "erro", rotulo: "Com erro" },
    { valor: "processando", rotulo: "Em processamento" },
    { valor: "emitida", rotulo: "Emitidas" },
  ];

export function estadoDaBusca(
  valor: string | undefined,
): EstadoNota | undefined {
  return ESTADOS.find((e) => e === valor);
}

/** O que acontece a seguir e quem faz, em frase (voz.md 2, item 4). */
export function fraseProximoPasso(
  estado: EstadoNota,
  emissaoAutomatica: boolean,
): string {
  switch (estado) {
    case "pendente":
      return emissaoAutomatica
        ? "O sistema emite a nota pelo provedor assim que o pagamento é confirmado. Se não emitiu, o financeiro emite daqui."
        : "O financeiro, com a contadora, emite a nota no portal do provedor e registra o número aqui.";
    case "processando":
      return "O provedor está processando. Consulte de novo em alguns minutos; o financeiro acompanha.";
    case "emitida":
      return "Nada mais a fazer. Os arquivos da nota ficam guardados aqui.";
    case "erro":
      return "O financeiro confere o motivo abaixo, corrige o cadastro se for o caso e reenvia a nota.";
    case "cancelada":
      return "A nota foi cancelada e não muda mais.";
  }
}
