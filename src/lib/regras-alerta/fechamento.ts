import type {
  CampoFechamentoObrigatorio,
  DadosFechamentoAlerta,
  ResultadoValidacaoFechamento,
} from "./tipos";

/**
 * Os quatro campos obrigatórios para fechar um alerta clínico (PRD 9.3,
 * "Registro obrigatório antes de fechar qualquer alerta"): sinal
 * identificado, horário do acionamento, orientação médica recebida e
 * conduta adotada.
 */
const CAMPOS_OBRIGATORIOS: readonly CampoFechamentoObrigatorio[] = [
  "sinalIdentificado",
  "acionadoEm",
  "orientacaoMedica",
  "condutaAdotada",
];

function ehTextoPreenchido(valor: string | null | undefined): boolean {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Valida se um alerta clínico pode ser fechado. Não decide nada sobre
 * armazenamento: quem chama grava `alerta_clinico.fechado_em` só depois de
 * `valido` vir `true`.
 */
export function validarFechamentoAlerta(
  dados: DadosFechamentoAlerta,
): ResultadoValidacaoFechamento {
  const camposFaltando = CAMPOS_OBRIGATORIOS.filter(
    (campo) => !ehTextoPreenchido(dados[campo]),
  );
  return { valido: camposFaltando.length === 0, camposFaltando };
}
