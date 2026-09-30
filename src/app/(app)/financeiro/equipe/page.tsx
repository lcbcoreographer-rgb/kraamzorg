import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { AvisoAcesso } from "@/components/shell/aviso-acesso";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { buscaParaMes } from "@/lib/gestao/formato";
import { inicioDoMes } from "@/lib/gestao/financeiro";
import { obterTelaEquipe } from "@/modules/financeiro/gestao/dados";
import {
  fraseEquipe,
  ListaEquipe,
} from "@/modules/financeiro/gestao/componentes/lista-equipe";
import {
  NavegacaoFinanceiro,
  SeletorMes,
} from "@/modules/financeiro/gestao/componentes/navegacao-financeiro";

export const metadata: Metadata = {
  title: "Pagamento da equipe · Kraamzorg OS",
};

/**
 * Pagamento da equipe (P46 item 3, PRD 3.4): horas por visita vezes o valor
 * da hora, mais a ajuda de deslocamento, liberado só depois do envio das
 * evoluções aos médicos. Financeiro e diretoria, em AAL2.
 */
export default async function PaginaEquipe({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: busca } = await searchParams;
  const usuario = await exigirSessao("/financeiro/equipe");
  const hoje = hojeEmBrasilia();
  const mes = buscaParaMes(busca) ?? inicioDoMes(hoje);

  let tela: Awaited<ReturnType<typeof obterTelaEquipe>> | null = null;
  try {
    tela = await obterTelaEquipe(usuario, mes);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Pagamento da equipe"
        subtitulo={
          tela?.situacao === "ok"
            ? fraseEquipe(tela.dados)
            : "O que cada profissional recebe pelas visitas, liberado depois do envio das evoluções."
        }
      />
      <div className="flex flex-col gap-6 pt-6">
        <NavegacaoFinanceiro atual="/financeiro/equipe" mes={mes} />
        <SeletorMes mes={mes} hoje={hoje} caminho="/financeiro/equipe" />
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="Os pagamentos não abriram agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : tela.situacao === "ok" ? (
          <ListaEquipe dados={tela.dados} hoje={hoje} />
        ) : (
          <AvisoAcesso
            situacao={tela.situacao}
            caminho="/financeiro/equipe"
            aalPossivel={usuario.aalPossivel}
            motivoMfa="O pagamento da equipe é dado financeiro, por isso pede o código do aplicativo (MFA) antes de abrir."
            motivoPapel="O pagamento da equipe é do financeiro e da diretoria. Cada enfermeira vê só o próprio."
            tituloPapel="O pagamento da equipe não está com o seu papel"
          />
        )}
      </div>
    </>
  );
}
