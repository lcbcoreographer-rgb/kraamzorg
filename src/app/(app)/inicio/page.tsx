import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { Papel } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarDiaSemanaEData } from "@/lib/formatacao";
import { papelPrincipal } from "@/lib/navegacao";
import { FilaTransferencias } from "@/modules/agente/transferencias/componentes/fila-transferencias";
import {
  listarFilaTela,
  obterTelefonePlantao,
} from "@/modules/agente/transferencias/dados";
import { DESTINO_DO_PAPEL } from "@/modules/agente/tipos";
import type { TransferenciaTela } from "@/modules/agente/tipos";
import { ListaTarefas } from "@/modules/mensageria/tarefas/componentes/lista-tarefas";
import {
  listarTarefasTela,
  type TarefasTela,
} from "@/modules/mensageria/tarefas/dados";

export const metadata: Metadata = { title: "Início · Kraamzorg OS" };

/** O que o Início de cada papel vai mostrar (PRD 20.4). */
const INICIO_POR_PAPEL: Record<
  Exclude<Papel, "enfermeira" | "comercial">,
  { titulo: string; texto: string; acao?: { rotulo: string; href: string } }
> = {
  coordenacao: {
    titulo: "O que pede decisão vai aparecer aqui",
    texto:
      "Alertas clínicos abertos, transferências de saúde, fichas pendentes, ofertas sem resposta e a síntese da equipe.",
  },
  financeiro: {
    titulo: "O que pede atenção no financeiro vai aparecer aqui",
    texto: "Cobranças vencendo, pagamentos confirmados e notas com erro.",
    acao: { rotulo: "Ver cobranças", href: "/cobrancas" },
  },
  marketing: {
    titulo: "Os números de origem e funil vão aparecer aqui",
    texto:
      "Leads por origem e por estágio, sempre em agregado, sem dado de família.",
  },
  diretoria: {
    titulo: "As cinco perguntas do dia vão aparecer aqui",
    texto:
      "Vendas, operação, equipe, financeiro e alertas, cada uma com a comparação ao período anterior.",
    acao: { rotulo: "Ver pipeline", href: "/pipeline" },
  },
};

const NUMERO_POR_EXTENSO = [
  "Nenhuma",
  "Uma",
  "Duas",
  "Três",
  "Quatro",
  "Cinco",
  "Seis",
  "Sete",
  "Oito",
  "Nove",
  "Dez",
];

function fraseContagem(
  n: number,
  singular: string,
  plural: string,
  maiuscula = true,
): string {
  const extenso = n <= 10 ? (NUMERO_POR_EXTENSO[n] ?? String(n)) : String(n);
  const numero = maiuscula || n > 10 ? extenso : extenso.toLowerCase();
  return `${numero} ${n === 1 ? singular : plural}`;
}

/**
 * Dono: P18 (fila e tarefas do comercial) e P27 (transferências); cada
 * papel ganha o próprio Início no módulo dele (coordenação P36, financeiro
 * P46, marketing P47, diretoria P52).
 */
export default async function PaginaInicio() {
  const sessao = await exigirSessao();
  const principal = papelPrincipal(sessao.papeis);

  if (principal === "comercial") {
    return <InicioComercial usuarioId={sessao.usuarioId} />;
  }

  const conteudo =
    INICIO_POR_PAPEL[
      principal && principal !== "enfermeira" ? principal : "diretoria"
    ];
  return (
    <TelaEmConstrucao
      titulo="Início"
      tituloVazio={conteudo.titulo}
      texto={conteudo.texto}
      acao={conteudo.acao}
    />
  );
}

/**
 * Início do comercial (fluxo E e C1 do telas.md; protótipo
 * `comercial-inicio.html`): a fila de transferências e as tarefas que
 * vencem hoje, com a frase-resumo do dia. No computador, fila e tarefas
 * lado a lado, 62/38 (crítica do CRM, P0 item 1).
 */
async function InicioComercial({ usuarioId }: { usuarioId: string }) {
  let fila: TransferenciaTela[] | null = null;
  let tela: TarefasTela | null = null;
  let telefonePlantao: string | null = null;
  try {
    [fila, tela, telefonePlantao] = await Promise.all([
      listarFilaTela(),
      listarTarefasTela(),
      obterTelefonePlantao(),
    ]);
  } catch {
    fila = null;
    tela = null;
  }

  const gruposHoje =
    tela?.grupos.filter(
      (g) => g.balde === "vencida" || g.balde === "vence_hoje",
    ) ?? [];
  const totalTarefasHoje = gruposHoje.reduce(
    (acc, g) => acc + g.tarefas.length,
    0,
  );

  const dataResumo = formatarDiaSemanaEData(new Date());
  const resumo =
    fila && tela && dataResumo
      ? `${dataResumo}. ${fraseContagem(
          fila.length,
          "transferência aberta",
          "transferências abertas",
        )} e ${fraseContagem(
          totalTarefasHoje,
          "tarefa com prazo hoje",
          "tarefas com prazo hoje",
          false,
        )}.`
      : dataResumo;

  return (
    <>
      <CabecalhoTela titulo="Início" subtitulo={resumo} />
      <div className="grid grid-cols-1 gap-8 pt-6 lg:grid-cols-[62fr_38fr]">
        <section aria-labelledby="inicio-transferencias">
          <h2
            id="inicio-transferencias"
            className="font-titulo text-2 text-texto mb-3"
          >
            Transferências
          </h2>
          {fila ? (
            <FilaTransferencias
              fila={fila}
              usuarioId={usuarioId}
              destinoDoPapel={DESTINO_DO_PAPEL.comercial}
              telefonePlantao={telefonePlantao}
            />
          ) : (
            <FaixaAlerta
              variante="erro"
              titulo="Não foi possível carregar a fila agora"
            >
              Confira a conexão e recarregue a página.
            </FaixaAlerta>
          )}
        </section>

        <section aria-labelledby="inicio-tarefas">
          <h2
            id="inicio-tarefas"
            className="font-titulo text-2 text-texto mb-3"
          >
            Tarefas de hoje
          </h2>
          {tela ? (
            <ListaTarefas grupos={gruposHoje} />
          ) : (
            <FaixaAlerta
              variante="erro"
              titulo="Não foi possível carregar as tarefas agora"
            >
              Confira a conexão e recarregue a página.
            </FaixaAlerta>
          )}
        </section>
      </div>
    </>
  );
}
