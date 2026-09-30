/**
 * Limpeza do que vai para o Sentry (P14 item 5, CLAUDE.md "Segurança e
 * LGPD"): nome, telefone, e-mail, CPF e conteúdo de mensagem nunca saem do
 * nosso sistema por relatório de erro. Funções puras, sem depender do SDK
 * (o SDK chama `limparEvento` em `beforeSend`, ver `config.ts`), então o
 * teste confere o que sairia sem rede.
 *
 * Três camadas:
 * 1. Estrutura: o evento perde tudo que pode carregar dado de gente (usuário,
 *    cabeçalhos, cookies, corpo e query string da requisição, contextos extras,
 *    variáveis locais da pilha, nome do servidor). Sobra o que ajuda a achar o
 *    defeito: tipo do erro, pilha, método, caminho, ambiente e versão.
 * 2. Texto: toda cadeia que sobra (mensagem, valor da exceção, migalhas)
 *    passa por `mascararTexto`, que troca e-mail, CPF, telefone e número longo.
 * 3. Endereço: a URL perde query string e fragmento, e os trechos do caminho
 *    que são segredo de uso único (token do formulário do contrato, segredo do
 *    webhook) viram `[oculto]`.
 *
 * Limite conhecido: o nome de uma pessoa dentro de uma mensagem de exceção
 * não se detecta por expressão regular. A regra do código é a de sempre: erro
 * nunca leva dado de paciente na mensagem. O teste fixa isso nas rotas.
 */

export const OCULTO = "[oculto]";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 000.000.000-00, 000 000 000 00 ou 11 dígitos colados
const CPF = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}\b/g;
// +55 (11) 91234-5678, (11) 1234-5678, 5511912345678 e variações com 10 a 13 dígitos
const TELEFONE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2}\)|\d{2})[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;
const NUMERO_LONGO = /\b\d{9,}\b/g;

/** Troca e-mail, CPF, telefone e número longo por `[oculto]`. */
export function mascararTexto(texto: string): string {
  return texto
    .replace(EMAIL, OCULTO)
    .replace(CPF, OCULTO)
    .replace(TELEFONE, OCULTO)
    .replace(NUMERO_LONGO, OCULTO);
}

/** Caminhos cujo trecho seguinte é segredo de uso único. */
const PREFIXOS_SEGREDO = [
  "/formulario/",
  "/api/webhooks/autentique/",
  "/auth/",
];

/**
 * Tira query string e fragmento, esconde o trecho secreto do caminho e mascara
 * o que restar. Aceita URL completa ou só o caminho; se não entender, devolve
 * `[oculto]` em vez de arriscar.
 */
export function limparUrl(url: string): string {
  let caminho: string;
  let origem = "";
  try {
    const u = new URL(url, "https://interno.invalid");
    caminho = u.pathname;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) origem = u.origin;
  } catch {
    return OCULTO;
  }
  for (const prefixo of PREFIXOS_SEGREDO) {
    if (caminho.startsWith(prefixo)) {
      const resto = caminho.slice(prefixo.length);
      const depois = resto.includes("/") ? resto.slice(resto.indexOf("/")) : "";
      caminho = `${prefixo}${OCULTO}${depois}`;
      break;
    }
  }
  return mascararTexto(`${origem}${caminho}`);
}

type Objeto = Record<string, unknown>;

const ehObjeto = (v: unknown): v is Objeto =>
  !!v && typeof v === "object" && !Array.isArray(v);

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? mascararTexto(v) : undefined;
}

function limparExcecao(valor: unknown): unknown {
  if (!ehObjeto(valor)) return valor;
  const saida: Objeto = { ...valor };
  if (typeof saida.value === "string") saida.value = mascararTexto(saida.value);
  const pilha = saida.stacktrace;
  if (ehObjeto(pilha) && Array.isArray(pilha.frames)) {
    saida.stacktrace = {
      ...pilha,
      frames: pilha.frames.map((f) => {
        if (!ehObjeto(f)) return f;
        // variáveis locais podem ter dado de gente
        const { vars: _vars, ...resto } = f;
        void _vars;
        return resto;
      }),
    };
  }
  return saida;
}

/** Migalha do Sentry: mantém categoria, nível e hora; perde dado e mensagem livre. */
export function limparMigalha<T>(migalha: T): T | null {
  if (!ehObjeto(migalha)) return migalha;
  const categoria =
    typeof migalha.category === "string" ? migalha.category : "";
  // console e clique podem repetir texto digitado por gente
  if (categoria === "console" || categoria.startsWith("ui.")) return null;
  const saida: Objeto = { ...migalha };
  if (typeof saida.message === "string") {
    // migalha de navegação e de rede traz o endereço como mensagem
    saida.message = /^(\/|https?:\/\/)/.test(saida.message)
      ? limparUrl(saida.message)
      : mascararTexto(saida.message);
  }
  const dados = ehObjeto(saida.data) ? saida.data : null;
  if (dados) {
    const url =
      typeof dados.url === "string" ? limparUrl(dados.url) : undefined;
    const minimo: Objeto = {};
    if (url) minimo.url = url;
    if (typeof dados.method === "string") minimo.method = dados.method;
    if (typeof dados.status_code === "number")
      minimo.status_code = dados.status_code;
    saida.data = minimo;
  }
  return saida as T;
}

/**
 * O evento inteiro, pronto para sair. Nunca devolve `null` (erro com dado
 * sensível ainda vale ser visto, sem o dado).
 */
export function limparEvento<T>(evento: T): T {
  if (!ehObjeto(evento)) return evento;
  const saida: Objeto = { ...evento };

  delete saida.user;
  delete saida.extra;
  delete saida.server_name;
  delete saida.modules;
  delete saida.sdkProcessingMetadata;

  if (typeof saida.message === "string")
    saida.message = mascararTexto(saida.message);
  if (typeof saida.transaction === "string")
    saida.transaction = limparUrl(saida.transaction);

  const requisicao = ehObjeto(saida.request) ? saida.request : null;
  if (requisicao) {
    const minima: Objeto = {};
    if (typeof requisicao.method === "string")
      minima.method = requisicao.method;
    if (typeof requisicao.url === "string")
      minima.url = limparUrl(requisicao.url);
    saida.request = minima;
  }

  if (ehObjeto(saida.exception) && Array.isArray(saida.exception.values)) {
    saida.exception = {
      ...saida.exception,
      values: saida.exception.values.map(limparExcecao),
    };
  }

  if (Array.isArray(saida.breadcrumbs)) {
    saida.breadcrumbs = saida.breadcrumbs
      .map((m) => limparMigalha(m))
      .filter((m) => m !== null);
  }

  // Contextos: fica só o que descreve o ambiente técnico, nada de pessoa.
  if (ehObjeto(saida.contexts)) {
    const { runtime, browser, os } = saida.contexts as Objeto;
    const permitidos: Objeto = {};
    if (runtime) permitidos.runtime = runtime;
    if (browser) permitidos.browser = browser;
    if (os) permitidos.os = os;
    saida.contexts = permitidos;
  }

  if (ehObjeto(saida.tags)) {
    const tags: Objeto = {};
    for (const [k, v] of Object.entries(saida.tags)) {
      tags[k] = typeof v === "string" ? texto(v) : v;
    }
    saida.tags = tags;
  }

  return saida as T;
}
