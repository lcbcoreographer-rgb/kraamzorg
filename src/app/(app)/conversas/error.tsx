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
        variante="erro"
        titulo="As conversas não abriram agora"
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
        Nada mudou nas conversas nem nas famílias. Confira a conexão e toque em
        Tentar de novo; se continuar, avise a equipe técnica.
      </FaixaAlerta>
    </div>
  );
}
