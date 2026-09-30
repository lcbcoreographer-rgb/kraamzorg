import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  obterTelaListaCobrancas,
  situacaoDaBusca,
  type TelaListaCobrancas,
} from "@/modules/financeiro/cobrancas/dados";
import { ListaCobrancasTela } from "@/modules/financeiro/cobrancas/componentes/lista-cobrancas";

export const metadata: Metadata = { title: "Cobranças · Kraamzorg OS" };

/**
 * Cobranças pela InfinitePay (P32): o que espera pagamento, o que venceu e
 * o que já foi pago, com o link de cada uma. Financeiro e diretoria, em
 * AAL2 (PRD 13).
 */
export default async function PaginaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao: busca } = await searchParams;
  const situacao = situacaoDaBusca(busca);
  const usuario = await exigirSessao("/cobrancas");

  let tela: TelaListaCobrancas | null = null;
  try {
    tela = await obterTelaListaCobrancas(usuario, situacao);
  } catch {
    tela = null;
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
        Cobranças
      </h1>
      {!tela ? (
        <FaixaAlerta variante="erro" titulo="As cobranças não abriram agora">
          Confira a conexão e recarregue a página. Nada foi alterado.
        </FaixaAlerta>
      ) : tela.situacao === "mfa" ? (
        <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
          <p className="text-corpo text-texto flex items-start gap-3">
            <LockKeyhole
              className="text-texto-2 mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            As cobranças mostram valores e pagamentos, por isso pedem o código
            do aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/cobrancas")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : tela.situacao === "sem_permissao" ? (
        <FaixaAlerta
          variante="info"
          titulo="As cobranças não estão com o seu papel"
        >
          As cobranças são do financeiro e da diretoria. O comercial vê o status
          de cada uma no contrato da família.
        </FaixaAlerta>
      ) : (
        <ListaCobrancasTela lista={tela.lista} situacao={situacao} />
      )}
    </div>
  );
}
