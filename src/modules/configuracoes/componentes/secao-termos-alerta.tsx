import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { obterRepositorioModulo } from "../dados";
import { AlternarTermoAtivo } from "./alternar-termo-ativo";
import { FormularioTermo } from "./formulario-termo";
import { inicioDoTexto, TextoDaFamilia } from "./texto-da-familia";

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
  const { configuracoes } = await obterRepositorios();
  const [termos, mensagens] = await Promise.all([
    repositorio.listarTermosAlerta(),
    // Leitura comum de `mensagem_modelo` (a RLS deixa a coordenação ler);
    // sem ela, a tabela continua de pé e a coluna avisa onde conferir.
    configuracoes
      .listarMensagensModelo({ destinatario: "familia" })
      .catch(() => []),
  ]);
  const mensagemPorChave = new Map(mensagens.map((m) => [m.chave, m]));
  const opcoesMensagem = mensagens.map((m) => ({
    valor: m.chave,
    rotulo: inicioDoTexto(m.texto, 56),
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-apoio text-texto-2 max-w-leitura">
        Quando uma família escreve um destes termos, o sistema age na hora,
        antes de a Isadora responder.
      </p>
      <div className="flex items-center justify-end">
        <FormularioTermo opcoesMensagem={opcoesMensagem} />
      </div>
      {termos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum termo de alerta cadastrado"
          texto="Cadastre o primeiro termo. Quando uma família escrever esse termo, o sistema transfere para a equipe de saúde ou aciona o freio, conforme a ação escolhida."
        />
      ) : (
        <TabelaLista
          rotulo="Termos de alerta"
          colunas={[
            { chave: "termo", rotulo: "Termo", principal: true },
            { chave: "situacao", rotulo: "Situação", canto: true },
            { chave: "acao", rotulo: "Ação" },
            { chave: "mensagem", rotulo: "Texto que a família recebe" },
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
                <TextoDaFamilia
                  mensagem={mensagemPorChave.get(termo.mensagemChave)}
                />
              ),
              botao: (
                <div className="flex items-center gap-2">
                  <AlternarTermoAtivo id={termo.id} ativo={termo.ativo} />
                  <FormularioTermo
                    termo={termo}
                    opcoesMensagem={opcoesMensagem}
                  />
                </div>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
