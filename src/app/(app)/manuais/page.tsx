import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ResumoManual, Trilha } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
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
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Manuais e protocolos
        </h1>
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          O que a sua função precisa ler, na versão de hoje. Quando um texto
          muda, a leitura pede uma nova confirmação.
        </p>
      </div>

      {falhou ? (
        <FaixaAlerta variante="erro" titulo="Os manuais não abriram agora">
          Confira a conexão e recarregue a página. Nada foi alterado.
        </FaixaAlerta>
      ) : manuais.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          titulo="Nenhum manual para você ainda"
          texto={
            gestao
              ? "Cadastre o primeiro manual abaixo e marque quem precisa ler."
              : "Quando a coordenação publicar um manual para a sua função, ele aparece aqui."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {manuais.map((m) => (
            <li
              key={m.id}
              className="rounded-3 bg-superficie shadow-1 flex flex-wrap items-center justify-between gap-3 p-5"
              data-manual={m.titulo}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/manuais/${m.id}`}
                  className="font-titulo text-2 text-texto font-medium underline-offset-4 hover:underline"
                >
                  {m.titulo}
                </Link>
                <p className="text-apoio text-texto-2">
                  {m.categoria === "protocolo" ? "Protocolo" : "Manual"}, versão{" "}
                  {m.versao}, publicada em {formatarData(m.publicadaEm)}.
                  {m.papeisAlvo.length > 0
                    ? ` Para: ${m.papeisAlvo.map((p) => ROTULO_PAPEL_ALVO[p] ?? p).join(", ")}.`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!m.ativo ? <Selo variante="contorno">Fora de uso</Selo> : null}
                {m.confirmacoes !== null ? (
                  <Selo variante="neutro">
                    {m.confirmacoes}{" "}
                    {m.confirmacoes === 1 ? "confirmação" : "confirmações"}
                  </Selo>
                ) : null}
                <Selo variante={m.lido ? "sucesso" : "aviso"}>
                  {m.lido ? "Lido" : "Falta confirmar a leitura"}
                </Selo>
              </div>
            </li>
          ))}
        </ul>
      )}

      {gestao && !falhou ? (
        <>
          <section aria-labelledby="novo" className="flex flex-col gap-3">
            <h2 id="novo" className="font-titulo text-1 text-texto font-normal">
              Cadastrar
            </h2>
            <FormularioManual />
          </section>
          <section aria-labelledby="trilhas" className="flex flex-col gap-3">
            <h2
              id="trilhas"
              className="font-titulo text-1 text-texto font-normal"
            >
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
                    className="rounded-3 bg-superficie shadow-1 flex flex-col gap-2 p-5"
                  >
                    <p className="font-titulo text-2 text-texto font-medium">
                      {t.nome}{" "}
                      <span className="text-apoio text-texto-2 font-sans">
                        ({ROTULO_PAPEL_ALVO[t.papelAlvo] ?? t.papelAlvo}
                        {t.ativa ? "" : ", fora de uso"})
                      </span>
                    </p>
                    <p className="text-apoio text-texto-2">
                      {t.itens.map((i) => i.titulo).join(", ") || "Sem manuais"}
                    </p>
                    {t.equipe ? (
                      <ul className="flex flex-col gap-1">
                        {t.equipe.map((p) => (
                          <li
                            key={p.usuarioId}
                            className="text-corpo text-texto"
                          >
                            {p.nome}: {p.feitos} de {p.total}
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
        </>
      ) : null}
    </div>
  );
}
