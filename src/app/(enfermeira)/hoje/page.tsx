import type { Metadata } from "next";
import { CalendarDays, ClipboardPen, MapPin } from "lucide-react";
import { CabecalhoSaudacao } from "@/components/shell/cabecalho-saudacao";
import { saudacao } from "@/components/shell/saudacao";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { somarDias } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { HojeCliente } from "@/modules/operacao/portal/componentes/hoje-cliente";
import { IndicadorPortal } from "@/modules/operacao/portal/componentes/indicador-portal";
import {
  fraseDoDia,
  resumoDoHoje,
  tituloDeHoje,
  visitasDoDiaSeguinte,
} from "@/modules/operacao/portal/textos";

export const metadata: Metadata = { title: "Hoje · Kraamzorg OS" };

/**
 * Hoje da enfermeira (P38, fluxo B; direção "Colo", DESIGN.md 2.13): o
 * bloco de abertura com o cumprimento, o dia e o trio de números (visitas
 * de hoje, fichas pendentes, visitas de amanhã); depois as visitas do dia
 * com endereço, horário, contato, chegada e saída, só das famílias
 * atribuídas a ela. O conteúdo é guardado no aparelho por 24 horas e abre
 * sem sinal (página de sem sinal).
 */
export default async function PaginaHoje() {
  const sessao = await exigirSessao("/hoje");
  const { portal } = await obterRepositorios();
  const [hoje, familias] = await Promise.all([
    portal.obterHoje(),
    portal.listarFamilias(),
  ]);
  const amanha = visitasDoDiaSeguinte(familias, somarDias(hoje.dia, 1));
  const resumo = resumoDoHoje(hoje, amanha);

  return (
    <>
      <CabecalhoSaudacao
        saudacao={saudacao(hoje.profissionalNome || sessao.nome)}
        titulo={tituloDeHoje(hoje.dia)}
        frase={fraseDoDia(hoje.visitas)}
        lateral={<IndicadorPortal />}
      >
        <div className="tablet:grid-cols-3 grid grid-cols-2 gap-2">
          <CartaoResumo
            destaque
            className="tablet:col-span-1 col-span-2"
            fundo="marinho"
            tom="dourado"
            icone={<MapPin />}
            valor={hoje.visitas.length}
            rotulo={resumo.visitas.rotulo}
            contexto={resumo.visitas.contexto}
            href="#visitas-de-hoje"
          />
          <CartaoResumo
            fundo="medio"
            tom="argila"
            icone={<ClipboardPen />}
            valor={hoje.fichasPendentes.length}
            rotulo={resumo.fichas.rotulo}
            contexto={resumo.fichas.contexto}
          />
          <CartaoResumo
            fundo="medio"
            tom="lavanda"
            icone={<CalendarDays />}
            valor={amanha.length}
            rotulo={resumo.amanha.rotulo}
            contexto={resumo.amanha.contexto}
            href="/perfil"
          />
        </div>
      </CabecalhoSaudacao>
      <HojeCliente inicial={hoje} familias={familias} hoje={hoje.dia} />
      <ListaBlocos className="pt-6">
        <ItemBloco
          href="/minhas-evolucoes"
          icone={<ClipboardPen />}
          tom="salvia"
          titulo="Evoluções para os médicos"
          apoio="As evoluções que você escreve e manda para a revisão."
        />
      </ListaBlocos>
    </>
  );
}
