import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Oferta } from "@/lib/dados/tipos-operacao";
import { ListaOfertas } from "@/modules/operacao/designacao/componentes/lista-ofertas";

export const metadata: Metadata = { title: "Ofertas · Kraamzorg OS" };

/**
 * Ofertas de família para a enfermeira (P36 item 1, fluxo D). Aceitar ou
 * recusar dentro do prazo; a recusa da titular aciona o backup e avisa a
 * coordenação. O P38 aponta para esta tela a partir do Hoje.
 */
export default async function PaginaOfertas() {
  await exigirSessao("/ofertas");

  let ofertas: Oferta[] | null = null;
  try {
    const { operacao } = await obterRepositorios();
    ofertas = await operacao.minhasOfertas();
  } catch {
    ofertas = null;
  }

  if (!ofertas) {
    return (
      <>
        <CabecalhoTela titulo="Ofertas" />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="As ofertas não abriram agora">
            Confira a conexão e recarregue a página.
          </FaixaAlerta>
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoTela
        titulo="Ofertas"
        subtitulo="Famílias que a coordenação quer que você acompanhe. Responda dentro do prazo."
      />
      <div className="flex flex-col gap-4 pt-6">
        <ListaOfertas ofertas={ofertas} />
      </div>
    </>
  );
}
