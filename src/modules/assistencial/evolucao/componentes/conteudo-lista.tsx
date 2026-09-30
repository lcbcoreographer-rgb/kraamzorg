import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { FiltrosLista } from "@/components/ui/filtros-lista";
import { obterTelaListaEvolucoes, type TelaListaEvolucoes } from "../dados";
import { ListaEvolucoesTela } from "./lista-evolucoes";

/**
 * Corpo da tela de evoluções, igual para a coordenação e para a enfermeira: o
 * filtro (abertas ou todas), a frase do que espera ação e a lista. A base dos
 * links é o que muda entre as duas.
 */
export function situacaoDaBusca(
  valor: string | undefined,
): "abertas" | "todas" {
  return valor === "todas" ? "todas" : "abertas";
}

export async function ConteudoListaEvolucoes({
  filtro,
  base,
  baseFamilia,
}: {
  filtro: "abertas" | "todas";
  base: "/evolucoes" | "/minhas-evolucoes";
  baseFamilia: "/familias" | "/minhas-familias";
}) {
  let tela: TelaListaEvolucoes | null = null;
  try {
    tela = await obterTelaListaEvolucoes(filtro);
  } catch {
    tela = null;
  }

  if (!tela) {
    return (
      <FaixaAlerta variante="erro" titulo="As evoluções não abriram agora">
        Confira a conexão e recarregue a página. Nada foi alterado.
      </FaixaAlerta>
    );
  }
  if (tela.situacao === "sem_permissao") {
    return (
      <FaixaAlerta
        variante="info"
        titulo="As evoluções não estão com o seu papel"
      >
        As evoluções são da enfermeira que atende, da coordenação e da
        diretoria.
      </FaixaAlerta>
    );
  }

  const pendentes = tela.lista.acompanhamentos.filter(
    (a) => a.situacao !== "concluida",
  ).length;
  const escaladas = tela.lista.acompanhamentos.filter(
    (a) => a.situacao === "escalada",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-corpo text-texto max-w-[60ch]">
        {pendentes === 0
          ? "Nenhuma evolução espera ação agora."
          : `${pendentes} ${pendentes === 1 ? "acompanhamento espera" : "acompanhamentos esperam"} a evolução aos médicos.${escaladas > 0 ? ` ${escaladas} passou do prazo e está com a coordenação.` : ""}`}
      </p>
      <FiltrosLista
        rotulo="Filtrar evoluções"
        itens={[
          { rotulo: "Em aberto", href: base, ativo: filtro === "abertas" },
          {
            rotulo: "Todas",
            href: `${base}?situacao=todas`,
            ativo: filtro === "todas",
          },
        ]}
      />
      <ListaEvolucoesTela
        lista={tela.lista}
        base={base}
        baseFamilia={baseFamilia}
        filtro={filtro}
      />
    </div>
  );
}
