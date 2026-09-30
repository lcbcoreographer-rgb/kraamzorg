"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardPen, PhoneCall } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import {
  camposFaltandoDoAcionamento,
  linkDeLigacao,
  tituloDoAchado,
  varianteDaFaixa,
} from "@/lib/checklist/alertas";
import { dataCurta } from "@/lib/checklist/formato";
import type { AcionamentoAlerta } from "@/lib/checklist/registro";
import type { AlertaClinicoResumo } from "@/lib/dados/tipos-assistencial";
import { textos } from "../checklist/textos";
import {
  FolhaAcionamento,
  horaAgoraEmBrasilia,
} from "../componentes/folha-acionamento";
import type { AlertaNaTela } from "../tipos";
import { acaoFecharAlerta, acaoRegistrarAcionamento } from "./acoes";
import { textosAlertas } from "./textos";

/**
 * Lista de alertas clínicos (P40): a enfermeira registra o acionamento dos
 * alertas das famílias dela; a coordenação completa o registro e fecha; a
 * diretoria só lê. Cada alerta mostra o código da regra, o achado com o
 * valor, a conduta aprovada sem paráfrase e os quatro campos do DOC 3.
 * Alerta imediato usa o token `alerta`; família em luto ou intercorrência
 * usa a variante `sensivel`, nunca o vermelho.
 */

export type PapelNaLista = "enfermeira" | "coordenacao" | "diretoria";

export interface ListaDeAlertasProps {
  alertas: AlertaClinicoResumo[];
  /** Telefone da supervisão médica em E.164 (parâmetro); vazio se não informado. */
  telefone: string;
  papel: PapelNaLista;
}

function paraAlertaNaTela(a: AlertaClinicoResumo): AlertaNaTela {
  const acionamento: AcionamentoAlerta | undefined =
    a.sinalIdentificado ||
    a.acionadoEm ||
    a.orientacaoMedica ||
    a.condutaAdotada
      ? {
          regraId: a.regraId,
          bebeId: a.bebeId,
          sinalIdentificado: a.sinalIdentificado ?? "",
          acionadoEm: a.acionadoEm ?? "",
          orientacaoMedica: a.orientacaoMedica ?? "",
          condutaAdotada: a.condutaAdotada ?? "",
        }
      : undefined;
  return {
    chave: a.id,
    regraId: a.regraId,
    bebeId: a.bebeId,
    bebeRotulo: null,
    grupo: a.grupo,
    severidade: a.severidade,
    descricao: a.descricao,
    conduta: a.conduta,
    campo: a.campo,
    valorLegivel: a.valorObservado,
    acionamento,
    servidor: { id: a.id, versao: a.versao, fechado: Boolean(a.fechadoEm) },
    privado: a.grupo === "saude_mental" && a.severidade === "imediato",
    sensivel:
      a.estadoSensivel === "bloqueio_total" ||
      a.estadoSensivel === "encerrado_sensivel",
  };
}

export function ListaDeAlertas({
  alertas,
  telefone,
  papel,
}: ListaDeAlertasProps) {
  const router = useRouter();
  const [emFolha, definirEmFolha] = React.useState<AlertaClinicoResumo | null>(
    null,
  );
  const [aviso, definirAviso] = React.useState<{
    texto: string;
    erro: boolean;
  } | null>(null);
  const [fechando, definirFechando] = React.useState<string | null>(null);

  const noFolha = emFolha ? paraAlertaNaTela(emFolha) : null;

  async function salvar(acionamento: AcionamentoAlerta) {
    if (!emFolha) return;
    const resultado = await acaoRegistrarAcionamento({
      alertaId: emFolha.id,
      versaoBase: emFolha.versao,
      sinalIdentificado: acionamento.sinalIdentificado,
      acionadoEm: acionamento.acionadoEm,
      orientacaoMedica: acionamento.orientacaoMedica,
      condutaAdotada: acionamento.condutaAdotada,
    });
    if (resultado.ok) {
      definirAviso({ texto: textosAlertas.salvo, erro: false });
      router.refresh();
    } else {
      definirAviso({ texto: resultado.mensagem, erro: true });
    }
  }

  async function fechar(a: AlertaClinicoResumo) {
    definirFechando(a.id);
    try {
      const resultado = await acaoFecharAlerta(a.id, a.versao);
      if (resultado.ok) {
        definirAviso({ texto: textosAlertas.fechadoAviso, erro: false });
        router.refresh();
      } else {
        definirAviso({ texto: resultado.mensagem, erro: true });
      }
    } catch {
      definirAviso({ texto: textosAlertas.falhaAtualizar, erro: true });
    } finally {
      definirFechando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso ? (
        <p
          role={aviso.erro ? "alert" : "status"}
          className={
            aviso.erro
              ? "text-apoio text-alerta font-semibold"
              : "text-apoio text-sucesso font-semibold"
          }
        >
          {aviso.texto}
        </p>
      ) : null}
      <ul className="flex flex-col gap-4">
        {alertas.map((a) => (
          <li key={a.id}>
            <ItemDoAlerta
              alerta={a}
              telefone={telefone}
              papel={papel}
              fechando={fechando === a.id}
              aoRegistrar={() => definirEmFolha(a)}
              aoFechar={() => void fechar(a)}
            />
          </li>
        ))}
      </ul>
      <FolhaAcionamento
        aberto={emFolha !== null}
        aoFechar={() => definirEmFolha(null)}
        alerta={noFolha}
        aoSalvar={salvar}
      />
    </div>
  );
}

