import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterBaseConhecimentoTela } from "@/modules/agente/base-conhecimento/dados";
import { PainelBaseConhecimento } from "@/modules/agente/base-conhecimento/componentes/painel-base-conhecimento";
import {
  obterMetricasTela,
  periodoPadrao,
} from "@/modules/agente/metricas/dados";
import { PainelMetricas } from "@/modules/agente/metricas/componentes/painel-metricas";
import { obterModoAgenteTela } from "@/modules/agente/modo/dados";
import { PainelModo } from "@/modules/agente/modo/componentes/painel-modo";
import { obterRegraRetomadaTela } from "@/modules/agente/regras-retomada/dados";
import { PainelRegraRetomada } from "@/modules/agente/regras-retomada/componentes/painel-regra-retomada";

export const metadata: Metadata = { title: "Isadora · Kraamzorg OS" };

function Secao({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-linha flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-titulo text-2 text-texto">{titulo}</h2>
        {texto ? <p className="text-apoio text-texto-2 mt-1">{texto}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Painel da Isadora no CRM (P27 itens 1, 3, 4 e 5; PRD 11.3, 11.4, 11.12 e
 * 20.5): regras de retomada, modo do agente, base de conhecimento e
 * métricas. Conversas e transferências ficam em `/conversas` e
 * `/transferencias`, rotas próprias (item 1 e 2). Dono: P27.
 */
export default async function PaginaAgente() {
  const sessao = await exigirSessao("/agente");
  const ehDiretoria = sessao.papeis.includes("diretoria");

  const [regraR, configuracaoR, baseR, metricasR] = await Promise.all([
    obterRegraRetomadaTela().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    // `parametro` só é lido pela diretoria (RLS, PRD 13): para os demais
    // papéis o modo nem é pedido, e a tela diz de quem é a decisão em vez
    // de mostrar um valor que o banco não entregou.
    (ehDiretoria ? obterModoAgenteTela() : Promise.resolve(null)).then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    obterBaseConhecimentoTela().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
    (async () => {
      const { desde, ate } = periodoPadrao();
      return obterMetricasTela(desde, ate);
    })().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null }),
    ),
  ]);
  const regra = regraR.v;
  const configuracao = configuracaoR.v;
  const base = baseR.v;
  const metricas = metricasR.v;
  const carregouTudo =
    regraR.ok && configuracaoR.ok && baseR.ok && metricasR.ok;

  return (
    <>
      <CabecalhoTela
        titulo="Isadora"
        subtitulo="Modo, retomada, base de conhecimento e os números do mês."
      />
      <div className="flex flex-col gap-8 pt-6">
        {!carregouTudo ? (
          <FaixaAlerta
            variante="imediato"
            titulo="Alguma parte não carregou agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : null}

        <Secao
          titulo="Retomada de quem parou de responder"
          texto="A Isadora manda uma única mensagem de retomada. D+3 e D+14 continuam como tarefa humana."
        >
          {regra ? (
            <PainelRegraRetomada regra={regra} podeEditar={ehDiretoria} />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar esta regra agora.
            </p>
          )}
        </Secao>

        <Secao
          titulo="Modo da Isadora"
          texto="Desligada, em teste (só responde à lista) ou em produção."
        >
          {!ehDiretoria ? (
            <PainelModo configuracao={null} podeEditar={false} />
          ) : configuracao ? (
            <PainelModo configuracao={configuracao} podeEditar />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar o modo agora.
            </p>
          )}
        </Secao>

        <Secao
          titulo="Base de conhecimento"
          texto="O que a Isadora pode responder. Só o que está aprovado entra na próxima reindexação."
        >
          {base ? (
            <PainelBaseConhecimento base={base} podeAprovar={ehDiretoria} />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar a base agora.
            </p>
          )}
        </Secao>

        <Secao
          titulo="Números do mês"
          texto="Últimos 30 dias, cada número ao lado da meta combinada para os primeiros 60 dias."
        >
          {metricas ? (
            <PainelMetricas metricas={metricas} />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar as métricas agora.
            </p>
          )}
        </Secao>
      </div>
    </>
  );
}
