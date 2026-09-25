import type { Metadata } from "next";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao, obterAutenticacao } from "@/lib/auth/sessao";
import { FormularioCadastroMfa } from "../../_componentes/formularios";
import { proximoDaBusca, type ParametrosBusca } from "../../_componentes/parametros";
import { ERRO_AUTH } from "../../mensagens";

export const metadata: Metadata = { title: "Cadastrar o código de acesso · Kraamzorg OS" };

/**
 * Cadastro do MFA com QR (P07 item 6; PRD 5.1: TOTP obrigatório para quem
 * vê dado assistencial ou financeiro). O QR e o segredo vêm do Supabase
 * Auth (`mfa.enroll`); nada disso é guardado pelo app.
 */
export default async function PaginaCadastroMfa({ searchParams }: { searchParams: ParametrosBusca }) {
  await exigirSessao();
  const proximo = proximoDaBusca(await searchParams);
  const cadastro = await obterAutenticacao().iniciarCadastroMfa();

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display text-texto font-normal">
          Proteja o seu acesso
        </h1>
        <p className="text-corpo text-texto">
          O seu papel vê dados de saúde ou financeiros, então cada entrada pede também um código
          que muda a cada 30 segundos.
        </p>
      </div>

      {"erro" in cadastro ? (
        <FaixaAlerta variante="imediato" titulo={ERRO_AUTH[cadastro.erro]} />
      ) : (
        <>
          <ol className="text-corpo text-texto flex list-decimal flex-col gap-3 pl-5">
            <li>
              Instale no celular um aplicativo autenticador, como Google Authenticator, Microsoft
              Authenticator ou 1Password.
            </li>
            <li>No aplicativo, escolha adicionar conta e aponte a câmera para o QR code abaixo.</li>
            <li>Digite o código de 6 números que aparecer no aplicativo.</li>
          </ol>
          <figure className="rounded-3 bg-superficie shadow-1 flex flex-col items-center gap-3 p-5">
            {/* O QR é um data URI de SVG gerado pelo Supabase Auth: next/image não se aplica. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cadastro.qrCodeSvg}
              alt="QR code para cadastrar o Kraamzorg OS no aplicativo autenticador"
              width={192}
              height={192}
              className="size-48"
            />
            <figcaption className="text-apoio text-texto-2 text-center">
              Não consegue ler o QR? Digite esta chave no aplicativo:
              <span className="text-dado text-texto mt-1 block font-mono break-all">
                {cadastro.segredo}
              </span>
            </figcaption>
          </figure>
          <FormularioCadastroMfa fatorId={cadastro.fatorId} proximo={proximo} />
        </>
      )}
    </>
  );
}
