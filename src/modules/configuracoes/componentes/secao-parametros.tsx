import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarDataHora } from "@/lib/formatacao";
import { obterRepositorioModulo } from "../dados";
import { classificarTipoParametro } from "../dados/parametro-tipo";
import { FormularioParametro } from "./formulario-parametro";

const ROTULO_TIPO: Record<string, string> = {
  inteiro: "Número",
  decimal: "Número",
  booleano: "Ligado/desligado",
  texto: "Texto",
  lista_texto: "Lista",
  objeto: "Objeto",
  nulo: "Sem valor",
};

function resumoValor(valor: unknown): string {
  const texto = JSON.stringify(valor);
  if (!texto) return "";
  return texto.length > 60 ? `${texto.slice(0, 57)}...` : texto;
}

/**
 * Parâmetros (P13, "Fazer" item 1): validação por tipo e histórico vindo
 * do log de auditoria. Só a diretoria (PRD 13).
 */
export async function SecaoParametros() {
  const { configuracoes } = await obterRepositorios();
  const repositorioModulo = await obterRepositorioModulo();
  const parametros = await configuracoes.listarParametros();

  if (parametros.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum parâmetro visível"
        texto="Parâmetros aparecem aqui só para a diretoria. Se você é da diretoria e a lista está vazia, confira a sessão e o MFA."
      />
    );
  }

  const comHistorico = await Promise.all(
    parametros.map(async (parametro) => ({
      parametro: {
        ...parametro,
        tipo: classificarTipoParametro(parametro.valor),
      },
      historico: await repositorioModulo.historicoParametro(parametro.chave),
    })),
  );

  return (
    <TabelaLista
      rotulo="Parâmetros do sistema"
      colunas={[
        { chave: "chave", rotulo: "Chave", principal: true },
        { chave: "tipo", rotulo: "Tipo", canto: true },
        { chave: "valor", rotulo: "Valor" },
        { chave: "atualizado", rotulo: "Atualizado", numerica: true },
        { chave: "acao", rotulo: "Ação" },
      ]}
      linhas={comHistorico.map(({ parametro, historico }) => ({
        id: parametro.chave,
        valores: {
          chave: (
            <span className="flex flex-col">
              <span className="text-texto font-mono font-semibold">
                {parametro.chave}
              </span>
              {parametro.descricao ? (
                <span className="text-apoio text-texto-2 font-normal">
                  {parametro.descricao}
                </span>
              ) : null}
            </span>
          ),
          tipo: <Selo variante="neutro">{ROTULO_TIPO[parametro.tipo]}</Selo>,
          valor: (
            <span className="text-apoio font-mono">
              {resumoValor(parametro.valor)}
            </span>
          ),
          atualizado: (
            <span className="font-mono">
              {formatarDataHora(parametro.atualizadoEm)}
            </span>
          ),
          acao: (
            <FormularioParametro parametro={parametro} historico={historico} />
          ),
        },
      }))}
    />
  );
}
