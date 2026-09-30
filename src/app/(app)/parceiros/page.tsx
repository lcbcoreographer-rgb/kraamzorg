import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  ListaParceiros,
  RelatorioIndicacoes,
} from "@/lib/dados/tipos-relacao";
import { PainelParceiros } from "@/modules/parceiros/componentes/painel-parceiros";
import { ROTULO_ESPECIALIDADE } from "@/modules/relacao/rotulos";

export const metadata: Metadata = { title: "Parceiros médicos · Kraamzorg OS" };

/**
 * Parceiros médicos e indicações (P50): relacionamento institucional, nunca
 * comissão. O aviso sobre a vedação ética fica sempre no topo. Cadastro do
 * médico, contato e tarefas de relacionamento, registro de indicação (de
 * médico ou de família promotora) e o relatório por médico.
 */
export default async function PaginaParceiros() {
  const usuario = await exigirSessao("/parceiros");
  const semMfa = exigeMfa(usuario.papeis) && usuario.aal !== "aal2";

  let lista: ListaParceiros | null = null;
  let relatorio: RelatorioIndicacoes | null = null;
  let familias: { id: string; nome: string }[] = [];
  let falhou = false;
  if (!semMfa) {
    try {
      const repos = await obterRepositorios();
      [lista, relatorio] = await Promise.all([
        repos.relacao.parceiros.listar(),
        repos.relacao.parceiros.relatorio({}),
      ]);
      familias = (await repos.familias.listarFamilias({ limite: 200 })).map(
        (f) => ({ id: f.id, nome: f.nome }),
      );
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
          Parceiros médicos
        </h1>
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          Os médicos que conhecem a Kraamzorg, as indicações que chegaram e o
          contato combinado com cada um.
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
            Esta tela cruza médicos e famílias, por isso pede o código do
            aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/parceiros")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : falhou || !lista ? (
        <FaixaAlerta
          variante={falhou ? "erro" : "info"}
          titulo={
            falhou
              ? "Os parceiros não abriram agora"
              : "Os parceiros não estão com o seu papel"
          }
        >
          {falhou
            ? "Confira a conexão e recarregue a página. Nada foi alterado."
            : "Parceiros médicos e indicações são do comercial e da diretoria."}
        </FaixaAlerta>
      ) : (
        <>
          <FaixaAlerta
            variante="info"
            titulo="Parceria não tem contrapartida financeira"
          >
            {lista.aviso}
          </FaixaAlerta>
          <PainelParceiros parceiros={lista.parceiros} familias={familias} />
          <section aria-labelledby="relatorio" className="flex flex-col gap-3">
            <h2
              id="relatorio"
              className="font-titulo text-1 text-texto font-normal"
            >
              Relatório por médico
            </h2>
            {relatorio && relatorio.porMedico.length > 0 ? (
              <TabelaLista
                rotulo="Indicações por médico parceiro"
                colunas={[
                  { chave: "nome", rotulo: "Médico", principal: true },
                  { chave: "especialidade", rotulo: "Especialidade" },
                  { chave: "indicacoes", rotulo: "Indicações", numerica: true },
                  {
                    chave: "qualificadas",
                    rotulo: "Qualificadas",
                    numerica: true,
                  },
                  {
                    chave: "contratos",
                    rotulo: "Viraram contrato",
                    numerica: true,
                  },
                ]}
                linhas={relatorio.porMedico.map((m) => ({
                  id: m.medicoId,
                  valores: {
                    nome: m.nome,
                    especialidade: ROTULO_ESPECIALIDADE[m.especialidade],
                    indicacoes: String(m.indicacoes),
                    qualificadas: String(m.qualificadas),
                    contratos: String(m.contratos),
                  },
                }))}
              />
            ) : (
              <EstadoVazio
                nivelTitulo="h3"
                titulo="Nenhuma indicação de médico ainda"
                texto="Quando você registrar uma indicação de um médico parceiro, ela aparece aqui e também no relatório de origem do marketing."
              />
            )}
            {relatorio && relatorio.porPromotora.length > 0 ? (
              <TabelaLista
                rotulo="Indicações por família promotora"
                colunas={[
                  {
                    chave: "nome",
                    rotulo: "Família que indicou",
                    principal: true,
                  },
                  { chave: "indicacoes", rotulo: "Indicações", numerica: true },
                  {
                    chave: "contratos",
                    rotulo: "Viraram contrato",
                    numerica: true,
                  },
                ]}
                linhas={relatorio.porPromotora.map((f) => ({
                  id: f.familiaId,
                  valores: {
                    nome: f.nomeExibicao,
                    indicacoes: String(f.indicacoes),
                    contratos: String(f.contratos),
                  },
                }))}
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
