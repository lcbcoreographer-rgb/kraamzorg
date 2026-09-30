"use client";

import Link from "next/link";
import { LogOut, MapPin, MapPinCheck, OctagonPause, Phone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { Selo } from "@/components/ui/selo";
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
}: {
  rotulo: string;
  instante: string | null;
  situacao: SituacaoEnvio | null;
}) {
  const hora = instante ? horaEmBrasilia(instante) : null;
  return (
    <p className="flex flex-col gap-0.5" data-marca={rotulo.toLowerCase()}>
      <span className="text-mini text-texto-2 font-semibold">{rotulo}</span>
      <span className="text-3 text-texto font-mono">{hora ?? "ainda não"}</span>
      {situacao ? (
        <span
          className={
            situacao === "sincronizado"
              ? "text-mini text-sucesso"
              : situacao === "no_aparelho"
                ? "text-mini text-aviso-texto"
                : "text-mini text-alerta"
          }
        >
          {TEXTO_SITUACAO[situacao]}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Cartão da visita de hoje (protótipo enfermeira-hoje.html; P38 item 1):
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

  return (
    <article
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
      aria-labelledby={`visita-${v.visitaId}`}
      data-visita={v.visitaId}
      data-estado-visita={v.estado}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p>
          <span className="text-2 text-texto font-mono font-semibold">
            {v.horaPrevista ?? "sem hora"}
          </span>{" "}
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
            className="text-corpo text-texto min-h-toque inline-flex items-start gap-2 py-2 underline underline-offset-4"
          >
            <MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>
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
            className="text-corpo text-texto min-h-toque inline-flex items-center gap-2 underline underline-offset-4"
            aria-label={`Ligar para ${primeiroNome ?? "a família"}, ${formatarTelefone(v.contatoTelefone)}`}
          >
            <Phone className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-mono">
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
        className="tablet:grid-cols-2 grid grid-cols-2 gap-4"
        aria-label="Chegada e saída"
      >
        <Marca
          rotulo="Chegada"
          instante={v.checkinEm}
          situacao={v.chegadaSituacao}
        />
        <Marca
          rotulo="Saída"
          instante={v.checkoutEm}
          situacao={v.saidaSituacao}
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
            className="min-h-toque-campo"
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
            className="min-h-toque-campo"
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
