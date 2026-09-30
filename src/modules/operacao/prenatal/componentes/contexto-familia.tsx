import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";

/**
 * Contexto da família ao lado da entrevista (fluxo B, computador): DPP
 * (estimativa), idade gestacional calculada e cidade. Nada de dado
 * assistencial além do que a própria entrevista mostra; a DPP aparece como
 * o que é, uma estimativa.
 */
export function ContextoFamilia({
  nome,
  dpp,
  ig,
  cidade,
  uf,
  urgente,
  gemelar,
}: {
  nome: string;
  dpp: string | null;
  ig: string | null;
  cidade: string | null;
  uf: string | null;
  urgente: boolean;
  gemelar: boolean;
}) {
  return (
    <Cartao variante="plano" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-2 text-texto font-medium">{nome}</h2>
        {urgente ? <Selo variante="alerta">Pré-natal urgente</Selo> : null}
        {gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
      </div>
      <dl className="text-corpo grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-texto-2">Idade gestacional</dt>
        <dd className="text-texto font-mono">{ig ?? "sem DPP"}</dd>
        <dt className="text-texto-2">Data provável do parto</dt>
        <dd className="text-texto font-mono">
          {dpp ? (formatarData(dpp) ?? dpp) : "não informada"}
        </dd>
        <dt className="text-texto-2">Cidade</dt>
        <dd className="text-texto">
          {cidade ? `${cidade}${uf ? `, ${uf}` : ""}` : "não informada"}
        </dd>
      </dl>
      <p className="text-apoio text-texto-2">
        A data provável é uma estimativa. Ela ajuda a planejar, mas não move
        nada sozinha.
      </p>
    </Cartao>
  );
}
