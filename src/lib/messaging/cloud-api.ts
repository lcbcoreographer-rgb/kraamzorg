import { capturaPermitida, registrarCaptura } from "./captura";
import { digitosTelefone } from "./link-whatsapp";
import type {
  Mensageiro,
  PedidoEnvio,
  ResultadoEnvio,
  VerificadorFreio,
} from "./tipos";

/**
 * Canal `cloud_api` (PRD 4.1 D-08, 14, 22.1 T-01; P18b): a API oficial do
 * WhatsApp (Cloud API da Meta). Regras que ele cumpre:
 *
 * 1. Toda mensagem para família passa por `verificar` (o
 *    `privado.pode_enviar_mensagem` do banco) antes de tocar a rede.
 * 2. Dentro de `janelaHoras` desde a última mensagem da família, sai texto
 *    livre (`type: "text"`).
 * 3. Fora dela, ou sem saber quando a família escreveu, só sai o modelo
 *    aprovado pela Meta (`type: "template"`) da chave `pedido.modelo`. O texto
 *    livre de `pedido.texto` NUNCA sai fora da janela, nem como plano B: sem
 *    modelo aprovado, o envio falha com `fora_da_janela_sem_modelo`.
 * 4. `janelaHoras` vem de `parametro.whatsapp_janela_horas` (quem monta o
 *    adaptador lê do banco). Sem o valor, tudo conta como fora da janela.
 * 5. Sem credencial, em desenvolvimento e homologação, o envio cai na captura
 *    (`captura.ts`): nada vai à rede e o teste confere o que sairia. Em
 *    produção, sem credencial, o envio falha.
 *
 * Aviso a grupo interno (categoria "interna") não passa por aqui: a Cloud API
 * não tem grupo, e os avisos internos seguem pela UAZAPI (PRD 4.1, T-01).
 * Configuração só por variável de ambiente: nunca token no código.
 */

export interface ModeloAprovado {
  mensagemChave: string;
  /** Nome do modelo na Meta (`template.name`). */
  nomeMeta: string;
  /** Código de idioma da Meta ("pt_BR"). */
  idioma: string;
  /** Nomes das variáveis em ordem: a primeira é {{1}}. */
  variaveis: string[];
  /** Valor usado quando o pedido não traz a variável. */
  valoresPadrao: Record<string, string>;
  /** Texto exato submetido à Meta, com {{1}}, {{2}}. */
  texto: string;
}

/** Porta para o cadastro `modelo_whatsapp`: devolve só modelo com status aprovado. */
export interface CatalogoModelos {
  buscarAprovado(
    mensagemChave: string,
    idioma?: string,
  ): Promise<ModeloAprovado | null>;
}

export interface ConfigCloudApi {
  /** Sem credencial completa, o adaptador captura (fora de produção). */
  credenciais: { token: string; phoneNumberId: string } | null;
  /** Padrão "https://graph.facebook.com"; o teste aponta para outro host. */
  urlBase?: string;
  /** Versão da Graph API, sem valor fixo no código: vem do ambiente. */
  versaoGraph?: string;
  /** parametro.whatsapp_janela_horas; nulo ou zero = tudo fora da janela. */
  janelaHoras: number | null;
  catalogo: CatalogoModelos;
  idiomaPadrao?: string;
  /** Injeção para teste. */
  fetchImpl?: typeof fetch;
  agora?: () => Date;
}

const URL_GRAPH_PADRAO = "https://graph.facebook.com";
const IDIOMA_PADRAO = "pt_BR";
const TEMPO_LIMITE_MS = 15000;

