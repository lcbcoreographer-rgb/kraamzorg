import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";

/**
 * O que a tela mostra quando a pessoa ainda não confirmou o código do
 * aplicativo (MFA) ou quando o papel dela não abre aquela tela. A defesa é o
 * banco (papel e AAL2 conferidos dentro de cada função); isto só explica, em
 * frase completa, o que fazer (PRD 20.3).
 */
export function AvisoAcesso({
  situacao,
  caminho,
  aalPossivel,
  motivoMfa,
  motivoPapel,
  tituloPapel,
}: {
  situacao: "mfa" | "sem_permissao";
  /** Caminho de volta depois do desafio. */
  caminho: string;
  aalPossivel: "aal1" | "aal2";
  motivoMfa: string;
  motivoPapel: string;
  tituloPapel: string;
}) {
  if (situacao === "sem_permissao") {
    return (
      <FaixaAlerta variante="info" titulo={tituloPapel}>
        {motivoPapel}
      </FaixaAlerta>
    );
  }
  return (
    <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
      <p className="text-corpo text-texto flex items-start gap-3">
        <LockKeyhole
          className="text-texto-2 mt-1 size-4 shrink-0"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {motivoMfa}
      </p>
      <Botao
        asChild
        variante="secundario"
        tamanho="compacto"
        className="self-start"
      >
        <Link
          href={`${aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(caminho)}`}
        >
          Confirmar com o código
        </Link>
      </Botao>
    </div>
  );
}
