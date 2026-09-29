"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * Erro ao abrir o painel da Isadora (P27). Diz o que aconteceu e o que fazer, sem
 * detalhe técnico nem dado da família.
 */
export default function ErroAgente({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="erro"
        titulo="O painel da Isadora não abriu agora"
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
        Nada mudou na configuração da Isadora. Confira a conexão e toque em
        Tentar de novo; se continuar, avise a equipe técnica.
      </FaixaAlerta>
    </div>
  );
}
