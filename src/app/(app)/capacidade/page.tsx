import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { VisaoCapacidade } from "@/modules/operacao/capacidade/componentes/visao-capacidade";
import { obterTelaCapacidade } from "@/modules/operacao/capacidade/dados";
import { fraseResumo } from "@/modules/operacao/capacidade/textos";

export const metadata: Metadata = { title: "Capacidade · Kraamzorg OS" };

/**
 * Capacidade das próximas semanas (P45, PRD 10.2 e 16.2): a ocupação, a chance
 * de sobrevenda e a cobertura de backup de cada região. Coordenação e
 * diretoria, em AAL2.
 */
export default async function PaginaCapacidade() {
  const usuario = await exigirSessao("/capacidade");
  let tela: Awaited<ReturnType<typeof obterTelaCapacidade>> | null = null;
  try {
    tela = await obterTelaCapacidade(usuario);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Capacidade"
        subtitulo={
          tela?.situacao === "ok"
            ? fraseResumo(tela.visao)
            : "Quantas famílias cada região atende nas próximas semanas, e se a equipe cobre o backup."
        }
      />
      <div className="pt-6">
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="A capacidade não abriu agora">
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
              A capacidade mostra a carga da equipe, por isso pede o código do
              aplicativo (MFA) antes de abrir.
            </p>
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              className="self-start"
            >
              <Link
                href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/capacidade")}`}
              >
                Confirmar com o código
              </Link>
            </Botao>
          </div>
        ) : tela.situacao === "sem_permissao" ? (
          <FaixaAlerta
            variante="info"
            titulo="A capacidade não está com o seu papel"
          >
            A capacidade é da coordenação e da diretoria.
          </FaixaAlerta>
        ) : (
          <VisaoCapacidade visao={tela.visao} />
        )}
      </div>
    </>
  );
}
