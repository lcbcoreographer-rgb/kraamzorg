import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { VisaoTarefasEquipe } from "@/lib/dados/tipos-relacao";
import { QuadroEquipes } from "@/modules/relacao/componentes/quadro-equipes";
import { montarQuadroEquipes } from "@/modules/relacao/quadro-equipes";

export const metadata: Metadata = {
  title: "Tarefas por equipe · Kraamzorg OS",
};

/**
 * Tarefas por equipe (P51 item 1): a visão da coordenação e da diretoria de
 * quanto cada equipe e cada pessoa tem em aberto, o que venceu e o que está
 * sem responsável. A tarefa em si continua na tela Tarefas.
 */
export default async function PaginaTarefasEquipe() {
  const usuario = await exigirSessao("/tarefas-equipe");
  const semMfa = exigeMfa(usuario.papeis) && usuario.aal !== "aal2";

  let visao: VisaoTarefasEquipe | null = null;
  let falhou = false;
  if (!semMfa) {
    try {
      visao = await (await obterRepositorios()).relacao.tarefasEquipe.visao();
    } catch (erro) {
      falhou = !(
        erro instanceof ErroRepositorio && erro.codigo === "sem_permissao"
      );
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Tarefas por equipe
        </h1>
        <p className="text-apoio text-texto-2 max-w-[60ch]">
          Uma coluna por equipe e, dentro dela, as tarefas de cada pessoa. O que
          venceu fica no topo; o que está sem responsável vem primeiro. Cada
          tarefa se resolve na tela Tarefas de quem cuida dela.
        </p>
      </div>

      {semMfa ? (
        <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
          <p className="text-corpo text-texto flex items-start gap-3">
            <LockKeyhole
              className="text-texto-2 mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            Esta tela reúne as tarefas de todas as equipes, por isso pede o
            código do aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/tarefas-equipe")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : falhou || !visao ? (
        <FaixaAlerta
          variante={falhou ? "erro" : "info"}
          titulo={
            falhou
              ? "As tarefas não abriram agora"
              : "Esta visão é da coordenação e da diretoria"
          }
        >
          {falhou
            ? "Confira a conexão e recarregue a página. Nada foi alterado."
            : "Suas próprias tarefas ficam na tela Tarefas."}
        </FaixaAlerta>
      ) : (
        <QuadroEquipes quadro={montarQuadroEquipes(visao)} />
      )}
    </div>
  );
}
