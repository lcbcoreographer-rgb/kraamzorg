import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { HojeCliente } from "@/modules/operacao/portal/componentes/hoje-cliente";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import { fraseDoDia, tituloDeHoje } from "@/modules/operacao/portal/textos";

export const metadata: Metadata = { title: "Hoje · Kraamzorg OS" };

/**
 * Hoje da enfermeira (P38, fluxo B): as visitas do dia com endereço, horário,
 * contato, chegada e saída, só das famílias atribuídas a ela. O conteúdo é
 * guardado no aparelho por 24 horas e abre sem sinal (página de sem sinal).
 */
export default async function PaginaHoje() {
  await exigirSessao("/hoje");
  const { portal } = await obterRepositorios();
  const [hoje, familias] = await Promise.all([
    portal.obterHoje(),
    portal.listarFamilias(),
  ]);
  return (
    <>
      <CabecalhoTela
        titulo={tituloDeHoje(hoje.dia)}
        abertura
        subtitulo={fraseDoDia(hoje.visitas)}
        lateral={<IndicadorPortal />}
      />
      <HojeCliente inicial={hoje} familias={familias} hoje={hoje.dia} />
    </>
  );
}
