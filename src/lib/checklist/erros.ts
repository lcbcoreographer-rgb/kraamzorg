/**
 * Recusas de negócio do banco no checklist e nos alertas (0023): o banco
 * manda "checklist:<código> <detalhe>" na mensagem. A tela traduz o código
 * em uma frase que diz o que aconteceu e o que fazer (PRD 20.3).
 */

export function codigoChecklist(erro: unknown): string | null {
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  const achado = /checklist:([a-z_]+)/.exec(mensagem);
  return achado?.[1] ?? null;
}

/** Campos obrigatórios que o banco apontou ("2.1.temperatura,3.1.peso#id"). */
export function pendenciasDoErro(erro: unknown): string[] {
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  const achado = /checklist:obrigatorios_pendentes\s+([^\s]+)/.exec(mensagem);
  return achado?.[1] ? achado[1].split(",") : [];
}

const FRASES: Record<string, string> = {
  assinatura_invalida:
    "A assinatura não confere com o registro. Nada foi gravado. Abra o registro de novo e assine outra vez.",
  obrigatorios_pendentes:
    "Ainda faltam campos obrigatórios. Nada foi gravado. Abra a lista do que falta e responda.",
  resumo_obrigatorio:
    "O resumo do dia é obrigatório. Escreva o resumo e assine de novo.",
  nao_e_a_profissional_da_visita:
    "Só quem foi designada para esta visita assina o registro.",
  familia_nao_atribuida: "Esta família não está entre as que você acompanha.",
  visita_nao_iniciada:
    "A visita ainda não foi iniciada. Inicie a visita para registrar.",
  instrumento_indisponivel:
    "A versão do checklist usada neste registro não está aprovada. Avise a coordenação.",
  registro_divergente:
    "Esta visita já tem um registro assinado com outro conteúdo. A correção é por adendo, com o motivo.",
  adendo_sem_motivo: "O adendo precisa de um motivo.",
  adendo_sem_conteudo: "O adendo precisa de um texto.",
  adendo_de_outra_profissional:
    "Só quem assinou o registro, ou a coordenação, faz o adendo.",
  fechamento_incompleto:
    "Antes de fechar, falta registrar o sinal identificado, a hora do acionamento, a orientação médica recebida e a conduta adotada.",
  versao_desatualizada:
    "Este alerta mudou enquanto você olhava. Atualize a tela e confira o que foi registrado.",
  alerta_fechado: "Este alerta já foi fechado.",
  acionamento_no_futuro: "A hora do acionamento não pode estar no futuro.",
  seletor_desligado:
    "A lista de sinais do DOC 3 ainda espera a validação da coordenação clínica. Se houver sinal de alerta agora, ligue para a supervisão médica.",
  regra_inativa: "Esta regra de alerta está desligada.",
  caminho_invalido:
    "O áudio não pôde ser guardado neste lugar. Tente gravar de novo.",
  audio_longo: "O áudio passa do tempo máximo. Grave um trecho mais curto.",
  visita_de_outra_profissional: "Esta visita é de outra profissional.",
};

/** Frase para a tela a partir do erro do banco; a de reserva diz o que fazer. */
export function fraseDoErro(erro: unknown, acao: string): string {
  const codigo = codigoChecklist(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo]!;
  return `Não foi possível ${acao} agora. O que você fez está salvo no aparelho. Tente de novo em instantes.`;
}
