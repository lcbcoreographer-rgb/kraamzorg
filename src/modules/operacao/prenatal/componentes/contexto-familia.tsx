import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/**
 * Contexto da família ao lado da entrevista (fluxo B, computador; direção
 * "Colo"): um bloco areia, o lugar da família, com o nome e três dados em
 * blocos pequenos: idade gestacional calculada, DPP (estimativa) e cidade.
 * Nada de dado assistencial além do que a própria entrevista mostra.
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
  const dados: {
    rotulo: string;
    valor: string;
    mono: boolean;
    marca?: string;
  }[] = [
    { rotulo: "Idade gestacional", valor: ig ?? "sem DPP", mono: true },
    {
      rotulo: "Data provável do parto",
      marca: "estimativa",
      valor: dpp ? (formatarData(dpp) ?? dpp) : "não informada",
      mono: true,
    },
    {
      rotulo: "Cidade",
      valor: cidade ? `${cidade}${uf ? `, ${uf}` : ""}` : "não informada",
      mono: false,
    },
  ];
  return (
    <section
      aria-label="A família"
      className="rounded-3 bg-areia-clara flex flex-col gap-4 p-5"
    >
      <div className="flex flex-col gap-2">
        <h2 className="font-titulo text-2 text-texto font-medium">{nome}</h2>
        {urgente || gemelar ? (
          <div className="flex flex-wrap gap-2">
            {urgente ? <Selo variante="alerta">Pré-natal urgente</Selo> : null}
            {gemelar ? <Selo variante="neutro">Gemelar</Selo> : null}
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-2">
        {dados.map((d) => (
          <div
            key={d.rotulo}
            className="rounded-2 bg-superficie flex flex-col gap-0.5 px-3 py-2.5"
          >
            <dt className="text-mini text-texto-2">
              {d.rotulo}
              {d.marca ? <em className="ml-1">({d.marca})</em> : null}
            </dt>
            <dd
              className={cn(
                "text-texto font-medium",
                d.mono ? "text-dado font-mono" : "text-corpo",
              )}
            >
              {d.valor}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-apoio text-texto-2">
        A data provável é uma estimativa. Ela ajuda a planejar, mas não move
        nada sozinha.
      </p>
    </section>
  );
}
