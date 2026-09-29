/**
 * Microcopy do formulário seguro público (P30 item 2): rótulos, etapas,
 * botões e as mensagens de erro de digitação. Segue docs/design/voz.md
 * (seção 3, família) e a tabela "Onde cada texto mora": microcopy da tela
 * fica no arquivo de textos do módulo. As frases de explicação, o
 * consentimento, o fim e os avisos de link (o que a família lê como
 * conversa) vêm de mensagem_modelo (chaves formulario_*), em rascunho até
 * a aprovação.
 *
 * Regras: você para ela, vocês quando a decisão é da família; nada de
 * travessão, exclamação, "mamãe" ou "papai"; o erro diz o que aconteceu e o
 * que fazer, sem culpar; o que foi digitado nunca some.
 */

export const ETAPAS = {
  voce: "Sobre você",
  endereco: "Onde vocês vão estar",
  pagador: "Quem vai pagar",
  final: "Para terminar",
} as const;

export const ROTULOS = {
  nomeCompleto: "Nome completo",
  cpf: "CPF",
  dataNascimento: "Data de nascimento",
  email: "E-mail",
  cep: "CEP",
  logradouro: "Rua ou avenida",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "Estado",
  enderecoCasa: "Endereço de casa",
  enderecoAtendimento: "Endereço onde vocês vão estar",
  pagadorNome: "Nome completo de quem vai pagar",
  pagadorCpf: "CPF de quem vai pagar",
  pagadorEmail: "E-mail de quem vai pagar",
  pagadorEndereco: "Endereço de quem vai pagar",
  testemunhaNome: "Nome de quem assina como testemunha",
  testemunhaEmail: "E-mail da testemunha",
  sim: "Sim, o mesmo",
  nao: "Não, é outro endereço",
  consentimento: "Concordo",
} as const;

export const EXEMPLOS = {
  cpf: "000.000.000-00",
  dataNascimento: "dd/mm/aaaa",
  cep: "00000-000",
  uf: "SP",
} as const;

export const BOTOES = {
  continuar: "Continuar",
  voltar: "Voltar",
  enviar: "Enviar os dados",
  enviando: "Enviando",
} as const;

/** "Etapa 2 de 3" (o nome da etapa vem logo abaixo, como título). */
export function rotuloEtapa(atual: number, total: number) {
  return `Etapa ${atual} de ${total}`;
}

export const ERROS = {
  obrigatorio: "Falta este dado para o contrato.",
  nomeCompleto:
    "Escreva o nome completo, com sobrenome, do jeito que está no documento.",
  cpfCurto: (quantos: number) =>
    `Esse CPF tem ${quantos} ${quantos === 1 ? "número" : "números"}. Confira se faltou algum.`,
  cpfLongo: (quantos: number) =>
    `Esse CPF tem ${quantos} números, e o CPF tem 11. Confira se sobrou algum.`,
  cpfDigito: "Os números desse CPF não conferem. Confira e digite de novo.",
  cpfIgualGestante:
    "Esse é o CPF de quem recebe o cuidado. Coloque aqui o CPF de quem vai pagar.",
  dataFormato: "Escreva a data com dia, mês e ano, como 17/05/1994.",
  dataFutura: "Essa data ainda não chegou. Confira o ano.",
  dataAntiga: "Confira o ano: ficou muito no passado.",
  email:
    "Esse e-mail parece incompleto. Confira se tem @ e o final, como .com ou .com.br.",
  cep: "O CEP tem 8 números. Confira e digite de novo.",
  uf: "Use a sigla do estado, como SP ou PR.",
  escolha: "Escolha uma das opções para continuar.",
  consentimento:
    "Para enviar, marque que você concorda com o uso dos dados para o contrato.",
  testemunhaEmail:
    "A testemunha recebe o contrato para assinar por e-mail. Escreva o e-mail dela ou deixe os dois campos em branco.",
  verificacao:
    "Ainda estamos confirmando que o envio é seu. Espere uns segundos e toque em Enviar os dados de novo.",
  verificacaoIndisponivel:
    "A verificação de segurança não carregou. Recarregue a página; o que você preencheu continua aqui.",
} as const;

/** Quando o banco não tem os textos (seed sem as chaves formulario_*). */
export const FORMULARIO_SEM_TEXTOS =
  "Este formulário ainda não está pronto. Fale com a Kraamzorg pelo WhatsApp.";

export const TITULO_PAGINA = "Dados do contrato · Kraamzorg Brasil";
