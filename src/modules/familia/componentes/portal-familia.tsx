import Image from "next/image";
import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  CircleDot,
  ClipboardList,
  House,
  MessageSquareText,
  Phone,
  UserRound,
} from "lucide-react";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
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
import { cn } from "@/lib/utils";
import { montarPassos, type Passo } from "../passos";
import { BotaoSair } from "./botao-sair";

/**
 * O portal da família (P49), na direção "Colo" com a camada de acolhimento
 * do DESIGN.md 11: abre num bloco colo com o cumprimento pelo nome, situa no
 * tempo da família, diz o que vem agora e quem faz, e não finge calor. Cada
 * assunto mora num bloco com a cor do que ele é (o tempo em lavanda, as
 * pessoas em argila, a família em areia) e o contato com a equipe é o único
 * bloco forte, em marinho. Datas de fato e estimativa nunca se misturam.
 * Frases que falam com a família vêm de mensagem_modelo (textos do portal);
 * aqui ficam só os rótulos curtos da tela. Família em pausa (freio, perda)
 * vê só o contato, sem tom de apoio.
 */

const ROTULO_ESTADO: Record<Passo["estado"], string> = {
  feito: "Feito",
  agora: "Agora",
  depois: "Em seguida",
};

function ContatoDaEquipe({
  contato,
  forte,
}: {
  contato: ContatoEquipePortal;
  /** Dentro do bloco marinho: texto creme. */
  forte: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {contato.nome ? (
        <p
          className={cn(
            "font-titulo text-2 font-medium",
            forte ? "text-texto-inverso" : "text-texto",
          )}
        >
          {contato.nome}
        </p>
      ) : null}
      {contato.funcao ? (
        <p
          className={cn(
            "text-corpo",
            forte ? "text-texto-inverso-2" : "text-texto-2",
          )}
        >
          {contato.funcao}
        </p>
      ) : null}
      {contato.telefoneE164 ? (
        <p className="pt-2">
          <a
            className={cn(
              "rounded-pilula text-corpo min-h-toque inline-flex items-center gap-2 px-5 font-semibold no-underline",
              forte
                ? "bg-creme text-marinho"
                : "border-borda-campo bg-superficie text-texto border-[1.5px]",
            )}
            href={`tel:${contato.telefoneE164}`}
          >
            <Phone className="size-5" aria-hidden="true" strokeWidth={1.75} />
            <span className="font-mono">
              {formatarTelefone(contato.telefoneE164) ?? contato.telefoneE164}
            </span>
          </a>
        </p>
      ) : null}
      {contato.horario ? (
        <p
          className={cn(
            "text-corpo pt-1",
            forte ? "text-texto-inverso-2" : "text-texto-2",
          )}
        >
          {contato.horario}
        </p>
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
        : ClipboardList;
  // O que já aconteceu fica quieto, num bloco sálvia baixo (o feito); o passo
  // de agora é o bloco dourado, maior, com a frase do que acontece; o que vem
  // depois fica tracejado ("ainda não"). A família acha o "agora" sem ler a
  // lista inteira. Com a data da próxima visita já marcada, a frase de espera
  // ("as visitas aparecem aqui quando a coordenação confirmar") contradiz a
  // data e sai.
  const apoio =
    passo.chave === "visitas" && passo.dataMarcada ? null : passo.apoio;
  return (
    <li
      data-passo={passo.chave}
      data-estado={passo.estado}
      aria-current={passo.estado === "agora" ? "step" : undefined}
      className={cn(
        "flex items-start gap-3",
        passo.estado === "agora"
          ? "rounded-3 bg-dourado-claro my-1 p-4"
          : passo.estado === "depois"
            ? "rounded-2 border-marinho-50 border-[1.5px] border-dashed px-3 py-3"
            : "rounded-2 bg-salvia-clara px-3 py-2.5",
      )}
    >
      <TileIcone
        tom={
          passo.estado === "agora"
            ? "dourado"
            : passo.estado === "feito"
              ? "salvia"
              : "branco"
        }
        tamanho={passo.estado === "agora" ? "m" : "p"}
      >
        <Icone />
      </TileIcone>
      <div className="flex min-w-0 flex-1 flex-col gap-1 self-center">
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
            <span className="text-corpo text-texto-2 font-mono">
              {formatarData(passo.data)}
            </span>
          ) : null}
        </p>
        {passo.estado !== "feito" && passo.data ? (
          <p className="text-corpo text-texto font-mono">
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
  icone,
  tom,
  children,
}: {
  id: string;
  titulo: string;
  icone: ReactNode;
  tom: Tom;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TileIcone tom={tom} forma="quadrado">
          {icone}
        </TileIcone>
        <h2 id={id} className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </h2>
      </div>
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
      <header className="rounded-colo bg-dourado-claro flex flex-col gap-3 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {t.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[56ch]">{t.boas_vindas}</p>
      </header>

      <Secao
        id="passos"
        titulo={t.passos_titulo ?? "Seus próximos passos"}
        icone={<ClipboardList />}
        tom="dourado"
      >
        <ol className="flex flex-col gap-2">
          {passos.map((p) => (
            <ItemPasso key={p.chave} passo={p} />
          ))}
        </ol>
      </Secao>

      {datas.length > 0 ? (
        <Secao
          id="datas"
          titulo={t.datas_titulo ?? "Datas"}
          icone={<CalendarDays />}
          tom="lavanda"
        >
          <div className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-3">
            <dl className="tablet:grid-cols-2 grid grid-cols-1 gap-2">
              {datas.map((x) => (
                <div
                  key={x.chave}
                  className="rounded-2 bg-superficie flex flex-col gap-1 px-4 py-3"
                >
                  <dt className="text-corpo text-texto">
                    {x.rotulo}{" "}
                    <span className="text-texto-2 italic">
                      ({x.marca === "estimativa" ? "estimativa" : "confirmado"})
                    </span>
                  </dt>
                  <dd className="text-3 text-texto font-mono font-medium">
                    {formatarData(x.valor)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-corpo text-texto-2 max-w-[60ch] px-2 pb-1">
              {t.dpp_nota}
            </p>
          </div>
        </Secao>
      ) : null}

      <Secao
        id="enfermeira"
        titulo={t.enfermeira_titulo ?? "Sua enfermeira"}
        icone={<UserRound />}
        tom="argila"
      >
        <div className="rounded-3 bg-argila-clara flex items-center gap-4 p-5">
          {portal.enfermeira?.fotoPath && portal.enfermeira.nome ? (
            <Image
              src="/familia/foto"
              alt={`Foto de ${portal.enfermeira.nome}`}
              width={72}
              height={72}
              unoptimized
              className="size-[72px] rounded-full object-cover"
            />
          ) : (
            <TileIcone tom="argila" tamanho="g">
              <UserRound />
            </TileIcone>
          )}
          <p className="text-3 text-texto max-w-[52ch]">
            {portal.enfermeira === null
              ? t.enfermeira_sem_designacao
              : (portal.enfermeira.nome ?? t.enfermeira_sem_nome)}
          </p>
        </div>
      </Secao>

      <Secao
        id="visitas"
        titulo={t.visitas_titulo ?? "Visitas em casa"}
        icone={<House />}
        tom="lavanda"
      >
        {portal.visitas.length === 0 ? (
          <p className="rounded-3 bg-lavanda-clara text-corpo text-texto max-w-[60ch] p-5">
            {t.visitas_vazio}
          </p>
        ) : (
          <ul className="rounded-3 bg-lavanda-clara flex flex-col gap-2 p-3">
            {portal.visitas.map((v) => (
              <li
                key={v.dia}
                className={cn(
                  "rounded-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3",
                  v.feita ? "bg-salvia-clara" : "bg-superficie",
                )}
              >
                <span className="text-corpo text-texto font-medium">
                  Dia {v.dia}
                  {portal.acompanhamento
                    ? ` de ${portal.acompanhamento.diasContratados}`
                    : ""}
                </span>
                <span
                  className={cn(
                    "rounded-pilula text-corpo inline-flex items-center gap-1.5 px-3 py-0.5",
                    v.feita
                      ? "bg-salvia-media text-texto"
                      : "bg-lavanda-clara text-texto",
                  )}
                >
                  {v.feita ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : null}
                  {v.feita ? "Feita" : "Marcada"}
                </span>
                <span className="text-corpo text-texto col-span-2 font-mono">
                  {formatarData(v.data)}
                  {v.hora ? `, ${v.hora}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        id="guia"
        titulo={t.guia_titulo ?? "Guia de início"}
        icone={<BookOpen />}
        tom="areia"
      >
        <p className="rounded-3 bg-areia-clara text-corpo text-texto p-5">
          {t.guia_inicio}
        </p>
      </Secao>

      {portal.evolucoes.ativo ? (
        <Secao
          id="evolucoes"
          titulo={t.evolucoes_titulo ?? "Evoluções de enfermagem"}
          icone={<ClipboardList />}
          tom="areia"
        >
          {portal.evolucoes.itens.length === 0 ? (
            <p className="rounded-3 bg-areia-clara text-corpo text-texto p-5">
              {t.evolucoes_vazio}
            </p>
          ) : (
            <ul className="rounded-3 bg-areia-clara flex flex-col gap-2 p-3">
              {portal.evolucoes.itens.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2 bg-superficie text-corpo text-texto px-4 py-3"
                >
                  {e.tipo === "neonatal"
                    ? "Evolução do bebê"
                    : "Evolução da mãe"}
                  {e.enviadoEm ? (
                    <>
                      , enviada em{" "}
                      <span className="font-mono">
                        {formatarData(e.enviadoEm)}
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Secao>
      ) : null}

      <Secao
        id="pesquisa"
        titulo={t.pesquisa_titulo ?? "Sua opinião"}
        icone={<MessageSquareText />}
        tom="argila"
      >
        <p className="rounded-3 bg-argila-clara text-corpo text-texto p-5">
          {portal.pesquisa?.respondida
            ? t.pesquisa_respondida
            : portal.pesquisa?.enviada
              ? t.pesquisa_enviada
              : t.pesquisa_espera}
        </p>
      </Secao>

      <section
        aria-labelledby="contato"
        className="rounded-3 bg-marinho flex flex-col gap-4 p-5"
      >
        <div className="flex items-center gap-3">
          <TileIcone tom="branco" forma="quadrado">
            <Phone />
          </TileIcone>
          <h2
            id="contato"
            className="font-titulo text-2 text-texto-inverso font-medium"
          >
            {t.contato_titulo ?? "Fale com a equipe"}
          </h2>
        </div>
        <ContatoDaEquipe contato={portal.contato} forte />
        <p className="text-corpo text-texto-inverso-2 max-w-[56ch]">
          {t.contato_apoio}
        </p>
      </section>
    </>
  );
}

function SoContato({
  portal,
}: {
  portal: Exclude<PortalFamilia, { situacao: "ok" }>;
}) {
  const t = portal.textos;
  // Família em pausa (freio, perda): creme e branco, sem tom de apoio e sem
  // bloco forte (DESIGN.md 11.8). Só quem está com eles e como falar.
  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="font-titulo text-1 text-texto font-normal">
          {t.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[56ch]">{t.texto}</p>
      </header>
      <section aria-labelledby="contato" className="flex flex-col gap-3">
        <h2 id="contato" className="font-titulo text-2 text-texto font-medium">
          {t.contato_titulo ?? "Quem está com vocês"}
        </h2>
        <div className="rounded-3 bg-superficie border-linha border p-5">
          <ContatoDaEquipe contato={portal.contato} forte={false} />
        </div>
      </section>
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
