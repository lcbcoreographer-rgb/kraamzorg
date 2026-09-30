import type { Severidade } from "@/lib/regras-alerta";
import type { AcionamentoAlerta } from "@/lib/checklist/registro";

/**
 * Um alerta como a tela o mostra (checklist e lista de alertas): o achado
 * com o valor, a conduta aprovada e o que já foi registrado do DOC 3.
 */
export interface AlertaNaTela {
  /** `regraId|bebeId`, a chave que junta o alerta do aparelho e o do servidor. */
  chave: string;
  regraId: string;
  bebeId: string | null;
  /** "Bebê 1" ou o nome, quando a regra é do recém-nascido. */
  bebeRotulo: string | null;
  grupo: string;
  severidade: Severidade;
  /** Descrição da regra, de `regra_alerta`. */
  descricao: string;
  /** Conduta aprovada, de `regra_alerta`, sem paráfrase. */
  conduta: string;
  campo: string | null;
  /** Valor registrado, já formatado ("38,2 °C"). */
  valorLegivel: string | null;
  /** Os quatro campos do DOC 3 já preenchidos neste aparelho. */
  acionamento?: AcionamentoAlerta;
  /** Alerta gravado no servidor, quando já sincronizou. */
  servidor?: { id: string; versao: number; fechado: boolean };
  /** Saúde mental imediata: ocorrência privada, sem expor o achado na faixa presa. */
  privado: boolean;
  /** Família em luto ou intercorrência: a faixa não usa o vermelho. */
  sensivel: boolean;
}
