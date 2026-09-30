import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Check, GraduationCap } from "lucide-react";
import { MantaDobrada } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TileIcone } from "@/components/ui/tile-icone";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Trilha } from "@/lib/dados/tipos-relacao";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Treinamentos · Kraamzorg OS" };

/**
 * Trilha de treinamento da enfermeira (P51 item 2): os manuais e protocolos
 * que a coordenação separou para a função, na ordem, com o que já foi lido.
 * Só leitura e confirmação; o texto abre na tela de manuais.
 */
export default async function PaginaTreinamentos() {
  await exigirSessao("/treinamentos");
  let trilhas: Trilha[] = [];
  let falhou = false;
  try {
    const { relacao } = await obterRepositorios();
    trilhas = (await relacao.manuais.trilhas()).filter((t) => t.ativa);
  } catch {
    falhou = true;
  }
  return (
    <>
      <CabecalhoTela
        titulo="Treinamentos"
        subtitulo="Os manuais e protocolos da sua função, na ordem que a coordenação montou."
      />
      <div className="flex flex-col gap-6 pt-6">
        {falhou ? (
          <p role="alert" className="text-corpo text-alerta">
            Sem sinal agora. Os treinamentos abrem quando a conexão voltar.
          </p>
        ) : trilhas.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<MantaDobrada tamanho={112} />}
            titulo="Nenhum treinamento para você agora"
            texto="Quando a coordenação montar uma trilha para a sua função, ela aparece aqui, na ordem de leitura."
          />
        ) : (
          trilhas.map((t) => {
            const feitos = t.itens.filter((i) => i.lido).length;
            return (
              <section
                key={t.id}
                aria-label={t.nome}
                className="rounded-3 bg-areia-clara flex flex-col gap-4 p-5"
                data-trilha={t.nome}
              >
                <div className="flex items-center gap-3">
                  <TileIcone tom="areia" forma="quadrado">
                    <GraduationCap />
                  </TileIcone>
                  <h2 className="font-titulo text-2 text-texto font-medium">
                    {t.nome}
                  </h2>
                </div>
                <BarraProgresso
                  valor={feitos}
                  total={t.itens.length}
                  texto={`${feitos} de ${t.itens.length} ${t.itens.length === 1 ? "manual lido" : "manuais lidos"}.`}
                  textoCompleta={`${feitos} de ${t.itens.length} ${t.itens.length === 1 ? "manual lido" : "manuais lidos"}. A trilha está completa.`}
                />
                <ol className="flex flex-col gap-2">
                  {t.itens.map((i) => (
                    <li
                      key={i.manualId}
                      className={cn(
                        "rounded-2 flex flex-wrap items-center gap-3 px-3 py-2",
                        i.lido ? "bg-salvia-clara" : "bg-superficie shadow-1",
                      )}
                    >
                      <TileIcone tom={i.lido ? "salvia" : "areia"} tamanho="p">
                        {i.lido ? <Check /> : <BookOpen />}
                      </TileIcone>
                      <Link
                        href={`/manuais/${i.manualId}`}
                        className="text-corpo text-texto min-h-toque inline-flex min-w-0 flex-1 items-center underline underline-offset-4"
                      >
                        {i.ordem}. {i.titulo}
                      </Link>
                      <Selo variante={i.lido ? "sucesso" : "aviso"}>
                        {i.lido ? "Lido" : "Falta ler"}
                      </Selo>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