/** Lê as credenciais do ambiente. Nulo se faltar qualquer uma. */
export function credenciaisCloudApiDoAmbiente(): ConfigCloudApi["credenciais"] {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

const SEM_CATALOGO: CatalogoModelos = {
  async buscarAprovado() {
    return null;
  },
};

/** Sem configuração: catálogo vazio, então só o texto livre dentro da janela (e janela nula: nada). */
export function criarMensageiroCloudApi(
  config: Partial<ConfigCloudApi> = {},
): Mensageiro {
  const completa: ConfigCloudApi = {
    credenciais: config.credenciais ?? credenciaisCloudApiDoAmbiente(),
    urlBase: config.urlBase ?? process.env.WHATSAPP_GRAPH_URL,
    versaoGraph: config.versaoGraph ?? process.env.WHATSAPP_GRAPH_VERSAO,
    janelaHoras: config.janelaHoras ?? null,
    catalogo: config.catalogo ?? SEM_CATALOGO,
    idiomaPadrao: config.idiomaPadrao,
    fetchImpl: config.fetchImpl,
    agora: config.agora,
  };
  return {
    canal: "cloud_api",
    enviar: (pedido, verificar) => enviar(completa, pedido, verificar),
  };
}

function falha(codigo: string, motivo: string): ResultadoEnvio {
  return { ok: false, motivo, codigo };
}

/** Verdadeiro se a família escreveu há menos de `janelaHoras` horas. */
export function dentroDaJanela(
  ultimaMensagemFamiliaEm: string | Date | null | undefined,
  janelaHoras: number | null,
  agora: Date,
): boolean {
  if (!janelaHoras || janelaHoras <= 0) return false;
  if (!ultimaMensagemFamiliaEm) return false;
  const quando = new Date(ultimaMensagemFamiliaEm).getTime();
  if (Number.isNaN(quando)) return false;
  const decorrido = agora.getTime() - quando;
  return decorrido >= 0 && decorrido <= janelaHoras * 3_600_000;
}

/** Sem quebra de linha nem tabulação (a Meta recusa) e sem parâmetro vazio. */
function valorDeParametro(valor: string | undefined): string | null {
  const limpo = (valor ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return limpo === "" ? null : limpo;
}

/** Troca {{1}}, {{2}} pelos valores, na ordem. */
export function renderizarModelo(texto: string, valores: string[]): string {
  return valores.reduce(
    (atual, valor, indice) => atual.split(`{{${indice + 1}}}`).join(valor),
    texto,
  );
}

async function enviar(
  config: ConfigCloudApi,
  pedido: PedidoEnvio,
  verificar: VerificadorFreio,
): Promise<ResultadoEnvio> {
  if (pedido.destinatario !== "familia") {
    return falha(
      "grupo_nao_suportado",
      "A Cloud API oficial não envia para grupo. O aviso à equipe segue pelo canal interno.",
    );
  }

  const verificacao = await verificar({
    familiaId: pedido.familiaId,
    categoria: pedido.categoria,
    canal: "cloud_api",
  });
  if (!verificacao.pode) {
    return {
      ok: false,
      motivo: verificacao.motivo,
      codigo: verificacao.codigo ?? "freio",
    };
  }

  const para = digitosTelefone(pedido.telefoneOuJid);
  if (para.length < 10) {
    return falha(
      "telefone_invalido",
      "O telefone dessa família não está em um formato que o WhatsApp aceita.",
    );
  }

  const agora = (config.agora ?? (() => new Date()))();
  const dentro = dentroDaJanela(
    pedido.ultimaMensagemFamiliaEm,
    config.janelaHoras,
    agora,
  );

  let corpo: Record<string, unknown>;
  let texto: string;
  let via: "texto_livre" | "modelo";
  let nomeModelo: string | undefined;

  if (dentro) {
    if (pedido.texto.trim() === "") {
      return falha("texto_vazio", "Não há texto para enviar.");
    }
    corpo = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: para,
      type: "text",
      text: { preview_url: false, body: pedido.texto },
    };
    texto = pedido.texto;
    via = "texto_livre";
  } else {
    if (!pedido.modelo) {
      return falha(
        "fora_da_janela_sem_modelo",
        "A última mensagem dessa família está fora da janela de resposta do WhatsApp. Fora dela só sai modelo aprovado pela Meta, e nenhum foi indicado. Nada foi enviado.",
      );
    }
    const idioma = config.idiomaPadrao ?? IDIOMA_PADRAO;
    const modelo = await config.catalogo.buscarAprovado(
      pedido.modelo.mensagemChave,
      idioma,
    );
    if (!modelo) {
      return falha(
        "fora_da_janela_sem_modelo",
        "Fora da janela de resposta do WhatsApp só sai modelo aprovado pela Meta, e esta mensagem ainda não tem um aprovado. Nada foi enviado.",
      );
    }
    const valores: string[] = [];
    for (const nome of modelo.variaveis) {
      const valor =
        valorDeParametro(pedido.modelo.variaveis?.[nome]) ??
        valorDeParametro(modelo.valoresPadrao[nome]);
      if (valor === null) {
        return falha(
          "parametro_sem_valor",
          "Falta um dado para preencher o modelo aprovado. Nada foi enviado.",
        );
      }
      valores.push(valor);
    }
    corpo = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: para,
      type: "template",
      template: {
        name: modelo.nomeMeta,
        language: { code: modelo.idioma },
        ...(valores.length > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters: valores.map((valor) => ({
                    type: "text",
                    text: valor,
                  })),
                },
              ],
            }
          : {}),
      },
    };
    texto = renderizarModelo(modelo.texto, valores);
    via = "modelo";
    nomeModelo = modelo.nomeMeta;
  }

  if (!config.credenciais) {
    if (!capturaPermitida()) {
      return falha(
        "nao_configurado",
        "A Cloud API do WhatsApp não está configurada neste ambiente. Nada foi enviado.",
      );
    }
    const id = registrarCaptura(corpo);
    return {
      ok: true,
      canal: "cloud_api",
      modo: "enviado",
      texto,
      idExterno: id,
      via,
      modelo: nomeModelo,
      capturado: true,
    };
  }

  const base = (config.urlBase ?? URL_GRAPH_PADRAO).replace(/\/+$/, "");
  const versao = config.versaoGraph ? `/${config.versaoGraph}` : "";
  const url = `${base}${versao}/${config.credenciais.phoneNumberId}/messages`;
  const buscar = config.fetchImpl ?? fetch;

  let resposta: Response;
  try {
    resposta = await buscar(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.credenciais.token}`,
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    return falha(
      "rede",
      "Não deu para falar com o WhatsApp agora. Tente de novo em instantes.",
    );
  }

  const json = (await resposta.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { code?: number };
  } | null;

  if (!resposta.ok) {
    return recusaDaMeta(json?.error?.code, resposta.status);
  }

  const idExterno = json?.messages?.[0]?.id;
  if (!idExterno) {
    return falha(
      "resposta_sem_id",
      "O WhatsApp respondeu sem confirmar o envio. Confira a conversa antes de tentar de novo.",
    );
  }
  return {
    ok: true,
    canal: "cloud_api",
    modo: "enviado",
    texto,
    idExterno,
    via,
    modelo: nomeModelo,
  };
}

/** Códigos da Cloud API que a tela precisa tratar. O texto do erro da Meta nunca volta. */
function recusaDaMeta(
  codigo: number | undefined,
  status: number,
): ResultadoEnvio {
  switch (codigo) {
    case 131047:
    case 131051:
      return falha(
        "meta_fora_da_janela",
        "O WhatsApp recusou porque a última mensagem da família saiu da janela de resposta. Só sai modelo aprovado.",
      );
    case 131026:
      return falha(
        "meta_nao_entregavel",
        "Esse número não recebe mensagem pelo WhatsApp. Confira o telefone da família.",
      );
    case 132001:
    case 132012:
      return falha(
        "meta_modelo_invalido",
        "O WhatsApp não reconheceu o modelo aprovado. Avise a diretoria; nada foi enviado.",
      );
    case 130429:
    case 131056:
      return falha(
        "meta_limite",
        "O WhatsApp pediu para esperar um pouco antes de novos envios. Tente de novo em alguns minutos.",
      );
    case 190:
      return falha(
        "meta_credencial",
        "A credencial do WhatsApp deixou de valer. Avise a diretoria; nada foi enviado.",
      );
    default:
      return falha(
        "meta_recusou",
        `O WhatsApp recusou o envio (código ${codigo ?? status}).`,
      );
  }
}
