import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { AvisoAcesso } from "@/components/shell/aviso-acesso";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { inicioDoMes } from "@/lib/gestao/financeiro";
import { buscaParaMes } from "@/lib/gestao/formato";
import { SeletorMes } from "@/modules/financeiro/gestao/componentes/navegacao-financeiro";
import { PainelTela } from "@/modules/painel/componentes/painel-tela";
import { obterTelaPainel } from "@/modules/painel/dados";
import { fraseDoPainel } from "@/modules/painel/textos";

export const metadata: Metadata = { title: "Painel executivo · Kraamzorg OS" };

/**
 * Painel da diretoria (P52, PRD 16.2): as cinco perguntas executivas
 * (comercial, marketing, operação, experiência e financeiro) com as metas da
 * Kraamzorg. Só a diretoria, em AAL2. Nenhum dado assistencial nem de família.
 */
export default async function PaginaPainel({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: busca } = await searchParams;
  const usuario = await exigirSessao("/painel");
  const hoje = hojeEmBrasilia();
  const mes = buscaParaMes(busca) ?? inicioDoMes(hoje);

  let tela: Awaited<ReturnType<typeof obterTelaPainel>> | null = null;
  try {
    tela = await obterTelaPainel(usuario, mes);
  } catch {
    tela = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Painel executivo"
        subtitulo={
          tela?.situacao === "ok"
            ? fraseDoPainel(tela.dados.atual)
            : "Vendas, marketing, operação, experiência e financeiro do mês, com as metas da Kraamzorg."
        }
      />
      <div className="flex flex-col gap-6 pt-6">
        <SeletorMes mes={mes} hoje={hoje} caminho="/painel" />
        {!tela ? (
          <FaixaAlerta variante="erro" titulo="O painel não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        ) : tela.situacao === "ok" ? (
          <PainelTela dados={tela.dados} />
        ) : (
          <AvisoAcesso
            situacao={tela.situacao}
            caminho="/painel"
            aalPossivel={usuario.aalPossivel}
            motivoMfa="O painel reúne números de vendas e de dinheiro, por isso pede o código do aplicativo (MFA) antes de abrir."
            motivoPapel="O painel executivo é da diretoria."
            tituloPapel="O painel não está com o seu papel"
          />
        )}
      </div>
    </>
  );
}
