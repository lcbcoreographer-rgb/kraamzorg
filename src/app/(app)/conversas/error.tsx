"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * Erro ao abrir as conversas (P27). Diz o que aconteceu e o que fazer, sem
 * detalhe técnico nem dado da família.
 */
export default function ErroConversas({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="imediato"
        titulo="Não foi possível abrir esta tela agora"
        acoes={
          <Botao
            variante="secundario"
            tamanho="compacto"
            onClick={() => retry()}
          >
            Tentar de novo
          </Botao>
        }
      >
        Confira a conexão e tente de novo. Se continuar, avise a equipe técnica.
        Nada foi alterado nas conversas.
      </FaixaAlerta>
    </div>
  );
}
