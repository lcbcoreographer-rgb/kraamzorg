import { codigoVenda, ErroRepositorio } from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções de contrato e cobrança
 * (0019_contrato_cobranca.sql, "venda:<código>") e para os erros de
 * geração e envio. Erro diz o que aconteceu e o que fazer (PRD 20.3).
 */
const FRASES: Record<string, string> = {
  familia_inexistente:
    "Essa família não está mais disponível. Atualize a tela.",
  contrato_inexistente:
    "Esse contrato não está mais disponível. Atualize a tela.",
  formulario_pendente:
    "A família ainda não mandou os dados pelo formulário seguro. O contrato sai depois disso.",
  contrato_ja_enviado:
    "Este contrato já foi enviado para assinatura. O PDF não muda mais.",
  familia_em_estado_sensivel:
    "Esta família está em estado sensível ou pediu para não ser contatada. Nada sai por aqui; o contato é da coordenação, pelo nome.",
  modelo_sem_cadastro:
    "O modelo de contrato ainda não está cadastrado nos parâmetros. Avise a diretoria; nada foi gerado.",
  dados_incompletos:
    "Faltam dados da gestante ou de quem paga (CPF, nascimento, e-mail ou endereço). Peça um novo link do formulário na proposta.",
  caminho_pdf_invalido:
    "O arquivo do contrato saiu com um nome fora do padrão. Nada foi guardado; tente de novo.",
  pdf_sem_resumo:
    "O PDF não pôde ser conferido. Nada foi guardado; gere de novo.",
  contrato_nao_gerado: "Gere o contrato antes de enviar para assinatura.",
  envio_em_andamento:
    "Um envio já está em andamento para este contrato. Confira o painel da Autentique antes de tentar de novo.",
  envio_nao_reservado:
    "Não há envio em andamento para este contrato. Atualize a tela.",
  signatario_kraamzorg_sem_cadastro:
    "Falta cadastrar quem assina pela Kraamzorg. Avise a diretoria; nada foi enviado.",
  gestante_sem_contato:
    "A gestante não tem e-mail nem telefone cadastrado. Nada foi enviado.",
  documento_invalido:
    "A Autentique devolveu um identificador que não conferiu. Avise a equipe técnica.",
  contrato_nao_assinado:
    "O contrato ainda não foi assinado. A cobrança sai depois da assinatura.",
  cobranca_sem_parametro:
    "O vencimento da cobrança ainda não está nos parâmetros. Avise a diretoria; nenhuma cobrança foi criada.",
  cobranca_inexistente:
    "Essa cobrança não está mais disponível. Atualize a tela.",
  cobranca_nao_aberta:
    "Essa cobrança já foi paga ou cancelada. Atualize a tela.",
  link_invalido:
    "O link de pagamento que voltou não é seguro. Nada foi guardado; tente de novo.",
  link_ja_gerado: "Essa cobrança já tem link de pagamento.",
  parcelas_acima_do_limite:
    "O contrato tem mais parcelas do que o link de pagamento permite sem juros. Combine essa cobrança à mão e registre a baixa quando o pagamento chegar.",
  motivo_obrigatorio:
    "Escreva o motivo da baixa em pelo menos 10 letras, para ficar registrado.",
  comprovante_obrigatorio:
    "Anexe o comprovante do pagamento (PDF, PNG ou JPG) para dar a baixa.",
  valor_menor_que_a_cobranca:
    "O valor recebido é menor que o da cobrança. Confira o comprovante; a baixa parcial não existe por aqui.",
  situacao_invalida: "Esse filtro não existe. Escolha outro.",
  sem_permissao:
    "O seu papel não permite esta etapa. Fale com a diretoria se precisar dela.",
};

const FRASES_SERVICO: Record<string, string> = {
  modelo_invalido:
    "O modelo de contrato tem um problema e o PDF não saiu. Avise a diretoria para corrigir o modelo em Configurações.",
  pdf_nao_encontrado:
    "O PDF gerado não foi encontrado. Gere o contrato de novo antes de enviar.",
  modelo_nao_aprovado:
    "O modelo de contrato ainda é provisório e este ambiente envia documentos com validade. Peça a aprovação do jurídico e do Leonardo em Configurações antes de enviar. Nada foi enviado.",
  integracao_nao_configurada:
    "A conexão com a Autentique ainda não foi configurada neste ambiente. Nada foi enviado.",
  autentique_recusou:
    "A Autentique recusou o documento. Nada foi criado lá; confira os dados de quem assina e tente de novo.",
  autentique_incerto:
    "Não deu para saber se a Autentique recebeu o documento. Confira o painel da Autentique. Se o documento estiver lá, aguarde as assinaturas; se não estiver, toque em Liberar o envio.",
  armazenamento:
    "O arquivo não foi guardado. Nada mudou no contrato; tente de novo em instantes.",
};

interface ErroComCodigo {
  codigo?: string;
  name?: string;
}

export function fraseErroContrato(erro: unknown, acao: string): string {
  const servico = erro as ErroComCodigo;
  if (
    servico?.name === "ErroServicoContrato" &&
    servico.codigo &&
    FRASES_SERVICO[servico.codigo]
  ) {
    return FRASES_SERVICO[servico.codigo]!;
  }
  const codigo = codigoVenda(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") return FRASES.sem_permissao!;
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}
