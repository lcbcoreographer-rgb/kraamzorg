"use client";

import * as React from "react";
import {
  CalendarDays,
  ClipboardPen,
  Inbox,
  ListTodo,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Thermometer,
  UserCheck,
} from "lucide-react";
import { ILUSTRACOES, type NomeIlustracao } from "@/components/ilustracoes";
import { CabecalhoSaudacao } from "@/components/shell/cabecalho-saudacao";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { AnelProgresso } from "@/components/ui/anel-progresso";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { Comemoracao } from "@/components/ui/comemoracao";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { ProgressoEtapas } from "@/components/ui/progresso-etapas";
import { SimNao } from "@/components/ui/sim-nao";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";

/**
 * Vitrine da direção "Colo" [v4.4] (DESIGN.md, seção 2; PRD 20.2): tons
 * de apoio, forma, números grandes, ícone em tile, abas em pílula,
 * progresso, cabeçalho com cumprimento, lista em blocos, pergunta em
 * cartão, as dez ilustrações e a comemoração. Dados fictícios.
 */
function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 py-8">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </h2>
        {descricao ? (
          <p className="text-apoio text-texto-2 max-w-[64ch]">{descricao}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const TONS: {
  tom: Tom;
  nome: string;
  papel: string;
  claro: string;
  medio: string;
  receita: string;
  contraste: string;
}[] = [
  {
    tom: "dourado",
    nome: "dourado-claro e dourado-medio",
    papel: "O agora: o dia, a visita em curso, a etapa atual",
    claro: "bg-dourado-claro",
    medio: "bg-dourado-medio",
    receita: "dourado 30% e 55% + creme",
    contraste: "marinho 12,2:1 e 9,8:1; texto-2 5,0:1 só no claro",
  },
  {
    tom: "areia",
    nome: "areia-clara e areia",
    papel: "A família e o que já foi guardado",
    claro: "bg-areia-clara",
    medio: "bg-areia",
    receita: "areia 55% + creme; areia da marca",
    contraste: "marinho 13,6:1 e 12,0:1; texto-2 5,6:1 e 4,9:1",
  },
  {
    tom: "salvia",
    nome: "salvia-clara e salvia-media",
    papel: "O que está feito",
    claro: "bg-salvia-clara",
    medio: "bg-salvia-media",
    receita: "sucesso 18% e 40% + creme",
    contraste: "marinho 12,3:1 e 9,0:1; texto-2 5,1:1 só no claro",
  },
  {
    tom: "lavanda",
    nome: "lavanda-clara e lavanda-media",
    papel: "O tempo: amanhã, a semana, a agenda",
    claro: "bg-lavanda-clara",
    medio: "bg-lavanda-media",
    receita: "sensivel 18% e 36% + branco",
    contraste: "marinho 12,7:1 e 9,5:1; texto-2 5,2:1 só no claro",
  },
  {
    tom: "argila",
    nome: "argila-clara e argila-media",
    papel: "As pessoas e as conversas",
    claro: "bg-argila-clara",
    medio: "bg-argila-media",
    receita: "alerta 14% e 30% + creme",
    contraste: "marinho 12,7:1 e 9,9:1; texto-2 5,2:1 só no claro",
  },
];

const ICONE_DO_TOM: Record<Tom, React.ReactNode> = {
  dourado: <MapPin />,
  areia: <ClipboardPen />,
  salvia: <UserCheck />,
  lavanda: <CalendarDays />,
  argila: <MessageCircle />,
};

export function VitrineColo() {
  const [aba, definirAba] = React.useState("semana");
  const [resposta, definirResposta] = React.useState<"sim" | "nao">();
  const [rodada, definirRodada] = React.useState(0);
  const etapas = [
    "chegada",
    "puerpera",
    "sinais",
    "mamas",
    "bebe",
    "orientacoes",
    "emocional",
    "resumo",
  ];

  return (
    <>
      <Secao
        id="s-colo-tons"
        titulo="Tons de apoio"
        descricao="Misturas das cores da marca (PRD 20.2, v4.4). A paleta base não muda. Tom é superfície, nunca estado, e nunca aparece em freio, perda, intercorrência ou alerta clínico."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TONS.map((t) => (
            <li
              key={t.tom}
              className={`rounded-3 flex flex-col gap-3 p-4 ${t.claro}`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`rounded-2 inline-flex size-12 items-center justify-center ${t.medio} [&_svg]:size-5`}
                >
                  {ICONE_DO_TOM[t.tom]}
                </span>
                <p className="text-apoio text-texto font-mono font-medium">
                  {t.nome}
                </p>
              </div>
              <p className="text-corpo text-texto font-medium">{t.papel}</p>
              <p className="text-mini text-texto-2">
                {t.receita}. {t.contraste}.
              </p>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        id="s-colo-forma"
        titulo="Forma"
        descricao="Quatro raios (6, 16, 28 e pílula) e a forma colo: o bloco de abertura com a base em arco raso, como a curva do símbolo."
      >
        <div className="flex flex-wrap items-end gap-4">
          {(
            [
              ["rounded-1", "raio-1, 6 px"],
              ["rounded-2", "raio-2, 16 px"],
              ["rounded-3", "raio-3, 28 px"],
              ["rounded-pilula", "pílula"],
            ] as const
          ).map(([classe, rotulo]) => (
            <div key={classe} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={`bg-areia size-20 ${classe}`}
              />
              <span className="text-mini text-texto-2 font-mono">{rotulo}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="rounded-colo bg-dourado-claro h-28 w-40"
            />
            <span className="text-mini text-texto-2 font-mono">colo</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cartao>
            <p className="text-corpo text-texto font-semibold">Cartão branco</p>
            <p className="text-apoio text-texto-2">
              O trabalho que ainda falta, com sombra leve.
            </p>
          </Cartao>
          <Cartao variante="areia-clara">
            <p className="text-corpo text-texto font-semibold">Bloco de tom</p>
            <p className="text-apoio text-texto-2">
              Sem sombra; a cor diz o assunto.
            </p>
          </Cartao>
          <Cartao variante="salvia" forma="colo">
            <p className="text-corpo text-texto font-semibold">Forma colo</p>
            <p className="text-apoio text-texto-2">
              Um por tela, no bloco de abertura.
            </p>
          </Cartao>
        </div>
      </Secao>

      <Secao
        id="s-colo-cumprimento"
        titulo="Cabeçalho com cumprimento e números grandes"
        descricao="Telas de abertura (Hoje, Início): cumprimento pelo primeiro nome, o dia, a frase do dia e o trio de cartões-resumo. O primeiro ocupa a linha no celular."
      >
        <CabecalhoSaudacao
          nivelTitulo="h3"
          saudacao="Bom dia, Talita"
          titulo="Hoje, quinta 24/09"
          frase="Duas visitas, manhã e tarde."
          className="mt-0"
        >
          <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2">
            <CartaoResumo
              destaque
              className="tablet:col-span-1 col-span-2"
              fundo="branco"
              tom="dourado"
              icone={<MapPin />}
              valor={2}
              rotulo="visitas hoje"
              contexto="a primeira às 09:00"
            />
            <CartaoResumo
              fundo="branco"
              tom="areia"
              icone={<ClipboardPen />}
              valor={1}
              rotulo="ficha pendente"
              contexto="falta o registro"
            />
            <CartaoResumo
              fundo="branco"
              tom="lavanda"
              icone={<CalendarDays />}
              valor={2}
              rotulo="visitas amanhã"
              contexto="a primeira às 09:00"
            />
          </div>
        </CabecalhoSaudacao>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CartaoResumo
            tom="argila"
            icone={<Inbox />}
            valor={3}
            rotulo="transferências esperando"
            contexto="1 com prioridade máxima"
          />
          <CartaoResumo
            tom="salvia"
            icone={<UserCheck />}
            valor={1}
            rotulo="com a equipe"
            contexto="1 com você"
          />
          <CartaoResumo
            tom="areia"
            icone={<ListTodo />}
            valor={4}
            rotulo="tarefas para hoje"
            contexto="nenhuma atrasada"
          />
        </div>
      </Secao>

      <Secao
        id="s-colo-tile"
        titulo="Ícone em tile"
        descricao="O ícone em marinho num círculo ou num quadradinho no tom médio do assunto. 36, 44 e 56 px. Estado nunca vai em tile."
      >
        <div className="flex flex-wrap items-center gap-3">
          {TONS.map((t) => (
            <TileIcone key={`c-${t.tom}`} tom={t.tom} tamanho="g">
              {ICONE_DO_TOM[t.tom]}
            </TileIcone>
          ))}
          <TileIcone tom="marinho" tamanho="g">
            <Phone />
          </TileIcone>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {TONS.map((t) => (
            <TileIcone key={`q-${t.tom}`} tom={t.tom} forma="quadrado">
              {ICONE_DO_TOM[t.tom]}
            </TileIcone>
          ))}
          <TileIcone tom="areia" tamanho="p">
            <Thermometer />
          </TileIcone>
        </div>
      </Secao>

      <Secao
        id="s-colo-abas"
        titulo="Abas em pílula"
        descricao="Trilha areia e a aba ativa em pílula branca. Para trocar de visão na mesma tela."
      >
        <AbasPilula
          rotulo="Período"
          ativa={aba}
          aoEscolher={definirAba}
          abas={[
            { valor: "hoje", rotulo: "Hoje" },
            { valor: "semana", rotulo: "Semana", contador: 12 },
            { valor: "mes", rotulo: "Mês" },
          ]}
        />
      </Secao>

      <Secao
        id="s-colo-progresso"
        titulo="Progresso"
        descricao="Anel segmentado (um segmento por etapa real), barra em pílula com a frase ao lado e blocos segmentados para tempo. Nunca decorativo."
      >
        <div className="flex flex-wrap items-center gap-6">
          <AnelProgresso
            segmentos={[
              "feito",
              "feito",
              "atual",
              "futuro",
              "futuro",
              "futuro",
              "futuro",
              "futuro",
            ]}
            tamanho={88}
            centro={
              <span className="font-titulo text-numero-sm text-texto font-medium">
                3
              </span>
            }
          />
          <p className="text-corpo text-texto max-w-[28ch]">
            Etapa 3 de 8. Duas etapas completas.
          </p>
        </div>
        <div className="grid max-w-md gap-5">
          <BarraProgresso valor={5} total={9} texto="5 de 9 respondidas" />
          <BarraProgresso
            valor={9}
            total={9}
            texto="9 de 9 respondidas"
            textoCompleta="Tudo respondido nesta etapa"
          />
          <ProgressoEtapas etapas={etapas} atual={2} />
        </div>
      </Secao>

      <Secao
        id="s-colo-pergunta"
        titulo="Pergunta em cartão"
        descricao="Checklist: uma pergunta por cartão, respostas em pílulas de 56 px. Sem resposta, branco com sombra; respondida, assenta em areia-clara com a marca de check."
      >
        <div className="flex max-w-md flex-col gap-3">
          <div className="rounded-3 bg-superficie shadow-1 p-4">
            <SimNao
              arranjo="cartao"
              name="colo-sem-resposta"
              pergunta="Bem-estar geral preservado"
              rotuloSim="Sim"
              rotuloNao="Não"
            />
          </div>
          <div
            className={
              resposta
                ? "rounded-3 bg-areia-clara ease-estado relative p-4 transition-colors duration-220"
                : "rounded-3 bg-superficie shadow-1 relative p-4"
            }
          >
            <SimNao
              arranjo="cartao"
              name="colo-respondida"
              pergunta="Sono e repouso adequados"
              rotuloSim="Sim"
              rotuloNao="Não"
              valor={resposta}
              onMudar={definirResposta}
            />
          </div>
        </div>
      </Secao>

      <Secao
        id="s-colo-lista"
        titulo="Lista em blocos"
        descricao="Cada item é um bloco macio com o tile do assunto; o espaço separa, sem divisória."
      >
        <ListaBlocos className="max-w-md">
          <ItemBloco
            href="#s-colo-lista"
            icone={<ClipboardPen />}
            tom="salvia"
            titulo="Evoluções para os médicos"
            apoio="As evoluções que você escreve e manda para a revisão."
          />
          <ItemBloco
            fundo="tom"
            tom="areia"
            icone={<ClipboardPen />}
            titulo="D1 de 6 da Família Teste Maré"
            apoio="Falta o registro da visita."
          />
          <ItemBloco
            fundo="tom"
            tom="lavanda"
            icone={<CalendarDays />}
            titulo="Família Teste Jade"
            apoio="Amanhã às 14:00, D2"
          />
        </ListaBlocos>
      </Secao>

      <Secao
        id="s-colo-ilustracoes"
        titulo="Ilustrações"
        descricao="Desenho próprio em traço, com a espessura dos ícones: marinho no traço, dourado e tons de apoio no preenchimento. Só em estado vazio e na comemoração do checklist completo."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(ILUSTRACOES) as NomeIlustracao[]).map((nome) => {
            const { Componente, nome: rotulo, uso } = ILUSTRACOES[nome];
            return (
              <li
                key={nome}
                className="rounded-3 bg-superficie flex flex-col items-center gap-2 p-4 text-center"
              >
                <Componente tamanho={112} />
                <p className="text-apoio text-texto font-semibold">{rotulo}</p>
                <p className="text-mini text-texto-2">{uso}</p>
              </li>
            );
          })}
        </ul>
      </Secao>

      <Secao
        id="s-colo-comemoracao"
        titulo="Comemoração do checklist completo"
        descricao="O traço se desenha uma vez, o check aparece por último, e para. Sem exclamação, sem parabéns. Nunca com alerta na visita ou família em estado sensível."
      >
        <Comemoracao
          key={rodada}
          titulo="Checklist do D4 completo."
          texto="Falta só a sua assinatura."
          acao={<Botao>Assinar registro do D4</Botao>}
        />
        <Botao
          variante="fantasma"
          tamanho="compacto"
          className="self-start"
          iconeEsquerda={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={() => definirRodada((n) => n + 1)}
        >
          Ver o movimento de novo
        </Botao>
      </Secao>
    </>
  );
}
