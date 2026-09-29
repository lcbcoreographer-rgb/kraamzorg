/**
 * P28 · Servidor de homologação simulado, só para a máquina local.
 *
 * Existe para provar o próprio roteiro de homologação (`roteiro.spec.ts` e o
 * executor `hml/driver-webhook.ts`) enquanto o n8n, a UAZAPI de teste e a
 * OpenAI de homologação não existem. Ele faz o papel dos três:
 *
 * - `POST /webhook/...`: o webhook do fluxo 3. Roda a mensagem no simulador do
 *   fluxo gerado (`SessaoLocal`), sobre o banco local, com o modelo roteirizado.
 *   O caso e o turno saem do `messageid` que o roteiro monta (`kz-p28-<caso>-<turno>-...`).
 * - `GET/DELETE /api/teste/uazapi` e `POST /api/teste/uazapi/transcricoes`: a
 *   rota de captura do app, com o mesmo segredo no cabeçalho.
 * - um relógio que roda a entrada B do fluxo 3 (follow-up) a cada poucos
 *   segundos, no lugar do gatilho de 30 minutos do n8n.
 *
 * Só escuta em 127.0.0.1. Nunca é o alvo de um aceite: o aceite de 24 de 24
 * só vale no ambiente real.
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { CASOS } from "../lib/casos";
import { aplicarPreparo } from "../lib/preparo";
import { gravarParametro, lerParametro, lerReferencia } from "../lib/sql";
import type { Caso, Objeto, Preparo } from "../lib/tipos";
import { SessaoLocal } from "./execucao-local";
import type { Transcricao } from "./execucao-local";
import { consultaLocal } from "./ponte-psql";
import type { ConexaoLocal } from "./ponte-psql";
import { interlocutora } from "../lib/payloads";

export interface ServidorSimulado {
  /** Base da URL (http://127.0.0.1:porta). */
  url: string;
  webhookUrl: string;
  fechar(): Promise<void>;
}

interface Captura {
  id: string;
  tipo: "texto" | "midia";
  corpo: Objeto;
  capturadoEm: string;
}

async function lerCorpo(requisicao: IncomingMessage): Promise<Objeto> {
  const partes: Buffer[] = [];
  for await (const parte of requisicao) partes.push(parte as Buffer);
  const texto = Buffer.concat(partes).toString("utf8");
  return texto ? (JSON.parse(texto) as Objeto) : {};
}

function responder(
  resposta: ServerResponse,
  status: number,
  corpo: unknown,
): void {
  resposta.writeHead(status, { "content-type": "application/json" });
  resposta.end(JSON.stringify(corpo));
}

/** Preparos que, num ambiente real, o cliente já teria feito (textos aprovados, lista completa do IBGE). */
function preparosDoAmbiente(): Preparo[] {
  const chaves = new Set<string>();
  const extras: Preparo[] = [];
  for (const caso of CASOS) {
    for (const p of caso.preparo ?? []) {
      if (p.preparo === "textosAprovados")
        p.chaves.forEach((c) => chaves.add(c));
      if (p.preparo === "cidadeForaDaArea") extras.push(p);
    }
  }
  return [
    ...(chaves.size
      ? [{ preparo: "textosAprovados", chaves: [...chaves] } as Preparo]
      : []),
    ...extras,
  ];
}

