import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { PainelCobranca } from "@/modules/financeiro/cobrancas/componentes/painel-cobranca";
import {
  obterTelaDetalheCobranca,
  type TelaDetalheCobranca,
} from "@/modules/financeiro/cobrancas/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Cobrança · Kraamzorg OS" };

/** Uma cobrança: situação, link de pagamento, pagamento confirmado e baixa manual (P32). */
export default async function PaginaCobranca({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const usuario = await exigirSessao("/cobrancas");

  let tela: TelaDetalheCobranca | null = null;
  try {
    tela = await obterTelaDetalheCobranca(usuario, id);
  } catch {
    tela = null;
  }
  if (tela?.situacao === "nao_encontrada") notFound();

  const voltar = (
    <Link
      href="/cobrancas"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Cobranças
    </Link>
  );

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Cobrança
          </h1>
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="A cobrança não abriu agora">
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
                A cobrança mostra valores e pagamentos, por isso pede o código
                do aplicativo (MFA) antes de abrir.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <Link
                  href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(`/cobrancas/${id}`)}`}
                >
                  Confirmar com o código
                </Link>
              </Botao>
            </div>
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="As cobranças não estão com o seu papel"
            >
              As cobranças são do financeiro e da diretoria.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  const { cobranca, demonstracao } = tela;
  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="bg-superficie-2 -mx-4 flex flex-col gap-2 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8">
          <h1 className="font-titulo text-1 text-texto font-normal">
            Cobrança da {cobranca.familiaNome}
          </h1>
        </header>
        <PainelCobranca cobranca={cobranca} demonstracao={demonstracao} />
      </div>
    </>
  );
}
