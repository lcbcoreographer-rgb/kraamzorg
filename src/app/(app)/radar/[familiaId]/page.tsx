import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Hospital,
  ListTodo,
  UserRound,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  AlocacaoFamilia,
  DesignacaoLinha,
  PapelDesignacao,
} from "@/lib/dados/tipos-operacao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { ROTULO_ESTAGIO_P2 } from "@/modules/crm/pipeline/estagios";
import {
  ROTULO_ESTADO_VISITA,
  ROTULO_PAPEL_DESIGNACAO,
  ROTULO_PERIODO,
  ROTULO_STATUS_DESIGNACAO,
} from "@/modules/operacao/comum/rotulos";
import { fraseErroOperacao } from "@/modules/operacao/comum/mensagens";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import { FormularioDesignar } from "@/modules/operacao/radar/componentes/designar";
import {
  FormularioAlta,
  FormularioNascimento,
  FormularioPrevisaoAlta,
} from "@/modules/operacao/radar/componentes/nascimento-alta";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Alocação · Kraamzorg OS" };

const VIVAS = new Set(["oferecida", "aceita"]);

/**
 * Um assunto da alocação (direção "Colo"): título com o tile do assunto e,
 * embaixo, o bloco. Branco com sombra quando é trabalho a fazer (um
 * formulário); no tom do assunto quando é leitura (as visitas marcadas).
 */
function Secao({
  id,
  titulo,
  texto,
  icone,
  tom,
  variante = "padrao",
  children,
}: {
  id: string;
  titulo: string;
  texto?: string;
  icone: ReactNode;
  tom: Tom | "neutro";
  variante?: "padrao" | "lavanda" | "plano";
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <TituloSecao
        id={id}
        icone={icone}
        tom={tom}
        titulo={titulo}
        texto={texto}
      />
      <Cartao variante={variante} className="flex flex-col gap-4">
        {children}
      </Cartao>
    </section>
  );
}

