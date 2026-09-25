import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { obterRepositorioModulo } from "../dados";
import { AlternarTermoAtivo } from "./alternar-termo-ativo";
import { FormularioTermo } from "./formulario-termo";

const ROTULO_ACAO: Record<string, string> = {
  handoff_saude: "Transfere para a equipe de saúde",
  bloqueio_total: "Bloqueio total",
};

/**
 * Termos de alerta (P13, "Fazer" item 6): ativar, desativar, ação e
 * mensagem. Único domínio que a coordenação também gerencia (PRD 13).
 */
export async function SecaoTermosAlerta() {
  const repositorio = await obterRepositorioModulo();
  const termos = await repositorio.listarTermosAlerta();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-apoio text-texto-2 max-w-leitura">
        Quando a família escrever um destes termos para a Isadora, o sistema
        aplica a ação na hora, antes de qualquer outra decisão do agente (PRD
        11.2).
      </p>
      <div className="flex items-center justify-end">
        <FormularioTermo />
      </div>
      {termos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum termo de alerta cadastrado"
          texto="A lista de termos que disparam alerta ou bloqueio aparece aqui. Cadastre o primeiro termo para começar."
        />
      ) : (
        <TabelaLista
          rotulo="Termos de alerta"
          colunas={[
            { chave: "termo", rotulo: "Termo", principal: true },
            { chave: "situacao", rotulo: "Situação", canto: true },
            { chave: "acao", rotulo: "Ação" },
            { chave: "mensagem", rotulo: "Mensagem enviada" },
            { chave: "botao", rotulo: "Editar" },
          ]}
          linhas={termos.map((termo) => ({
            id: termo.id,
            valores: {
              termo: (
                <span className="text-texto font-semibold">{termo.termo}</span>
              ),
              situacao: termo.ativo ? (
                <Selo variante="sucesso">Ativo</Selo>
              ) : (
                <Selo variante="neutro">Desativado</Selo>
              ),
              acao: ROTULO_ACAO[termo.acao] ?? termo.acao,
              mensagem: (
                <span className="font-mono">{termo.mensagemChave}</span>
              ),
              botao: (
                <div className="flex items-center gap-2">
                  <AlternarTermoAtivo id={termo.id} ativo={termo.ativo} />
                  <FormularioTermo termo={termo} />
                </div>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
