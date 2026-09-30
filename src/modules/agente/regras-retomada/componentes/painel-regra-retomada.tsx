import { Bot } from "lucide-react";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { RegraRetomadaTela } from "../dados";

/**
 * Textos da retomada de quem parou de responder (P27 item 1, PRD 11.3;
 * protótipo `comercial-agente-regras.html`, C6). Só leitura: [v4.5] a janela
 * de retomada é ajuste da equipe de implantação, fora do app.
 */
export function PainelRegraRetomada({ regra }: { regra: RegraRetomadaTela }) {
  return (
    <div className="flex flex-col gap-4">
      <FaixaAlerta variante="info" titulo="Quando a Isadora nunca retoma">
        A Isadora nunca retoma conversa de família com freio nem conversa já
        assumida pela equipe.
      </FaixaAlerta>

      <div className="flex flex-col gap-3">
        {regra.textoPosPdf ? (
          <div className="bg-superficie-2 rounded-3 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-texto font-semibold">
                Depois da apresentação
              </span>
              <Selo
                variante={
                  regra.textoPosPdf.status === "aprovado" ? "sucesso" : "aviso"
                }
                icone={<Bot />}
              >
                {regra.textoPosPdf.status === "aprovado"
                  ? "Aprovado"
                  : "Rascunho para aprovação"}
              </Selo>
            </div>
            <p className="text-corpo text-texto">{regra.textoPosPdf.texto}</p>
          </div>
        ) : null}
        {regra.textoPosAbertura ? (
          <div className="bg-superficie-2 rounded-3 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-texto font-semibold">
                Depois só da abertura
              </span>
              <Selo
                variante={
                  regra.textoPosAbertura.status === "aprovado"
                    ? "sucesso"
                    : "aviso"
                }
                icone={<Bot />}
              >
                {regra.textoPosAbertura.status === "aprovado"
                  ? "Aprovado"
                  : "Rascunho para aprovação"}
              </Selo>
            </div>
            <p className="text-corpo text-texto">
              {regra.textoPosAbertura.texto}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
