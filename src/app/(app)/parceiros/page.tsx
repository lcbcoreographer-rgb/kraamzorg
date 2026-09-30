import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, LockKeyhole } from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
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
    <>
      <CabecalhoTela
        titulo="Parceiros médicos"
        subtitulo="Os médicos que conhecem a Kraamzorg, as indicações que chegaram e o contato combinado com cada um."
      />
      <div className="flex flex-col gap-10 pt-6">
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
            <SecaoBloco
              idTitulo="relatorio"
              titulo="Relatório de indicações"
              icone={<ChartColumn />}
              tom="areia"
              apoio="Quem indicou, quantas famílias chegaram e quantas viraram contrato. As mesmas indicações entram na origem do marketing."
            >
              {relatorio && relatorio.porMedico.length > 0 ? (
                <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                  <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 flex flex-col gap-2 min-[720px]:p-5">
                    <h3 className="text-3 text-texto font-semibold">
                      Por médico parceiro
                    </h3>
                    <TabelaLista
                      rotulo="Indicações por médico parceiro"
                      colunas={[
                        { chave: "nome", rotulo: "Médico", principal: true },
                        { chave: "especialidade", rotulo: "Especialidade" },
                        {
                          chave: "indicacoes",
                          rotulo: "Indicações",
                          numerica: true,
                        },
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
                  </div>
                  {relatorio.porPromotora.length > 0 ? (
                    <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 flex flex-col gap-2 min-[720px]:p-5">
                      <h3 className="text-3 text-texto font-semibold">
                        Por família que indicou
                      </h3>
                      <TabelaLista
                        rotulo="Indicações por família promotora"
                        colunas={[
                          {
                            chave: "nome",
                            rotulo: "Família",
                            principal: true,
                          },
                          {
                            chave: "indicacoes",
                            rotulo: "Indicações",
                            numerica: true,
                          },
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
                    </div>
                  ) : null}
                </div>
              ) : (
                <EstadoVazio
                  nivelTitulo="h3"
                  variante="tracejado"
                  titulo="Nenhuma indicação de médico ainda"
                  texto="Quando você registrar uma indicação de um médico parceiro, ela aparece aqui e também no relatório de origem do marketing."
                />
              )}
            </SecaoBloco>
          </>
        )}
      </div>
    </>
  );
}
