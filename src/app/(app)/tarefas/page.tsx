import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaTarefas } from "@/modules/mensageria/tarefas/componentes/lista-tarefas";
import { listarTarefasTela, type TarefasTela } from "@/modules/mensageria/tarefas/dados";

export const metadata: Metadata = { title: "Tarefas · Kraamzorg OS" };

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
        subtitulo="Por prioridade e prazo, com o texto sugerido pronto para editar."
      />
      <div className="pt-6">
        {tela ? (
          <ListaTarefas grupos={tela.grupos} />
        ) : (
          <FaixaAlerta variante="imediato" titulo="Não foi possível carregar as tarefas agora">
            Confira a conexão e recarregue a página. Se continuar, avise a equipe técnica.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
