import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaPosVendaTela } from "@/modules/operacao/ocorrencias/componentes/lista-pos-venda";
import {
  obterTelaPosVenda,
  situacaoPosVenda,
  type TelaPosVenda,
} from "@/modules/operacao/ocorrencias/dados-pos-venda";

export const metadata: Metadata = { title: "Pós-venda · Kraamzorg OS" };

/**
 * Pós-venda, pipeline 4 (P42): a pesquisa de cada família que terminou o
 * acompanhamento, a nota e a ação que vem depois. Coordenação e diretoria.
 */
export default async function PaginaPosVenda({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao: busca } = await searchParams;
  const situacao = situacaoPosVenda(busca);
  await exigirSessao("/pos-venda");

  let tela: TelaPosVenda | null = null;
  try {
    tela = await obterTelaPosVenda(situacao);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Pós-venda"
        subtitulo="A pesquisa de cada família que terminou o acompanhamento, a nota e o que vem depois."
      />
      <div className="flex flex-col gap-6 pt-6">
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="O pós-venda não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : tela.situacao === "sem_permissao" ? (
          <FaixaAlerta
            variante="info"
            titulo="O pós-venda não está com o seu papel"
          >
            O pós-venda é da coordenação e da diretoria.
          </FaixaAlerta>
        ) : (
          <ListaPosVendaTela lista={tela.lista} situacao={situacao} />
        )}
      </div>
    </>
  );
}
