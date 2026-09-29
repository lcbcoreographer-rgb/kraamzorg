"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * Erro ao abrir uma tela do portal (P38). O que já foi registrado no
 * aparelho continua salvo e sobe sozinho; a tela diz isso antes de tudo.
 */
export default function ErroPortal({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="erro"
        titulo="Esta tela não abriu agora"
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
        O que você registrou neste aparelho continua salvo e sobe sozinho quando
        a conexão voltar. Toque em Tentar de novo; se continuar, avise a
        coordenação.
      </FaixaAlerta>
    </div>
  );
}
