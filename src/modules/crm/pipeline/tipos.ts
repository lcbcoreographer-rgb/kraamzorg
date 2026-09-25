import type {
  CartaoOportunidade,
  ClassificacaoLead,
  EstagioP1,
  EstagioP2,
  MotivoPerda,
  NumeroPipeline,
  PapelPessoa,
} from "@/lib/dados/tipos";
import type { OrigemLead } from "./estagios";

/** Filtros da tela de pipeline (P15 item 1): estende o filtro do repositório
 * com o que a tela resolve sozinha (semanas, "só as minhas"). */
export interface FiltroPipelineTela {
  pipeline: NumeroPipeline;
  estagio?: EstagioP1 | EstagioP2;
  regiaoId?: string;
  classificacao?: ClassificacaoLead;
  busca?: string;
  /** Só oportunidades do usuário logado. */
  minhas?: boolean;
  semanasMin?: number;
  semanasMax?: number;
}

/** Cartão com o que a tela calcula por cima do repositório (P15 item 3). */
export interface CartaoPipelineTela extends CartaoOportunidade {
  idadeGestacional: string | null;
  tempoNoEstagio: string;
}

export interface ColunaPipeline {
  estagio: EstagioP1 | EstagioP2;
  rotulo: string;
  cartoes: CartaoPipelineTela[];
}

export interface PedidoLeadManual {
  nomeFamilia: string;
  bairro?: string;
  cidadeInformada?: string;
  dpp?: string;
  origem: OrigemLead;
  nomeContato: string;
  papelContato: PapelPessoa;
  telefoneE164: string;
}

export interface PedidoPerda {
  oportunidadeId: string;
  pipeline: NumeroPipeline;
  motivo: MotivoPerda;
  detalhe?: string;
}