function ItemDoAlerta({
  alerta,
  telefone,
  papel,
  fechando,
  aoRegistrar,
  aoFechar,
}: {
  alerta: AlertaClinicoResumo;
  telefone: string;
  papel: PapelNaLista;
  fechando: boolean;
  aoRegistrar: () => void;
  aoFechar: () => void;
}) {
  const naTela = paraAlertaNaTela(alerta);
  const fechado = Boolean(alerta.fechadoEm);
  const faltam = camposFaltandoDoAcionamento(naTela.acionamento);
  const variante = fechado
    ? "sucesso"
    : varianteDaFaixa(naTela.severidade, naTela.sensivel);
  const link = linkDeLigacao(telefone);
  const podeRegistrar = !fechado && papel !== "diretoria";
  const podeFechar = !fechado && papel === "coordenacao";

  const titulo = naTela.privado
    ? textosAlertas.ocorrenciaPrivada
    : tituloDoAchado(alerta.descricao, alerta.valorObservado);

  return (
    <article
      aria-label={`${alerta.regraId}, ${alerta.nomeFamilia}`}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-3 text-texto font-semibold">
          {alerta.nomeFamilia}
        </h2>
        {alerta.diaNumero ? (
          <span className="text-apoio text-texto-2">
            {textosAlertas.dia(alerta.diaNumero)}
          </span>
        ) : null}
        {fechado ? (
          <Selo
            variante="sucesso"
            icone={<CircleCheck className="size-4" aria-hidden="true" />}
          >
            {textosAlertas.fechadoEm(dataCurta(alerta.fechadoEm!))}
          </Selo>
        ) : (
          <Selo variante="neutro">{textosAlertas.aberto}</Selo>
        )}
        {alerta.visitaId ? (
          <Link
            href={`/visita/${alerta.visitaId}`}
            className="text-apoio text-texto ml-auto font-semibold underline underline-offset-4"
          >
            {textosAlertas.abrirVisita}
          </Link>
        ) : null}
      </div>
      <FaixaAlerta
        variante={variante}
        codigo={alerta.regraId}
        titulo={titulo}
        anunciar={false}
        meta={
          fechado
            ? undefined
            : faltam.length === 0
              ? papel === "coordenacao"
                ? textosAlertas.podeFechar
                : textos.alerta.registrado
              : textosAlertas.faltamParaFechar(
                  faltam.map((f) => textos.folhaAcionamento.campoDe[f]),
                )
        }
        acoes={
          <>
            {!fechado && link ? (
              <Botao
                asChild
                variante={variante === "imediato" ? "perigo" : "secundario"}
                tamanho="compacto"
              >
                <a href={link}>
                  <PhoneCall className="size-[18px]" aria-hidden="true" />
                  {textos.alerta.ligar}
                </a>
              </Botao>
            ) : null}
            {podeRegistrar ? (
              <Botao
                variante="secundario"
                tamanho="compacto"
                onClick={aoRegistrar}
              >
                <ClipboardPen className="size-[18px]" aria-hidden="true" />
                {faltam.length === 4
                  ? textosAlertas.registrar
                  : textosAlertas.completar}
              </Botao>
            ) : null}
            {podeFechar ? (
              <Botao
                tamanho="compacto"
                onClick={aoFechar}
                disabled={faltam.length > 0}
                carregando={fechando}
              >
                {textosAlertas.fechar}
              </Botao>
            ) : null}
            {!fechado && papel === "diretoria" ? (
              <span className="text-apoio text-texto-2">
                {textosAlertas.soLeitura}
              </span>
            ) : null}
          </>
        }
      >
        {naTela.privado ? null : alerta.conduta}
      </FaixaAlerta>
      <RegistroDoAcionamento alerta={alerta} />
    </article>
  );
}

function RegistroDoAcionamento({ alerta }: { alerta: AlertaClinicoResumo }) {
  const linhas: [string, string | null][] = [
    [textosAlertas.registro.sinal, alerta.sinalIdentificado],
    [
      textosAlertas.registro.horario,
      alerta.acionadoEm ? horaLegivel(alerta.acionadoEm) : null,
    ],
    [textosAlertas.registro.orientacao, alerta.orientacaoMedica],
    [textosAlertas.registro.conduta, alerta.condutaAdotada],
  ];
  if (linhas.every(([, valor]) => !valor)) return null;
  return (
    <section
      aria-label={textosAlertas.registro.titulo}
      className="rounded-2 bg-superficie border-linha border p-4"
    >
      <h3 className="text-apoio text-texto-2 mb-2 font-semibold">
        {textosAlertas.registro.titulo}
      </h3>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-apoio text-texto-2">{rotulo}</dt>
            <dd className="text-corpo text-texto">
              {valor ?? textosAlertas.registro.naoRegistrado}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "29/09/2026 às 10:14" no horário de Brasília. */
function horaLegivel(iso: string): string {
  const instante = new Date(iso);
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
  return `${dataCurta(data)} às ${horaAgoraEmBrasilia(instante)}`;
}

/** Estado vazio da lista, usado pelas duas páginas. */
export function VazioDosAlertas({
  situacao,
}: {
  situacao: "abertos" | "fechados";
}) {
  const v =
    situacao === "abertos"
      ? textosAlertas.vazioAbertos
      : textosAlertas.vazioFechados;
  return <EstadoVazio titulo={v.titulo} texto={v.texto} />;
}
