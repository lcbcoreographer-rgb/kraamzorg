import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import { obterLoja } from "@/lib/dados/demonstracao/loja";

/**
 * Grava a mensagem que uma pessoa da equipe mandou para a família,
 * `enviado_por = 'humano'` (P27, mesmo padrão de
 * `src/modules/mensageria/tarefas/registrar-envio.ts`, P18): o canal
 * manual (`src/lib/messaging`) só monta o link do WhatsApp, quem grava o
 * registro é quem chama, depois de checar o freio.
 *
 * Não existe ainda uma função `api.*` para isto (0012 a 0014 são de outra
 * trilha) nem grant de INSERT em `mensagem` para `authenticated`
 * (`0007_permissoes.sql`: "só L; o texto passa por
 * privado.mascarar_documentos antes de gravar, então o registro do
 * 'enviei' é função, P18"). Mesma pendência do P18, registrada lá; aqui
 * herda a mesma solução: funciona na demonstração, e no Supabase real
 * falha com um erro claro até a função existir.
 */
export async function registrarEnvioConversa(
  conversaId: string,
  texto: string,
): Promise<void> {
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    if (!l.conversas.some((c) => c.id === conversaId)) {
      throw new ErroRepositorio("nao_encontrado", "demonstração: conversa");
    }
    l.mensagens.push({
      id: crypto.randomUUID(),
      conversaId,
      direcao: "saida",
      enviadoPor: "humano",
      tipo: "texto",
      conteudo: texto,
      enviadaEm: new Date().toISOString(),
    });
    return;
  }

  const cliente = await criarClienteServidor();
  const insercao = await cliente.from("mensagem").insert({
    conversa_id: conversaId,
    direcao: "saida",
    enviado_por: "humano",
    tipo: "texto",
    conteudo: texto,
  });
  if (insercao.error) {
    throw new ErroRepositorio(
      "indisponivel",
      `registrar envio: gravar mensagem (${insercao.error.message})`,
    );
  }
}
