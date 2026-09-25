import Link from "next/link";
import { Clock, FileText, Hourglass, OctagonPause } from "lucide-react";
import type { Papel } from "@/lib/auth/papeis";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import type { NumeroPipeline } from "@/lib/dados/tipos";
import type { CartaoPipelineTela } from "../tipos";
import { MenuMover } from "./menu-mover";

const ROTULO_CLASSIFICACAO = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
} as const;

/**
 * Cartão da oportunidade (P15 item 3): nome, semanas calculadas, cidade,
 * tempo no estágio, próximo contato e sinais (apresentação enviada,
 * transferência aberta, estado sensível na cor própria). Protótipo
 * `comercial-pipeline.html`, classe `c3-cartao`.
 */
export function CartaoOportunidadePipeline({
  cartao,
  pipeline,
  papeis,
}: {
  cartao: CartaoPipelineTela;
  pipeline: NumeroPipeline;
  papeis: readonly Papel[];
}) {
  const emFreio = cartao.estadoSensivel !== "normal";

  return (
    <Cartao
      variante={emFreio ? "areia" : "padrao"}
      className={emFreio ? "border-sensivel-borda border" : undefined}
    >
      <div className="flex flex-col gap-2">
        <Link
          href={`/familias/${cartao.familiaId}`}
          className="text-corpo min-h-toque inline-flex items-center font-semibold hover:underline"
        >
          {cartao.nomeFamilia}
        </Link>
        <p className="text-apoio text-texto-2 flex flex-wrap gap-x-3 gap-y-0.5">
          {cartao.idadeGestacional ? (
            <span
              className="font-mono"
              title={
                cartao.dpp
                  ? `Calculada da DPP ${formatarData(cartao.dpp)}`
                  : undefined
              }
            >
              {cartao.idadeGestacional}
            </span>
          ) : null}
          {cartao.bairro || cartao.cidade ? (
            <span>
              {[cartao.bairro, cartao.cidade].filter(Boolean).join(", ")}
            </span>
          ) : null}
        </p>
        <p className="text-mini text-texto-2">
          {cartao.tempoNoEstagio} neste estágio
        </p>

        <div className="flex flex-wrap gap-1.5">
          {cartao.classificacao ? (
            <Selo
              variante={
                cartao.classificacao === "quente" ? "destaque" : "neutro"
              }
            >
              {ROTULO_CLASSIFICACAO[cartao.classificacao]}
            </Selo>
          ) : null}
          {cartao.pdfEnviadoEm ? (
            <Selo icone={<FileText aria-hidden="true" />}>
              Apresentação enviada
            </Selo>
          ) : null}
          {cartao.transferenciaAberta ? (
            <Selo variante="aviso" icone={<Hourglass aria-hidden="true" />}>
              Transferência aberta
            </Selo>
          ) : null}
          {emFreio ? (
            <Selo
              variante="sensivel"
              icone={<OctagonPause aria-hidden="true" />}
            >
              {cartao.estadoSensivel === "bloqueio_total"
                ? "Freio em bloqueio total"
                : "Freio em atenção"}
            </Selo>
          ) : null}
        </div>

        {emFreio ? (
          <p className="text-sensivel border-linha text-apoio flex items-start gap-2 border-t pt-2">
            <OctagonPause
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Nenhuma mensagem automática sai para esta família.
          </p>
        ) : cartao.proximoContatoEm ? (
          <p className="border-linha text-apoio flex items-start gap-2 border-t pt-2">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Próximo contato em {formatarData(cartao.proximoContatoEm)}.
          </p>
        ) : null}

        <div className="-ml-3">
          <MenuMover cartao={cartao} pipeline={pipeline} papeis={papeis} />
        </div>
      </div>
    </Cartao>
  );
}
