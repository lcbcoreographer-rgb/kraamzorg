import Link from "next/link";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { cn } from "@/lib/utils";
import {
  ListaDeAlertas,
  VazioDosAlertas,
  type PapelNaLista,
} from "./lista-de-alertas";
import { textosAlertas } from "./textos";

/**
 * Conteúdo comum das duas telas de alertas clínicos (P40): `/alertas` da
 * enfermeira e `/alertas-clinicos` da coordenação e da diretoria. A lista
 * vem de `api.alertas_clinicos`, que grava a leitura no log e recorta por
 * papel (enfermeira nas famílias atribuídas, coordenação e diretoria em
 * todas).
 */
export async function PaginaDeAlertas({
  caminho,
  situacao,
}: {
  /** Rota da página, para as abas e para a barreira de sessão. */
  caminho: "/alertas" | "/alertas-clinicos";
  situacao: "abertos" | "fechados";
}) {
  const sessao = await exigirSessao(caminho);
  const papel: PapelNaLista = sessao.papeis.includes("coordenacao")
    ? "coordenacao"
    : sessao.papeis.includes("diretoria")
      ? "diretoria"
      : "enfermeira";

  const { assistencial } = await obterRepositorios();
  const [alertas, telefone] = await Promise.all([
    assistencial.listarAlertas(situacao),
    assistencial.telefoneSupervisao(),
  ]);

  const t = textosAlertas[papel];
  return (
    <div className="flex flex-col gap-6 pb-8">
      <CabecalhoTela titulo={t.titulo} subtitulo={t.subtitulo} />
      <nav aria-label={textosAlertas.abas.rotulo} className="flex gap-2">
        {(["abertos", "fechados"] as const).map((s) => (
          <Link
            key={s}
            href={s === "abertos" ? caminho : `${caminho}?situacao=${s}`}
            aria-current={s === situacao ? "page" : undefined}
            className={cn(
              "rounded-pilula text-apoio min-h-toque inline-flex items-center px-4 font-semibold",
              s === situacao
                ? "bg-marinho text-texto-inverso"
                : "bg-marinho-08 text-texto",
            )}
          >
            {textosAlertas.abas[s]}
          </Link>
        ))}
      </nav>
      {alertas.length === 0 ? (
        <VazioDosAlertas situacao={situacao} />
      ) : (
        <ListaDeAlertas alertas={alertas} telefone={telefone} papel={papel} />
      )}
    </div>
  );
}

/** Lê `?situacao=` da URL: qualquer valor fora da lista volta para abertos. */
export function situacaoDaUrl(
  valor: string | string[] | undefined,
): "abertos" | "fechados" {
  return valor === "fechados" ? "fechados" : "abertos";
}
