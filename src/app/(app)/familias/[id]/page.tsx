import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  AbasFicha,
  type AbaFicha,
} from "@/modules/crm/ficha/componentes/abas-ficha";
import { CabecalhoFicha } from "@/modules/crm/ficha/componentes/cabecalho-ficha";
import { LinhaDoTempo } from "@/modules/crm/ficha/componentes/linha-do-tempo";
import { PainelComercial } from "@/modules/crm/ficha/componentes/painel-comercial";
import { PainelConversas } from "@/modules/crm/ficha/componentes/painel-conversas";
import { PainelPessoas } from "@/modules/crm/ficha/componentes/painel-pessoas";
import {
  obterConversaDaFamilia,
  obterDadosContratoTela,
  obterFichaTela,
  obterFreioDesfazerSegundos,
  listarLinhaDoTempoTela,
} from "@/modules/crm/ficha/dados";
import { formatarData } from "@/lib/formatacao";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Ficha da família · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

/**
 * Ficha 360 (P16, PROMPTS.md): resumo com as quatro datas, linha do tempo,
 * pessoas, comercial, conversas em leitura e o botão de freio em um toque
 * no cabeçalho. Rota registrada em `src/lib/navegacao` pela casca (P10);
 * esta página só troca o conteúdo, dentro de `src/app/(app)/familias`.
 */
export default async function PaginaFicha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Pesquisa>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const sessao = await exigirSessao("/familias");
  const pesquisa = await searchParams;
  const abaPedida = Array.isArray(pesquisa.aba)
    ? pesquisa.aba[0]
    : pesquisa.aba;

  const ficha = await obterFichaTela(id);
  if (!ficha) notFound();

  const vePainelComercial =
    sessao.papeis.includes("comercial") ||
    sessao.papeis.includes("coordenacao") ||
    sessao.papeis.includes("diretoria");
  const veConversas =
    sessao.papeis.includes("comercial") ||
    sessao.papeis.includes("coordenacao") ||
    sessao.papeis.includes("diretoria");
  const podeEditarComercial =
    sessao.papeis.includes("comercial") || sessao.papeis.includes("diretoria");
  const podeReverterFreio =
    sessao.papeis.includes("coordenacao") ||
    sessao.papeis.includes("diretoria");

  const [eventos, conversa, freioDesfazerSegundos, dadosContrato] =
    await Promise.all([
      listarLinhaDoTempoTela(id),
      veConversas ? obterConversaDaFamilia(id) : Promise.resolve(null),
      obterFreioDesfazerSegundos(),
      (() => {
        const contato =
          ficha.pessoas.find((p) => p.contatoPrincipal) ?? ficha.pessoas[0];
        return vePainelComercial && contato
          ? obterDadosContratoTela(contato.id, false)
          : Promise.resolve(null);
      })(),
    ]);

  const abas: AbaFicha[] = [{ chave: "tempo", rotulo: "Linha do tempo" }];
  if (vePainelComercial) abas.push({ chave: "comercial", rotulo: "Comercial" });
  if (veConversas) abas.push({ chave: "conversas", rotulo: "Conversas" });
  const aba = abas.some((a) => a.chave === abaPedida) ? abaPedida! : "tempo";

  const datasCabecalho = ficha.datas.map((d) => ({
    rotulo: d.rotulo,
    valor: d.valor ? (formatarData(d.valor) ?? "ainda não") : "ainda não",
    tipo: d.valor ? d.tipo : ("ausente" as const),
  }));

  return (
    <>
      <CabecalhoTela titulo="Ficha da família" />

      <div className="flex flex-col gap-4 pt-2">
        <CabecalhoFicha
          familiaId={ficha.familiaId}
          nome={ficha.nome}
          meta={
            <>
              {ficha.estagioRotulo ? (
                <Selo variante="marinho">{ficha.estagioRotulo}</Selo>
              ) : null}
              {ficha.idadeGestacional ? (
                <span
                  className="text-corpo font-mono"
                  title={
                    ficha.datas[0]?.valor
                      ? `Calculada da DPP ${formatarData(ficha.datas[0].valor)}`
                      : undefined
                  }
                >
                  {ficha.idadeGestacional}
                </span>
              ) : null}
              {ficha.bairro || ficha.cidade ? (
                <span>
                  {[ficha.bairro, ficha.cidade].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </>
          }
          datas={datasCabecalho}
          estadoSensivelInicial={ficha.estadoSensivel}
          estadoSensivelEmInicial={ficha.estadoSensivelEm}
          podeReverter={podeReverterFreio}
          freioDesfazerSegundos={freioDesfazerSegundos}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <AbasFicha familiaId={ficha.familiaId} abas={abas} ativa={aba} />
            <div className="pt-5">
              {aba === "tempo" ? <LinhaDoTempo eventos={eventos} /> : null}
              {aba === "comercial" && vePainelComercial ? (
                <PainelComercial
                  familiaId={ficha.familiaId}
                  oportunidade={ficha.oportunidade}
                  pessoas={ficha.pessoas}
                  dadosContrato={dadosContrato}
                  naoContatar={ficha.naoContatar}
                  dataNascimento={ficha.datas[1]?.valor ?? null}
                  dataAlta={ficha.datas[2]?.valor ?? null}
                  podeEditar={podeEditarComercial}
                />
              ) : null}
              {aba === "conversas" && veConversas ? (
                <PainelConversas conversa={conversa} />
              ) : null}
            </div>
          </div>

          <aside className="flex flex-col gap-4" aria-label="Pessoas">
            <PainelPessoas pessoas={ficha.pessoas} />
          </aside>
        </div>
      </div>
    </>
  );
}
