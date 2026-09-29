/**
 * P28 · Ações do roteiro entre duas mensagens da família, iguais nos dois
 * executores: pausar a Isadora, envelhecer a conversa, "resolver" a
 * transferência no CRM e "Devolver à Isadora". Só o follow-up muda de um
 * executor para o outro (o local roda o gatilho; o real espera o n8n), então
 * ele fica de fora.
 */
import {
  lerEstado,
  sqlDevolverAIsadora,
  sqlEnvelhecerConversa,
  sqlPausarIA,
  sqlResolverTransferencia,
} from "./sql";
import type { Consulta } from "./sql";
import type { Acao } from "./tipos";

export type AcaoDeBanco = Exclude<Acao, { acao: "executarFollowup" }>;

/** Roda a ação e devolve a frase que aparece na transcrição do relatório. */
export async function executarAcaoDeBanco(
  consulta: Consulta,
  acao: AcaoDeBanco,
  telefoneE164: string,
): Promise<string> {
  const estado = await lerEstado(consulta, telefoneE164);
  const conversaId = estado.conversa?.id;
  if (!conversaId)
    throw new Error(`A ação ${acao.acao} precisa de uma conversa já aberta`);
  switch (acao.acao) {
    case "pausarIA":
      await consulta.linhas(sqlPausarIA(conversaId));
      return "[roteiro pausa a Isadora nesta conversa]";
    case "envelhecerConversa":
      await consulta.linhas(sqlEnvelhecerConversa(conversaId, acao.horas));
      return `[roteiro envelhece a conversa em ${acao.horas} h]`;
    case "resolverNoCRM": {
      const aberta = [...estado.transferencias]
        .reverse()
        .find((h) => h.status === "aberto" || h.status === "assumido");
      if (!aberta)
        throw new Error("resolverNoCRM: não há transferência aberta");
      await consulta.linhas(sqlResolverTransferencia(aberta.id));
      return '[a equipe marca a transferência como "resolvida" no CRM]';
    }
    case "devolverAIsadora":
      await consulta.linhas(sqlDevolverAIsadora(conversaId));
      return '[a equipe toca em "Devolver à Isadora"]';
  }
}
