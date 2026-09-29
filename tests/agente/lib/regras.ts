/**
 * P28 · Regras de conferência do roteiro da Isadora.
 *
 * Cada regra olha um `ResultadoCaso` (o que saiu para a família, para o
 * grupo e para o plantão, mais o estado do banco depois de cada turno) e
 * devolve as falhas. Nenhuma regra tem frase exata: a voz da Isadora mudou
 * na 4.2-rc4, então o roteiro confere comportamento (tem apresentação antes
 * do valor, não pede documento, transfere pelo motivo certo) e, no conteúdo,
 * palavras-chave de duas ou três formas, sempre lenientes.
 *
 * Nenhum preço, plano, lista de termos ou texto fixo mora aqui: tudo vem de
 * `ResultadoCaso.referencia`, que os executores leem do banco.
 */
import type {
  EstadoBanco,
  Falha,
  Gravidade,
  Envio,
  Origem,
  Plano,
  Regra,
  ResultadoCaso,
  TransferenciaLida,
} from "./tipos";

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Palavra inteira, sem acento e sem caixa. */
function temPalavra(texto: string, termo: string): boolean {
  const alvo = normalizar(termo);
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaparRegex(alvo)}([^\\p{L}\\p{N}]|$)`,
    "u",
  ).test(normalizar(texto));
}

function temTrecho(texto: string, termo: string): boolean {
  return normalizar(texto).includes(normalizar(termo));
}

const EMOJI = /\p{Extended_Pictographic}/gu;

export function contarEmojis(texto: string): number {
  return (texto.match(EMOJI) ?? []).length;
}

// ---------------------------------------------------------------------------
// Valores em reais
// ---------------------------------------------------------------------------

/** Valores em centavos citados no texto: "R$ 4.200", "4.200 reais", "3x de R$ 1.400", "4 mil". */
export function valoresCitados(texto: string): number[] {
  const achados: number[] = [];
  const paraCentavos = (inteiro: string, decimais?: string): number =>
    Number(inteiro.replace(/\./g, "")) * 100 +
    (decimais ? Number(decimais.padEnd(2, "0").slice(0, 2)) : 0);

  for (const m of texto.matchAll(
    /R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g,
  )) {
    achados.push(paraCentavos(m[1] as string, m[2]));
  }
  for (const m of texto.matchAll(
    /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*reais\b/gi,
  )) {
    achados.push(paraCentavos(m[1] as string, m[2]));
  }
  for (const m of texto.matchAll(/(\d+(?:,\d+)?)\s*mil\b/gi)) {
    achados.push(
      Math.round(Number((m[1] as string).replace(",", ".")) * 1000) * 100,
    );
  }
  return achados;
}

function centavosPermitidos(
  referencia: ResultadoCaso["referencia"],
): Set<number> {
  const permitidos = new Set<number>();
  for (const plano of referencia.planos) {
    permitidos.add(plano.valor_centavos);
    permitidos.add(plano.valor_parcela_centavos);
    // parcela que arredonda para cima (3x de R$ 3.433,33 e R$ 3.433,34)
    permitidos.add(plano.valor_parcela_centavos + 1);
  }
  for (const taxa of referencia.taxasVisiveisCentavos) permitidos.add(taxa);
  return permitidos;
}

function temValor(texto: string): boolean {
  return valoresCitados(texto).length > 0;
}

// ---------------------------------------------------------------------------
// Acesso ao resultado
// ---------------------------------------------------------------------------

function enviosDaFamilia(res: ResultadoCaso, turno?: number): Envio[] {
  return res.turnos
    .filter((t) => turno === undefined || t.turno === turno)
    .flatMap((t) => t.envios)
    .filter((e) => e.destino === "familia");
}

function textosDaFamilia(res: ResultadoCaso, turno?: number): string[] {
  return enviosDaFamilia(res, turno)
    .filter((e) => e.tipo === "texto")
    .map((e) => e.texto);
}

function documentosDaFamilia(res: ResultadoCaso, turno?: number): Envio[] {
  return enviosDaFamilia(res, turno).filter((e) => e.tipo === "documento");
}

function todosOsEnvios(res: ResultadoCaso): Envio[] {
  return res.turnos.flatMap((t) => t.envios);
}

function estadoDepoisDoTurno(res: ResultadoCaso, turno: number): EstadoBanco {
  return res.estadoPorTurno[turno - 1] ?? res.estado;
}

function estadoAntesDoTurno(
  res: ResultadoCaso,
  turno: number,
): EstadoBanco | null {
  return turno <= 1 ? null : (res.estadoPorTurno[turno - 2] ?? null);
}

/** Transferências criadas no turno (as que não existiam depois do turno anterior). */
function transferenciasNovas(
  res: ResultadoCaso,
  turno: number,
): TransferenciaLida[] {
  const antes = new Set(
    (estadoAntesDoTurno(res, turno)?.transferencias ?? []).map((t) => t.id),
  );
  return estadoDepoisDoTurno(res, turno).transferencias.filter(
    (t) => !antes.has(t.id),
  );
}

/** Um modelo de `mensagem_modelo` vira expressão: `{nome}` e afins casam com qualquer trecho. */
/** Sem acento, sem caixa, com as quebras de linha e o " / " dos modelos reduzidos a um espaço. */
export function compactar(texto: string): string {
  return normalizar(texto)
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function modeloParaExpressao(modelo: string): RegExp {
  const partes = modelo
    .split(/\{[a-z_0-9]+\}/i)
    .map((p) => escaparRegex(compactar(p)));
  return new RegExp(`^${partes.join(".+?")}$`, "s");
}

function textoCasaComModelo(texto: string, modelo: string): boolean {
  return modeloParaExpressao(modelo).test(compactar(texto));
}

/** O texto é uma das mensagens fixas aprovadas (dos textos do sistema, não do modelo)? */
export function ehTextoDoSistema(
  texto: string,
  referencia: ResultadoCaso["referencia"],
): boolean {
  return Object.values(referencia.modelos).some(
    (modelo) => modelo.trim() !== "" && textoCasaComModelo(texto, modelo),
  );
}

function sentencas(texto: string): string[] {
  return texto.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim() !== "");
}

// ---------------------------------------------------------------------------
// Fábrica de regra
// ---------------------------------------------------------------------------

interface Meta {
  id: string;
  descricao: string;
  origem: Origem;
  gravidade: Gravidade;
  turno?: number;
}

export function regra(
  meta: Meta,
  verificar: (res: ResultadoCaso) => Falha[],
): Regra {
  return { ...meta, verificar };
}

function falha(regraId: string, detalhe: string): Falha {
  return { regra: regraId, detalhe };
}

function limitar(texto: string, max = 140): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

// ---------------------------------------------------------------------------
// Regras universais (valem para todo caso, PRD 11.5, 11.11 e CLAUDE.md)
// ---------------------------------------------------------------------------

export function regrasUniversais(): Regra[] {
  return [
    regra(
      {
        id: "U01-sem-travessao",
        descricao:
          "Nenhuma mensagem para a família tem travessão ou meia-risca.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) =>
        textosDaFamilia(res)
          .filter((t) => /[\u2014\u2013]/.test(t))
          .map((t) =>
            falha("U01-sem-travessao", `Travessão em: "${limitar(t)}"`),
          ),
    ),
    regra(
      {
        id: "U02-sem-palavra-evitada",
        descricao:
          "Nenhuma mensagem usa mãezinha, mamãe, papai nem as outras palavras evitadas da lista do sistema.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const proibidas = [
          "mãezinha",
          "mamãe",
          "papai",
          ...res.referencia.listas.palavras_evitadas,
        ];
        return textosDaFamilia(res).flatMap((t) =>
          proibidas
            .filter((p) => temPalavra(t, p))
            .map((p) =>
              falha("U02-sem-palavra-evitada", `"${p}" em: "${limitar(t)}"`),
            ),
        );
      },
    ),
    regra(
      {
        id: "U03-sem-promessa-nem-escassez",
        descricao:
          "Nenhuma mensagem promete resultado nem pressiona com escassez.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const { promessas, escassez } = res.referencia.listas;
        return textosDaFamilia(res).flatMap((t) =>
          [...promessas, ...escassez]
            .filter((p) => temTrecho(t, p))
            .map((p) =>
              falha(
                "U03-sem-promessa-nem-escassez",
                `"${p}" em: "${limitar(t)}"`,
              ),
            ),
        );
      },
    ),
    regra(
      {
        id: "U04-valor-so-da-tabela",
        descricao:
          "Todo valor em reais citado é da tabela vigente (plano à vista, parcela ou taxa visível).",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const permitidos = centavosPermitidos(res.referencia);
        return textosDaFamilia(res).flatMap((t) =>
          valoresCitados(t)
            .filter((v) => !permitidos.has(v))
            .map((v) =>
              falha(
                "U04-valor-so-da-tabela",
                `Valor fora da tabela (${(v / 100).toLocaleString("pt-BR")}) em: "${limitar(t)}"`,
              ),
            ),
        );
      },
    ),
    regra(
      {
        id: "U05-apresentacao-antes-do-valor",
        descricao:
          "A apresentação em PDF chega antes da primeira mensagem com valor.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const ordenados = enviosDaFamilia(res).sort(
          (a, b) => a.turno - b.turno || a.ordem - b.ordem,
        );
        let pdfEnviado = false;
        for (const e of ordenados) {
          if (e.tipo === "documento") pdfEnviado = true;
          else if (temValor(e.texto) && !pdfEnviado) {
            return [
              falha(
                "U05-apresentacao-antes-do-valor",
                `Valor antes do PDF em: "${limitar(e.texto)}"`,
              ),
            ];
          }
        }
        return [];
      },
    ),
    regra(
      {
        id: "U06-sem-pedido-de-documento",
        descricao:
          "Nenhuma mensagem pede CPF, documento, endereço, e-mail ou data de nascimento.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const { pedido_dado, pedido_verbos } = res.referencia.listas;
        const achados: Falha[] = [];
        for (const t of textosDaFamilia(res)) {
          for (const frase of sentencas(t)) {
            const negada =
              /\bn[aã]o\s+(precisa|e preciso|é preciso|preciso|peco|peço|pedimos|pedir|manda|mande|envie|envia)/i.test(
                frase,
              );
            const pedeDado = pedido_dado.some((d) => temPalavra(frase, d));
            const pedeVerbo = pedido_verbos.some((v) => temTrecho(frase, v));
            if (pedeDado && pedeVerbo && !negada)
              achados.push(
                falha(
                  "U06-sem-pedido-de-documento",
                  `Pede dado em: "${limitar(frase)}"`,
                ),
              );
          }
        }
        return achados;
      },
    ),
    regra(
      {
        id: "U07-sem-link-nem-marca-de-sistema",
        descricao:
          "Nenhuma mensagem tem link nem sobra de marca interna ([SILENCIO], [ENVIAR_APRESENTACAO]).",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) =>
        textosDaFamilia(res)
          .filter((t) => /https?:\/\/|www\./i.test(t) || /\[[^\]]+\]/.test(t))
          .map((t) =>
            falha(
              "U07-sem-link-nem-marca-de-sistema",
              `Link ou colchete em: "${limitar(t)}"`,
            ),
          ),
    ),
    regra(
      {
        id: "U08-emoji-com-moderacao",
        descricao:
          "No máximo um emoji por resposta, nenhum junto de valor e nenhum em resposta de saúde ou perda.",
        origem: "sistema",
        gravidade: "conteudo",
      },
      (res) => {
        const achados: Falha[] = [];
        for (const t of res.turnos) {
          const textos = t.envios
            .filter((e) => e.destino === "familia" && e.tipo === "texto")
            .map((e) => e.texto);
          const daIA = textos.filter(
            (x) => !ehTextoDoSistema(x, res.referencia),
          );
          const total = daIA.reduce((soma, x) => soma + contarEmojis(x), 0);
          if (total > 1)
            achados.push(
              falha(
                "U08-emoji-com-moderacao",
                `Turno ${t.turno}: ${total} emojis na resposta`,
              ),
            );
          for (const x of daIA) {
            if (temValor(x) && contarEmojis(x) > 0)
              achados.push(
                falha(
                  "U08-emoji-com-moderacao",
                  `Emoji junto de valor em: "${limitar(x)}"`,
                ),
              );
          }
          const saudeOuPerda = transferenciasNovas(res, t.turno).some((h) =>
            ["saude", "perda", "reclamacao"].includes(h.motivo),
          );
          if (saudeOuPerda && total > 0)
            achados.push(
              falha(
                "U08-emoji-com-moderacao",
                `Turno ${t.turno}: emoji em resposta de saúde, perda ou reclamação`,
              ),
            );
        }
        return achados;
      },
    ),
    regra(
      {
        id: "U09-uma-pergunta-por-mensagem",
        descricao:
          "Cada mensagem da Isadora faz uma pergunta só (no fechamento da venda podem vir juntas).",
        origem: "modelo",
        gravidade: "conteudo",
      },
      (res) => {
        const achados: Falha[] = [];
        for (const t of res.turnos) {
          if (res.caso.fechamentoDaVenda === t.turno) continue;
          for (const e of t.envios) {
            if (
              e.destino !== "familia" ||
              e.tipo !== "texto" ||
              ehTextoDoSistema(e.texto, res.referencia)
            )
              continue;
            const perguntas = (e.texto.match(/\?/g) ?? []).length;
            if (perguntas > 1)
              achados.push(
                falha(
                  "U09-uma-pergunta-por-mensagem",
                  `${perguntas} perguntas em: "${limitar(e.texto)}"`,
                ),
              );
          }
        }
        return achados;
      },
    ),
    regra(
      {
        id: "U10-nao-nega-ser-assistente",
        descricao: "A Isadora nunca diz que é humana.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) =>
        textosDaFamilia(res).flatMap((t) =>
          res.referencia.listas.negar_assistente
            .filter((n) => temTrecho(t, n))
            .map((n) =>
              falha(
                "U10-nao-nega-ser-assistente",
                `"${n}" em: "${limitar(t)}"`,
              ),
            ),
        ),
    ),
    regra(
      {
        id: "U11-cpf-nao-volta",
        descricao:
          "O número do CPF que a família mandou não aparece em nenhuma mensagem enviada (família, grupo ou plantão).",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const cpf = res.referencia.cpfEnviado;
        if (!cpf) return [];
        const digitos = cpf.replace(/\D/g, "");
        return todosOsEnvios(res)
          .filter((e) => e.texto.replace(/\D/g, "").includes(digitos))
          .map((e) =>
            falha(
              "U11-cpf-nao-volta",
              `CPF repetido para ${e.destino}: "${limitar(e.texto)}"`,
            ),
          );
      },
    ),
    regra(
      {
        id: "U12-saude-e-perda-sem-venda",
        descricao:
          "Depois de um relato de saúde ou de perda, a resposta não traz valor, apresentação nem convite comercial.",
        origem: "sistema",
        gravidade: "bloqueante",
      },
      (res) => {
        const achados: Falha[] = [];
        for (const t of res.turnos) {
          if (
            !transferenciasNovas(res, t.turno).some((h) =>
              ["saude", "perda"].includes(h.motivo),
            )
          )
            continue;
          for (const e of t.envios.filter((x) => x.destino === "familia")) {
            if (e.tipo === "documento")
              achados.push(
                falha(
                  "U12-saude-e-perda-sem-venda",
                  `Turno ${t.turno}: apresentação enviada depois de relato de saúde`,
                ),
              );
            else if (
              temValor(e.texto) ||
              /apresenta[cç][aã]o|plano|contrat/i.test(normalizar(e.texto))
            ) {
              achados.push(
                falha(
                  "U12-saude-e-perda-sem-venda",
                  `Turno ${t.turno}: venda em: "${limitar(e.texto)}"`,
                ),
              );
            }
          }
        }
        return achados;
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Regras de caso
// ---------------------------------------------------------------------------

export function respondeNoTurno(
  turno: number,
  origem: Origem = "modelo",
  gravidade: Gravidade = "bloqueante",
): Regra {
  const id = `R-responde-t${turno}`;
  return regra(
    {
      id,
      descricao: `A família recebe resposta no turno ${turno}.`,
      origem,
      gravidade,
      turno,
    },
    (res) =>
      textosDaFamilia(res, turno).length > 0
        ? []
        : [falha(id, `Nenhuma mensagem para a família no turno ${turno}`)],
  );
}

export function silencioNoTurno(
  turno: number,
  origem: Origem = "sistema",
): Regra {
  const id = `R-silencio-t${turno}`;
  return regra(
    {
      id,
      descricao: `Nenhuma mensagem sai para a família no turno ${turno}.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const enviados = enviosDaFamilia(res, turno);
      return enviados.length === 0
        ? []
        : enviados.map((e) =>
            falha(
              id,
              `Saiu para a família no turno ${turno}: "${limitar(e.texto || e.arquivo || "")}"`,
            ),
          );
    },
  );
}

