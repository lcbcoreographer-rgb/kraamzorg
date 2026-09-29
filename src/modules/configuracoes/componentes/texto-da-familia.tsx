import { ChevronDown } from "lucide-react";
import { formatarData } from "@/lib/formatacao";
import type { MensagemModelo } from "@/lib/dados/tipos";

/**
 * Começo do texto de uma mensagem, para rótulo e prévia (sem cortar no
 * meio da palavra). Tira a chave da tela (voz.md, regra 10): quem cuida
 * dos termos e da régua reconhece o texto pelo que a família lê.
 */
export function inicioDoTexto(texto: string, limite = 64): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > 20 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,.;:]$/, "")}…`;
}

/**
 * "Texto que a família recebe" (DESIGN.md, 11.12; lista de mudanças P1-6):
 * o começo do texto aprovado, que abre ao tocar e mostra o texto inteiro
 * com o estado da aprovação. O texto vem de `mensagem_modelo`, nunca de um
 * mapa no código.
 */
export function TextoDaFamilia({
  mensagem,
}: {
  mensagem: MensagemModelo | undefined;
}) {
  if (!mensagem) {
    return (
      <span className="text-apoio text-texto-2">
        Texto não encontrado em Mensagens. Confira com a diretoria.
      </span>
    );
  }
  return (
    <details className="group max-w-[48ch]">
      <summary className="text-apoio text-texto min-h-toque flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{inicioDoTexto(mensagem.texto)}</span>
        <ChevronDown
          aria-hidden="true"
          className="text-texto-2 size-4 shrink-0 transition-transform duration-140 group-open:rotate-180"
          strokeWidth={1.75}
        />
      </summary>
      <div className="bg-superficie-2 rounded-2 mt-1 flex flex-col gap-2 p-3">
        <p className="text-apoio text-texto whitespace-pre-wrap">
          {mensagem.texto}
        </p>
        <p className="text-mini text-texto-2">
          {mensagem.status === "aprovado"
            ? mensagem.aprovadoEm
              ? `Texto aprovado em ${formatarData(mensagem.aprovadoEm)}.`
              : "Texto aprovado."
            : "Rascunho, ainda sem aprovação."}
        </p>
      </div>
    </details>
  );
}
