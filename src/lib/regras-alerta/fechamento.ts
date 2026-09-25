import type {
  CampoFechamentoObrigatorio,
  DadosFechamentoAlerta,
  ResultadoValidacaoFechamento,
} from "./tipos";

/**
 * Os quatro campos obrigatórios para fechar um alerta clínico (PRD 9.3,
 * "Registro obrigatório antes de fechar qualquer alerta"): sinal
 * identificado, horário do acionamento, orientação médica recebida e
 * conduta adotada. A hora do acionamento só conta quando é data e hora
 * ISO 8601 com fuso, o formato de `alerta_clinico.acionado_em`.
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

// Data e hora com fuso (ISO 8601), como `alerta_clinico.acionado_em` (timestamptz).
const DATA_HORA_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Hora do acionamento precisa ser um instante de verdade, não texto livre. */
function ehDataHoraValida(valor: string | null | undefined): boolean {
  if (!ehTextoPreenchido(valor)) return false;
  const texto = (valor as string).trim();
  return DATA_HORA_ISO.test(texto) && !Number.isNaN(Date.parse(texto));
}

function campoPreenchido(
  campo: CampoFechamentoObrigatorio,
  dados: DadosFechamentoAlerta,
): boolean {
  return campo === "acionadoEm"
    ? ehDataHoraValida(dados.acionadoEm)
    : ehTextoPreenchido(dados[campo]);
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
    (campo) => !campoPreenchido(campo, dados),
  );
  return { valido: camposFaltando.length === 0, camposFaltando };
}
