import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { obterRegraRetomada } from "../repositorio";
import type { MensagemModelo } from "@/lib/dados/tipos";

export interface RegraRetomadaTela {
  horas: number;
  atualizadoEm: string | null;
  textoPosPdf: MensagemModelo | null;
  textoPosAbertura: MensagemModelo | null;
}

/**
 * Janela de retomada de quem parou de responder (P27 item 1, PRD 11.3;
 * protótipo `comercial-agente-regras.html`, C6). Os textos
 * (`followup_d1_pos_pdf`, `followup_d1_pos_abertura`) vêm de
 * `mensagem_modelo` (CLAUDE.md: nenhum texto para a família fica no
 * código), lidos aqui só para mostrar o rascunho na tela.
 */
export async function obterRegraRetomadaTela(): Promise<RegraRetomadaTela> {
  const { configuracoes } = await obterRepositorios();
  const [regra, posPdf, posAbertura] = await Promise.all([
    obterRegraRetomada(),
    configuracoes.obterMensagemModelo("followup_d1_pos_pdf"),
    configuracoes.obterMensagemModelo("followup_d1_pos_abertura"),
  ]);
  return {
    horas: regra.horas,
    atualizadoEm: regra.atualizadoEm,
    textoPosPdf: posPdf,
    textoPosAbertura: posAbertura,
  };
}
