import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { formatarMoeda } from "@/lib/formatacao";
import { obterRepositorioModulo } from "../dados";
import { FormularioCidade } from "./formulario-cidade";
import { FormularioRegiao } from "./formulario-regiao";

/** Regiões e localidades (P13, "Fazer" item 3): taxa, confirmação e aliases. */
export async function SecaoRegioes() {
  const repositorio = await obterRepositorioModulo();
  const [regioes, cidades] = await Promise.all([
    repositorio.listarRegioesDetalhe(),
    repositorio.listarCidades(),
  ]);
  const nomeRegiao = (id: string | null) =>
    regioes.find((r) => r.id === id)?.nome ?? "Sem região";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2 font-titulo text-texto font-medium">Regiões</h2>
          <FormularioRegiao />
        </div>
        <div className="mt-3">
          <TabelaLista
            rotulo="Regiões atendidas"
            colunas={[
              { chave: "nome", rotulo: "Nome", principal: true },
              { chave: "situacao", rotulo: "Situação", canto: true },
              { chave: "praca", rotulo: "Praça" },
              { chave: "limite", rotulo: "Limite semanal", numerica: true },
              { chave: "taxa", rotulo: "Taxa de deslocamento", numerica: true },
              { chave: "acao", rotulo: "Ação" },
            ]}
            linhas={regioes.map((regiao) => ({
              id: regiao.id,
              valores: {
                nome: regiao.nome,
                situacao: regiao.ativa ? (
                  <Selo variante="sucesso">Ativa</Selo>
                ) : (
                  <Selo variante="neutro">Inativa</Selo>
                ),
                praca: regiao.praca,
                limite: (
                  <span className="font-mono">
                    {regiao.limiteFamiliasSemana}
                  </span>
                ),
                taxa: (
                  <span className="font-mono">
                    {formatarMoeda(regiao.taxaDeslocamentoCentavos)}
                  </span>
                ),
                acao: <FormularioRegiao regiao={regiao} />,
              },
            }))}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2 font-titulo text-texto font-medium">
            Localidades
          </h2>
          <FormularioCidade regioes={regioes} />
        </div>
        <div className="mt-3">
          <TabelaLista
            rotulo="Cidades e localidades"
            colunas={[
              { chave: "nome", rotulo: "Cidade", principal: true },
              { chave: "situacao", rotulo: "Situação", canto: true },
              { chave: "regiao", rotulo: "Região" },
              { chave: "taxa", rotulo: "Taxa", numerica: true },
              { chave: "acao", rotulo: "Ação" },
            ]}
            linhas={cidades.map((cidade) => ({
              id: cidade.id,
              valores: {
                nome: (
                  <span className="flex flex-col">
                    <span className="text-texto font-semibold">
                      {cidade.nome}, {cidade.uf}
                    </span>
                    {cidade.aliases.length > 0 ? (
                      <span className="text-apoio text-texto-2 font-normal">
                        {cidade.aliases.join(", ")}
                      </span>
                    ) : null}
                  </span>
                ),
                situacao: !cidade.atendida ? (
                  <Selo variante="neutro">Não atendida</Selo>
                ) : cidade.requerConfirmacao ? (
                  <Selo variante="aviso">Confirmar</Selo>
                ) : (
                  <Selo variante="sucesso">Atendida</Selo>
                ),
                regiao: nomeRegiao(cidade.regiaoId),
                taxa: (
                  <span className="font-mono">
                    {formatarMoeda(cidade.taxaDeslocamentoCentavos)}
                  </span>
                ),
                acao: <FormularioCidade cidade={cidade} regioes={regioes} />,
              },
            }))}
          />
        </div>
      </section>
    </div>
  );
}
