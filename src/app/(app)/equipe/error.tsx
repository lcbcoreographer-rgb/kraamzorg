"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * Erro ao abrir a equipe (P37). Diz o que aconteceu e o que fazer, sem
 * detalhe técnico nem dado de família.
 */
export default function ErroEquipe({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="erro"
        titulo="A equipe não abriu agora"
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
        Nada mudou no cadastro nem nas visitas. Confira a conexão e toque em
        Tentar de novo; se continuar, avise a equipe técnica.
      </FaixaAlerta>
    </div>
  );
}
