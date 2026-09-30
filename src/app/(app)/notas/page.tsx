import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaNotasTela } from "@/modules/financeiro/notas/componentes/lista-notas";
import {
  obterTelaListaNotas,
  type TelaListaNotas,
} from "@/modules/financeiro/notas/dados";
import { estadoDaBusca } from "@/modules/financeiro/notas/rotulos";

export const metadata: Metadata = { title: "Notas · Kraamzorg OS" };

/**
 * Notas fiscais de serviço (P43, PRD 14): as que esperam emissão, as que
 * voltaram com erro (com o motivo), as em processamento e as emitidas, com o
 * número e os arquivos. Financeiro e diretoria, em AAL2 (PRD 13).
 */
export default async function PaginaNotas({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao: busca } = await searchParams;
  const estado = estadoDaBusca(busca);
  const usuario = await exigirSessao("/notas");

  let tela: TelaListaNotas | null = null;
  try {
    tela = await obterTelaListaNotas(usuario, estado);
  } catch {
    tela = null;
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
        Notas
      </h1>
      {!tela ? (
        <FaixaAlerta variante="erro" titulo="As notas não abriram agora">
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
            As notas mostram valores, pagadores e documentos fiscais, por isso
            pedem o código do aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/notas")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : tela.situacao === "sem_permissao" ? (
        <FaixaAlerta
          variante="info"
          titulo="As notas não estão com o seu papel"
        >
          As notas fiscais são do financeiro e da diretoria. O comercial vê o
          status da nota no contrato da família.
        </FaixaAlerta>
      ) : (
        <ListaNotasTela lista={tela.lista} estado={estado} />
      )}
    </div>
  );
}
