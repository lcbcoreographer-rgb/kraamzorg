import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { VisaoTarefasEquipe } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
import { ROTULO_EQUIPE } from "@/modules/relacao/rotulos";

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
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          Quanto cada equipe tem em aberto, o que já venceu e o que ainda não
          tem responsável.
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
        <>
          <section aria-labelledby="equipes" className="flex flex-col gap-3">
            <h2
              id="equipes"
              className="font-titulo text-1 text-texto font-normal"
            >
              Por equipe
            </h2>
            {visao.equipes.length === 0 ? (
              <EstadoVazio
                nivelTitulo="h3"
                titulo="Nenhuma tarefa aberta"
                texto="Quando houver tarefas em aberto, cada equipe aparece aqui com o total."
              />
            ) : (
              <TabelaLista
                rotulo="Tarefas abertas por equipe"
                colunas={[
                  { chave: "equipe", rotulo: "Equipe", principal: true },
                  { chave: "abertas", rotulo: "Abertas", numerica: true },
                  {
                    chave: "andamento",
                    rotulo: "Em andamento",
                    numerica: true,
                  },
                  { chave: "vencidas", rotulo: "Vencidas", numerica: true },
                  { chave: "sem", rotulo: "Sem responsável", numerica: true },
                  {
                    chave: "concluidas",
                    rotulo: "Concluídas em 7 dias",
                    numerica: true,
                  },
                ]}
                linhas={visao.equipes.map((e) => ({
                  id: e.equipe,
                  valores: {
                    equipe: ROTULO_EQUIPE[e.equipe] ?? e.equipe,
                    abertas: String(e.abertas),
                    andamento: String(e.emAndamento),
                    vencidas: String(e.vencidas),
                    sem: String(e.semResponsavel),
                    concluidas: String(e.concluidas7d),
                  },
                }))}
              />
            )}
          </section>

          <section aria-labelledby="pessoas" className="flex flex-col gap-3">
            <h2
              id="pessoas"
              className="font-titulo text-1 text-texto font-normal"
            >
              Por pessoa
            </h2>
            {visao.pessoas.length === 0 ? (
              <p className="text-corpo text-texto-2">
                Nenhuma pessoa tem tarefa aberta agora.
              </p>
            ) : (
              <TabelaLista
                rotulo="Tarefas abertas por pessoa"
                colunas={[
                  { chave: "nome", rotulo: "Pessoa", principal: true },
                  { chave: "equipe", rotulo: "Equipe" },
                  { chave: "abertas", rotulo: "Abertas", numerica: true },
                  { chave: "vencidas", rotulo: "Vencidas", numerica: true },
                ]}
                linhas={visao.pessoas.map((p) => ({
                  id: p.usuarioId,
                  valores: {
                    nome: p.nome,
                    equipe: ROTULO_EQUIPE[p.equipe] ?? p.equipe,
                    abertas: String(p.abertas),
                    vencidas: String(p.vencidas),
                  },
                }))}
              />
            )}
          </section>

          <section aria-labelledby="lista" className="flex flex-col gap-3">
            <h2
              id="lista"
              className="font-titulo text-1 text-texto font-normal"
            >
              Tarefas em aberto
            </h2>
            {visao.tarefas.length === 0 ? (
              <p className="text-corpo text-texto-2">Nada em aberto.</p>
            ) : (
              <TabelaLista
                rotulo="Tarefas em aberto"
                colunas={[
                  { chave: "titulo", rotulo: "Tarefa", principal: true },
                  { chave: "estado", rotulo: "Prazo", canto: true },
                  { chave: "equipe", rotulo: "Equipe" },
                  { chave: "responsavel", rotulo: "Responsável" },
                  { chave: "familia", rotulo: "Família" },
                ]}
                linhas={visao.tarefas.map((t) => ({
                  id: t.id,
                  valores: {
                    titulo: t.titulo,
                    estado: t.vencida ? (
                      <Selo variante="alerta">
                        Venceu em {formatarData(t.venceEm ?? "")}
                      </Selo>
                    ) : t.venceEm ? (
                      <Selo variante="neutro">
                        Até {formatarData(t.venceEm)}
                      </Selo>
                    ) : (
                      <Selo variante="contorno">Sem prazo</Selo>
                    ),
                    equipe: ROTULO_EQUIPE[t.equipe] ?? t.equipe,
                    responsavel: t.responsavel ?? "Sem responsável",
                    familia: t.familia ?? "",
                  },
                }))}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
