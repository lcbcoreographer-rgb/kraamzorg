import Image from "next/image";
import { Check, Circle, CircleDot } from "lucide-react";
import type {
  ContatoEquipePortal,
  PortalFamilia,
  PortalFamiliaCompleto,
} from "@/lib/dados/tipos-relacao";
import {
  formatarData,
  formatarDataHora,
  formatarTelefone,
} from "@/lib/formatacao";
import { montarPassos, type Passo } from "../passos";
import { BotaoSair } from "./botao-sair";

/**
 * O portal da família (P49), na direção de acolhimento do DESIGN.md 11: chama
 * pelo nome, situa no tempo da família, diz o que vem agora e quem faz, e não
 * finge calor. Datas de fato e estimativa nunca se misturam. Frases que falam
 * com a família vêm de mensagem_modelo (textos do portal); aqui ficam só os
 * rótulos curtos da tela.
 */

const ROTULO_ESTADO: Record<Passo["estado"], string> = {
  feito: "Feito",
  agora: "Agora",
  depois: "Em seguida",
};

function ContatoDaEquipe({ contato }: { contato: ContatoEquipePortal }) {
  return (
    <div className="flex flex-col gap-1">
      {contato.nome ? (
        <p className="text-3 text-texto">{contato.nome}</p>
      ) : null}
      {contato.funcao ? (
        <p className="text-corpo text-texto-2">{contato.funcao}</p>
      ) : null}
      {contato.telefoneE164 ? (
        <p className="text-corpo text-texto">
          <a
            className="font-mono underline underline-offset-4"
            href={`tel:${contato.telefoneE164}`}
          >
            {formatarTelefone(contato.telefoneE164) ?? contato.telefoneE164}
          </a>
        </p>
      ) : null}
      {contato.horario ? (
        <p className="text-corpo text-texto-2">{contato.horario}</p>
      ) : null}
    </div>
  );
}

