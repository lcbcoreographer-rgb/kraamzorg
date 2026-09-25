/**
 * Assunto fixo do e-mail de evolução para médicos (PRD 23.5, P41), sem
 * nome de paciente por desenho: nunca recebe parâmetro. O corpo (que pode
 * ter o nome do paciente, endereçado só ao médico responsável) é montado
 * pela sessão que usa este texto, a partir de `mensagem_modelo`, não daqui.
 */
export const ASSUNTO_EMAIL_EVOLUCAO =
  "Evolução de enfermagem · Kraamzorg Brasil";