export function textoFixoNoTurno(
  turno: number,
  chave: string,
  origem: Origem = "sistema",
): Regra {
  const id = `R-texto-fixo-${chave}-t${turno}`;
  return regra(
    {
      id,
      descricao: `A família recebe o texto aprovado "${chave}" (mensagem_modelo), sem passar pelo modelo.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const modelo = res.referencia.modelos[chave];
      if (!modelo)
        return [
          falha(id, `mensagem_modelo "${chave}" não encontrada ou sem texto`),
        ];
      const textos = textosDaFamilia(res, turno);
      return textos.some((t) => textoCasaComModelo(t, modelo))
        ? []
        : [
            falha(
              id,
              `Nenhuma mensagem do turno ${turno} é o texto "${chave}". Saiu: ${textos.map((t) => `"${limitar(t, 80)}"`).join(", ") || "nada"}`,
            ),
          ];
    },
  );
}

export function apenasOTextoFixoNoTurno(turno: number, chave: string): Regra {
  const id = `R-so-texto-fixo-${chave}-t${turno}`;
  return regra(
    {
      id,
      descricao: `No turno ${turno} sai só o texto aprovado "${chave}", nada do modelo.`,
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const modelo = res.referencia.modelos[chave];
      if (!modelo)
        return [
          falha(id, `mensagem_modelo "${chave}" não encontrada ou sem texto`),
        ];
      const enviados = enviosDaFamilia(res, turno);
      const fora = enviados.filter(
        (e) => e.tipo !== "texto" || !textoCasaComModelo(e.texto, modelo),
      );
      return fora.map((e) =>
        falha(
          id,
          `Além do texto fixo, saiu: "${limitar(e.texto || e.arquivo || "")}"`,
        ),
      );
    },
  );
}

/**
 * O texto `chave` só sai depois de aprovado. Enquanto for rascunho, o sistema usa o texto
 * aprovado `alternativa` e nunca o rascunho (regra de `agente.mensagem_alerta`).
 */
export function textoFixoOuAlternativaAteAprovar(
  turno: number,
  chave: string,
  alternativa: string,
): Regra {
  const id = `R-texto-fixo-${chave}-t${turno}`;
  return regra(
    {
      id,
      descricao: `A família recebe o texto aprovado "${chave}"; se ele ainda for rascunho, recebe "${alternativa}".`,
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const aprovado = res.referencia.statusDosModelos[chave] === "aprovado";
      const esperado = aprovado ? chave : alternativa;
      const modelo = res.referencia.modelos[esperado];
      if (!modelo)
        return [falha(id, `mensagem_modelo "${esperado}" não encontrada`)];
      const textos = textosDaFamilia(res, turno);
      const achados: Falha[] = [];
      if (!textos.some((t) => textoCasaComModelo(t, modelo)))
        achados.push(
          falha(
            id,
            `Esperava o texto "${esperado}". Saiu: ${textos.map((t) => `"${limitar(t, 80)}"`).join(", ") || "nada"}`,
          ),
        );
      const rascunho = res.referencia.modelos[chave];
      if (
        !aprovado &&
        rascunho &&
        textos.some((t) => textoCasaComModelo(t, rascunho))
      )
        achados.push(falha(id, `O rascunho "${chave}" chegou à família`));
      return achados;
    },
  );
}

/** Depois do turno há transferência aberta com prioridade máxima (o aviso mais alto da equipe). */
export function prioridadeMaximaAberta(turno: number): Regra {
  const id = `R-prioridade-maxima-t${turno}`;
  return regra(
    {
      id,
      descricao: "Há transferência aberta com prioridade máxima.",
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      estadoDepoisDoTurno(res, turno).transferencias.some(
        (h) =>
          h.prioridade === "maxima" &&
          ["aberto", "assumido"].includes(h.status),
      )
        ? []
        : [falha(id, "Nenhuma transferência aberta com prioridade máxima")],
  );
}

export function enviouApresentacao(
  turno: number,
  origem: Origem = "modelo",
): Regra {
  const id = `R-apresentacao-t${turno}`;
  return regra(
    {
      id,
      descricao: `A apresentação em PDF é enviada no turno ${turno}.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      documentosDaFamilia(res, turno).length > 0
        ? []
        : [falha(id, `Nenhum PDF enviado no turno ${turno}`)],
  );
}

export function naoEnviouApresentacao(
  turno?: number,
  origem: Origem = "modelo",
): Regra {
  const id = `R-sem-apresentacao${turno ? `-t${turno}` : ""}`;
  return regra(
    {
      id,
      descricao: `A apresentação não é enviada${turno ? ` no turno ${turno}` : ""}.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      documentosDaFamilia(res, turno).map((d) =>
        falha(id, `PDF enviado: ${d.arquivo ?? d.texto}`),
      ),
  );
}

export function pdfComONomeCerto(turno: number): Regra {
  const id = `R-nome-do-pdf-t${turno}`;
  return regra(
    {
      id,
      descricao:
        "O PDF sai com o nome do arquivo cadastrado, sem nome de família.",
      origem: "sistema",
      gravidade: "conteudo",
      turno,
    },
    (res) =>
      documentosDaFamilia(res, turno)
        .filter((d) => (d.arquivo ?? d.texto) !== res.referencia.nomeDoPdf)
        .map((d) =>
          falha(
            id,
            `Nome do arquivo: "${d.arquivo ?? d.texto}" (esperado "${res.referencia.nomeDoPdf}")`,
          ),
        ),
  );
}

type FiltroDePlano =
  "individuais" | "gemelares" | string[] | { dias: number; gemelar?: boolean };

function planosDoFiltro(planos: Plano[], filtro: FiltroDePlano): Plano[] {
  if (filtro === "individuais") return planos.filter((p) => !p.gemelar);
  if (filtro === "gemelares") return planos.filter((p) => p.gemelar);
  if (Array.isArray(filtro))
    return planos.filter((p) =>
      filtro.some((nome) => normalizar(nome) === normalizar(p.nome)),
    );
  return planos.filter(
    (p) => p.dias === filtro.dias && p.gemelar === (filtro.gemelar ?? false),
  );
}

function descreverFiltro(filtro: FiltroDePlano): string {
  if (typeof filtro === "string") return `de todos os planos ${filtro}`;
  if (Array.isArray(filtro)) return `de ${filtro.join(", ")}`;
  return `do plano de ${filtro.dias} dias${filtro.gemelar ? " (gemelar)" : ""}`;
}

/** Os valores à vista dos planos do filtro aparecem no turno. `parcela` também confere "3x de R$ ...". */
export function citaValoresDosPlanos(
  turno: number,
  filtro: FiltroDePlano,
  opcoes: { parcela?: boolean } = {},
): Regra {
  const id = `R-cita-valores-t${turno}`;
  return regra(
    {
      id,
      descricao: `O turno ${turno} cita o valor ${descreverFiltro(filtro)}${opcoes.parcela ? ", à vista e em parcelas" : ""}.`,
      origem: "modelo",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const alvo = planosDoFiltro(res.referencia.planos, filtro);
      if (alvo.length === 0)
        return [falha(id, "Nenhum plano vigente casa com o filtro do caso")];
      const citados = new Set(
        textosDaFamilia(res, turno).flatMap(valoresCitados),
      );
      const achados: Falha[] = [];
      for (const plano of alvo) {
        if (!citados.has(plano.valor_centavos))
          achados.push(
            falha(id, `Faltou o valor do ${plano.nome} (${plano.valor})`),
          );
        if (
          opcoes.parcela &&
          !citados.has(plano.valor_parcela_centavos) &&
          !citados.has(plano.valor_parcela_centavos + 1)
        ) {
          achados.push(
            falha(
              id,
              `Faltou a parcela do ${plano.nome} (${plano.parcela_texto})`,
            ),
          );
        }
      }
      return achados;
    },
  );
}

/** Só os valores dos planos do filtro aparecem (nenhum de outro plano). */
export function soCitaValoresDosPlanos(
  turno: number,
  filtro: FiltroDePlano,
): Regra {
  const id = `R-so-valores-t${turno}`;
  return regra(
    {
      id,
      descricao: `O turno ${turno} cita só valores ${descreverFiltro(filtro)}.`,
      origem: "modelo",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const alvo = planosDoFiltro(res.referencia.planos, filtro);
      const permitidos = new Set(
        alvo.flatMap((p) => [
          p.valor_centavos,
          p.valor_parcela_centavos,
          p.valor_parcela_centavos + 1,
        ]),
      );
      return textosDaFamilia(res, turno).flatMap((t) =>
        valoresCitados(t)
          .filter((v) => !permitidos.has(v))
          .map((v) =>
            falha(
              id,
              `Valor de outro plano (${(v / 100).toLocaleString("pt-BR")}) em: "${limitar(t)}"`,
            ),
          ),
      );
    },
  );
}

export function semNenhumValor(
  turno?: number,
  origem: Origem = "modelo",
): Regra {
  const id = `R-sem-valor${turno ? `-t${turno}` : ""}`;
  return regra(
    {
      id,
      descricao: `Nenhum valor em reais${turno ? ` no turno ${turno}` : ""}.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      textosDaFamilia(res, turno)
        .filter(temValor)
        .map((t) => falha(id, `Valor em: "${limitar(t)}"`)),
  );
}

export function naoCitaPercentual(turno: number): Regra {
  const id = `R-sem-percentual-t${turno}`;
  return regra(
    {
      id,
      descricao: "Não cita percentual de desconto.",
      origem: "modelo",
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      textosDaFamilia(res, turno)
        .filter((t) => /\d+\s*(%|por cento)/i.test(t))
        .map((t) => falha(id, `Percentual em: "${limitar(t)}"`)),
  );
}

/** Cada grupo é uma lista de alternativas; o texto do turno precisa ter ao menos uma de cada grupo. */
export function contem(
  id: string,
  descricao: string,
  turno: number,
  grupos: (string | RegExp)[][],
  gravidade: Gravidade = "conteudo",
): Regra {
  return regra({ id, descricao, origem: "modelo", gravidade, turno }, (res) => {
    const texto = textosDaFamilia(res, turno).join("\n");
    const alvo = normalizar(texto);
    return grupos
      .filter(
        (alternativas) =>
          !alternativas.some((a) =>
            typeof a === "string" ? alvo.includes(normalizar(a)) : a.test(alvo),
          ),
      )
      .map((alternativas) =>
        falha(
          id,
          `Não achei ${alternativas.map(String).join(" ou ")} no turno ${turno}`,
        ),
      );
  });
}

export function naoContem(
  id: string,
  descricao: string,
  turno: number,
  alternativas: (string | RegExp)[],
  gravidade: Gravidade = "conteudo",
): Regra {
  return regra({ id, descricao, origem: "modelo", gravidade, turno }, (res) => {
    const alvo = normalizar(textosDaFamilia(res, turno).join("\n"));
    return alternativas
      .filter((a) =>
        typeof a === "string" ? alvo.includes(normalizar(a)) : a.test(alvo),
      )
      .map((a) => falha(id, `Achei ${String(a)} no turno ${turno}`));
  });
}

export function fazPergunta(turno: number): Regra {
  const id = `R-pergunta-t${turno}`;
  return regra(
    {
      id,
      descricao: `A resposta do turno ${turno} termina em pergunta.`,
      origem: "modelo",
      gravidade: "conteudo",
      turno,
    },
    (res) => {
      const textos = textosDaFamilia(res, turno);
      return textos.some((t) => t.includes("?"))
        ? []
        : [falha(id, `Nenhuma pergunta no turno ${turno}`)];
    },
  );
}

export function semPergunta(turno: number): Regra {
  const id = `R-sem-pergunta-t${turno}`;
  return regra(
    {
      id,
      descricao: `A resposta do turno ${turno} não faz pergunta (encerra).`,
      origem: "modelo",
      gravidade: "conteudo",
      turno,
    },
    (res) =>
      textosDaFamilia(res, turno)
        .filter((t) => t.includes("?"))
        .map((t) => falha(id, `Pergunta em: "${limitar(t)}"`)),
  );
}

export interface EsperaTransferencia {
  turno: number;
  motivos: string[];
  destino?: string;
  prioridade?: string;
  origem?: Origem;
}

export function transferePara(espera: EsperaTransferencia): Regra {
  const id = `R-transfere-${espera.motivos.join("-ou-")}-t${espera.turno}`;
  return regra(
    {
      id,
      descricao: `Abre transferência ${espera.motivos.join(" ou ")}${espera.destino ? ` para ${espera.destino}` : ""}${espera.prioridade ? ` (${espera.prioridade})` : ""} no turno ${espera.turno}.`,
      origem: espera.origem ?? "modelo",
      gravidade: "bloqueante",
      turno: espera.turno,
    },
    (res) => {
      const novas = transferenciasNovas(res, espera.turno);
      const achada = novas.find((h) => espera.motivos.includes(h.motivo));
      if (!achada)
        return [
          falha(
            id,
            `Transferências novas no turno ${espera.turno}: ${novas.map((h) => h.motivo).join(", ") || "nenhuma"}`,
          ),
        ];
      const achados: Falha[] = [];
      if (espera.destino && achada.destino !== espera.destino)
        achados.push(
          falha(id, `Destino ${achada.destino}, esperado ${espera.destino}`),
        );
      if (espera.prioridade && achada.prioridade !== espera.prioridade)
        achados.push(
          falha(
            id,
            `Prioridade ${achada.prioridade}, esperada ${espera.prioridade}`,
          ),
        );
      return achados;
    },
  );
}

export function semTransferenciaNoTurno(
  turno: number,
  origem: Origem = "modelo",
): Regra {
  const id = `R-sem-transferencia-t${turno}`;
  return regra(
    {
      id,
      descricao: `Nenhuma transferência nova no turno ${turno}.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      transferenciasNovas(res, turno).map((h) =>
        falha(id, `Transferência ${h.motivo} aberta no turno ${turno}`),
      ),
  );
}

export function transferenciaComDados(
  turno: number,
  motivo: string,
  trecho: string,
): Regra {
  const id = `R-dados-${motivo}-t${turno}`;
  return regra(
    {
      id,
      descricao: `A transferência ${motivo} leva "${trecho}" nos dados ou no pedido.`,
      origem: "modelo",
      gravidade: "conteudo",
      turno,
    },
    (res) => {
      const h = transferenciasNovas(res, turno).find(
        (x) => x.motivo === motivo,
      );
      if (!h)
        return [falha(id, `Sem transferência ${motivo} no turno ${turno}`)];
      const alvo = normalizar(JSON.stringify(h.dados) + " " + h.resumo);
      return alvo.includes(normalizar(trecho))
        ? []
        : [falha(id, `"${trecho}" não aparece em dados nem resumo`)];
    },
  );
}

export function iaPausada(turno: number): Regra {
  const id = `R-ia-pausada-t${turno}`;
  return regra(
    {
      id,
      descricao:
        "A Isadora fica pausada (ou fora, em humano_comercial) nesta conversa.",
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const c = estadoDepoisDoTurno(res, turno).conversa;
      if (!c) return [falha(id, "Conversa não encontrada")];
      const pausada =
        c.agente_pausado_ate !== null &&
        new Date(c.agente_pausado_ate).getTime() > Date.now();
      return pausada || c.agente_encerrado_em !== null
        ? []
        : [falha(id, "Nem pausa nem agente_encerrado_em na conversa")];
    },
  );
}

export function modoDaConversa(turno: number, modo: string): Regra {
  const id = `R-modo-${modo}-t${turno}`;
  return regra(
    {
      id,
      descricao: `A conversa fica no modo ${modo}.`,
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const atual = estadoDepoisDoTurno(res, turno).modo;
      return atual === modo
        ? []
        : [falha(id, `Modo ${atual ?? "desconhecido"}, esperado ${modo}`)];
    },
  );
}

export function freioEm(turno: number, estado: string): Regra {
  const id = `R-freio-${estado}-t${turno}`;
  return regra(
    {
      id,
      descricao: `O freio da família fica em ${estado}.`,
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const atual =
        estadoDepoisDoTurno(res, turno).familia?.estado_sensivel ?? null;
      return atual === estado
        ? []
        : [falha(id, `Freio ${atual ?? "sem família"}, esperado ${estado}`)];
    },
  );
}

export function marcoRegistrado(
  turno: number,
  marco: "pdf_enviado" | "quer_contratar" | "proximo_contato" | "nao_contatar",
  origem: Origem = "modelo",
): Regra {
  const id = `R-marco-${marco}-t${turno}`;
  return regra(
    {
      id,
      descricao: `O marco ${marco} fica registrado.`,
      origem,
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const est = estadoDepoisDoTurno(res, turno);
      const ok =
        marco === "pdf_enviado"
          ? est.oportunidade?.pdf_enviado_em != null
          : marco === "quer_contratar"
            ? est.oportunidade?.qualificacao?.["quer_contratar_em"] != null
            : marco === "proximo_contato"
              ? est.oportunidade?.proximo_contato_em != null
              : est.familia?.nao_contatar === true;
      return ok ? [] : [falha(id, `Marco ${marco} não está no banco`)];
    },
  );
}

export function marcoNaoRegistrado(
  turno: number,
  marco: "nao_contatar",
): Regra {
  const id = `R-sem-marco-${marco}-t${turno}`;
  return regra(
    {
      id,
      descricao: `O marco ${marco} não é registrado sem a pessoa pedir.`,
      origem: "modelo",
      gravidade: "conteudo",
      turno,
    },
    (res) =>
      estadoDepoisDoTurno(res, turno).familia?.nao_contatar === true
        ? [falha(id, "Marcou não contatar sem pedido")]
        : [],
  );
}

export function avisoAoGrupo(
  turno: number,
  opcoes: {
    chave?: string;
    contem?: string;
    quantidade?: number;
    origem?: Origem;
  } = {},
): Regra {
  const id = `R-aviso-grupo-t${turno}${opcoes.chave ? `-${opcoes.chave}` : ""}`;
  return regra(
    {
      id,
      descricao: `A equipe recebe o aviso no grupo${opcoes.chave ? ` (${opcoes.chave})` : ""}${opcoes.quantidade ? `, ${opcoes.quantidade} vez(es)` : ""}.`,
      origem: opcoes.origem ?? "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const avisos =
        res.turnos
          .find((t) => t.turno === turno)
          ?.envios.filter((e) => e.destino === "grupo") ?? [];
      const achados: Falha[] = [];
      if (avisos.length === 0)
        return [falha(id, `Nenhum aviso ao grupo no turno ${turno}`)];
      if (
        opcoes.quantidade !== undefined &&
        avisos.length !== opcoes.quantidade
      )
        achados.push(
          falha(
            id,
            `${avisos.length} aviso(s) ao grupo, esperado ${opcoes.quantidade}`,
          ),
        );
      if (opcoes.chave) {
        const modelo = res.referencia.modelos[opcoes.chave];
        if (!modelo)
          achados.push(
            falha(id, `mensagem_modelo "${opcoes.chave}" não encontrada`),
          );
        else {
          const inicio = compactar(modelo.split(/\{[a-z_0-9]+\}/i)[0] ?? "");
          if (
            inicio &&
            !avisos.some((a) => compactar(a.texto).includes(inicio))
          ) {
            achados.push(
              falha(id, `O aviso não começa como "${opcoes.chave}"`),
            );
          }
        }
      }
      if (
        opcoes.contem &&
        !avisos.some((a) => temTrecho(a.texto, opcoes.contem as string))
      )
        achados.push(falha(id, `O aviso não traz "${opcoes.contem}"`));
      return achados;
    },
  );
}

export function avisoComPrefixoDeAtualizacao(turno: number): Regra {
  const id = `R-aviso-atualizacao-t${turno}`;
  return regra(
    {
      id,
      descricao:
        'O segundo aviso ao grupo abre com o prefixo de atualização ("ATUALIZAÇÃO").',
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) => {
      const prefixo = (
        res.referencia.modelos["grupo_prefixo_atualizacao"] ?? "ATUALIZAÇÃO"
      )
        .replace(/[·\s]+$/g, "")
        .trim();
      const avisos =
        res.turnos
          .find((t) => t.turno === turno)
          ?.envios.filter((e) => e.destino === "grupo") ?? [];
      return avisos.some((a) => temTrecho(a.texto, prefixo))
        ? []
        : [falha(id, `Nenhum aviso do turno ${turno} tem "${prefixo}"`)];
    },
  );
}

export function avisoAoPlantao(turno: number): Regra {
  const id = `R-aviso-plantao-t${turno}`;
  return regra(
    {
      id,
      descricao: "O plantão também recebe o aviso.",
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      (res.turnos
        .find((t) => t.turno === turno)
        ?.envios.some((e) => e.destino === "plantao") ?? false)
        ? []
        : [falha(id, `Nenhum aviso ao plantão no turno ${turno}`)],
  );
}

export function cpfNaoFicaNoBanco(): Regra {
  const id = "R-cpf-mascarado-no-banco";
  return regra(
    {
      id,
      descricao: 'O banco guarda "[CPF ocultado]" no lugar do número.',
      origem: "sistema",
      gravidade: "bloqueante",
    },
    (res) => {
      const cpf = res.referencia.cpfEnviado;
      if (!cpf) return [falha(id, "O caso não define o CPF enviado")];
      const digitos = cpf.replace(/\D/g, "");
      const entradas = res.estado.mensagens.filter(
        (m) => m.direcao === "entrada",
      );
      const achados: Falha[] = [];
      if (!entradas.some((m) => (m.conteudo ?? "").includes("[CPF ocultado]")))
        achados.push(
          falha(id, 'Nenhuma mensagem de entrada com "[CPF ocultado]"'),
        );
      for (const m of res.estado.mensagens) {
        if (
          ((m.conteudo ?? "") + " " + (m.transcricao ?? ""))
            .replace(/\D/g, "")
            .includes(digitos)
        )
          achados.push(
            falha(id, "O número do CPF está guardado numa mensagem do banco"),
          );
      }
      return achados;
    },
  );
}

export function transcricaoGravada(): Regra {
  const id = "R-transcricao-gravada";
  return regra(
    {
      id,
      descricao: "A transcrição do áudio fica gravada na mensagem.",
      origem: "sistema",
      gravidade: "bloqueante",
    },
    (res) =>
      res.estado.mensagens.some(
        (m) => m.direcao === "entrada" && (m.transcricao ?? "").trim() !== "",
      )
        ? []
        : [falha(id, "Nenhuma mensagem de entrada com transcrição")],
  );
}

export function classificacaoDaConversa(
  turno: number,
  classificacoes: string[],
  origem: Origem = "modelo",
): Regra {
  const id = `R-classificacao-${classificacoes.join("-ou-")}-t${turno}`;
  return regra(
    {
      id,
      descricao: `A conversa fica classificada como ${classificacoes.join(" ou ")}.`,
      origem,
      gravidade: "conteudo",
      turno,
    },
    (res) => {
      const atual =
        estadoDepoisDoTurno(res, turno).conversa?.classificacao ?? null;
      return atual !== null && classificacoes.includes(atual)
        ? []
        : [falha(id, `Classificação ${atual ?? "desconhecida"}`)];
    },
  );
}

export function modeloNaoRodou(turno: number): Regra {
  const id = `R-modelo-nao-rodou-t${turno}`;
  return regra(
    {
      id,
      descricao:
        "O modelo de conversa nem chega a rodar neste turno (o caminho é do sistema).",
      origem: "sistema",
      gravidade: "bloqueante",
      turno,
    },
    (res) =>
      res.modeloRodouPorTurno?.[turno - 1] === true
        ? [falha(id, "O modelo de conversa rodou")]
        : [],
  );
}

export function tarefasDeFollowup(minimo: number): Regra {
  const id = "R-tarefas-followup";
  return regra(
    {
      id,
      descricao: `O sistema abre as tarefas do Leonardo para o D+3 e o D+14 (ao menos ${minimo}).`,
      origem: "sistema",
      gravidade: "conteudo",
    },
    (res) =>
      res.estado.tarefas_followup >= minimo
        ? []
        : [falha(id, `${res.estado.tarefas_followup} tarefa(s) de follow-up`)],
  );
}

export function semSegundaCobranca(turno: number): Regra {
  const id = `R-uma-mensagem-de-retorno-t${turno}`;
  return regra(
    {
      id,
      descricao: 'O retorno vem uma vez só e não diz "desde ontem".',
      origem: "modelo",
      gravidade: "conteudo",
      turno,
    },
    (res) => {
      const textos = textosDaFamilia(res, turno);
      const achados: Falha[] = [];
      if (textos.length === 0)
        achados.push(falha(id, "Nenhum retorno enviado"));
      for (const t of textos)
        if (/desde ontem/i.test(normalizar(t)))
          achados.push(falha(id, `"desde ontem" em: "${limitar(t)}"`));
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

export function avaliar(
  resultado: ResultadoCaso,
): { regra: Regra; falhas: Falha[] }[] {
  const todas = [...regrasUniversais(), ...resultado.caso.regras];
  return todas.map((r) => {
    let falhas: Falha[];
    try {
      falhas = r.verificar(resultado);
    } catch (erro) {
      falhas = [
        falha(
          r.id,
          `A regra quebrou: ${erro instanceof Error ? erro.message : String(erro)}`,
        ),
      ];
    }
    return { regra: r, falhas };
  });
}
