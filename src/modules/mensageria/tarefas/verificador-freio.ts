import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";
import type {
  CanalMensageria,
  CategoriaAutomacao,
  VerificacaoFreio,
  VerificadorFreio,
} from "@/lib/messaging";

/**
 * Implementação de verdade do `VerificadorFreio` (a interface fica em
 * `src/lib/messaging`, que não conhece `src/lib/dados` de propósito). É a
 * porta de saída de toda mensagem para a família (PRD 8.2): nada sai do
 * canal manual nem do uazapi sem passar por aqui.
 *
 * Supabase: chama `api.pode_enviar_mensagem(familia_id, categoria, canal)`
 * por RPC, o invólucro de `privado.pode_enviar_mensagem` (0009_freio.sql).
 * O invólucro em `api` ainda não existe (0012 a 0014 são de outra trilha),
 * então `rpcPendente` devolve `funcao_pendente` até a migration chegar; aqui
 * isso vira `pode: false`, nunca `true`: um freio que a gente não consegue
 * checar de verdade é tratado como fechado.
 *
 * O banco devolve um código em `motivo` ("freio_bloqueio_total",
 * "fora_da_janela"...). A tela nunca mostra o código: `motivoLegivel`
 * troca por uma frase (PRD 20.3) e o código segue em `codigo` só para a
 * tela escolher o tom.
 *
 * Demonstração: sem a função do banco para chamar, aproxima a mesma matriz
 * (PRD 8.2, `privado.freio_permite`) a partir de `FichaRepositorio.obterFicha`
 * (estado sensível e `nao_contatar`). Não cobre a conversa iniciada pela
 * família, a janela de horário nem o limite de uma mensagem de conteúdo por
 * dia, que exigem dados que a loja de demonstração não guarda.
 */
export function criarVerificadorFreio(): VerificadorFreio {
  return async ({ familiaId, categoria, canal }) => {
    if (categoria === "interna") {
      // PRD 8.2 e 0009: "interna" só avisa a equipe e nunca fala com a
      // família. Aviso a grupo interno não passa por aqui (uazapi pula o
      // verificador para destinatario "equipe").
      return recusa("categoria_interna");
    }
    if (!familiaId) {
      return recusa("familia_obrigatoria");
    }
    return modoDados() === "demonstracao"
      ? verificarPorAproximacao(familiaId, categoria)
      : verificarPorRpc(familiaId, categoria, canal ?? "manual");
  };
}

/** Frases para os códigos de `privado.pode_enviar_mensagem` (0009_freio.sql). */
const FRASES: Record<string, string> = {
  familia_obrigatoria:
    "Essa tarefa não está ligada a uma família. Nada foi enviado.",
  familia_inexistente: "Não encontrei essa família. Atualize a tela.",
  familia_mesclada:
    "Essa família foi unida a outro cadastro. Abra a ficha que ficou e continue por lá.",
  categoria_interna: "Esse aviso é só para a equipe e não vai para a família.",
  freio_atencao:
    "Essa família está em atenção. Por enquanto, só mensagem operacional.",
  freio_bloqueio_total:
    "O freio está em bloqueio total para essa família. Só contato humano e nominal.",
  freio_encerrado_sensivel:
    "Essa família está em encerramento sensível. Nenhuma mensagem de régua sai para ela.",
  nao_contatar: "Essa família pediu para não ser contatada. Nada sai por aqui.",
  conversa_nao_iniciada_pela_familia:
    "A família ainda não escreveu para a Kraamzorg. A régua só fala com quem já mandou mensagem.",
  conteudo_ja_enviado_hoje:
    "Essa família já recebeu uma mensagem de conteúdo hoje. Deixe esta para amanhã.",
  janela_nao_configurada:
    "A janela de horário de envio não está configurada. Avise a diretoria; nada foi enviado.",
  fora_da_janela:
    "Agora está fora da janela de horário de envio. Tente de novo dentro dela.",
  funcao_pendente:
    "A verificação do freio ainda não está pronta no banco. Nada foi enviado.",
  indisponivel:
    "Não deu para confirmar se pode enviar agora. Tente de novo em instantes.",
};

export function motivoLegivel(codigo: string): string {
  return (
    FRASES[codigo] ??
    "O banco recusou o envio para essa família. Nada foi enviado."
  );
}

/** Códigos que pedem o tom ameixa do estado sensível (PRD 8.3), não o de aviso. */
export function codigoSensivel(codigo: string | undefined): boolean {
  return Boolean(
    codigo && (codigo.startsWith("freio_") || codigo === "nao_contatar"),
  );
}

function recusa(codigo: string): VerificacaoFreio {
  return { pode: false, motivo: motivoLegivel(codigo), codigo };
}

async function verificarPorRpc(
  familiaId: string,
  categoria: CategoriaAutomacao,
  canal: CanalMensageria,
): Promise<VerificacaoFreio> {
  try {
    const cliente = await criarClienteServidor();
    const resposta = await rpcPendente(cliente, "pode_enviar_mensagem", {
      familia_id: familiaId,
      categoria,
      canal,
    });
    const registro =
      resposta && typeof resposta === "object" && !Array.isArray(resposta)
        ? (resposta as Record<string, unknown>)
        : {};
    if (registro.pode === true) return { pode: true, motivo: "" };
    const codigo =
      typeof registro.motivo === "string" ? registro.motivo : "desconhecido";
    return recusa(codigo);
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "funcao_pendente") {
      return recusa("funcao_pendente");
    }
    return recusa("indisponivel");
  }
}

async function verificarPorAproximacao(
  familiaId: string,
  categoria: CategoriaAutomacao,
): Promise<VerificacaoFreio> {
  const { ficha } = await obterRepositorios();
  const registro = await ficha.obterFicha(familiaId);
  if (!registro) return recusa("familia_inexistente");
  const { estadoSensivel, naoContatar } = registro.familia;

  // Mesma ordem do banco: freio antes de nao_contatar.
  if (
    estadoSensivel === "bloqueio_total" ||
    estadoSensivel === "encerrado_sensivel"
  ) {
    return recusa(`freio_${estadoSensivel}`);
  }
  // conteudo e marketing (PRD 8.2): só em normal.
  if (estadoSensivel === "atencao" && categoria !== "operacional") {
    return recusa("freio_atencao");
  }
  if (naoContatar) return recusa("nao_contatar");
  return { pode: true, motivo: "" };
}
