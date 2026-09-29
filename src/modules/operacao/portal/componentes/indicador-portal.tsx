"use client";

import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { horaEmBrasilia } from "@/lib/agenda/datas";
import { usePortal } from "./provedor-portal";

/**
 * Indicador de sincronização do cabeçalho da enfermeira (DESIGN.md, seção
 * 6; PRD 15): "Salvo no aparelho", "Enviando 3 registros", "Sincronizado
 * 11:42". Fica em toda tela do portal e diz a verdade sobre o que já subiu.
 * Conflito e erro têm texto próprio e, no erro, o botão de tentar agora.
 */
export function IndicadorPortal() {
  const {
    online,
    pendentes,
    comErro,
    comConflito,
    sincronizadoEm,
    tentarAgora,
  } = usePortal();

  let estado: EstadoSincronizacao;
  let texto: string;
  if (comConflito > 0) {
    estado = "erro";
    texto = "Um registro precisa da coordenação";
  } else if (comErro > 0 && online) {
    estado = "erro";
    texto = "Não enviou. Tentamos de novo em instantes.";
  } else if (pendentes > 0 && !online) {
    estado = "local";
    texto =
      pendentes === 1
        ? "Salvo no aparelho"
        : `${pendentes} registros salvos no aparelho`;
  } else if (pendentes > 0) {
    estado = "enviando";
    texto =
      pendentes === 1
        ? "Enviando 1 registro"
        : `Enviando ${pendentes} registros`;
  } else if (!online) {
    estado = "local";
    texto = "Sem sinal";
  } else {
    estado = "sincronizado";
    const hora = sincronizadoEm
      ? horaEmBrasilia(new Date(sincronizadoEm))
      : null;
    texto = hora ? `Sincronizado ${hora}` : "Tudo em dia";
  }

  return (
    <IndicadorSincronizacao
      estado={estado}
      texto={texto}
      aoTentarNovamente={
        estado === "erro" && comErro > 0 ? tentarAgora : undefined
      }
      rotuloTentarNovamente="Tentar agora"
    />
  );
}
