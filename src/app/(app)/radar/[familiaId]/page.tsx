import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  AlocacaoFamilia,
  DesignacaoLinha,
  PapelDesignacao,
} from "@/lib/dados/tipos-operacao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import { ROTULO_ESTAGIO_P2 } from "@/modules/crm/pipeline/estagios";
import {
  ROTULO_ESTADO_VISITA,
  ROTULO_PAPEL_DESIGNACAO,
  ROTULO_PERIODO,
  ROTULO_STATUS_DESIGNACAO,
} from "@/modules/operacao/comum/rotulos";
import { fraseErroOperacao } from "@/modules/operacao/comum/mensagens";
import { FormularioDesignar } from "@/modules/operacao/radar/componentes/designar";
import {
  FormularioAlta,
  FormularioNascimento,
  FormularioPrevisaoAlta,
} from "@/modules/operacao/radar/componentes/nascimento-alta";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Alocação · Kraamzorg OS" };

const VIVAS = new Set(["oferecida", "aceita"]);

function Secao({
  id,
  titulo,
  texto,
  children,
}: {
  id: string;
  titulo: string;
  texto?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Cartao className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="font-titulo text-2 text-texto font-medium">
            {titulo}
          </h2>
          {texto ? <p className="text-apoio text-texto-2">{texto}</p> : null}
        </div>
        {children}
      </Cartao>
    </section>
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
  return (
    <Cartao variante="plano" className="flex flex-col gap-4" data-papel={papel}>
      <h3 className="font-titulo text-2 text-texto font-medium">
        {ROTULO_PAPEL_DESIGNACAO[papel]}
      </h3>
      {doPapel.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {doPapel.map((d) => (
            <LinhaDesignacao key={d.id} d={d} />
          ))}
        </ul>
      ) : (
        <p className="text-corpo text-texto-2">Ninguém designada ainda.</p>
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
      <div className="flex flex-col gap-6 pt-6">
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

        <Cartao variante="plano" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-2 text-texto font-medium">
              {f.nome}
            </h2>
            {f.estagioP2 ? (
              <Selo variante="neutro">{ROTULO_ESTAGIO_P2[f.estagioP2]}</Selo>
            ) : null}
            {f.gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
          </div>
          <dl className="text-corpo grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-texto-2">Idade gestacional</dt>
            <dd className="text-texto font-mono">
              {f.ig ?? "sem data provável"}
            </dd>
            <dt className="text-texto-2">
              Data provável do parto (estimativa)
            </dt>
            <dd className="text-texto font-mono">
              {f.dpp ? (formatarData(f.dpp) ?? f.dpp) : "não informada"}
            </dd>
            <dt className="text-texto-2">Nascimento</dt>
            <dd className="text-texto font-mono">
              {f.dataNascimento
                ? (formatarData(f.dataNascimento) ?? f.dataNascimento)
                : "ainda não registrado"}
            </dd>
            <dt className="text-texto-2">Alta</dt>
            <dd className="text-texto font-mono">
              {f.dataAlta
                ? (formatarData(f.dataAlta) ?? f.dataAlta)
                : "ainda não registrada"}
            </dd>
            <dt className="text-texto-2">Início do acompanhamento (D1)</dt>
            <dd className="text-texto font-mono">
              {f.dataInicioEfetivo
                ? (formatarData(f.dataInicioEfetivo) ?? f.dataInicioEfetivo)
                : "depois da alta"}
            </dd>
            {f.janelaInicio && f.janelaFim ? (
              <>
                <dt className="text-texto-2">Janela do parto</dt>
                <dd className="text-texto font-mono">
                  {formatarData(f.janelaInicio) ?? f.janelaInicio} a{" "}
                  {formatarData(f.janelaFim) ?? f.janelaFim}
                </dd>
              </>
            ) : null}
            {f.periodoPreferido.length > 0 ? (
              <>
                <dt className="text-texto-2">Período preferido</dt>
                <dd className="text-texto">
                  {f.periodoPreferido.map((p) => ROTULO_PERIODO[p]).join(", ")}
                </dd>
              </>
            ) : null}
          </dl>
        </Cartao>

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
          <Secao id="pendencias" titulo="O que está pendente">
            <ul className="flex flex-col gap-2">
              {alocacao.tarefas.map((t, i) => (
                <li key={`${t.tipo}-${i}`} className="text-corpo text-texto">
                  {t.titulo}
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        {!sensivel && !semContrato ? (
          <Secao
            id="designacao"
            titulo="Titular e backup"
            texto="A oferta dá à enfermeira o prazo configurado para responder. Se a titular recusar, o backup assume e a coordenação é avisada."
          >
            <div className="tablet:grid-cols-2 grid grid-cols-1 gap-4">
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
          </Secao>
        ) : null}

        {!semContrato && !sensivel && !f.dataNascimento ? (
          <Secao
            id="nascimento"
            titulo="Registrar o nascimento"
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
