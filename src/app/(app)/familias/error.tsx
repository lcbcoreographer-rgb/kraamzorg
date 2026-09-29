"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * Erro ao carregar a lista de famílias ou uma ficha (P16). Diz o que
 * aconteceu e o que fazer, sem detalhe técnico nem dado da família.
 */
export default function ErroFamilias({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="erro"
        titulo="A família não abriu agora"
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
        Nada mudou no cadastro da família. Confira a conexão e toque em Tentar
        de novo; se continuar, avise a equipe técnica.
      </FaixaAlerta>
    </div>
  );
}
