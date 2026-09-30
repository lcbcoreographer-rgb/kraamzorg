import type { Metadata } from "next";
import { Inbox, ListTodo, UserCheck } from "lucide-react";
import { CabecalhoSaudacao } from "@/components/shell/cabecalho-saudacao";
import { saudacao } from "@/components/shell/saudacao";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
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
import { fraseDoDia, resumoDoInicio } from "./frase-do-dia";
import { InicioCoordenacao, InicioDiretoria } from "./inicio-gestao";
import {
  listarTarefasTela,
  type TarefasTela,
} from "@/modules/mensageria/tarefas/dados";

export const metadata: Metadata = { title: "Início · Kraamzorg OS" };

/**
 * O que o Início dos papéis ainda sem resumo próprio vai mostrar (PRD
 * 20.4), no molde do estado "ainda em construção" (DESIGN.md, 11.7;
 * voz.md, seção 5). Coordenação e diretoria já têm o Início montado
 * [polimento] (`inicio-gestao.tsx`).
 */
const INICIO_POR_PAPEL: Record<
  "financeiro" | "marketing",
  { texto: string; acao?: { rotulo: string; href: string } }
> = {
  financeiro: {
    texto:
      "Aqui você vai ver o que pede atenção no financeiro: cobranças vencendo, pagamentos confirmados e notas com erro.",
    acao: { rotulo: "Ver cobranças", href: "/cobrancas" },
  },
  marketing: {
    texto:
      "Aqui você vai ver os leads por origem e por estágio, sempre em número agregado, sem dado de família.",
  },
};

/**
 * Dono: P18 (fila e tarefas do comercial) e P27 (transferências); cada
 * papel ganha o próprio Início no módulo dele (coordenação P36, financeiro
 * P46, marketing P47, diretoria P52). Coordenação e diretoria: montados no
 * polimento da direção "Colo", com as leituras que já existiam.
 */
export default async function PaginaInicio() {
  const sessao = await exigirSessao();
  const principal = papelPrincipal(sessao.papeis);

  if (principal === "comercial") {
    return <InicioComercial usuarioId={sessao.usuarioId} nome={sessao.nome} />;
  }
  if (principal === "coordenacao") {
    return <InicioCoordenacao sessao={sessao} />;
  }
  if (principal === "financeiro" || principal === "marketing") {
    const conteudo = INICIO_POR_PAPEL[principal];
    // Tela de abertura: o título é o dia (DESIGN.md, 11.4); a aba e o
    // <title> continuam "Início".
    return (
      <TelaEmConstrucao
        titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
        abertura
        saudacao={saudacao(sessao.nome)}
        texto={conteudo.texto}
        acao={conteudo.acao}
      />
    );
  }
  return <InicioDiretoria sessao={sessao} />;
}

/**
 * Início do comercial (fluxo E e C1 do telas.md; direção "Colo", DESIGN.md
 * 2.2 e 2.13): o bloco de abertura com o cumprimento, o dia, a frase do dia
 * e o trio de números (transferências esperando, com a equipe, tarefas de
 * hoje); depois a fila de transferências e as tarefas que vencem hoje. No
 * computador, fila e tarefas lado a lado, 62/38 (crítica do CRM, P0 item 1).
 */
async function InicioComercial({
  usuarioId,
  nome,
}: {
  usuarioId: string;
  nome: string;
}) {
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
  const contagem =
    fila && tela
      ? {
          transferenciasEsperando: fila.filter((t) => t.status === "aberto")
            .length,
          transferenciasComEquipe: fila.filter((t) => t.status === "assumido")
            .length,
          tarefasAtrasadas:
            gruposHoje.find((g) => g.balde === "vencida")?.tarefas.length ?? 0,
          tarefasHoje:
            gruposHoje.find((g) => g.balde === "vence_hoje")?.tarefas.length ??
            0,
        }
      : null;
  const resumo = contagem ? fraseDoDia(contagem) : null;
  const numeros = contagem
    ? resumoDoInicio(contagem, {
        maxima: fila!.filter(
          (t) => t.status === "aberto" && t.prioridade === "maxima",
        ).length,
        comVoce: fila!.filter(
          (t) => t.status === "assumido" && t.assumidoPor === usuarioId,
        ).length,
      })
    : null;

  return (
    <>
      {/* Tela de abertura: o cumprimento, o dia como título e a frase de
          estado logo abaixo, em marinho (DESIGN.md, 2.2 e 11.4). A aba e o
          <title> continuam "Início". */}
      <CabecalhoSaudacao
        saudacao={saudacao(nome)}
        titulo={formatarDiaSemanaEData(new Date()) ?? "Início"}
        frase={resumo}
      >
        {numeros ? (
          <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2 lg:max-w-[720px] lg:gap-3">
            <CartaoResumo
              destaque
              className="tablet:col-span-1 col-span-2"
              fundo="marinho"
              tom="argila"
              icone={<Inbox />}
              valor={contagem!.transferenciasEsperando}
              rotulo={numeros.esperando.rotulo}
              contexto={numeros.esperando.contexto}
              href="#inicio-transferencias"
            />
            <CartaoResumo
              fundo="medio"
              tom="salvia"
              icone={<UserCheck />}
              valor={contagem!.transferenciasComEquipe}
              rotulo={numeros.comEquipe.rotulo}
              contexto={numeros.comEquipe.contexto}
              href="/transferencias"
            />
            <CartaoResumo
              fundo="medio"
              tom="lavanda"
              icone={<ListTodo />}
              valor={contagem!.tarefasHoje + contagem!.tarefasAtrasadas}
              rotulo={numeros.tarefas.rotulo}
              contexto={numeros.tarefas.contexto}
              href="#inicio-tarefas"
            />
          </div>
        ) : null}
      </CabecalhoSaudacao>
      <div className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[62fr_38fr]">
        <section
          aria-labelledby="inicio-transferencias"
          className="scroll-mt-4"
        >
          <div className="mb-3 flex items-center gap-3">
            <TileIcone tom="marinho" forma="quadrado">
              <Inbox />
            </TileIcone>
            <h2
              id="inicio-transferencias"
              className="font-titulo text-2 text-texto"
            >
              Transferências
            </h2>
          </div>
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

        <section aria-labelledby="inicio-tarefas" className="scroll-mt-4">
          {tela ? (
            <ListaTarefas
              grupos={gruposHoje}
              titulo="Tarefas de hoje"
              idTitulo="inicio-tarefas"
              icone={<ListTodo />}
              tomIcone="lavanda"
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
