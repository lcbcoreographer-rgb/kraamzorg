import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { MensagemModelo } from "@/lib/dados/tipos";

export interface RegraRetomadaTela {
  textoPosPdf: MensagemModelo | null;
  textoPosAbertura: MensagemModelo | null;
}

/**
 * Textos da retomada de quem parou de responder (P27 item 1, PRD 11.3;
 * protótipo `comercial-agente-regras.html`, C6). Os textos
 * (`followup_d1_pos_pdf`, `followup_d1_pos_abertura`) vêm de
 * `mensagem_modelo` (CLAUDE.md: nenhum texto para a família fica no
 * código), lidos aqui só para mostrar o rascunho na tela. [v4.5] A janela em
 * horas é parâmetro do agente (`agente_followup_horas`), mantido pela equipe
 * de implantação: a tela não a lê nem a altera.
 */
export async function obterRegraRetomadaTela(): Promise<RegraRetomadaTela> {
  const { configuracoes } = await obterRepositorios();
  const [posPdf, posAbertura] = await Promise.all([
    configuracoes.obterMensagemModelo("followup_d1_pos_pdf"),
    configuracoes.obterMensagemModelo("followup_d1_pos_abertura"),
  ]);
  return { textoPosPdf: posPdf, textoPosAbertura: posAbertura };
}
