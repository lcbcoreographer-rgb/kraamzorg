import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";
import {
  agruparConsultas,
  quemChegouAoAlerta,
} from "@/modules/operacao/prenatal/agrupar";
import { CartaoConsulta } from "@/modules/operacao/prenatal/componentes/cartao-consulta";

export const metadata: Metadata = { title: "Pré-natal · Kraamzorg OS" };

function Secao({
  id,
  titulo,
  consultas,
}: {
  id: string;
  titulo: string;
  consultas: ConsultaPrenatalResumo[];
}) {
  if (consultas.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </h2>
      <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-3">
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

  return (
    <>
      <CabecalhoTela
        titulo="Pré-natal"
        subtitulo="A entrevista acontece na consulta online, por volta de 34 semanas. Cada resposta fica salva ao sair do campo, e você pode voltar de onde parou."
      />
      <div className="flex flex-col gap-8 pt-6">
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
            titulo="Nenhuma consulta pré-natal por enquanto"
            texto="A consulta nasce quando o pagamento de uma família é confirmado. Ela aparece aqui para marcar e conduzir a entrevista."
          />
        ) : null}

        <Secao id="urgentes" titulo="Urgentes" consultas={grupos.urgentes} />
        <Secao
          id="para-agendar"
          titulo="Para marcar"
          consultas={grupos.paraAgendar}
        />
        <Secao
          id="agendadas"
          titulo="Marcadas e em andamento"
          consultas={grupos.agendadas}
        />
        <Secao
          id="concluidas"
          titulo="Concluídas"
          consultas={grupos.concluidas}
        />
      </div>
    </>
  );
}
