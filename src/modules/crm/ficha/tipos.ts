import type {
  CartaoOportunidade,
  EstadoSensivel,
  EventoLinhaDoTempo,
  Mensagem,
  NumeroPipeline,
  PapelPessoa,
  PessoaFicha,
} from "@/lib/dados/tipos";
import type { FaseFamilia } from "./lista-familias";

/**
 * Tipos da tela da ficha 360 (P16). `FichaRepositorio` (fundação) já
 * devolve o dado bruto; este arquivo só acrescenta o que a tela calcula por
 * cima (rótulos, textos prontos), do mesmo jeito que `pipeline/tipos.ts`
 * faz para o cartão do pipeline.
 */

export interface DataChaveTela {
  rotulo: string;
  /** "aaaa-mm-dd" (estimativa ou fato) ou null quando ainda não existe. */
  valor: string | null;
  tipo: "estimativa" | "fato";
}

export interface FichaTela {
  familiaId: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  estadoSensivel: EstadoSensivel;
  estadoSensivelEm: string | null;
  naoContatar: boolean;
  gemelar: boolean;
  primeiraGestacao: boolean | null;
  datas: DataChaveTela[];
  idadeGestacional: string | null;
  estagioRotulo: string | null;
  pipeline: NumeroPipeline | null;
  pessoas: PessoaFicha[];
  oportunidade: CartaoOportunidade | null;
}

export interface EventoTela {
  id: number;
  tipo: string;
  titulo: string;
  criadoEm: string;
  restrito: boolean;
}

export interface ConversaResumoTela {
  conversaId: string;
  /** [v4.3] Quem responde à família hoje; null fora de lead e cliente. */
  quemConduz: "isadora" | "leonardo" | "equipe" | null;
  nomeContato: string | null;
  telefoneE164: string | null;
  mensagens: Mensagem[];
}

export interface DadosContratoTela {
  pessoaId: string;
  completo: boolean;
  cpf: string | null;
  dataNascimento: string | null;
  endereco: Record<string, unknown> | null;
  preenchidoVia: string | null;
}

export interface FiltroFamiliasTela {
  busca?: string;
}

/**
 * O ponto da família no tempo, para a coluna da lista: a medida em mono
 * ("37s2d", "16/08") e, quando há, a frase antes dela ("Nasceu em").
 */
export interface TempoFamiliaTela {
  frase: string | null;
  medida: string;
}

/**
 * O que vem a seguir com a família, pelo que a oportunidade já registra:
 * transferência esperando, retorno combinado ou quem está com ela.
 */
export interface ProximoPassoTela {
  tipo: "transferencia" | "retorno" | "voce" | "sem_responsavel" | "equipe";
  frase: string;
  /** Data do retorno, em mono ao lado da frase ("02/10"). */
  data?: string;
}

export interface FamiliaListaTela {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  estadoSensivel: EstadoSensivel;
  naoContatar: boolean;
  idadeGestacional: string | null;
  fase: FaseFamilia;
  tempo: TempoFamiliaTela | null;
  /** Estágio da oportunidade mais recente; null quando o papel não vê o pipeline. */
  estagio: string | null;
  proximoPasso: ProximoPassoTela | null;
}

export type { PapelPessoa, EventoLinhaDoTempo };
