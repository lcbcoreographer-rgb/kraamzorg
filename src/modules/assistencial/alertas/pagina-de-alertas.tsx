import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
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
      <AbasPilula
        rotulo={textosAlertas.abas.rotulo}
        ativa={situacao}
        className="self-start"
        abas={(["abertos", "fechados"] as const).map((s) => ({
          valor: s,
          rotulo: textosAlertas.abas[s],
          href: s === "abertos" ? caminho : `${caminho}?situacao=${s}`,
        }))}
      />
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
