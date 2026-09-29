/**
 * P28 · Executor do ambiente real: manda os payloads ao webhook do fluxo 3 de
 * homologação e lê o resultado no lugar onde ele aparece de verdade.
 *
 * - Envios: a rota de captura do app (`/api/teste/uazapi`), alimentada pelo
 *   n8n com `homologacao.envioSimulado` ligado. Cada caso limpa a captura
 *   antes de começar e roda sozinho (o Playwright roda com um worker).
 * - Estado: o banco de homologação (conversa, transferências, marcos, freio,
 *   modo), lido pelas mesmas consultas do executor local.
 * - Áudio: a transcrição que o caso pede é registrada na rota de transcrições
 *   antes do payload, e `message/download` devolve esse texto (ou falha).
 *
 * Uma conversa nova por caso: cada caso usa um número inventado que nunca
 * existiu antes. Nada aqui usa número, nome ou conversa real.
 */
import { Client } from "pg";
import {
  descreverTurno,
  idDaMensagem,
  interlocutora,
  montarPayload,
} from "../lib/payloads";
import type { Interlocutora } from "../lib/payloads";
import { executarAcaoDeBanco } from "../lib/acoes";
import { aplicarPreparo } from "../lib/preparo";
import {
  envelopar,
  gravarParametro,
  lerEstado,
  lerParametro,
  lerReferencia,
  sqlAgendarFollowup,
} from "../lib/sql";
import type { Consulta } from "../lib/sql";
import { ehAcao } from "../lib/tipos";
import type {
  Caso,
  Envio,
  EstadoBanco,
  Objeto,
  ResultadoCaso,
  ResultadoTurno,
  Turno,
} from "../lib/tipos";
import type { AmbienteReal } from "./ambiente";

interface Captura {
  id: string;
  tipo: "texto" | "midia";
  corpo: Objeto;
}

const dormir = (ms: number) =>
  new Promise<void>((resolver) => setTimeout(resolver, ms));

export class ExecutorReal {
  private client: Client;
  readonly consulta: Consulta;
  private restauracoes: (() => Promise<void>)[] = [];
  private sequencia = 0;
  private readonly base = 1_000_000 + Math.floor(Math.random() * 8_000_000);
  private debounceSegundos = 20;
  private modoDoAgente: string | null = null;

  constructor(private readonly amb: AmbienteReal) {
    this.client = new Client({ connectionString: amb.databaseUrl });
    this.consulta = {
      linhas: async (sql) => {
        const resposta = await this.client.query(envelopar(sql));
        const primeira = resposta.rows[0] as
          Record<string, unknown> | undefined;
        return (primeira ? (Object.values(primeira)[0] as Objeto[]) : []) ?? [];
      },
    };
  }

  private cabecalhos() {
    return {
      "x-kz-interno-secret": this.amb.segredoInterno,
      "content-type": "application/json",
    };
  }

  /** Confere que o alvo é mesmo homologação e prepara o agente para o roteiro. */
  async iniciar(): Promise<void> {
    await this.client.connect();
    const resposta = await fetch(`${this.amb.appUrl}/api/teste/uazapi`, {
      headers: this.cabecalhos(),
    });
    if (resposta.status !== 200) {
      throw new Error(
        `A rota de captura respondeu ${resposta.status}. Ela só abre com NEXT_PUBLIC_APP_ENV=homologacao e o segredo certo; o roteiro para aqui para nunca tocar em outro ambiente.`,
      );
    }
    const modo = await lerParametro(this.consulta, "agente_modo");
    this.modoDoAgente = typeof modo === "string" ? modo : null;
    if (this.modoDoAgente === "desligado") {
      throw new Error(
        'agente_modo está "desligado": a Isadora não responde. Ponha "teste" (com os números do roteiro na lista) ou "producao" em homologação.',
      );
    }
    const debounce = await lerParametro(
      this.consulta,
      "agente_debounce_segundos",
    );
    if (typeof debounce === "number") this.debounceSegundos = debounce;
  }

  async encerrar(): Promise<void> {
    for (const f of this.restauracoes.reverse()) await f();
    this.restauracoes = [];
    await this.client.end();
  }

