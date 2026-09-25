import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarDataHora } from "@/lib/formatacao";
import { obterRepositorioModulo } from "../dados";
import { AcoesMensagem } from "./acoes-mensagem";
import { FormularioMensagem } from "./formulario-mensagem";

const ROTULO_DESTINATARIO: Record<string, string> = {
  familia: "Família",
  equipe: "Equipe",
  medico: "Médico",
  agente: "Agente",
};

const ROTULO_STATUS: Record<
  string,
  { rotulo: string; variante: "sucesso" | "aviso" | "neutro" }
> = {
  aprovado: { rotulo: "Aprovado", variante: "sucesso" },
  rascunho: { rotulo: "Rascunho", variante: "aviso" },
  arquivado: { rotulo: "Arquivado", variante: "neutro" },
};

/**
 * Mensagens (P13, "Fazer" item 5): lista por destinatário, edição com
 * prévia, contagem de caracteres, troca automática de travessão por
 * vírgula, fluxo de rascunho para aprovado com quem aprovou.
 */
export async function SecaoMensagens() {
  const repositorio = await obterRepositorioModulo();
  const mensagens = await repositorio.listarMensagensDetalhe();

  if (mensagens.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma mensagem visível"
        texto="Os textos que o sistema envia para a família, a equipe e o agente aparecem aqui, sempre com o aprovador registrado."
      />
    );
  }

  let nomePorId: Record<string, string> = {};
  try {
    const { usuarios } = await obterRepositorios();
    const lista = await usuarios.listarUsuarios();
    nomePorId = Object.fromEntries(lista.map((u) => [u.id, u.nome]));
  } catch {
    // Sem a lista de usuários, mostra o id mesmo (não é motivo para
    // esconder a mensagem inteira).
  }

  const porDestinatario = new Map<string, typeof mensagens>();
  for (const mensagem of mensagens) {
    const lista = porDestinatario.get(mensagem.destinatario) ?? [];
    lista.push(mensagem);
    porDestinatario.set(mensagem.destinatario, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...porDestinatario.entries()].map(([destinatario, lista]) => (
        <section key={destinatario}>
          <h2 className="text-2 font-titulo text-texto font-medium">
            Para{" "}
            {ROTULO_DESTINATARIO[destinatario]?.toLowerCase() ?? destinatario}
          </h2>
          <div className="mt-3">
            <TabelaLista
              rotulo={`Mensagens para ${ROTULO_DESTINATARIO[destinatario] ?? destinatario}`}
              colunas={[
                { chave: "chave", rotulo: "Chave", principal: true },
                { chave: "status", rotulo: "Status", canto: true },
                { chave: "texto", rotulo: "Texto" },
                { chave: "aprovacao", rotulo: "Aprovação" },
                { chave: "editar", rotulo: "Editar" },
                { chave: "acao", rotulo: "Ação" },
              ]}
              linhas={lista.map((mensagem) => {
                const status = ROTULO_STATUS[mensagem.status] ?? {
                  rotulo: mensagem.status,
                  variante: "neutro" as const,
                };
                return {
                  id: mensagem.chave,
                  valores: {
                    chave: (
                      <span className="text-texto font-mono font-semibold">
                        {mensagem.chave}
                      </span>
                    ),
                    status: (
                      <Selo variante={status.variante}>{status.rotulo}</Selo>
                    ),
                    texto: (
                      <span className="text-apoio text-texto-2">
                        {mensagem.texto.length > 80
                          ? `${mensagem.texto.slice(0, 77)}...`
                          : mensagem.texto}
                      </span>
                    ),
                    aprovacao:
                      mensagem.status === "aprovado" && mensagem.aprovadoPor ? (
                        <span className="text-apoio text-texto-2">
                          {nomePorId[mensagem.aprovadoPor] ??
                            mensagem.aprovadoPor}
                          {mensagem.aprovadoEm
                            ? `, ${formatarDataHora(mensagem.aprovadoEm)}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-apoio text-texto-2">
                          Ainda não aprovado
                        </span>
                      ),
                    editar: <FormularioMensagem mensagem={mensagem} />,
                    acao: (
                      <AcoesMensagem
                        chave={mensagem.chave}
                        status={mensagem.status}
                      />
                    ),
                  },
                };
              })}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