/** Uma das datas da família, num bloco pequeno: rótulo em cima, valor em mono. */
function Data({
  rotulo,
  marca,
  children,
  vazia,
}: {
  rotulo: string;
  marca?: "estimativa" | "fato";
  children: ReactNode;
  vazia?: boolean;
}) {
  return (
    <div className="rounded-2 bg-superficie flex flex-col gap-1 px-3 py-2.5">
      <dt className="text-mini text-texto-2">
        {rotulo}
        {marca ? <em className="ml-1">({marca})</em> : null}
      </dt>
      <dd
        className={cn(
          "text-dado font-mono",
          vazia ? "text-texto-2" : "text-texto font-medium",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function LinhaDesignacao({ d }: { d: DesignacaoLinha }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-corpo text-texto flex flex-wrap items-center gap-2">
        {d.profissional}
        <Selo
          variante={
            d.status === "aceita"
              ? "sucesso"
              : d.status === "oferecida"
                ? "destaque"
                : d.status === "recusada" || d.status === "expirada"
                  ? "alerta"
                  : "neutro"
          }
        >
          {ROTULO_STATUS_DESIGNACAO[d.status]}
        </Selo>
        {d.direta ? <Selo variante="neutro">Atribuição direta</Selo> : null}
      </span>
      {d.status === "oferecida" && d.prazoRespostaEm ? (
        <span className="text-apoio text-texto-2">
          Responde até {formatarDataHora(d.prazoRespostaEm) ?? ""}.
        </span>
      ) : null}
      {d.motivoRecusa ? (
        <span className="text-apoio text-texto-2">
          Motivo: {d.motivoRecusa}
        </span>
      ) : null}
    </li>
  );
}

function BlocoPapel({
  papel,
  familiaId,
  alocacao,
}: {
  papel: PapelDesignacao;
  familiaId: string;
  alocacao: AlocacaoFamilia;
}) {
  const doPapel = alocacao.designacoes.filter((d) => d.papel === papel);
  const viva = doPapel.find((d) => VIVAS.has(d.status));
  // Com alguém vivo no papel, o bloco é das pessoas (argila); sem ninguém,
  // é trabalho a fazer (branco com sombra, com o formulário da oferta).
  return (
    <Cartao
      variante={viva ? "argila" : "padrao"}
      className="flex flex-col gap-4"
      data-papel={papel}
    >
      <div className="flex items-center gap-3">
        <TileIcone tom="argila" tamanho="p">
          {papel === "titular" ? <UserRound /> : <UsersRound />}
        </TileIcone>
        <h3 className="font-titulo text-2 text-texto font-medium">
          {ROTULO_PAPEL_DESIGNACAO[papel]}
        </h3>
      </div>
      {doPapel.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {doPapel.map((d) => (
            <LinhaDesignacao key={d.id} d={d} />
          ))}
        </ul>
      ) : (
        <p className="text-corpo text-texto-2">
          Nenhuma enfermeira designada ainda.
        </p>
      )}
      {!viva ? (
        <FormularioDesignar
          familiaId={familiaId}
          papel={papel}
          candidatas={alocacao.candidatas}
        />
      ) : null}
    </Cartao>
  );
}

/**
 * Alocação e registros de uma família (P36, fluxo C): titular e backup por
 * oferta ou atribuição direta, registro do nascimento, previsão e registro
 * da alta, e as visitas que a alta gerou. As quatro datas aparecem separadas
 * e nomeadas: a data provável é estimativa; nascimento, alta e início
 * efetivo são fatos.
 */
export default async function PaginaAlocacao({
  params,
}: {
  params: Promise<{ familiaId: string }>;
}) {
  const { familiaId } = await params;
  if (!z.uuid().safeParse(familiaId).success) notFound();
  await exigirSessao("/radar");

  let alocacao: AlocacaoFamilia | null = null;
  let erro: string | null = null;
  try {
    const { operacao } = await obterRepositorios();
    alocacao = await operacao.alocacao(familiaId);
  } catch (e) {
    erro = fraseErroOperacao(e, "abrir a alocação");
  }

  const voltar = (
    <Botao asChild variante="secundario" tamanho="compacto">
      <Link href="/radar">
        <ArrowLeft aria-hidden className="size-4" />
        Radar
      </Link>
    </Botao>
  );

  if (!alocacao) {
    return (
      <>
        <CabecalhoTela titulo="Alocação" lateral={voltar} />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="A alocação não abriu">
            {erro ?? "Confira a conexão e tente de novo."}
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const { familia: f, acompanhamento: a } = alocacao;
  const hoje = hojeBrasilia();
  const semContrato = f.estagioP2 === null;
  const sensivel = f.estadoSensivel !== "normal";
  const periodoPadrao =
    f.periodoPreferido.find(
      (p): p is "manha" | "tarde" => p === "manha" || p === "tarde",
    ) ?? null;

  return (
    <>
      <CabecalhoTela
        titulo="Alocação"
        subtitulo="Quem acompanha esta família, o nascimento e a alta."
        lateral={voltar}
      />
      <div className="flex flex-col gap-8 pt-6">
        {sensivel ? (
          <FaixaAlerta
            variante="sensivel"
            titulo="Esta família está em estado sensível"
          >
            Nada é oferecido nem marcado até a coordenação liberar. Fale com a
            supervisão antes de qualquer registro.
          </FaixaAlerta>
        ) : null}
        {semContrato ? (
          <FaixaAlerta
            variante="prioritario"
            titulo="O pagamento ainda não foi confirmado"
          >
            A designação e os registros de nascimento e alta só valem depois do
            pagamento.
          </FaixaAlerta>
        ) : null}

        <section
          aria-label={`Datas da ${f.nome}`}
          className={cn(
            "rounded-3 flex flex-col gap-4 p-5 lg:p-6",
            sensivel ? "border-linha border" : "bg-areia-clara",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-1 text-texto font-medium">
              {f.nome}
            </h2>
            {f.estagioP2 ? (
              <Selo variante="neutro">{ROTULO_ESTAGIO_P2[f.estagioP2]}</Selo>
            ) : null}
            {f.gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
          </div>
          <dl className="tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Data rotulo="Idade gestacional" vazia={!f.ig}>
              {f.ig ?? "sem data provável"}
            </Data>
            <Data
              rotulo="Data provável do parto"
              marca="estimativa"
              vazia={!f.dpp}
            >
              {f.dpp ? (formatarData(f.dpp) ?? f.dpp) : "não informada"}
            </Data>
            <Data rotulo="Nascimento" vazia={!f.dataNascimento}>
              {f.dataNascimento
                ? (formatarData(f.dataNascimento) ?? f.dataNascimento)
                : "ainda não registrado"}
            </Data>
            <Data rotulo="Alta" vazia={!f.dataAlta}>
              {f.dataAlta
                ? (formatarData(f.dataAlta) ?? f.dataAlta)
                : "ainda não registrada"}
            </Data>
            <Data
              rotulo="Início do acompanhamento (D1)"
              vazia={!f.dataInicioEfetivo}
            >
              {f.dataInicioEfetivo
                ? (formatarData(f.dataInicioEfetivo) ?? f.dataInicioEfetivo)
                : "depois da alta"}
            </Data>
            {f.janelaInicio && f.janelaFim ? (
              <Data rotulo="Janela do parto">
                {formatarData(f.janelaInicio)?.slice(0, 5) ?? f.janelaInicio} a{" "}
                {formatarData(f.janelaFim) ?? f.janelaFim}
              </Data>
            ) : null}
            {f.periodoPreferido.length > 0 ? (
              <div className="rounded-2 bg-superficie flex flex-col gap-1 px-3 py-2.5">
                <dt className="text-mini text-texto-2">Período preferido</dt>
                <dd className="text-corpo text-texto font-medium">
                  {f.periodoPreferido.map((p) => ROTULO_PERIODO[p]).join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {f.dataNascimento ? (
          <FaixaAlerta
            variante="sucesso"
            titulo={`Nascimento registrado em ${formatarData(f.dataNascimento) ?? f.dataNascimento}`}
          >
            A agenda foi recalculada e a operação foi avisada.
            {f.dataAlta
              ? ` Alta registrada em ${formatarData(f.dataAlta) ?? f.dataAlta}${
                  a
                    ? `, com ${a.visitas} ${a.visitas === 1 ? "visita marcada" : "visitas marcadas"} a partir de ${
                        formatarData(
                          a.inicioEfetivo ?? f.dataInicioEfetivo ?? "",
                        ) ?? "D1"
                      }`
                    : ""
                }.`
              : ""}
          </FaixaAlerta>
        ) : null}

        {alocacao.tarefas.length > 0 ? (
          <Secao
            id="pendencias"
            titulo="O que está pendente"
            icone={<ListTodo />}
            tom="areia"
          >
            <ul className="flex flex-col gap-2">
              {alocacao.tarefas.map((t, i) => (
                <li
                  key={`${t.tipo}-${i}`}
                  className="text-corpo text-texto rounded-2 bg-areia-clara px-4 py-3"
                >
                  {t.titulo}
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        {!sensivel && !semContrato ? (
          <section aria-labelledby="designacao" className="flex flex-col gap-3">
            <TituloSecao
              id="designacao"
              icone={<UsersRound />}
              tom="argila"
              titulo="Titular e backup"
              texto="A oferta dá à enfermeira o prazo configurado para responder. Se a titular recusar, o backup assume e a coordenação é avisada."
            />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
              <BlocoPapel
                papel="titular"
                familiaId={familiaId}
                alocacao={alocacao}
              />
              <BlocoPapel
                papel="backup"
                familiaId={familiaId}
                alocacao={alocacao}
              />
            </div>
          </section>
        ) : null}

        {!semContrato && !sensivel && !f.dataNascimento ? (
          <Secao
            id="nascimento"
            titulo="Registrar o nascimento"
            icone={<CalendarCheck />}
            tom="dourado"
            texto="Depois do registro, a agenda é recalculada e a operação é avisada. A data provável do parto continua guardada como estimativa."
          >
            <FormularioNascimento
              familiaId={familiaId}
              gemelarNoCadastro={f.gemelar}
              hoje={hoje}
            />
          </Secao>
        ) : null}

        {f.dataNascimento && !f.dataAlta && !semContrato && !sensivel ? (
          <>
            <Secao
              id="previsao-alta"
              titulo="Previsão de alta"
              icone={<CalendarDays />}
              tom="lavanda"
              texto="Ajuda a operação a se preparar. Não gera visitas."
            >
              <FormularioPrevisaoAlta
                familiaId={familiaId}
                atual={a?.previsaoAlta ?? null}
                minimo={f.dataNascimento}
              />
            </Secao>
            <Secao
              id="alta"
              titulo="Registrar a alta"
              icone={<Hospital />}
              tom="dourado"
              texto="A alta ativa o acompanhamento, marca as visitas de D1 até o último dia do pacote, cria a tarefa do guia e avisa a profissional."
            >
              <FormularioAlta
                familiaId={familiaId}
                dataNascimento={f.dataNascimento}
                hoje={hoje}
                dias={a?.dias ?? 6}
                periodoPadrao={periodoPadrao}
              />
            </Secao>
          </>
        ) : null}

        {a && a.listaVisitas.length > 0 ? (
          <Secao
            id="visitas"
            titulo={`Visitas de D1 a D${a.dias}`}
            icone={<CalendarDays />}
            tom="lavanda"
            variante="lavanda"
            texto={`${a.visitas} visitas${a.periodo ? `, todas de ${ROTULO_PERIODO[a.periodo].toLowerCase()}` : ""}.`}
          >
            <TabelaLista
              rotulo="Visitas geradas pela alta"
              colunas={[
                { chave: "dia", rotulo: "Dia", principal: true },
                { chave: "data", rotulo: "Data" },
                { chave: "hora", rotulo: "Hora", numerica: true },
                { chave: "profissional", rotulo: "Profissional" },
                { chave: "estado", rotulo: "Situação", canto: true },
              ]}
              linhas={a.listaVisitas.map((v) => ({
                id: `${v.diaNumero}`,
                valores: {
                  dia: `D${v.diaNumero}`,
                  data: formatarData(v.data) ?? v.data,
                  hora: v.horaPrevista
                    ? v.horaPrevista.slice(0, 5)
                    : "a combinar",
                  profissional: v.profissional ?? "a designar",
                  estado: (
                    <Selo variante="neutro">
                      {ROTULO_ESTADO_VISITA[v.estado] ?? v.estado}
                    </Selo>
                  ),
                },
              }))}
            />
          </Secao>
        ) : null}
      </div>
    </>
  );
}
