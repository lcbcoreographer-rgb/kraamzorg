import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { obterRepositorioModulo } from "../dados";
import { FormularioCondicao } from "./formulario-condicao";

const ROTULO_TIPO: Record<string, string> = {
  desconto_pct: "Desconto",
  parcelamento: "Parcelamento",
  bonificacao: "Bonificação",
};

function resumoValor(condicao: { tipo: string; valor: number }): string {
  if (condicao.tipo === "desconto_pct") return `${condicao.valor}%`;
  if (condicao.tipo === "parcelamento") return `${condicao.valor}x`;
  return String(condicao.valor);
}

/** Condições comerciais (P13, "Fazer" item 4): a tabela única de condições (PRD 6.3). */
export async function SecaoCondicoes() {
  const repositorio = await obterRepositorioModulo();
  const condicoes = await repositorio.listarCondicoesComerciais();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <FormularioCondicao />
      </div>
      {condicoes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma condição comercial cadastrada"
          texto="Descontos, parcelamentos e bonificações aparecem aqui. Crie a primeira condição para o comercial poder usá-la."
        />
      ) : (
        <TabelaLista
          rotulo="Condições comerciais"
          colunas={[
            { chave: "nome", rotulo: "Nome", principal: true },
            { chave: "situacao", rotulo: "Situação", canto: true },
            { chave: "tipo", rotulo: "Tipo" },
            { chave: "valor", rotulo: "Valor", numerica: true },
            { chave: "aprovacao", rotulo: "Aprovação" },
            { chave: "acao", rotulo: "Ação" },
          ]}
          linhas={condicoes.map((condicao) => ({
            id: condicao.id,
            valores: {
              nome: (
                <span className="flex flex-col">
                  <span className="text-texto font-semibold">
                    {condicao.nome}
                  </span>
                  {condicao.observacao ? (
                    <span className="text-apoio text-texto-2 font-normal">
                      {condicao.observacao}
                    </span>
                  ) : null}
                </span>
              ),
              situacao: condicao.ativa ? (
                <Selo variante="sucesso">Ativa</Selo>
              ) : (
                <Selo variante="neutro">Inativa</Selo>
              ),
              tipo: ROTULO_TIPO[condicao.tipo],
              valor: <span className="font-mono">{resumoValor(condicao)}</span>,
              aprovacao: condicao.requerAprovacao
                ? "Exige aprovação"
                : "Automática",
              acao: <FormularioCondicao condicao={condicao} />,
            },
          }))}
        />
      )}
    </div>
  );
}
