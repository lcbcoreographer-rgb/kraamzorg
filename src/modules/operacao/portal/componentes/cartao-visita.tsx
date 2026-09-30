"use client";

import Link from "next/link";
import { LogOut, MapPin, MapPinCheck, OctagonPause, Phone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import { cn } from "@/lib/utils";
import { horaEmBrasilia } from "@/lib/agenda/datas";
import { formatarTelefone } from "@/lib/formatacao";
import { fraseErroEquipe, ROTULO_TURNO } from "../../equipe/textos";
import {
  proximoPasso,
  type SituacaoEnvio,
  type VisitaNaTela,
} from "../registro-local";
import {
  diaDeTotal,
  enderecoEmTexto,
  fraseEstadoSensivel,
  ligacaoDeMapa,
} from "../textos";

function reguaDaVisita(v: VisitaNaTela): DiaRegua[] {
  return Array.from({ length: v.diasContratados }, (_, i) => {
    const numero = i + 1;
    return {
      numero,
      estado:
        numero < v.diaNumero
          ? "feito"
          : numero === v.diaNumero
            ? "hoje"
            : "futuro",
      rotuloEstado: numero === v.diaNumero ? "hoje" : undefined,
    };
  });
}

const TEXTO_SITUACAO: Record<SituacaoEnvio, string> = {
  sincronizado: "Sincronizado",
  no_aparelho: "Salvo no aparelho",
  erro: "Não enviou ainda",
  conflito: "Precisa da coordenação",
};

function Marca({
  rotulo,
  instante,
  situacao,
  semTom,
}: {
  rotulo: string;
  instante: string | null;
  situacao: SituacaoEnvio | null;
  semTom: boolean;
}) {
  const hora = instante ? horaEmBrasilia(instante) : null;
  return (
    <p
      className={cn(
        "rounded-2 flex flex-col gap-0.5 px-4 py-3",
        semTom ? "border-linha border" : "bg-areia-clara",
      )}
      data-marca={rotulo.toLowerCase()}
    >
      <span className="text-mini text-texto-2 font-semibold">{rotulo}</span>
      <span className="text-3 text-texto font-mono">{hora ?? "ainda não"}</span>
      {situacao ? (
        <span
          // Estado em pílula com o lavado do próprio estado: sobre o tom
          // de apoio, o texto `sucesso` sozinho ficaria em 4,4:1.
          className={cn(
            "rounded-pilula text-mini mt-1 self-start px-2 py-0.5 font-semibold",
            situacao === "sincronizado"
              ? "bg-sucesso-lavado text-sucesso"
              : situacao === "no_aparelho"
                ? "bg-aviso-lavado text-aviso-texto"
                : "bg-alerta-lavado text-alerta",
          )}
        >
          {TEXTO_SITUACAO[situacao]}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Cartão da visita de hoje (protótipo enfermeira-hoje.html; P38 item 1;
 * direção "Colo", DESIGN.md 2.5 e 2.7):
 * hora e turno, o dia do acompanhamento, o nome da família, o endereço
 * (abre o mapa do aparelho), o contato em um toque, a régua de dias e, no
 * fim, a chegada e a saída com a hora gravada. Um botão só por vez
 * ("Cheguei" e depois "Saí da casa"), de 52 px, para tocar com uma mão. A
 * hora fica salva no aparelho na hora do toque, com ou sem sinal.
 */
export function CartaoVisita({
  visita: v,
  ocupado,
  aoChegar,
  aoSair,
  offline = false,
}: {
  visita: VisitaNaTela;
  ocupado: boolean;
  aoChegar: () => void;
  aoSair: () => void;
  /** Na página de sem sinal, o link para a ficha completa não existe. */
  offline?: boolean;
}) {
  const passo = proximoPasso(v);
  const endereco = enderecoEmTexto(v.endereco, v.cidade, v.bairro);
  const sensivel = fraseEstadoSensivel(v.estadoSensivel);
  const primeiroNome = v.contatoNome?.split(" ")[0] ?? null;
  // Família em freio, perda ou intercorrência: sem tom de apoio (PRD 20.2
  // [v4.4], regra 3); a hora e as linhas de contato ficam em branco.
  const semTom = v.estadoSensivel !== "normal";

  return (
    <article
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
      aria-labelledby={`visita-${v.visitaId}`}
      data-visita={v.visitaId}
      data-estado-visita={v.estado}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p
          className={cn(
            "rounded-pilula inline-flex min-h-10 items-baseline gap-2 px-4 py-1.5",
            semTom ? "border-linha border" : "bg-dourado-claro",
          )}
        >
          <span className="text-2 text-texto font-mono font-semibold">
            {v.horaPrevista ?? "sem hora"}
          </span>
          {v.turno ? (
            <span className="text-apoio text-texto-2">
              {ROTULO_TURNO[v.turno]}
            </span>
          ) : null}
        </p>
        <Selo variante="marinho">
          <span className="font-mono">
            {diaDeTotal(v.diaNumero, v.diasContratados)}
          </span>
        </Selo>
      </div>

      <div className="flex flex-col gap-2">
        <h3
          id={`visita-${v.visitaId}`}
          className="font-titulo text-1 text-texto font-medium"
        >
          {v.nomeExibicao}
        </h3>
        {primeiroNome ? (
          <p className="text-apoio text-texto-2">
            Contato: {primeiroNome}
            {v.gemelar ? ". Gestação de gêmeos." : "."}
          </p>
        ) : null}
        {endereco ? (
          <a
            href={ligacaoDeMapa(endereco)}
            className={cn(
              "rounded-2 text-corpo text-texto min-h-toque ease-estado mt-1 flex items-center gap-3 py-2 pr-3 pl-2 transition-colors duration-140",
              semTom
                ? "border-linha hover:bg-marinho-08 border"
                : "bg-areia-clara hover:bg-areia",
            )}
          >
            <TileIcone tom={semTom ? "branco" : "areia"} tamanho="p">
              <MapPin />
            </TileIcone>
            <span className="underline decoration-1 underline-offset-4">
              {endereco}
              <span className="sr-only">. Abre o mapa.</span>
            </span>
          </a>
        ) : null}
        {v.endereco?.referencia ? (
          <p className="text-apoio text-texto-2">
            Referência: {v.endereco.referencia}
          </p>
        ) : null}
        {v.contatoTelefone ? (
          <a
            href={`tel:${v.contatoTelefone}`}
            className={cn(
              "rounded-2 text-corpo text-texto min-h-toque ease-estado flex items-center gap-3 py-2 pr-3 pl-2 transition-colors duration-140",
              semTom
                ? "border-linha hover:bg-marinho-08 border"
                : "bg-argila-clara hover:bg-argila-media",
            )}
            aria-label={`Ligar para ${primeiroNome ?? "a família"}, ${formatarTelefone(v.contatoTelefone)}`}
          >
            <TileIcone tom={semTom ? "branco" : "argila"} tamanho="p">
              <Phone />
            </TileIcone>
            <span className="font-mono underline decoration-1 underline-offset-4">
              {formatarTelefone(v.contatoTelefone)}
            </span>
          </a>
        ) : null}
        {sensivel ? (
          <p className="text-apoio text-sensivel flex items-start gap-2">
            <OctagonPause
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {sensivel}
          </p>
        ) : null}
      </div>

      <ReguaDias
        dias={reguaDaVisita(v)}
        rotulo={`Acompanhamento de ${v.diasContratados} dias, hoje é o dia ${v.diaNumero}`}
      />

      <div
        className="tablet:grid-cols-2 grid grid-cols-2 gap-2"
        aria-label="Chegada e saída"
      >
        <Marca
          rotulo="Chegada"
          instante={v.checkinEm}
          situacao={v.chegadaSituacao}
          semTom={semTom}
        />
        <Marca
          rotulo="Saída"
          instante={v.checkoutEm}
          situacao={v.saidaSituacao}
          semTom={semTom}
        />
      </div>

      {v.erroEnvio ? (
        <p className="text-apoio text-alerta" role="status">
          {fraseErroEquipe(new Error(v.erroEnvio), "enviar este registro")} O
          horário está salvo no aparelho.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {passo === "chegar" ? (
          <Botao
            largaTotal
            className="min-h-toque-grande"
            carregando={ocupado}
            rotuloCarregando="Gravando a chegada"
            iconeEsquerda={<MapPinCheck aria-hidden="true" />}
            onClick={aoChegar}
          >
            Cheguei
          </Botao>
        ) : null}
        {passo === "sair" ? (
          <Botao
            largaTotal
            variante="primario"
            className="min-h-toque-grande"
            carregando={ocupado}
            rotuloCarregando="Gravando a saída"
            iconeEsquerda={<LogOut aria-hidden="true" />}
            onClick={aoSair}
          >
            Saí da casa
          </Botao>
        ) : null}
        {passo === "nenhum" && v.checkoutEm ? (
          <p className="text-apoio text-texto-2" role="status">
            Saída gravada. A ficha deste dia ainda falta.
          </p>
        ) : null}
        {!offline ? (
          <Link
            href={`/minhas-familias/${v.familiaId}`}
            className="text-apoio text-texto min-h-toque inline-flex items-center self-start underline underline-offset-4"
          >
            Ver o acompanhamento da família
          </Link>
        ) : null}
      </div>
    </article>
  );
}
