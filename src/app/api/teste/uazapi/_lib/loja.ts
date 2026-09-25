/**
 * Loja em memória da captura de homologação (P25 item 5, P27, P28): guarda
 * o que os fluxos 2 e 3 do n8n mandariam de verdade para a UAZAPI, para o
 * roteiro automatizado (P28, `tests/agente/roteiro.spec.ts`) conferir
 * conteúdo sem precisar de número real. Fica em `globalThis`, como
 * `src/lib/dados/demonstracao/loja.ts`, para sobreviver à recarga de
 * módulo do `next dev` e ser a mesma loja entre as rotas da API.
 *
 * Nome de paciente nunca entra aqui: quem grava é o fluxo, que já lê da
 * base sintética de homologação (CLAUDE.md, "dado real nunca sai de
 * produção").
 */

export interface CapturaEnvio {
  id: string;
  tipo: "texto" | "midia";
  corpo: Record<string, unknown>;
  capturadoEm: string;
}

export interface EsperaTranscricao {
  texto: string | null;
  falhar: boolean;
}

interface LojaTesteUazapi {
  envios: CapturaEnvio[];
  /** messageid (ou id equivalente) -> o que `message/download` deve devolver. */
  transcricoes: Record<string, EsperaTranscricao>;
}

const CHAVE_GLOBAL = "__kraamzorgLojaTesteUazapi";

function criar(): LojaTesteUazapi {
  return { envios: [], transcricoes: {} };
}

export function obterLojaTesteUazapi(): LojaTesteUazapi {
  const global = globalThis as unknown as Record<
    string,
    LojaTesteUazapi | undefined
  >;
  global[CHAVE_GLOBAL] ??= criar();
  return global[CHAVE_GLOBAL];
}

export function reiniciarLojaTesteUazapi(): LojaTesteUazapi {
  const global = globalThis as unknown as Record<
    string,
    LojaTesteUazapi | undefined
  >;
  global[CHAVE_GLOBAL] = criar();
  return global[CHAVE_GLOBAL];
}
