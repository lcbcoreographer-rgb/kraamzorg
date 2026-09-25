import type { Json } from "@/lib/db/types";
import type {
  Cidade,
  CondicaoComercial,
  HistoricoParametroItem,
  MensagemModeloDetalhe,
  Pacote,
  PacoteComVersoes,
  PedidoNovaVersao,
  PedidoNovoPacote,
  RegiaoDetalhe,
  ReguaFaixaDetalhe,
  TermoAlerta,
  VersaoPacote,
} from "./tipos";

/**
 * Interface do repositório do módulo Configurações (P13), no mesmo espírito
 * de `@/lib/dados/repositorios.ts`: a tela nunca sabe se do outro lado está
 * o Supabase ou a demonstração. Cobre o que falta na `ConfiguracoesRepositorio`
 * da fundação (que já tem leitura de parâmetro, mensagem, pacote vigente e
 * região): parâmetro com histórico e escrita, pacotes e versões com
 * vigência, regiões e localidades com escrita, condições comerciais,
 * mensagens com o fluxo de rascunho para aprovado, termos de alerta e
 * faixas da régua.
 *
 * Erro vira `ErroRepositorio` (`@/lib/dados/erros`), como no resto do app.
 */
export interface ConfiguracoesModuloRepositorio {
  // --- Parâmetros ----------------------------------------------------------
  /** Grava o novo valor; `atualizado_por` é o usuário da sessão. */
  atualizarParametro(chave: string, valor: Json): Promise<void>;
  /** Cria um parâmetro novo (raro: normalmente ele já existe pelo seed/migration). */
  criarParametro(
    chave: string,
    valor: Json,
    descricao: string | null,
  ): Promise<void>;
  /** Histórico do parâmetro, do log de auditoria (`api.log_auditoria`, PRD 13). */
  historicoParametro(chave: string): Promise<HistoricoParametroItem[]>;

  // --- Pacotes e versões (PRD 6.3, D-06) ------------------------------------
  listarPacotesComVersoes(): Promise<PacoteComVersoes[]>;
  criarPacote(pedido: PedidoNovoPacote): Promise<Pacote>;
  /**
   * Cria uma versão nova de preço. Se já existir uma versão vigente
   * (`vigencia_fim` nulo) para o pacote, ela é fechada em
   * `vigencia_inicio - 1 dia` antes da nova nascer: preço novo sempre cria
   * versão, e a versão antiga nunca é editada (PRD 13, aceite do P13).
   */
  criarVersaoPacote(pedido: PedidoNovaVersao): Promise<VersaoPacote>;
  ativarPacote(pacoteId: string, ativo: boolean): Promise<void>;

  // --- Regiões e localidades -------------------------------------------------
  listarRegioesDetalhe(): Promise<RegiaoDetalhe[]>;
  criarRegiao(dados: Omit<RegiaoDetalhe, "id">): Promise<RegiaoDetalhe>;
  atualizarRegiao(
    id: string,
    dados: Partial<Omit<RegiaoDetalhe, "id">>,
  ): Promise<void>;
  listarCidades(): Promise<Cidade[]>;
  criarCidade(dados: Omit<Cidade, "id">): Promise<Cidade>;
  atualizarCidade(
    id: string,
    dados: Partial<Omit<Cidade, "id">>,
  ): Promise<void>;

  // --- Condições comerciais --------------------------------------------------
  listarCondicoesComerciais(): Promise<CondicaoComercial[]>;
  criarCondicaoComercial(
    dados: Omit<CondicaoComercial, "id">,
  ): Promise<CondicaoComercial>;
  atualizarCondicaoComercial(
    id: string,
    dados: Partial<Omit<CondicaoComercial, "id">>,
  ): Promise<void>;

  // --- Mensagens (PRD 23) -----------------------------------------------------
  listarMensagensDetalhe(): Promise<MensagemModeloDetalhe[]>;
  /** Salva o texto como rascunho (ou cria a mensagem, se a chave for nova). */
  salvarRascunhoMensagem(
    chave: string,
    dados: {
      texto: string;
      canal: MensagemModeloDetalhe["canal"];
      destinatario: string;
      variaveis: string[];
    },
  ): Promise<void>;
  /** Rascunho para aprovado, com o aprovador registrado (PRD 13, aceite do P13). */
  aprovarMensagem(chave: string): Promise<void>;
  arquivarMensagem(chave: string): Promise<void>;

  // --- Termos de alerta (coordenação, PRD 13) ---------------------------------
  listarTermosAlerta(): Promise<TermoAlerta[]>;
  criarTermoAlerta(dados: Omit<TermoAlerta, "id">): Promise<TermoAlerta>;
  atualizarTermoAlerta(
    id: string,
    dados: Partial<Omit<TermoAlerta, "id">>,
  ): Promise<void>;

  // --- Faixas da régua (PRD 10.3) ----------------------------------------------
  listarFaixasRegua(): Promise<ReguaFaixaDetalhe[]>;
  atualizarFaixaRegua(
    id: string,
    dados: Partial<Omit<ReguaFaixaDetalhe, "id" | "ordem">>,
  ): Promise<void>;
}