  private novaInterlocutora(): Interlocutora {
    this.sequencia += 1;
    return interlocutora(
      `551199${String(this.base + this.sequencia).padStart(7, "0")}`,
    );
  }

  private async capturados(): Promise<Captura[]> {
    const resposta = await fetch(`${this.amb.appUrl}/api/teste/uazapi`, {
      headers: this.cabecalhos(),
    });
    if (!resposta.ok)
      throw new Error(
        `Falha ao ler a captura da UAZAPI: HTTP ${resposta.status}`,
      );
    const json = (await resposta.json()) as { envios: Captura[] };
    return json.envios;
  }

  private async limparCaptura(): Promise<void> {
    const resposta = await fetch(`${this.amb.appUrl}/api/teste/uazapi`, {
      method: "DELETE",
      headers: this.cabecalhos(),
    });
    if (!resposta.ok)
      throw new Error(
        `Falha ao limpar a captura da UAZAPI: HTTP ${resposta.status}`,
      );
  }

  private classificar(
    captura: Captura,
    quem: Interlocutora,
    turno: number,
    ordem: number,
  ): Envio {
    const numero = String(captura.corpo["number"] ?? "");
    const destino: Envio["destino"] =
      numero === quem.jid || numero === quem.digitos
        ? "familia"
        : numero.endsWith("@g.us")
          ? "grupo"
          : "plantao";
    const documento = captura.tipo === "midia";
    return {
      turno,
      ordem,
      destino,
      tipo: documento ? "documento" : "texto",
      texto: documento ? "" : String(captura.corpo["text"] ?? ""),
      arquivo: documento ? String(captura.corpo["docName"] ?? "") : undefined,
    };
  }

  private async assinatura(
    quem: Interlocutora,
  ): Promise<{ envios: number; estado: EstadoBanco }> {
    const envios = (await this.capturados()).length;
    return { envios, estado: await lerEstado(this.consulta, quem.e164) };
  }

  /**
   * Espera o turno terminar. Com resposta, espera a estabilidade; sem nenhuma, espera
   * `esperaSilencioSegundos` (o tempo do agrupamento mais a folga do modelo).
   */
  private async aguardar(
    quem: Interlocutora,
    enviosAntes: number,
    silencioEsperadoSegundos: number,
  ): Promise<void> {
    const inicio = Date.now();
    let ultimaMudanca = Date.now();
    let anterior = "";
    for (;;) {
      await dormir(this.amb.intervaloSegundos * 1000);
      const { envios, estado } = await this.assinatura(quem);
      const assinatura = `${envios}|${estado.mensagens.length}|${estado.transferencias.length}|${estado.conversa?.agente_pausado_ate ?? ""}`;
      if (assinatura !== anterior) {
        anterior = assinatura;
        ultimaMudanca = Date.now();
      }
      const decorrido = (Date.now() - inicio) / 1000;
      const parado = (Date.now() - ultimaMudanca) / 1000;
      if (envios > enviosAntes && parado >= this.amb.estabilidadeSegundos)
        return;
      if (envios <= enviosAntes && decorrido >= silencioEsperadoSegundos)
        return;
      if (decorrido >= this.amb.esperaMaximaSegundos) return;
    }
  }

