import type { Metadata } from "next";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { AvisoAcesso } from "@/components/shell/aviso-acesso";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterTelaExtrato } from "@/modules/financeiro/gestao/dados";
import { ImportarExtrato } from "@/modules/financeiro/gestao/componentes/importar-extrato";
import { NavegacaoFinanceiro } from "@/modules/financeiro/gestao/componentes/navegacao-financeiro";
import {
  fraseExtrato,
  VisaoExtrato,
} from "@/modules/financeiro/gestao/componentes/tabela-extrato";

export const metadata: Metadata = {
  title: "Extrato do banco · Kraamzorg OS",
};

/**
 * Conferência com o extrato do banco (P46 item 4): importa o arquivo e sugere
 * o par de cada lançamento. Nunca é gatilho de baixa (D-07). Financeiro e
 * diretoria, em AAL2.
 */
export default async function PaginaExtrato({
  searchParams,
}: {
  searchParams: Promise<{ importacao?: string }>;
}) {
  const { importacao } = await searchParams;
  const usuario = await exigirSessao("/financeiro/extrato");
  const id = z.uuid().safeParse(importacao);
  const importacaoId = id.success ? id.data : null;

  let tela: Awaited<ReturnType<typeof obterTelaExtrato>> | null = null;
  try {
    tela = await obterTelaExtrato(usuario, importacaoId);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Extrato do banco"
        subtitulo={
          tela?.situacao === "ok"
            ? fraseExtrato(tela.dados, importacaoId)
            : "Confira o que o banco mostra com as cobranças e as despesas do sistema."
        }
      />
      <div className="flex flex-col gap-6 pt-6">
        <NavegacaoFinanceiro atual="/financeiro/extrato" />
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="O extrato não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : tela.situacao === "ok" ? (
          <>
            <section
              aria-labelledby="ext-importar"
              className="bg-superficie rounded-3 shadow-1 flex max-w-[720px] flex-col gap-4 p-5"
            >
              <h2
                id="ext-importar"
                className="font-titulo text-2 text-texto font-medium"
              >
                Importar um extrato
              </h2>
              <ImportarExtrato />
            </section>
            <VisaoExtrato visao={tela.dados} importacaoId={importacaoId} />
          </>
        ) : (
          <AvisoAcesso
            situacao={tela.situacao}
            caminho="/financeiro/extrato"
            aalPossivel={usuario.aalPossivel}
            motivoMfa="O extrato do banco é dado financeiro, por isso pede o código do aplicativo (MFA) antes de abrir."
            motivoPapel="O extrato do banco é do financeiro e da diretoria."
            tituloPapel="O extrato não está com o seu papel"
          />
        )}
      </div>
    </>
  );
}
