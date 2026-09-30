/**
 * Armazenamento persistente (P11 item 3). O registro da visita fica no
 * IndexedDB do aparelho até subir (`src/lib/sync`). Sem pedido de
 * persistência, o navegador pode apagar esse banco quando o celular está sem
 * espaço, e um registro que ainda não subiu se perderia. Por isso o portal
 * da enfermeira pede o armazenamento persistente depois do login.
 *
 * `navigator.storage.persist()` não abre janela no Chrome (o navegador decide
 * pelo uso do app, e um aplicativo instalado costuma ganhar); no Firefox
 * abre uma pergunta. Em navegador sem suporte, devolve "indisponivel" e o
 * app segue igual: a fila offline já tem cópia no servidor assim que o sinal
 * volta.
 *
 * O resultado fica em `localStorage` só para a tela de perfil dizer como
 * está; o pedido roda de novo a cada sessão, porque o navegador pode
 * revogar. Nada aqui carrega dado de pessoa.
 */
export type SituacaoArmazenamento =
  "persistente" | "temporario" | "indisponivel";

export const CHAVE_ARMAZENAMENTO = "kz:armazenamento-persistente";

interface LojaArmazenamento {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export async function pedirArmazenamentoPersistente(
  loja: LojaArmazenamento | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator.storage as LojaArmazenamento | undefined),
): Promise<SituacaoArmazenamento> {
  if (!loja?.persist) return guardar("indisponivel");
  try {
    if (loja.persisted && (await loja.persisted()))
      return guardar("persistente");
    return guardar((await loja.persist()) ? "persistente" : "temporario");
  } catch {
    return guardar("indisponivel");
  }
}

function guardar(situacao: SituacaoArmazenamento): SituacaoArmazenamento {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, situacao);
  } catch {
    // navegador sem localStorage: a tela só não mostra o estado
  }
  return situacao;
}

export function situacaoGuardada(): SituacaoArmazenamento | null {
  try {
    const valor = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return valor === "persistente" ||
      valor === "temporario" ||
      valor === "indisponivel"
      ? valor
      : null;
  } catch {
    return null;
  }
}
