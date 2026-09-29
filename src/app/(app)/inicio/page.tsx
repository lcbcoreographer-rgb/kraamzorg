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
import { obterFraseEquipe } from "@/modules/operacao/equipe/dados";
import { ListaTarefas } from "@/modules/mensageria/tarefas/componentes/lista-tarefas";
import { fraseDoDia } from "./frase-do-dia";
import {
  listarTarefasTela,
  type TarefasTela,
} from "@/modules/mensageria/tarefas/dados";

export const metadata: Metadata = { title: "Início · Kraamzorg OS" };

/**
 * O que o Início de cada papel vai mostrar (PRD 20.4), no molde do estado
 * "ainda em construção" (DESIGN.md, 11.7; voz.md, seção 5).
 */
const INICIO_POR_PAPEL: Record<
  Exclude<Papel, "enfermeira" | "comercial">,
  { texto: string; acao?: { rotulo: string; href: string } }
> = {
  coordenacao: {
    texto:
      "Aqui você vai ver primeiro o que pede a sua decisão: alertas clínicos abertos, fichas sem assinatura e ofertas sem resposta.",
  },
  financeiro: {
    texto:
      "Aqui você vai ver o que pede atenção no financeiro: cobranças vencendo, pagamentos confirmados e notas com erro.",
    acao: { rotulo: "Ver cobranças", href: "/cobrancas" },
  },
  marketing: {
    texto:
      "Aqui você vai ver os leads por origem e por estágio, sempre em número agregado, sem dado de família.",
  },
  diretoria: {
    texto:
      "Aqui você vai ver, uma linha para cada, como estão vendas, operação, equipe, financeiro e alertas, comparados com o período anterior.",
    acao: { rotulo: "Ver pipeline", href: "/pipeline" },
  },
};

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
  // Coordenação e diretoria abrem o dia com a síntese da equipe (P37, fluxo
  // C): "3 em visita agora, 1 livre, 2 reservadas para esta semana...".
  const fraseEquipe =
    principal === "coordenacao" || principal === "diretoria"
      ? await obterFraseEquipe()
      : null;
  // Tela de abertura: o título é o dia (DESIGN.md, 11.4); a aba e o
  // <title> continuam "Início".
  return (
    <TelaEmConstrucao
      titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
      abertura
      subtitulo={fraseEquipe ? `Equipe agora: ${fraseEquipe}` : undefined}
      texto={conteudo.texto}
      acao={
        fraseEquipe && principal === "coordenacao"
          ? { rotulo: "Ver a equipe", href: "/equipe" }
          : conteudo.acao
      }
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
  const resumo =
    fila && tela
      ? fraseDoDia({
          transferenciasEsperando: fila.filter((t) => t.status === "aberto")
            .length,
          transferenciasComEquipe: fila.filter((t) => t.status === "assumido")
            .length,
          tarefasAtrasadas:
            gruposHoje.find((g) => g.balde === "vencida")?.tarefas.length ?? 0,
          tarefasHoje:
            gruposHoje.find((g) => g.balde === "vence_hoje")?.tarefas.length ??
            0,
        })
      : null;

  return (
    <>
      {/* Tela de abertura: o dia como título e a frase de estado logo
          abaixo, em marinho (DESIGN.md, 11.4). A aba e o <title>
          continuam "Início". */}
      <CabecalhoTela
        titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
        subtitulo={resumo}
        abertura
      />
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
              titulo="A fila de transferências não carregou"
            >
              Nada se perdeu: as transferências continuam abertas. Confira a
              conexão e recarregue a página.
            </FaixaAlerta>
          )}
        </section>

        <section aria-labelledby="inicio-tarefas">
          {tela ? (
            <ListaTarefas
              grupos={gruposHoje}
              titulo="Tarefas de hoje"
              idTitulo="inicio-tarefas"
            />
          ) : (
            <>
              <h2
                id="inicio-tarefas"
                className="font-titulo text-2 text-texto mb-3"
              >
                Tarefas de hoje
              </h2>
              <FaixaAlerta variante="erro" titulo="As tarefas não carregaram">
                Nada se perdeu: as tarefas continuam abertas. Confira a conexão
                e recarregue a página.
              </FaixaAlerta>
            </>
          )}
        </section>
      </div>
    </>
  );
}
