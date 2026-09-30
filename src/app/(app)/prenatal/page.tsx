import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
} from "lucide-react";
import { MantaDobrada } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import type { Tom } from "@/components/ui/tons";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";
import { formatarDataHora } from "@/lib/formatacao";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import {
  agruparConsultas,
  quemChegouAoAlerta,
} from "@/modules/operacao/prenatal/agrupar";
import { CartaoConsulta } from "@/modules/operacao/prenatal/componentes/cartao-consulta";

export const metadata: Metadata = { title: "Pré-natal · Kraamzorg OS" };

function Secao({
  id,
  titulo,
  texto,
  consultas,
  icone,
  tom,
  colunas = "cartoes",
}: {
  id: string;
  titulo: string;
  texto?: string;
  consultas: ConsultaPrenatalResumo[];
  icone: ReactNode;
  tom: Tom;
  /** "blocos": linhas compactas (as concluídas). */
  colunas?: "cartoes" | "blocos";
}) {
  if (consultas.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <TituloSecao
        id={id}
        icone={icone}
        tom={tom}
        titulo={titulo}
        texto={texto}
        contagem={consultas.length}
        unidade={consultas.length === 1 ? "família" : "famílias"}
      />
      <ul
        className={
          colunas === "blocos"
            ? "grid grid-cols-1 gap-2 lg:grid-cols-2"
            : "tablet:grid-cols-2 grid grid-cols-1 gap-3 xl:grid-cols-3"
        }
      >
        {consultas.map((c) => (
          <li key={c.consultaId}>
            <CartaoConsulta consulta={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Consultas pré-natais (P35): a entrevista do DOC 1, feita pela
 * coordenação por volta de 34 semanas. Só coordenação e diretoria abrem
 * (o conteúdo é dado assistencial, PRD 13); o comercial vê só o estado, na
 * ficha da família. Urgentes primeiro, depois as que faltam marcar, as
 * marcadas ou em andamento e as concluídas. O aviso das 34 semanas é
 * interno: nada sai para a família.
 */
export default async function PaginaPrenatal() {
  await exigirSessao("/prenatal");

  let consultas: ConsultaPrenatalResumo[] | null = null;
  try {
    const { operacao } = await obterRepositorios();
    consultas = await operacao.listarConsultas();
  } catch {
    consultas = null;
  }

  if (!consultas) {
    return (
      <>
        <CabecalhoTela titulo="Pré-natal" />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="A lista não abriu agora">
            Confira a conexão e recarregue a página. Nenhuma entrevista foi
            alterada.
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const grupos = agruparConsultas(consultas);
  const chegaram = quemChegouAoAlerta(consultas);
  const aMarcar = grupos.urgentes.length + grupos.paraAgendar.length;
  const proxima = grupos.agendadas.find((c) => c.agendadaPara);

  return (
    <>
      <CabecalhoTela
        titulo="Pré-natal"
        subtitulo="A entrevista acontece na consulta online, por volta de 34 semanas. Cada resposta fica salva ao sair do campo, e você pode voltar de onde parou."
      />
      <div className="flex flex-col gap-10 pt-6">
        {consultas.length > 0 ? (
          <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:gap-3">
            <CartaoResumo
              destaque
              className="tablet:col-span-1 col-span-2"
              tom="dourado"
              icone={<CalendarClock />}
              valor={aMarcar}
              rotulo={
                aMarcar === 1 ? "consulta para marcar" : "consultas para marcar"
              }
              contexto={
                grupos.urgentes.length === 0
                  ? "nenhuma urgente"
                  : grupos.urgentes.length === 1
                    ? "1 urgente, contratada perto do parto"
                    : `${grupos.urgentes.length} urgentes, contratadas perto do parto`
              }
              href={
                grupos.urgentes.length > 0
                  ? "#urgentes"
                  : grupos.paraAgendar.length > 0
                    ? "#para-agendar"
                    : undefined
              }
            />
            <CartaoResumo
              tom="lavanda"
              icone={<CalendarDays />}
              valor={grupos.agendadas.length}
              rotulo="marcadas ou em andamento"
              contexto={
                proxima?.agendadaPara
                  ? `a próxima em ${formatarDataHora(proxima.agendadaPara) ?? ""}`
                  : "nenhuma marcada agora"
              }
              href={grupos.agendadas.length > 0 ? "#agendadas" : undefined}
            />
            <CartaoResumo
              tom="salvia"
              icone={<ClipboardCheck />}
              valor={grupos.concluidas.length}
              rotulo={
                grupos.concluidas.length === 1
                  ? "entrevista concluída"
                  : "entrevistas concluídas"
              }
              contexto="guardadas na ficha de cada família"
              href={grupos.concluidas.length > 0 ? "#concluidas" : undefined}
            />
          </div>
        ) : null}

        {chegaram.length > 0 ? (
          <FaixaAlerta
            variante="prioritario"
            titulo={
              chegaram.length === 1
                ? "1 família chegou às 34 semanas"
                : `${chegaram.length} famílias chegaram às 34 semanas`
            }
            meta="Aviso interno da coordenação. Nada foi enviado às famílias."
          >
            {chegaram.map((c) => c.nome).join(", ")}.
          </FaixaAlerta>
        ) : null}

        {consultas.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<MantaDobrada tamanho={112} />}
            titulo="Nenhuma consulta pré-natal por enquanto"
            texto="A consulta nasce quando o pagamento de uma família é confirmado. Ela aparece aqui para marcar e conduzir a entrevista."
          />
        ) : null}

        <Secao
          id="urgentes"
          titulo="Urgentes"
          texto="Famílias que contrataram perto do parto. Marque estas primeiro."
          consultas={grupos.urgentes}
          icone={<CalendarClock />}
          tom="dourado"
        />
        <Secao
          id="para-agendar"
          titulo="Para marcar"
          consultas={grupos.paraAgendar}
          icone={<ClipboardList />}
          tom="dourado"
        />
        <Secao
          id="agendadas"
          titulo="Marcadas e em andamento"
          consultas={grupos.agendadas}
          icone={<CalendarDays />}
          tom="lavanda"
        />
        <Secao
          id="concluidas"
          titulo="Concluídas"
          consultas={grupos.concluidas}
          icone={<ClipboardCheck />}
          tom="salvia"
          colunas="blocos"
        />
      </div>
    </>
  );
}
