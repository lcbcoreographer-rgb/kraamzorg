import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import { ListaFamilias } from "@/modules/operacao/portal/componentes/lista-familias";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

/**
 * Famílias da enfermeira (P38): só as atribuídas a ela, lidas por
 * `api.portal_familias`, que não devolve dado comercial nem de família de
 * outra profissional. Cada cartão abre a ficha da família.
 */
export default async function PaginaMinhasFamilias() {
  await exigirSessao("/minhas-familias");
  const { portal } = await obterRepositorios();
  const familias = await portal.listarFamilias();
  return (
    <>
      <CabecalhoTela
        titulo="Famílias"
        subtitulo={
          familias.length === 1
            ? "Uma família com você agora."
            : `${familias.length} famílias com você agora.`
        }
        lateral={<IndicadorPortal />}
      />
      <div className="pt-6">
        <ListaFamilias familias={familias} hoje={hojeEmBrasilia()} />
      </div>
    </>
  );
}