export async function iniciarServidorSimulado(
  conexao: ConexaoLocal,
  opcoes: { segredo: string; porta?: number; instancia?: string },
): Promise<ServidorSimulado> {
  const consulta = consultaLocal(conexao);
  const capturas: Captura[] = [];
  const transcricoes = new Map<string, Transcricao>();
  const sessoes = new Map<string, { sessao: SessaoLocal; caso: Caso }>();

  // O ambiente "do cliente": agente ligado, debounce curto, textos aprovados, cidade fora da área.
  const restauracoes: (() => Promise<void>)[] = [];
  for (const [chave, valor] of [
    ["agente_modo", "producao"],
    ["agente_debounce_segundos", 1],
  ] as const) {
    const antes = await lerParametro(consulta, chave);
    await gravarParametro(consulta, chave, valor);
    restauracoes.push(async () => gravarParametro(consulta, chave, antes));
  }
  restauracoes.push(
    await aplicarPreparo(consulta, preparosDoAmbiente(), { ambiente: "local" }),
  );

  const segredoCerto = (requisicao: IncomingMessage) =>
    requisicao.headers["x-kz-interno-secret"] === opcoes.segredo;

  async function tratarWebhook(payload: Objeto): Promise<void> {
    const mensagem = (payload["message"] ?? {}) as Objeto;
    const messageId = String(mensagem["messageid"] ?? "");
    const achado = /^kz-p28-([a-z0-9]+)-(\d+)-/.exec(messageId);
    if (!achado)
      throw new Error(`messageid fora do padrão do roteiro: ${messageId}`);
    const caso = CASOS.find((c) => c.id.toLowerCase() === achado[1]);
    if (!caso) throw new Error(`caso desconhecido: ${achado[1]}`);
    const jid = String(mensagem["chatid"] ?? "");
    let entrada = sessoes.get(jid);
    if (!entrada) {
      const digitos = jid.replace(/\D/g, "");
      const referencia = await lerReferencia(consulta, {
        conversaId: null,
        telefone: `+${digitos}`,
        cpfEnviado: null,
      });
      const sessao = new SessaoLocal({
        caso,
        quem: interlocutora(digitos),
        conexao,
        planos: referencia.planos,
        horariosDaEdilaine: referencia.horariosDaEdilaine,
        aoEnviar: (corpo, tipo) =>
          capturas.push({
            id: randomUUID(),
            tipo,
            corpo,
            capturadoEm: new Date().toISOString(),
          }),
        transcricaoDe: (id) => transcricoes.get(id) ?? null,
      });
      await sessao.iniciar();
      entrada = { sessao, caso };
      sessoes.set(jid, entrada);
    }
    entrada.sessao.turnoAtual = Number(achado[2]);
    entrada.sessao.webhook(payload, String(mensagem["text"] ?? ""), messageId);
  }

  const servidor = createServer((requisicao, resposta) => {
    void (async () => {
      const url = new URL(requisicao.url ?? "/", "http://127.0.0.1");
      try {
        if (url.pathname === "/api/teste/uazapi") {
          if (!segredoCerto(requisicao))
            return responder(resposta, 401, { erro: "segredo" });
          if (requisicao.method === "GET")
            return responder(resposta, 200, { envios: capturas });
          if (requisicao.method === "DELETE") {
            capturas.length = 0;
            sessoes.clear();
            transcricoes.clear();
            return responder(resposta, 200, { ok: true });
          }
        }
        if (
          url.pathname === "/api/teste/uazapi/transcricoes" &&
          requisicao.method === "POST"
        ) {
          if (!segredoCerto(requisicao))
            return responder(resposta, 401, { erro: "segredo" });
          const corpo = await lerCorpo(requisicao);
          transcricoes.set(String(corpo["id"]), {
            texto: typeof corpo["texto"] === "string" ? corpo["texto"] : null,
            falhar: corpo["falhar"] === true,
          });
          return responder(resposta, 200, { ok: true });
        }
        if (
          url.pathname.startsWith("/webhook/") &&
          requisicao.method === "POST"
        ) {
          const payload = await lerCorpo(requisicao);
          if (
            payload["instanceName"] !==
            (opcoes.instancia ?? "kraamzorg-exemplo")
          )
            return responder(resposta, 200, {
              ignorado: "instância diferente",
            });
          await tratarWebhook(payload);
          return responder(resposta, 200, { ok: true });
        }
        responder(resposta, 404, { erro: "rota desconhecida" });
      } catch (erro) {
        responder(resposta, 500, {
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    })();
  });

  // O gatilho de 30 minutos do n8n (entrada B), em versão de poucos segundos, só para a
  // sessão do caso que espera o follow-up.
  const relogio = setInterval(() => {
    for (const { sessao, caso } of sessoes.values()) {
      const indice = caso.turnos.findIndex(
        (t) => "acao" in t && t.acao === "executarFollowup",
      );
      if (indice < 0 || sessao.envios.some((e) => e.turno === indice + 1))
        continue;
      try {
        sessao.turnoAtual = indice + 1;
        sessao.followup();
      } catch (erro) {
        console.error("[servidor simulado] follow-up falhou:", erro);
      }
    }
  }, 3000);

  await new Promise<void>((pronto) =>
    servidor.listen(opcoes.porta ?? 0, "127.0.0.1", pronto),
  );
  const endereco = servidor.address();
  if (!endereco || typeof endereco === "string")
    throw new Error("servidor simulado sem porta");
  const base = `http://127.0.0.1:${endereco.port}`;

  return {
    url: base,
    webhookUrl: `${base}/webhook/isadora-simulado`,
    async fechar() {
      clearInterval(relogio);
      await new Promise<void>((fim) => servidor.close(() => fim()));
      for (const f of restauracoes.reverse()) await f();
    },
  };
}
