import Link from "next/link";
import { Clock, FileText, Hourglass, OctagonPause } from "lucide-react";
import type { Papel } from "@/lib/auth/papeis";
import { Cartao } from "@/components/ui/cartao";
import { LinhaGestacao } from "@/components/ui/linha-gestacao";
import { Selo } from "@/components/ui/selo";
import { formatarData, localidade } from "@/lib/formatacao";
import type { EstadoSensivel, NumeroPipeline } from "@/lib/dados/tipos";
import { calcularIdadeGestacional, hojeBrasilia } from "../idade-gestacional";
import type { CartaoPipelineTela } from "../tipos";
import { MenuMover } from "./menu-mover";

const ROTULO_FREIO: Record<Exclude<EstadoSensivel, "normal">, string> = {
  atencao: "Freio em atenção",
  bloqueio_total: "Freio em bloqueio total",
  encerrado_sensivel: "Encerrado em estado sensível",
};

/** "Neste estágio desde hoje" / "Neste estágio há 3 dias" (voz.md, seção 5). */
function fraseNoEstagio(tempo: string): string {
  return tempo === "Hoje"
    ? "Neste estágio desde hoje"
    : `Neste estágio ${tempo.charAt(0).toLowerCase()}${tempo.slice(1)}`;
}

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
  // Perda ou intercorrência (bloqueio total, encerrado sensível): sai a
  // semana da gestação e a palavra de venda (quente, morno, frio) do
  // cartão (DESIGN.md, 11.8 e 11.9).
  const sensivel =
    cartao.estadoSensivel === "bloqueio_total" ||
    cartao.estadoSensivel === "encerrado_sensivel";
  const ig =
    !sensivel && cartao.dpp && !cartao.dataNascimento
      ? calcularIdadeGestacional(cartao.dpp, hojeBrasilia())
      : null;
  const dppTexto = cartao.dpp ? formatarData(cartao.dpp) : null;

  return (
    <Cartao
      // `areia` é a cor da família e da Isadora (cabeçalho, selo da
      // conversa): o cartão com freio usa o ameixa lavado, como o
      // protótipo, não areia (crítica do CRM, P1 item 9).
      className={
        emFreio ? "bg-sensivel-lavado border-sensivel-borda border" : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <Link
          href={`/familias/${cartao.familiaId}`}
          className="font-titulo text-3 min-h-toque inline-flex items-center font-medium underline-offset-4 hover:underline"
        >
          {cartao.nomeFamilia}
        </Link>
        <p className="text-apoio text-texto-2 flex flex-wrap gap-x-3 gap-y-0.5">
          {!sensivel && cartao.idadeGestacional ? (
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
          {localidade(cartao.bairro, cartao.cidade) ? (
            <span>{localidade(cartao.bairro, cartao.cidade)}</span>
          ) : null}
        </p>
        {ig && ig.semanas <= 42 && dppTexto ? (
          // Linha da família no tempo, fina e sem acento: nas listas o
          // bloco atual fica em marinho cheio (DESIGN.md, 11.9).
          <LinhaGestacao
            semanas={ig.semanas}
            dias={ig.dias}
            dpp={dppTexto}
            semLegenda
            className="py-1"
          />
        ) : null}
        <p className="text-mini text-texto-2">
          {fraseNoEstagio(cartao.tempoNoEstagio)}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {!sensivel && cartao.classificacao ? (
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
              {cartao.estadoSensivel !== "normal"
                ? ROTULO_FREIO[cartao.estadoSensivel]
                : null}
            </Selo>
          ) : null}
        </div>

        {emFreio ? (
          <p className="text-sensivel border-linha text-apoio flex items-start gap-2 border-t pt-2">
            <OctagonPause
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {sensivel
              ? "Nenhuma mensagem automática sai para esta família."
              : "Conteúdo e marketing pausados; os avisos da operação continuam."}
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
