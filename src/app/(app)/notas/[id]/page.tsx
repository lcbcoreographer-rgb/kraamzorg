import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { PainelNota } from "@/modules/financeiro/notas/componentes/painel-nota";
import { obterTelaNota, type TelaNota } from "@/modules/financeiro/notas/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Nota · Kraamzorg OS" };

/** Uma nota fiscal: estado, motivo do erro, emissão pelo provedor e emissão manual assistida (P43). */
export default async function PaginaNota({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const usuario = await exigirSessao("/notas");

  let tela: TelaNota | null = null;
  try {
    tela = await obterTelaNota(usuario, id);
  } catch {
    tela = null;
  }
  if (tela?.situacao === "nao_encontrada") notFound();

  const voltar = (
    <Link
      href="/notas"
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Notas
    </Link>
  );

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Nota
          </h1>
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="A nota não abriu agora">
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
                A nota mostra valores e documentos fiscais, por isso pede o
                código do aplicativo (MFA) antes de abrir.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <Link
                  href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(`/notas/${id}`)}`}
                >
                  Confirmar com o código
                </Link>
              </Botao>
            </div>
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="As notas não estão com o seu papel"
            >
              As notas fiscais são do financeiro e da diretoria.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  const { nota, demonstracao } = tela;
  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="rounded-3 bg-superficie-2 flex flex-col gap-2 p-5 lg:px-8 lg:py-6">
          <h1 className="font-titulo text-1 text-texto font-normal">
            Nota da {nota.familiaNome}
          </h1>
        </header>
        <PainelNota nota={nota} demonstracao={demonstracao} />
      </div>
    </>
  );
}