function ItemPasso({ passo }: { passo: Passo }) {
  const Icone =
    passo.estado === "feito"
      ? Check
      : passo.estado === "agora"
        ? CircleDot
        : Circle;
  // O que já aconteceu fica quieto (linha simples, sem cartão); o passo de
  // agora é o único cartão com a borda dourada; o que vem depois fica
  // tracejado. Assim a família acha o "agora" sem ler a lista inteira.
  // Com a data da próxima visita já marcada, a frase de espera ("as visitas
  // aparecem aqui quando a coordenação confirmar") contradiz a data e sai.
  const apoio =
    passo.chave === "visitas" && passo.dataMarcada ? null : passo.apoio;
  return (
    <li
      data-passo={passo.chave}
      data-estado={passo.estado}
      aria-current={passo.estado === "agora" ? "step" : undefined}
      className={
        passo.estado === "agora"
          ? "rounded-3 border-dourado bg-superficie shadow-1 my-2 flex gap-4 border-2 p-4"
          : passo.estado === "depois"
            ? "rounded-3 border-marinho-50 flex gap-4 border-[1.5px] border-dashed p-4"
            : "border-linha flex gap-4 border-b px-1 py-3"
      }
    >
      <Icone
        aria-hidden="true"
        strokeWidth={1.75}
        className={
          passo.estado === "feito"
            ? "text-sucesso mt-0.5 size-5 shrink-0"
            : "text-texto mt-1 size-5 shrink-0"
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={
            passo.estado === "feito"
              ? "text-corpo text-texto flex flex-wrap items-baseline justify-between gap-x-3"
              : "text-3 text-texto font-medium"
          }
        >
          <span>
            {passo.titulo}
            <span
              className={
                passo.estado === "feito"
                  ? "sr-only"
                  : "text-corpo text-texto-2 font-normal"
              }
            >
              {" "}
              · {ROTULO_ESTADO[passo.estado]}
            </span>
          </span>
          {passo.estado === "feito" && passo.data ? (
            <span className="text-apoio text-texto-2 font-mono">
              {formatarData(passo.data)}
            </span>
          ) : null}
        </p>
        {passo.estado !== "feito" && passo.data ? (
          <p className="text-corpo text-texto-2 font-mono">
            {passo.dataMarcada ? "Marcada para " : ""}
            {passo.chave === "prenatal" && passo.dataMarcada
              ? formatarDataHora(passo.data)
              : formatarData(passo.data)}
          </p>
        ) : null}
        {apoio ? (
          <p className="text-corpo text-texto max-w-[56ch]">{apoio}</p>
        ) : null}
      </div>
    </li>
  );
}

function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Completo({
  portal,
  hoje,
}: {
  portal: PortalFamiliaCompleto;
  hoje: string;
}) {
  const t = portal.textos;
  const passos = montarPassos(portal, hoje);
  const d = portal.datas;
  const datas: {
    chave: string;
    rotulo: string;
    valor: string;
    marca: "estimativa" | "fato";
  }[] = [];
  if (d.dpp)
    datas.push({
      chave: "dpp",
      rotulo: "Data provável do parto",
      valor: d.dpp,
      marca: "estimativa",
    });
  if (d.dataNascimento)
    datas.push({
      chave: "nascimento",
      rotulo: "Nascimento",
      valor: d.dataNascimento,
      marca: "fato",
    });
  if (d.dataAlta)
    datas.push({
      chave: "alta",
      rotulo: "Alta da maternidade",
      valor: d.dataAlta,
      marca: "fato",
    });
  if (d.dataInicioEfetivo)
    datas.push({
      chave: "inicio",
      rotulo: "Início das visitas",
      valor: d.dataInicioEfetivo,
      marca: "fato",
    });

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="font-titulo text-1 text-texto font-normal">
          {t.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[60ch]">{t.boas_vindas}</p>
      </header>

      <Secao id="passos" titulo={t.passos_titulo ?? "Seus próximos passos"}>
        <ol className="flex flex-col gap-2">
          {passos.map((p) => (
            <ItemPasso key={p.chave} passo={p} />
          ))}
        </ol>
      </Secao>

      {datas.length > 0 ? (
        <Secao id="datas" titulo={t.datas_titulo ?? "Datas"}>
          <dl className="rounded-3 bg-superficie-2 flex flex-col gap-3 p-5">
            {datas.map((x) => (
              <div
                key={x.chave}
                className="tablet:flex-row tablet:items-baseline tablet:justify-between tablet:gap-4 flex flex-col gap-0.5"
              >
                <dt className="text-corpo text-texto">
                  {x.rotulo}{" "}
                  <span className="text-texto-2 italic">
                    ({x.marca === "estimativa" ? "estimativa" : "confirmado"})
                  </span>
                </dt>
                <dd className="text-corpo text-texto font-mono">
                  {formatarData(x.valor)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-corpo text-texto-2 max-w-[60ch]">{t.dpp_nota}</p>
        </Secao>
      ) : null}

      <Secao id="enfermeira" titulo={t.enfermeira_titulo ?? "Sua enfermeira"}>
        <div className="rounded-3 bg-superficie-2 flex items-center gap-4 p-5">
          {portal.enfermeira?.fotoPath && portal.enfermeira.nome ? (
            <Image
              src="/familia/foto"
              alt={`Foto de ${portal.enfermeira.nome}`}
              width={72}
              height={72}
              unoptimized
              className="size-[72px] rounded-full object-cover"
            />
          ) : null}
          <p className="text-3 text-texto max-w-[52ch]">
            {portal.enfermeira === null
              ? t.enfermeira_sem_designacao
              : (portal.enfermeira.nome ?? t.enfermeira_sem_nome)}
          </p>
        </div>
      </Secao>

      <Secao id="visitas" titulo={t.visitas_titulo ?? "Visitas em casa"}>
        {portal.visitas.length === 0 ? (
          <p className="text-corpo text-texto max-w-[60ch]">
            {t.visitas_vazio}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {portal.visitas.map((v) => (
              <li
                key={v.dia}
                className="rounded-3 bg-superficie tablet:grid-cols-[auto_1fr_auto] grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 p-4"
              >
                <span className="text-corpo text-texto font-medium">
                  Dia {v.dia}
                  {portal.acompanhamento
                    ? ` de ${portal.acompanhamento.diasContratados}`
                    : ""}
                </span>
                <span className="text-corpo text-texto-2 tablet:order-last text-right">
                  {v.feita ? "Feita" : "Marcada"}
                </span>
                <span className="text-corpo text-texto tablet:col-span-1 col-span-2 font-mono">
                  {formatarData(v.data)}
                  {v.hora ? `, ${v.hora}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao id="guia" titulo={t.guia_titulo ?? "Guia de início"}>
        <p className="text-corpo text-texto max-w-[60ch]">{t.guia_inicio}</p>
      </Secao>

      {portal.evolucoes.ativo ? (
        <Secao
          id="evolucoes"
          titulo={t.evolucoes_titulo ?? "Evoluções de enfermagem"}
        >
          {portal.evolucoes.itens.length === 0 ? (
            <p className="text-corpo text-texto max-w-[60ch]">
              {t.evolucoes_vazio}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {portal.evolucoes.itens.map((e) => (
                <li key={e.id} className="text-corpo text-texto">
                  {e.tipo === "neonatal"
                    ? "Evolução do bebê"
                    : "Evolução da mãe"}
                  {e.enviadoEm
                    ? `, enviada em ${formatarData(e.enviadoEm)}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </Secao>
      ) : null}

      <Secao id="pesquisa" titulo={t.pesquisa_titulo ?? "Sua opinião"}>
        <p className="text-corpo text-texto max-w-[60ch]">
          {portal.pesquisa?.respondida
            ? t.pesquisa_respondida
            : portal.pesquisa?.enviada
              ? t.pesquisa_enviada
              : t.pesquisa_espera}
        </p>
      </Secao>

      <Secao id="contato" titulo={t.contato_titulo ?? "Fale com a equipe"}>
        <div className="rounded-3 bg-superficie-2 flex flex-col gap-3 p-5">
          <ContatoDaEquipe contato={portal.contato} />
          <p className="text-corpo text-texto-2 max-w-[56ch]">
            {t.contato_apoio}
          </p>
        </div>
      </Secao>
    </>
  );
}

function SoContato({
  portal,
}: {
  portal: Exclude<PortalFamilia, { situacao: "ok" }>;
}) {
  const t = portal.textos;
  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="font-titulo text-1 text-texto font-normal">
          {t.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[56ch]">{t.texto}</p>
      </header>
      <Secao id="contato" titulo={t.contato_titulo ?? "Quem está com vocês"}>
        <div className="rounded-3 bg-superficie-2 p-5">
          <ContatoDaEquipe contato={portal.contato} />
        </div>
      </Secao>
    </>
  );
}

export function PortalFamiliaTela({
  portal,
  hoje,
}: {
  portal: PortalFamilia;
  hoje: string;
}) {
  return (
    <div className="flex flex-col gap-8" data-portal={portal.situacao}>
      {portal.situacao === "ok" ? (
        <Completo portal={portal} hoje={hoje} />
      ) : (
        <SoContato portal={portal} />
      )}
      <BotaoSair />
    </div>
  );
}
