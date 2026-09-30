import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ClipboardList, FilePlus, Route } from "lucide-react";
import { Broto } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ResumoManual, Trilha } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { FormularioManual } from "@/modules/manuais/componentes/form-manual";
import { FormularioTrilha } from "@/modules/manuais/componentes/form-trilha";
import { ROTULO_PAPEL_ALVO } from "@/modules/relacao/rotulos";

export const metadata: Metadata = {
  title: "Manuais e protocolos · Kraamzorg OS",
};

/**
 * Manuais e protocolos (P51 item 2): a lista do que o seu papel precisa ler,
 * com a versão vigente e a confirmação de leitura. Coordenação e diretoria
 * também cadastram, versionam e montam as trilhas de treinamento.
 */
export default async function PaginaManuais() {
  const usuario = await exigirSessao("/manuais");
  const gestao = usuario.papeis.some(
    (p) => p === "coordenacao" || p === "diretoria",
  );

  let manuais: ResumoManual[] = [];
  let trilhas: Trilha[] = [];
  let falhou = false;
  try {
    const { relacao } = await obterRepositorios();
    manuais = await relacao.manuais.listar();
    if (gestao) trilhas = await relacao.manuais.trilhas();
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Manuais e protocolos"
        subtitulo="O que a sua função precisa ler, na versão de hoje. Quando um texto muda, a leitura pede uma nova confirmação."
      />
      <div className="flex flex-col gap-8 pt-6">
        {falhou ? (
          <FaixaAlerta variante="erro" titulo="Os manuais não abriram agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : manuais.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<Broto tamanho={104} />}
            titulo="Nenhum manual para você ainda"
            texto={
              gestao
                ? "Cadastre o primeiro manual abaixo e marque quem precisa ler."
                : "Quando a coordenação publicar um manual para a sua função, ele aparece aqui."
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* A leitura da pessoa como progresso de verdade (DESIGN.md, 2.8):
              quantos dos textos da função dela já têm a leitura confirmada
              na versão de hoje. */}
            <div className="rounded-3 bg-salvia-clara flex flex-col gap-3 p-5 lg:max-w-[560px]">
              <p className="text-3 text-texto font-semibold">Sua leitura</p>
              <BarraProgresso
                valor={manuais.filter((m) => m.lido).length}
                total={manuais.length}
                texto={`${manuais.filter((m) => m.lido).length} de ${manuais.length} com a leitura confirmada`}
                textoCompleta="Tudo lido na versão de hoje"
              />
            </div>
            <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {manuais.map((m) => (
                // Lido é o que está feito (sálvia); o que falta ler é o
                // trabalho (branco, com sombra leve).
                <li
                  key={m.id}
                  className={cn(
                    "rounded-3 flex items-start gap-3 p-5",
                    m.lido ? "bg-salvia-clara" : "bg-superficie shadow-1",
                  )}
                  data-manual={m.titulo}
                >
                  <TileIcone tom={m.lido ? "salvia" : "areia"} forma="quadrado">
                    {m.categoria === "protocolo" ? (
                      <ClipboardList />
                    ) : (
                      <BookOpen />
                    )}
                  </TileIcone>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={`/manuais/${m.id}`}
                        className="font-titulo text-2 text-texto font-medium underline-offset-4 hover:underline"
                      >
                        {m.titulo}
                      </Link>
                      <p className="text-apoio text-texto-2">
                        {m.categoria === "protocolo" ? "Protocolo" : "Manual"},
                        versão {m.versao}, publicada em{" "}
                        {formatarData(m.publicadaEm)}.
                        {m.papeisAlvo.length > 0
                          ? ` Para: ${m.papeisAlvo.map((p) => ROTULO_PAPEL_ALVO[p] ?? p).join(", ")}.`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!m.ativo ? (
                        <Selo variante="contorno">Fora de uso</Selo>
                      ) : null}
                      {m.confirmacoes !== null ? (
                        <Selo variante="neutro">
                          {m.confirmacoes}{" "}
                          {m.confirmacoes === 1
                            ? "confirmação"
                            : "confirmações"}
                        </Selo>
                      ) : null}
                      <Selo variante={m.lido ? "sucesso" : "aviso"}>
                        {m.lido ? "Lido" : "Falta confirmar a leitura"}
                      </Selo>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {gestao && !falhou ? (
          <>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              <section
                aria-labelledby="novo"
                className="flex min-w-0 flex-col gap-3"
              >
                <h2
                  id="novo"
                  className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
                >
                  <TileIcone tom="dourado" forma="quadrado">
                    <FilePlus />
                  </TileIcone>
                  Cadastrar
                </h2>
                <FormularioManual />
              </section>
              <section
                aria-labelledby="trilhas"
                className="flex min-w-0 flex-col gap-3"
              >
                <h2
                  id="trilhas"
                  className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
                >
                  <TileIcone tom="lavanda" forma="quadrado">
                    <Route />
                  </TileIcone>
                  Trilhas de treinamento
                </h2>
                {trilhas.length === 0 ? (
                  <p className="text-corpo text-texto-2">
                    Nenhuma trilha ainda. Monte a primeira abaixo.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {trilhas.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-5"
                      >
                        <p className="font-titulo text-2 text-texto font-medium">
                          {t.nome}{" "}
                          <span className="text-apoio text-texto-2 font-sans">
                            ({ROTULO_PAPEL_ALVO[t.papelAlvo] ?? t.papelAlvo}
                            {t.ativa ? "" : ", fora de uso"})
                          </span>
                        </p>
                        <p className="text-apoio text-texto-2">
                          {t.itens.map((i) => i.titulo).join(", ") ||
                            "Sem manuais"}
                        </p>
                        {t.equipe ? (
                          // Cada pessoa com a barra da trilha dela (DESIGN.md,
                          // 2.8): um progresso real, de manuais confirmados.
                          <ul className="flex flex-col gap-2">
                            {t.equipe.map((p) => (
                              <li
                                key={p.usuarioId}
                                className="rounded-2 bg-superficie flex flex-col gap-2 p-3"
                              >
                                <span className="text-corpo text-texto font-semibold">
                                  {p.nome}
                                </span>
                                <BarraProgresso
                                  valor={p.feitos}
                                  total={p.total}
                                  texto={`${p.feitos} de ${p.total}`}
                                  textoCompleta="Trilha completa"
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <FormularioTrilha manuais={manuais} />
              </section>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
