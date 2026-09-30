import type { Metadata } from "next";
import Link from "next/link";
import { Coins, History, LockKeyhole } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { Botao } from "@/components/ui/botao";
import { TileIcone } from "@/components/ui/tile-icone";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  ConfigCopiloto,
  PerguntaCopiloto,
} from "@/lib/dados/tipos-relacao";
import { formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { PainelCopiloto } from "@/modules/copiloto/componentes/painel-copiloto";

export const metadata: Metadata = { title: "Copiloto · Kraamzorg OS" };

const EXEMPLOS = [
  "Quantas oportunidades há em cada estágio do pipeline 1?",
  "Qual foi a taxa de conversão de leads neste mês?",
  "Quantos leads vieram de cada origem no mês passado?",
  "Qual a receita paga em setembro?",
  "Quais praças estão perto do limite de ocupação?",
];

/**
 * Copiloto interno (P48): pergunta em linguagem natural sobre pipeline,
 * conversão, receita, ocupação e origem dos leads, para a diretoria e o
 * comercial. O modelo escolhe entre cinco funções de leitura, sempre com as
 * permissões de quem pergunta, e nunca vê dado assistencial. As perguntas
 * ficam no histórico e o custo do mês está aqui, à vista.
 */
export default async function PaginaCopiloto() {
  const usuario = await exigirSessao("/copiloto");
  const semMfa = exigeMfa(usuario.papeis) && usuario.aal !== "aal2";

  let config: ConfigCopiloto | null = null;
  let historico: PerguntaCopiloto[] = [];
  let falhou = false;
  if (!semMfa) {
    try {
      const { relacao } = await obterRepositorios();
      [config, historico] = await Promise.all([
        relacao.copiloto.config(),
        relacao.copiloto.historico(8),
      ]);
    } catch (erro) {
      if (!(
        erro instanceof ErroRepositorio && erro.codigo === "sem_permissao"
      )) {
        falhou = true;
      }
    }
  }

  return (
    <>
      <CabecalhoTela
        titulo="Copiloto"
        subtitulo="Pergunte em uma frase e veja os números com a conta que os sustenta."
      />
      <div className="flex flex-col gap-8 pt-6">
        {semMfa ? (
          <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
            <p className="text-corpo text-texto flex items-start gap-3">
              <LockKeyhole
                className="text-texto-2 mt-1 size-4 shrink-0"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              O copiloto consulta números do negócio, por isso pede o código do
              aplicativo (MFA) antes de abrir.
            </p>
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              className="self-start"
            >
              <Link
                href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/copiloto")}`}
              >
                Confirmar com o código
              </Link>
            </Botao>
          </div>
        ) : falhou || !config ? (
          <FaixaAlerta
            variante={falhou ? "erro" : "info"}
            titulo={
              falhou
                ? "O copiloto não abriu agora"
                : "O copiloto não está com o seu papel"
            }
          >
            {falhou
              ? "Confira a conexão e recarregue a página. Nada foi alterado."
              : "O copiloto é da diretoria e do comercial."}
          </FaixaAlerta>
        ) : (
          <>
            {!config.ativo ? (
              <FaixaAlerta variante="info" titulo="O copiloto está desligado">
                A diretoria desligou o copiloto em Configurações. As perguntas
                ficam registradas, mas nenhuma vai a serviço de IA.
              </FaixaAlerta>
            ) : null}

            {/* Computador: a pergunta e a resposta à esquerda; o custo e as
              últimas perguntas na coluna da direita. */}
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[62fr_38fr]">
              <PainelCopiloto
                limite={config.perguntaMaxCaracteres}
                exemplos={EXEMPLOS}
              />

              <div className="flex flex-col gap-8">
                <section
                  aria-labelledby="custo"
                  className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-5"
                >
                  <h2
                    id="custo"
                    className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
                  >
                    <TileIcone tom="lavanda" forma="quadrado" tamanho="p">
                      <Coins />
                    </TileIcone>
                    Custo do mês
                  </h2>
                  <p className="text-corpo text-texto" data-teste="custo-mes">
                    {config.perguntasMes === 0
                      ? "Nenhuma pergunta neste mês ainda."
                      : `${config.perguntasMes} ${config.perguntasMes === 1 ? "pergunta" : "perguntas"} neste mês, com custo de ${formatarMoeda(config.custoMesCentavos)}${config.orcamentoMensalCentavos !== null ? `, de um limite de ${formatarMoeda(config.orcamentoMensalCentavos)}` : ""}.`}
                    {config.perguntasMes === 0 &&
                    config.orcamentoMensalCentavos !== null
                      ? ` O limite do mês é de ${formatarMoeda(config.orcamentoMensalCentavos)}.`
                      : ""}
                  </p>
                  {config.orcamentoMensalCentavos ? (
                    <BarraProgresso
                      valor={config.custoMesCentavos}
                      total={config.orcamentoMensalCentavos}
                      texto={`${Math.min(100, Math.round((config.custoMesCentavos / config.orcamentoMensalCentavos) * 100))}% do limite do mês usado`}
                      textoCompleta="O limite do mês foi todo usado"
                    />
                  ) : null}
                </section>

                {historico.length > 0 ? (
                  <section
                    aria-labelledby="historico"
                    className="flex flex-col gap-3"
                  >
                    <h2
                      id="historico"
                      className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
                    >
                      <TileIcone tom="areia" forma="quadrado" tamanho="p">
                        <History />
                      </TileIcone>
                      Últimas perguntas
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {historico.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-2 bg-areia-clara flex flex-col gap-1 px-4 py-3"
                        >
                          <span className="text-corpo text-texto">
                            {p.pergunta}
                          </span>
                          <span className="text-apoio text-texto-2">
                            {formatarDataHora(p.em)}
                            {p.quem ? `, ${p.quem}` : ""}
                            {p.situacao === "respondida"
                              ? ", respondida"
                              : p.situacao === "recusada"
                                ? ", recusada"
                                : p.situacao === "desligado"
                                  ? ", copiloto desligado"
                                  : p.situacao === "orcamento"
                                    ? ", sem orçamento"
                                    : ", com erro"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
