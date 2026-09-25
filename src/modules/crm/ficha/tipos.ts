import type {
  CartaoOportunidade,
  EstadoSensivel,
  EventoLinhaDoTempo,
  Mensagem,
  NumeroPipeline,
  PapelPessoa,
  PessoaFicha,
} from "@/lib/dados/tipos";

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

export interface FamiliaListaTela {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dpp: string | null;
  dataNascimento: string | null;
  estadoSensivel: EstadoSensivel;
  naoContatar: boolean;
  idadeGestacional: string | null;
}

export type { PapelPessoa, EventoLinhaDoTempo };
