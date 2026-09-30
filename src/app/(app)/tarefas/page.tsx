import type { Metadata } from "next";
import { ChevronDown, CircleHelp } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaTarefas } from "@/modules/mensageria/tarefas/componentes/lista-tarefas";
import {
  listarTarefasTela,
  type TarefasTela,
} from "@/modules/mensageria/tarefas/dados";

export const metadata: Metadata = { title: "Tarefas · Kraamzorg OS" };

/**
 * Como as tarefas funcionam, dito na própria tela (pergunta do dono em
 * 30/09). O que está aqui é o que o sistema já faz (PRD 6.4, 8.3, 10.1 e
 * 23.2): nenhuma regra nova.
 */
const COMO_FUNCIONA: { titulo: string; texto: string }[] = [
  {
    titulo: "De onde vêm",
    texto:
      "Das regras do sistema (a régua de nutrição, o retorno combinado com a família, o freio, o contrato, o pagamento, o fim do acompanhamento, a pesquisa) e de quem da equipe abre uma à mão. Cada tarefa diz de onde veio.",
  },
  {
    titulo: "Quem vê",
    texto:
      "As tarefas que são suas e as do seu papel que ainda não têm responsável.",
  },
  {
    titulo: "Em que ordem",
    texto:
      "Pelo prazo: as vencidas, as que vencem hoje, as dos próximos dias e as sem prazo. Dentro de cada grupo, a prioridade mais alta vem antes.",
  },
  {
    titulo: "Como fecham",
    texto:
      "Com Enviei, depois de mandar o texto pelo WhatsApp; com Concluir, quando é trabalho interno; ou na tela que a tarefa indica, como a ficha ou a proposta. Nada sai para a família sem você tocar em enviar, e o freio da família é conferido antes.",
  },
];

/**
 * Tarefas por prioridade e vencimento (P18 item 2, PRD 23.2). Texto
 * sugerido editável, "Abrir no WhatsApp" e "Enviei" (grava a mensagem com
 * `enviado_por = humano` e conclui a tarefa). Dono: P18. A rota é
 * registrada em `src/lib/navegacao` pela casca (P10).
 */
export default async function PaginaTarefas() {
  await exigirSessao("/tarefas");

  let tela: TarefasTela | null = null;
  try {
    tela = await listarTarefasTela();
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Tarefas"
        subtitulo="Agrupadas pelo prazo. Cada tarefa diz por que existe, o que fazer e tem a ação ao lado."
      />
      <div className="flex flex-col gap-8 pt-6">
        <details className="rounded-3 bg-areia-clara group max-w-[62rem]">
          <summary className="min-h-toque rounded-3 flex cursor-pointer list-none items-center gap-3 px-4 py-3 lg:px-5 [&::-webkit-details-marker]:hidden">
            <TileIcone tom="areia" forma="quadrado" tamanho="p">
              <CircleHelp />
            </TileIcone>
            <span className="text-corpo text-texto flex-1 font-semibold">
              Como as tarefas funcionam
            </span>
            <ChevronDown
              aria-hidden="true"
              className="text-texto ease-estado size-5 shrink-0 transition-transform duration-140 group-open:rotate-180"
              strokeWidth={1.75}
            />
          </summary>
          <dl className="tablet:grid-cols-2 grid gap-x-8 gap-y-4 px-4 pt-1 pb-5 lg:px-5">
            {COMO_FUNCIONA.map((item) => (
              <div key={item.titulo} className="flex flex-col gap-1">
                <dt className="text-apoio text-texto font-semibold">
                  {item.titulo}
                </dt>
                <dd className="text-apoio text-texto-2">{item.texto}</dd>
              </div>
            ))}
          </dl>
        </details>

        {tela ? (
          <ListaTarefas grupos={tela.grupos} detalhada />
        ) : (
          <FaixaAlerta
            variante="prioritario"
            titulo="Não foi possível carregar as tarefas agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