  async executar(caso: Caso): Promise<ResultadoCaso> {
    const quem = this.novaInterlocutora();
    const modoTesteForaDaLista =
      caso.preparo?.some((p) => p.preparo === "modoTesteForaDaLista") === true;

    const desfazerPreparo = await aplicarPreparo(
      this.consulta,
      caso.preparo ?? [],
      { ambiente: "real" },
    );
    let desfazerLista: (() => Promise<void>) | null = null;
    try {
      // Em modo teste só respondem os números da lista: entra o do caso, salvo no caso do "fora da lista".
      if (this.modoDoAgente === "teste" && !modoTesteForaDaLista) {
        const lista = await lerParametro(this.consulta, "agente_whitelist");
        const atual = Array.isArray(lista) ? (lista as string[]) : [];
        await gravarParametro(this.consulta, "agente_whitelist", [
          ...atual,
          quem.e164,
        ]);
        desfazerLista = async () =>
          gravarParametro(this.consulta, "agente_whitelist", atual);
      }

      await this.limparCaptura();
      const resultados: ResultadoTurno[] = [];
      const estadoPorTurno: EstadoBanco[] = [];
      let cpfEnviado: string | null = null;
      let consumidos = 0;

      for (const [indice, turno] of caso.turnos.entries()) {
        const numeroDoTurno = indice + 1;
        const antes = (await this.capturados()).length;
        let enviado: string;

        if (ehAcao(turno)) {
          enviado = await this.executarAcao(turno, quem);
        } else {
          enviado = descreverTurno(turno);
          const trecho =
            turno.tipo === "texto"
              ? /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.exec(turno.texto)?.[0]
              : undefined;
          if (trecho) cpfEnviado = trecho;
          await this.enviarMensagem(caso, turno, quem, numeroDoTurno);
          await this.aguardar(
            quem,
            antes,
            this.debounceSegundos + this.amb.esperaSilencioSegundos,
          );
        }

        const todos = await this.capturados();
        const novos = todos.slice(consumidos);
        consumidos = todos.length;
        resultados.push({
          turno: numeroDoTurno,
          enviado,
          envios: novos.map((c, i) =>
            this.classificar(
              c,
              quem,
              numeroDoTurno,
              consumidos - novos.length + i + 1,
            ),
          ),
        });
        estadoPorTurno.push(await lerEstado(this.consulta, quem.e164));
      }

      const estadoFinal =
        estadoPorTurno[estadoPorTurno.length - 1] ??
        (await lerEstado(this.consulta, quem.e164));
      const referencia = await lerReferencia(this.consulta, {
        conversaId: estadoFinal.conversa?.id ?? null,
        telefone: quem.e164,
        cpfEnviado,
      });
      return {
        caso,
        turnos: resultados,
        estado: estadoFinal,
        estadoPorTurno,
        referencia,
      };
    } finally {
      if (desfazerLista) await desfazerLista();
      await desfazerPreparo();
    }
  }

  private async enviarMensagem(
    caso: Caso,
    turno: Extract<Turno, { tipo: string }>,
    quem: Interlocutora,
    numero: number,
  ): Promise<void> {
    const messageId = idDaMensagem(caso.id, numero);
    if (turno.tipo === "audio") {
      const corpo = turno.falharTranscricao
        ? { id: messageId, falhar: true }
        : { id: messageId, texto: turno.transcricao };
      const registro = await fetch(
        `${this.amb.appUrl}/api/teste/uazapi/transcricoes`,
        {
          method: "POST",
          headers: this.cabecalhos(),
          body: JSON.stringify(corpo),
        },
      );
      if (!registro.ok)
        throw new Error(
          `Falha ao registrar a transcrição simulada: HTTP ${registro.status}`,
        );
    }
    const payload = montarPayload(turno, {
      quem,
      instancia: this.amb.instancia,
      messageId,
    });
    const resposta = await fetch(this.amb.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resposta.ok) {
      throw new Error(
        `O webhook do fluxo 3 respondeu HTTP ${resposta.status}. Confira se o fluxo está ativo e se a URL é a de produção.`,
      );
    }
  }

  private async executarAcao(
    turno: Extract<Turno, { acao: string }>,
    quem: Interlocutora,
  ): Promise<string> {
    if (turno.acao !== "executarFollowup")
      return executarAcaoDeBanco(this.consulta, turno, quem.e164);
    const antes = (await this.capturados()).length;
    await this.consulta.linhas(sqlAgendarFollowup());
    // O gatilho de 30 minutos do fluxo 3 (entrada B) busca o follow-up devido.
    const limite = Date.now() + this.amb.esperaFollowupMinutos * 60_000;
    while (Date.now() < limite) {
      await dormir(Math.max(this.amb.intervaloSegundos * 1000, 1000));
      if ((await this.capturados()).length > antes) {
        await this.aguardar(quem, antes, 0);
        return "[o agendador do follow-up roda]";
      }
    }
    return "[o agendador do follow-up não rodou dentro do tempo]";
  }
}
