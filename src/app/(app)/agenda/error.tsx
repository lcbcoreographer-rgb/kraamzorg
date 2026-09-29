"use client";

import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/** Erro ao abrir a agenda (P37): diz o que aconteceu e o que fazer. */
export default function ErroAgenda({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <FaixaAlerta
        variante="erro"
        titulo="A agenda não abriu agora"
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
        Nenhuma visita foi alterada. Confira a conexão e toque em Tentar de
        novo; se continuar, avise a equipe técnica.
      </FaixaAlerta>
    </div>
  );
}
