"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { usePortal } from "./provedor-portal";

/**
 * Sair do portal (telas.md E9, P12): antes de sair, o que ainda está só no
 * aparelho sobe; o cache do dia e o que já subiu são apagados. Se ainda
 * sobrar registro que não subiu, a pessoa é avisada e escolhe: esperar o
 * sinal ou sair mesmo assim (o registro continua no aparelho, que sobe na
 * próxima vez que ela entrar neste aparelho).
 */
export function BotaoSairPortal() {
  const { pendentes, online, sair } = usePortal();
  const [confirmando, definirConfirmando] = useState(false);
  const [saindo, definirSaindo] = useState(false);

  const tocar = async () => {
    if (pendentes > 0 && !confirmando) {
      definirConfirmando(true);
      return;
    }
    definirSaindo(true);
    await sair();
  };

  return (
    <div className="flex flex-col gap-3">
      {pendentes > 0 && confirmando ? (
        <FaixaAlerta
          variante="prioritario"
          titulo="Há registros que ainda não subiram"
        >
          {pendentes === 1
            ? "Um registro está salvo só neste aparelho."
            : `${pendentes} registros estão salvos só neste aparelho.`}{" "}
          {online
            ? "Vamos tentar enviar agora. Se algum não subir, ele fica guardado e sobe quando você entrar de novo."
            : "Sem sinal agora. Eles ficam guardados e sobem quando você entrar de novo com sinal."}
        </FaixaAlerta>
      ) : null}
      <Botao
        variante="secundario"
        className="self-start"
        carregando={saindo}
        rotuloCarregando="Saindo"
        iconeEsquerda={<LogOut aria-hidden="true" />}
        onClick={() => void tocar()}
      >
        {pendentes > 0 && confirmando ? "Sair mesmo assim" : "Sair"}
      </Botao>
    </div>
  );
}
