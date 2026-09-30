import type * as React from "react";
import { CalendarCheck, FileText } from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { MantaDobrada } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { CartaoOportunidade, PessoaFicha } from "@/lib/dados/tipos";
import type { DadosContratoTela } from "../tipos";
import { rotuloEstagio } from "../../pipeline/estagios";
import { ControleDataFato } from "./controle-data-fato";
import { ControleNaoContatar } from "./controle-nao-contatar";
import { DadosContrato } from "./dados-contrato";

const ROTULO_CLASSIFICACAO = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
} as const;

/**
 * Aba Comercial da ficha (P16 item 1 e 5; protótipo `comercial-ficha.html`,
 * `p-com`): estágio, classificação, próximo passo, dados de contrato
 * mascarados, "não contatar" e as datas de nascimento e alta. Leitura para
 * coordenação e financeiro (PRD 13); os dados de contrato ficam fora para a
 * coordenação, que não tem acesso a eles.
 */
export function PainelComercial({
  familiaId,
  oportunidade,
  pessoas,
  dadosContrato,
  naoContatar,
  dataNascimento,
  dataAlta,
  podeEditar,
  veDadosContrato,
  dadosContratoIndisponiveis,
  hoje,
  acoesVenda,
  semTom = false,
}: {
  familiaId: string;
  oportunidade: CartaoOportunidade | null;
  pessoas: PessoaFicha[];
  dadosContrato: DadosContratoTela | null;
  naoContatar: boolean;
  dataNascimento: string | null;
  dataAlta: string | null;
  /** Comercial e diretoria: não contatar e datas de fato. */
  podeEditar: boolean;
  /** Comercial, financeiro e diretoria (PRD 13, "Dados de contrato"). */
  veDadosContrato: boolean;
  /** A leitura mascarada falhou (MFA pendente, rede): explica, não esconde. */
  dadosContratoIndisponiveis: boolean;
  hoje: string;
  /** Atalhos da venda (P29 e P30): marcar conversa, abrir a proposta. */
  acoesVenda?: React.ReactNode;
  /** Família com o freio puxado: blocos sem tom de apoio (PRD 20.2). */
  semTom?: boolean;
}) {
  const contatoPrincipal =
    pessoas.find((p) => p.contatoPrincipal) ?? pessoas[0];
  // Blocos de dado (DESIGN.md, 2.5; referência: a grade de check-in com
  // rótulo pequeno e valor grande): o estágio é o agora, o próximo contato
  // é tempo, o resto é o que já foi guardado. Com o freio puxado, sem tom.
  const bloco = (tom: string) =>
    cn(
      "rounded-3 flex flex-col gap-1 p-4",
      semTom ? "bg-superficie border-linha border" : tom,
    );

  return (
    <div className="flex flex-col gap-6">
      {oportunidade ? (
        <dl className="tablet:grid-cols-4 grid grid-cols-2 gap-2">
          <div className={bloco("bg-dourado-claro")}>
            <dt className="text-mini text-texto-2 font-medium">Estágio</dt>
            <dd className="text-3 text-texto leading-snug font-semibold">
              {rotuloEstagio(
                oportunidade.pipeline,
                oportunidade.pipeline === 1
                  ? (oportunidade.estagioP1 ?? "novo")
                  : (oportunidade.estagioP2 ?? "proposta_enviada"),
              )}
            </dd>
          </div>
          {oportunidade.classificacao ? (
            <div className={bloco("bg-areia-clara")}>
              <dt className="text-mini text-texto-2 font-medium">
                Temperatura
              </dt>
              <dd>
                <Selo
                  variante={
                    oportunidade.classificacao === "quente"
                      ? "destaque"
                      : "neutro"
                  }
                >
                  {ROTULO_CLASSIFICACAO[oportunidade.classificacao]}
                </Selo>
              </dd>
            </div>
          ) : null}
          {oportunidade.proximoContatoEm ? (
            <div className={bloco("bg-lavanda-clara")}>
              <dt className="text-mini text-texto-2 font-medium">
                Próximo contato
              </dt>
              <dd className="text-3 text-texto font-mono font-medium tabular-nums">
                {formatarData(oportunidade.proximoContatoEm)}
              </dd>
            </div>
          ) : null}
          {oportunidade.pdfEnviadoEm ? (
            <div className={bloco("bg-areia-clara")}>
              <dt className="text-mini text-texto-2 font-medium">
                Apresentação
              </dt>
              <dd className="text-apoio text-texto flex items-center gap-1.5 font-medium">
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                Enviada em {formatarData(oportunidade.pdfEnviadoEm)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {oportunidade && acoesVenda ? (
        <div className="flex flex-wrap items-center gap-2">{acoesVenda}</div>
      ) : null}
      {oportunidade ? null : (
        <EstadoVazio
          semTom={semTom}
          ilustracao={semTom ? undefined : <MantaDobrada tamanho={96} />}
          titulo="Sem oportunidade comercial"
          texto="Esta família ainda não tem uma oportunidade aberta no pipeline."
        />
      )}

      {veDadosContrato && contatoPrincipal ? (
        <DadosContrato
          pessoaId={contatoPrincipal.id}
          mascarado={dadosContrato}
          indisponivel={dadosContratoIndisponiveis}
        />
      ) : null}

      <SecaoBloco
        idTitulo="t-contato-datas"
        titulo="Contato e datas"
        icone={<CalendarCheck />}
        tom="lavanda"
        semTom={semTom}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ControleNaoContatar
            familiaId={familiaId}
            naoContatar={naoContatar}
            podeEditar={podeEditar}
          />
          {podeEditar ? (
            <>
              <ControleDataFato
                familiaId={familiaId}
                campo="data_nascimento"
                rotulo="Nascimento"
                valorAtual={dataNascimento}
                hoje={hoje}
              />
              <ControleDataFato
                familiaId={familiaId}
                campo="data_alta"
                rotulo="Alta"
                valorAtual={dataAlta}
                hoje={hoje}
              />
            </>
          ) : null}
        </div>
      </SecaoBloco>
    </div>
  );
}
