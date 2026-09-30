import type { Metadata } from "next";
import { BookOpen, ChartColumn, Clock3, Settings2 } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { cn } from "@/lib/utils";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterBaseConhecimentoTela } from "@/modules/agente/base-conhecimento/dados";
import { PainelBaseConhecimento } from "@/modules/agente/base-conhecimento/componentes/painel-base-conhecimento";
import {
  obterLimiarAmostra,
  obterMetricasTela,
  periodoPadrao,
} from "@/modules/agente/metricas/dados";
import { PainelMetricas } from "@/modules/agente/metricas/componentes/painel-metricas";
import { obterRegraRetomadaTela } from "@/modules/agente/regras-retomada/dados";
import { PainelRegraRetomada } from "@/modules/agente/regras-retomada/componentes/painel-regra-retomada";

export const metadata: Metadata = { title: "Isadora · Kraamzorg OS" };

/**
 * Cada assunto da Isadora num bloco com a cor do que ele é (DESIGN.md,
 * 2.5): os ajustes são o agora (dourado), a retomada é tempo (lavanda), os
 * números são das conversas (argila), a base é o que já foi guardado
 * (areia). O título leva o assunto num tile.
 */
const FUNDO_SECAO: Record<Tom, string> = {
  dourado: "bg-dourado-claro",
  lavanda: "bg-lavanda-clara",
  argila: "bg-argila-clara",
  areia: "bg-areia-clara",
  salvia: "bg-salvia-clara",
};

function Secao({
  titulo,
  texto,
  icone,
  tom,
  className,
  children,
}: {
  titulo: string;
  texto?: string;
  icone: React.ReactNode;
  tom: Tom;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3 flex min-w-0 flex-col gap-4 p-5 lg:p-6",
        FUNDO_SECAO[tom],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TileIcone tom={tom} forma="quadrado">
          {icone}
        </TileIcone>
        <div className="flex flex-col gap-1">
          <h2 className="font-titulo text-2 text-texto font-medium">
            {titulo}
          </h2>
          {texto ? <p className="text-apoio text-texto-2">{texto}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Painel da Isadora no CRM (P27 itens 1, 4 e 5; PRD 11.3, 11.4, 11.12 e
 * 20.5): textos de retomada, base de conhecimento e métricas. [v4.5] O modo,
 * a lista de teste, as pausas e a janela de retomada são parâmetros do
 * agente, mantidos pela equipe de implantação: a tela só explica isso. Conversas e transferências ficam em `/conversas` e
 * `/transferencias`, rotas próprias (item 1 e 2). Dono: P27.
 */
export default async function PaginaAgente() {
  const sessao = await exigirSessao("/agente");
  const ehDiretoria = sessao.papeis.includes("diretoria");

  const [regraR, baseR, metricasR] = await Promise.all([
    obterRegraRetomadaTela().then(
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
  const base = baseR.v;
  const metricas = metricasR.v;
  const carregouTudo = regraR.ok && baseR.ok && metricasR.ok;

  return (
    <>
      <CabecalhoTela
        titulo="Isadora"
        subtitulo="Retomada, base de conhecimento e os números do mês."
      />
      <div className="flex flex-col gap-6 pt-6">
        {!carregouTudo ? (
          <FaixaAlerta variante="erro" titulo="Alguma parte não carregou agora">
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Secao
            icone={<Settings2 />}
            tom="dourado"
            titulo="Ajustes da Isadora"
            texto="Quando ela responde, a lista de teste, as pausas, a retomada e a agenda."
          >
            <p className="text-corpo text-texto">
              Esses ajustes são feitos pela equipe de implantação, fora do
              aplicativo, para a Isadora nunca falar com uma família por um
              número trocado sem querer. Para pedir uma mudança, fale com a
              equipe de implantação.
            </p>
          </Secao>

          <Secao
            icone={<Clock3 />}
            tom="lavanda"
            titulo="Retomada de quem parou de responder"
            texto="A Isadora manda uma única mensagem de retomada. D+3 e D+14 continuam como tarefa humana."
          >
            {regra ? (
              <PainelRegraRetomada regra={regra} />
            ) : (
              <p className="text-apoio text-texto-2">
                Não foi possível carregar esta regra agora.
              </p>
            )}
          </Secao>
        </div>

        <Secao
          icone={<ChartColumn />}
          tom="argila"
          titulo="Números do mês"
          texto="Últimos 30 dias, cada número ao lado da meta combinada para os primeiros 60 dias."
        >
          {metricas ? (
            <PainelMetricas
              metricas={metricas}
              limiarAmostra={await obterLimiarAmostra()}
            />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar as métricas agora.
            </p>
          )}
        </Secao>

        <Secao
          icone={<BookOpen />}
          tom="areia"
          titulo="Base de conhecimento"
          texto="O que a Isadora pode responder. Só o que está aprovado entra na próxima atualização."
        >
          {base ? (
            <PainelBaseConhecimento base={base} podeAprovar={ehDiretoria} />
          ) : (
            <p className="text-apoio text-texto-2">
              Não foi possível carregar a base agora.
            </p>
          )}
        </Secao>
      </div>
    </>
  );
}
