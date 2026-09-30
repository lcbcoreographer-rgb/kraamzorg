import type {
  ClassificacaoNps,
  EstagioPosVenda,
  ResumoPosVenda,
} from "@/lib/dados/tipos-ocorrencia";
import type { VarianteSelo } from "./rotulos";

/**
 * Rótulos do pós-venda (pipeline 4, PRD 7.4). A palavra "detrator" existe
 * aqui porque esta é a tela agregada de NPS; nas telas de uma família a nota
 * baixa se chama pelo que aconteceu (voz.md 5).
 */
export const ROTULO_ESTAGIO: Record<EstagioPosVenda, string> = {
  protocolo_ultimo_dia_concluido: "Pesquisa a enviar",
  pesquisa_enviada: "Aguardando resposta",
  pesquisa_respondida: "Respondida",
  classificado: "Classificada",
  acao_executada: "Ação feita",
  arquivado: "Arquivado",
};

export const VARIANTE_ESTAGIO: Record<EstagioPosVenda, VarianteSelo> = {
  protocolo_ultimo_dia_concluido: "aviso",
  pesquisa_enviada: "neutro",
  pesquisa_respondida: "neutro",
  classificado: "aviso",
  acao_executada: "sucesso",
  arquivado: "neutro",
};

export const ROTULO_CLASSIFICACAO: Record<ClassificacaoNps, string> = {
  promotor: "Promotor",
  neutro: "Neutro",
  detrator: "Detrator",
};

/** Próximo passo em frase, com quem faz (voz.md 2, item 4). */
export function fraseProximoPasso(estagio: EstagioPosVenda): string {
  switch (estagio) {
    case "protocolo_ultimo_dia_concluido":
      return "A coordenação gera o link da pesquisa e manda para a família.";
    case "pesquisa_enviada":
      return "A família responde pelo link. Quando responder, a nota é classificada aqui.";
    case "pesquisa_respondida":
      return "A resposta chegou e está sendo classificada.";
    case "classificado":
      return "A coordenação faz a ação da resposta: agradecer, pedir depoimento, pedir indicação ou ligar para a família.";
    case "acao_executada":
      return "Nada mais a fazer. Arquive quando quiser tirar da lista.";
    case "arquivado":
      return "Arquivado.";
  }
}

/** Frase do resumo: número em frase, com o NPS em pontos só quando há resposta (voz.md 5). */
export function fraseResumoPosVenda(resumo: ResumoPosVenda): string {
  const partes: string[] = [];
  if (resumo.aguardandoEnvio > 0) {
    partes.push(
      `${resumo.aguardandoEnvio} ${resumo.aguardandoEnvio === 1 ? "pesquisa espera" : "pesquisas esperam"} o envio.`,
    );
  }
  if (resumo.aguardandoResposta > 0) {
    partes.push(
      `${resumo.aguardandoResposta} ${resumo.aguardandoResposta === 1 ? "espera" : "esperam"} resposta da família.`,
    );
  }
  if (resumo.respondidas > 0) {
    partes.push(
      `${resumo.respondidas} ${resumo.respondidas === 1 ? "respondida" : "respondidas"}: ${resumo.promotores} ${resumo.promotores === 1 ? "promotor" : "promotores"}, ${resumo.neutros} ${resumo.neutros === 1 ? "neutro" : "neutros"} e ${resumo.detratores} ${resumo.detratores === 1 ? "detrator" : "detratores"}.`,
    );
    if (resumo.nps !== null) {
      partes.push(`NPS de ${resumo.nps} pontos.`);
    }
  }
  return partes.length === 0
    ? "Nenhuma pesquisa em andamento agora."
    : partes.join(" ");
}
