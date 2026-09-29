import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { rotuloEstagio } from "@/modules/crm/pipeline/estagios";
import { PainelContrato } from "@/modules/crm/contrato/componentes/painel-contrato";
import {
  obterTelaContrato,
  type TelaContrato,
} from "@/modules/crm/contrato/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Contrato · Kraamzorg OS" };

/**
 * Contrato e assinatura eletrônica (P31). Gera o PDF a partir dos dados do
 * formulário seguro, deixa a equipe conferir e envia à Autentique; depois da
 * assinatura, mostra a cobrança. Mesmo cabeçalho da proposta.
 */
export default async function PaginaContrato({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const usuario = await exigirSessao("/familias");

  let tela: TelaContrato | null = null;
  try {
    tela = await obterTelaContrato(id, usuario);
  } catch {
    tela = null;
  }

  const voltar = (
    <Link
      href={`/familias/${id}/proposta`}
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Proposta
    </Link>
  );

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Contrato
          </h1>
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="O contrato não abriu agora">
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
                O contrato mostra valores e dados pessoais, por isso pede o
                código do aplicativo (MFA) antes de abrir.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <Link
                  href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(`/familias/${id}/contrato`)}`}
                >
                  Confirmar com o código
                </Link>
              </Botao>
            </div>
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="O contrato desta família não está com o seu papel"
            >
              O contrato é do comercial e da diretoria. O financeiro vê o
              contrato quando ele existe.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  const { contrato: situacao, demonstracao } = tela;
  const estagio = situacao.oportunidade?.estagioP2
    ? rotuloEstagio(2, situacao.oportunidade.estagioP2)
    : null;

  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="bg-superficie-2 -mx-4 flex flex-col gap-3 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8">
          <h1 className="font-titulo text-1 text-texto font-normal">
            Contrato da {situacao.familia.nome}
          </h1>
          <div className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {estagio && !situacao.sensivel ? (
              <Selo variante="marinho">{estagio}</Selo>
            ) : null}
          </div>
        </header>
        <PainelContrato situacao={situacao} demonstracao={demonstracao} />
      </div>
    </>
  );
}
