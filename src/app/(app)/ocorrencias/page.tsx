import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaOcorrenciasTela } from "@/modules/operacao/ocorrencias/componentes/lista-ocorrencias";
import {
  obterTelaListaOcorrencias,
  situacaoDaBusca,
  type TelaListaOcorrencias,
} from "@/modules/operacao/ocorrencias/dados";

export const metadata: Metadata = { title: "Ocorrências · Kraamzorg OS" };

/**
 * Ocorrências (P42, PRD 6.6): o que a equipe abriu ou a pesquisa gerou, com
 * responsável, prazo de resposta e histórico. As privadas só aparecem para a
 * coordenação e a diretoria.
 */
export default async function PaginaOcorrencias({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao: busca } = await searchParams;
  const situacao = situacaoDaBusca(busca);
  await exigirSessao("/ocorrencias");

  let tela: TelaListaOcorrencias | null = null;
  try {
    tela = await obterTelaListaOcorrencias(situacao);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Ocorrências"
        lateral={
          <Botao
            asChild
            tamanho="compacto"
            className="max-w-full text-balance whitespace-normal"
            iconeEsquerda={<Plus className="size-4" aria-hidden="true" />}
          >
            <Link href="/ocorrencias/nova">Abrir uma ocorrência</Link>
          </Botao>
        }
      />
      <div className="flex flex-col gap-6 pt-4">
        {!tela ? (
          <FaixaAlerta
            variante="erro"
            titulo="As ocorrências não abriram agora"
          >
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : tela.situacao === "sem_permissao" ? (
          <FaixaAlerta
            variante="info"
            titulo="As ocorrências não estão com o seu papel"
          >
            As ocorrências são da coordenação e da diretoria.
          </FaixaAlerta>
        ) : (
          <ListaOcorrenciasTela lista={tela.lista} situacao={situacao} />
        )}
      </div>
    </>
  );
}
