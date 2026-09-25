import { FileText } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import type { CartaoOportunidade, PessoaFicha } from "@/lib/dados/tipos";
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
 * mascarados, "não contatar" e as datas de nascimento e alta.
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
}: {
  familiaId: string;
  oportunidade: CartaoOportunidade | null;
  pessoas: PessoaFicha[];
  dadosContrato: import("../tipos").DadosContratoTela | null;
  naoContatar: boolean;
  dataNascimento: string | null;
  dataAlta: string | null;
  podeEditar: boolean;
}) {
  const contatoPrincipal =
    pessoas.find((p) => p.contatoPrincipal) ?? pessoas[0];

  return (
    <div className="flex flex-col gap-4">
      {oportunidade ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
          <dt className="text-apoio text-texto-2">Estágio</dt>
          <dd className="text-corpo">
            {rotuloEstagio(
              oportunidade.pipeline,
              oportunidade.pipeline === 1
                ? (oportunidade.estagioP1 ?? "novo")
                : (oportunidade.estagioP2 ?? "proposta_enviada"),
            )}
          </dd>
          {oportunidade.classificacao ? (
            <>
              <dt className="text-apoio text-texto-2">Temperatura</dt>
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
            </>
          ) : null}
          {oportunidade.proximoContatoEm ? (
            <>
              <dt className="text-apoio text-texto-2">Próximo contato</dt>
              <dd className="text-corpo">
                {formatarData(oportunidade.proximoContatoEm)}
              </dd>
            </>
          ) : null}
          {oportunidade.pdfEnviadoEm ? (
            <>
              <dt className="text-apoio text-texto-2">Apresentação</dt>
              <dd className="text-corpo flex items-center gap-1.5">
                <FileText aria-hidden="true" className="size-4" />
                Enviada em {formatarData(oportunidade.pdfEnviadoEm)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : (
        <EstadoVazio
          titulo="Sem oportunidade comercial"
          texto="Esta família ainda não tem uma oportunidade aberta no pipeline."
        />
      )}

      {contatoPrincipal ? (
        <DadosContrato
          pessoaId={contatoPrincipal.id}
          mascarado={dadosContrato}
        />
      ) : null}

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
            />
            <ControleDataFato
              familiaId={familiaId}
              campo="data_alta"
              rotulo="Alta"
              valorAtual={dataAlta}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
