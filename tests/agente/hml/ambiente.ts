/**
 * P28 · Variáveis do ambiente de homologação real.
 *
 * O roteiro só roda contra o webhook do fluxo 3 de homologação quando todas
 * as variáveis abaixo existem. Faltando qualquer uma, o spec é pulado com a
 * lista do que falta (nunca falha por falta de ambiente, nunca adivinha).
 *
 * Nenhum valor real fica no repositório: os valores moram no cofre da
 * Kraamzorg e entram só no terminal de quem roda.
 */

export interface AmbienteReal {
  /** URL de produção do webhook do fluxo 3 (com o segredo no caminho). */
  webhookUrl: string;
  /** Base do app de homologação, onde vive a rota de captura /api/teste/uazapi. */
  appUrl: string;
  /** Segredo das rotas internas do app de homologação (INTERNAL_ROUTES_SECRET). */
  segredoInterno: string;
  /** Nome da instância da UAZAPI de teste (o nó "Validar Origem" recusa outra). */
  instancia: string;
  /** Conexão do banco de homologação, com papel que lê e prepara as tabelas do roteiro. */
  databaseUrl: string;
  /** Segundos entre uma olhada e outra na captura e no banco. */
  intervaloSegundos: number;
  /** Segundos sem novidade que valem como "a Isadora terminou". */
  estabilidadeSegundos: number;
  /** Segundos que se esperam por uma resposta que talvez nunca venha (caso de silêncio). */
  esperaSilencioSegundos: number;
  /** Teto de espera por turno. */
  esperaMaximaSegundos: number;
  /** Minutos que o caso 23 espera pelo agendador do follow-up. */
  esperaFollowupMinutos: number;
  pularFollowup: boolean;
  /** Onde gravar o relatório. */
  relatorio: string | null;
}

/** Onde cada caso grava o próprio resultado durante a rodada (o relatório junta tudo no fim). */
export const DIRETORIO_DOS_CASOS = "test-results/homologacao/casos";

export const VARIAVEIS_OBRIGATORIAS = [
  [
    "KZ_HML_AMBIENTE",
    "precisa valer exatamente homologacao, como confirmação de que o alvo não é produção",
  ],
  [
    "KZ_HML_WEBHOOK_URL",
    "URL de produção do webhook do fluxo 3 de homologação (webhooks.fluxo3Entrada)",
  ],
  ["KZ_HML_APP_URL", "base do app de homologação (a rota /api/teste/uazapi)"],
  [
    "KZ_HML_INTERNAL_ROUTES_SECRET",
    "INTERNAL_ROUTES_SECRET do app de homologação",
  ],
  [
    "KZ_HML_INSTANCIA",
    "nome da instância de teste da UAZAPI (uazapi.instancia do config)",
  ],
  ["KZ_HML_DATABASE_URL", "conexão do banco de homologação"],
] as const;

export type LeituraDoAmbiente =
  { ok: true; ambiente: AmbienteReal } | { ok: false; motivo: string };

function numero(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

export function lerAmbiente(
  env: NodeJS.ProcessEnv = process.env,
): LeituraDoAmbiente {
  const faltando = VARIAVEIS_OBRIGATORIAS.filter(
    ([nome]) => !env[nome] || env[nome]?.trim() === "",
  );
  if (faltando.length > 0) {
    return {
      ok: false,
      motivo:
        "Homologação real não configurada, roteiro pulado. Faltam: " +
        faltando.map(([nome, para]) => `${nome} (${para})`).join("; ") +
        ". O ambiente de homologação (n8n, UAZAPI de teste, OpenAI) ainda precisa existir; ver docs/homologacao/isadora-MODELO.md.",
    };
  }
  if (env["KZ_HML_AMBIENTE"] !== "homologacao") {
    return {
      ok: false,
      motivo:
        'KZ_HML_AMBIENTE precisa valer "homologacao". Roteiro pulado: nunca roda contra outro alvo.',
    };
  }
  const webhookUrl = env["KZ_HML_WEBHOOK_URL"] as string;
  // http só vale para o servidor simulado local (a própria máquina), nunca para um n8n de verdade.
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(webhookUrl);
  if (
    (!webhookUrl.startsWith("https://") && !local) ||
    webhookUrl.includes("/webhook-test/")
  ) {
    return {
      ok: false,
      motivo:
        "KZ_HML_WEBHOOK_URL precisa ser a URL de produção (https, /webhook/...), não a de /webhook-test/. Roteiro pulado.",
    };
  }
  return {
    ok: true,
    ambiente: {
      webhookUrl,
      appUrl: (env["KZ_HML_APP_URL"] as string).replace(/\/$/, ""),
      segredoInterno: env["KZ_HML_INTERNAL_ROUTES_SECRET"] as string,
      instancia: env["KZ_HML_INSTANCIA"] as string,
      databaseUrl: env["KZ_HML_DATABASE_URL"] as string,
      intervaloSegundos: numero(env["KZ_HML_INTERVALO_SEGUNDOS"], 2),
      estabilidadeSegundos: numero(env["KZ_HML_ESTABILIDADE_SEGUNDOS"], 15),
      esperaSilencioSegundos: numero(
        env["KZ_HML_ESPERA_SILENCIO_SEGUNDOS"],
        60,
      ),
      esperaMaximaSegundos: numero(env["KZ_HML_ESPERA_MAXIMA_SEGUNDOS"], 180),
      esperaFollowupMinutos: numero(env["KZ_HML_ESPERA_FOLLOWUP_MINUTOS"], 45),
      pularFollowup: env["KZ_HML_PULAR_FOLLOWUP"] === "1",
      relatorio: env["KZ_HML_RELATORIO"] ?? null,
    },
  };
}
