import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  AbasConfiguracoes,
  type AbaConfiguracoes,
} from "@/modules/configuracoes/componentes/abas";
import { SecaoCondicoes } from "@/modules/configuracoes/componentes/secao-condicoes";
import { SecaoMensagens } from "@/modules/configuracoes/componentes/secao-mensagens";
import { SecaoPacotes } from "@/modules/configuracoes/componentes/secao-pacotes";
import { SecaoParametros } from "@/modules/configuracoes/componentes/secao-parametros";
import { SecaoRegioes } from "@/modules/configuracoes/componentes/secao-regioes";
import { SecaoRegua } from "@/modules/configuracoes/componentes/secao-regua";
import { SecaoTermosAlerta } from "@/modules/configuracoes/componentes/secao-termos-alerta";
import { podeVerTudo } from "@/modules/configuracoes/dados/tipos";

export const metadata: Metadata = { title: "Configurações · Kraamzorg OS" };

const ABAS_DIRETORIA: AbaConfiguracoes[] = [
  { chave: "parametros", rotulo: "Parâmetros" },
  { chave: "pacotes", rotulo: "Pacotes e preços" },
  { chave: "regioes", rotulo: "Regiões e localidades" },
  { chave: "condicoes", rotulo: "Condições comerciais" },
  { chave: "mensagens", rotulo: "Mensagens" },
  { chave: "termos-alerta", rotulo: "Termos de alerta" },
  { chave: "regua", rotulo: "Régua" },
];

const ABAS_COORDENACAO: AbaConfiguracoes[] = [
  { chave: "termos-alerta", rotulo: "Termos de alerta" },
];

/**
 * Configurações (P13): parâmetros com validação por tipo e histórico,
 * pacotes e versões com vigência, regiões e localidades, condições
 * comerciais, mensagens com prévia e fluxo de rascunho para aprovado,
 * termos de alerta para a coordenação e faixas da régua.
 *
 * Diretoria vê tudo; coordenação vê só termos de alerta (PRD 13, "Parâmetros
 * e configurações"). O proxy e `exigirSessao` já garantem que só esses dois
 * papéis chegam nesta rota (`src/lib/navegacao/index.ts`); aqui a tela
 * ainda decide o que cada um vê dentro dela, porque a matriz do PRD 13 é
 * mais estreita que "ter acesso à rota".
 */
export default async function PaginaConfiguracoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await exigirSessao("/configuracoes");
  const vePreco = podeVerTudo(sessao.papeis);
  const abas = vePreco ? ABAS_DIRETORIA : ABAS_COORDENACAO;

  const pedida = (await searchParams).aba;
  const abaPedida = Array.isArray(pedida) ? pedida[0] : pedida;
  const aba = abas.some((a) => a.chave === abaPedida)
    ? abaPedida!
    : abas[0]!.chave;

  return (
    <>
      <CabecalhoTela
        titulo="Configurações"
        subtitulo={
          vePreco
            ? "Parâmetros, preços, regiões, condições comerciais, mensagens, termos de alerta e a régua de contato."
            : "Os termos que disparam alerta ou bloqueio para a equipe de saúde."
        }
      />
      <div className="mt-4">
        <AbasConfiguracoes abas={abas} ativa={aba} />
      </div>
      <div className="pt-6">
        {aba === "parametros" && vePreco ? (
          <SecaoParametros />
        ) : aba === "pacotes" && vePreco ? (
          <SecaoPacotes />
        ) : aba === "regioes" && vePreco ? (
          <SecaoRegioes />
        ) : aba === "condicoes" && vePreco ? (
          <SecaoCondicoes />
        ) : aba === "mensagens" && vePreco ? (
          <SecaoMensagens />
        ) : aba === "termos-alerta" ? (
          <SecaoTermosAlerta />
        ) : aba === "regua" && vePreco ? (
          <SecaoRegua />
        ) : (
          <EstadoVazio
            titulo="Esta seção não está disponível para o seu papel"
            texto="Volte para os termos de alerta ou fale com a diretoria se precisar de mais acesso."
          />
        )}
      </div>
    </>
  );
}
