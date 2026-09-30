import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigeMfa } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  AutorizacaoEnfermeiraPortal,
  FamiliaAcessoPortal,
} from "@/lib/dados/tipos-relacao";
import { AutorizacoesEnfermeiras } from "@/modules/acesso-familia/componentes/autorizacoes";
import { ListaAcessos } from "@/modules/acesso-familia/componentes/lista-acessos";

export const metadata: Metadata = { title: "Portal da família · Kraamzorg OS" };

/**
 * Acesso da família ao portal (P49), do lado da equipe: quem já pode entrar,
 * quem falta liberar, e o que cada enfermeira autorizou a família a ver (nome
 * e foto). Comercial, coordenação e diretoria liberam; a autorização das
 * enfermeiras é da coordenação e da diretoria.
 */
export default async function PaginaAcessoFamilia() {
  const usuario = await exigirSessao("/portal-familia");
  const semMfa = exigeMfa(usuario.papeis) && usuario.aal !== "aal2";
  const gestao = usuario.papeis.some(
    (p) => p === "coordenacao" || p === "diretoria",
  );

  let familias: FamiliaAcessoPortal[] = [];
  let enfermeiras: AutorizacaoEnfermeiraPortal[] = [];
  let falhou = false;
  if (!semMfa) {
    try {
      const { relacao } = await obterRepositorios();
      familias = await relacao.acessoFamilia.listar();
      if (gestao) enfermeiras = await relacao.acessoFamilia.enfermeiras();
    } catch (erro) {
      falhou = !(
        erro instanceof ErroRepositorio && erro.codigo === "sem_permissao"
      );
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          Portal da família
        </h1>
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          Quem da família já entra no portal e quem ainda falta liberar.
        </p>
      </div>

      {semMfa ? (
        <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
          <p className="text-corpo text-texto flex items-start gap-3">
            <LockKeyhole
              className="text-texto-2 mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            Esta tela mostra as famílias com contrato, por isso pede o código do
            aplicativo (MFA) antes de abrir.
          </p>
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent("/portal-familia")}`}
            >
              Confirmar com o código
            </Link>
          </Botao>
        </div>
      ) : falhou ? (
        <FaixaAlerta
          variante="erro"
          titulo="O portal da família não abriu agora"
        >
          Confira a conexão e recarregue a página. Nada foi alterado.
        </FaixaAlerta>
      ) : (
        <>
          <section aria-labelledby="acessos" className="flex flex-col gap-4">
            <h2
              id="acessos"
              className="font-titulo text-1 text-texto font-normal"
            >
              Acessos
            </h2>
            <ListaAcessos familias={familias} />
          </section>
          {gestao ? (
            <section
              aria-labelledby="enfermeiras"
              className="flex flex-col gap-4"
            >
              <h2
                id="enfermeiras"
                className="font-titulo text-1 text-texto font-normal"
              >
                Nome e foto das enfermeiras
              </h2>
              <p className="text-corpo text-texto-2 max-w-[64ch]">
                A família só vê o nome ou a foto da enfermeira que autorizou.
                Sem autorização, o portal diz que uma enfermeira da equipe vai
                acompanhar.
              </p>
              <AutorizacoesEnfermeiras enfermeiras={enfermeiras} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
