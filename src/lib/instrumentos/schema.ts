import { z } from "zod";

/**
 * Esquema dos instrumentos clínicos versionados (PRD 6.5 `instrumento`, 9,
 * P34 item 1). A definição JSON de cada versão (DOC 1 a DOC 4) mora em
 * `supabase/dados/instrumentos/*.json` e entra no banco por migration de
 * dados; o formulário da enfermeira e da coordenação é gerado a partir
 * dela (src/components/instrumentos).
 *
 * Regra que este esquema protege (PRD 9, CLAUDE.md "Clínico"): o
 * desenvolvedor não cria, não remove e não renomeia campo clínico. O
 * esquema só descreve a forma; o conteúdo vem do instrumento aprovado.
 * Item com `[clínico]` no PRD entra com `clinico: true` e o texto da
 * pendência em `nota_clinica`.
 */

// ---------------------------------------------------------------------------
// Identificadores
// ---------------------------------------------------------------------------

/** Código do instrumento, igual a `instrumento.codigo` (PRD 6.5). */
export const codigoInstrumento = z.enum([
  "DOC1_ENTREVISTA",
  "DOC2_CHECKLIST",
  "DOC3_ALERTAS",
  "DOC4_MAMADA",
]);
export type CodigoInstrumento = z.infer<typeof codigoInstrumento>;

/** Versão no formato do PRD 6.5: 'v1-2026-09'. */
export const versaoInstrumento = z
  .string()
  .regex(/^v\d+-\d{4}-\d{2}$/, "versão no formato v1-2026-09");

/** Id de campo ou de opção: snake_case sem acento. */
const idTecnico = z
  .string()
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "id em snake_case, sem acento");

/**
 * Id de bloco: o número do PRD ("1", "2.1", "3.2"), a letra do PRD ("A" a
 * "H", DOC 1) ou um nome em snake_case ("resumo").
 */
const idBloco = z
  .string()
  .regex(
    /^(\d+(\.\d+)*|[A-Z]|[a-z0-9]+(_[a-z0-9]+)*)$/,
    "bloco numerado (2.1), com letra (A) ou em snake_case",
  );

/** Código de regra do DOC 3 (PRD 9.3): PU-01, SM-04, RN-10, AM-06. */
export const codigoRegra = z
  .string()
  .regex(/^(PU|SM|RN|AM)-\d{2}$/, "regra do DOC 3 (PU-01 a AM-06)");

/** Enum `severidade` do PRD 6.0. */
export const severidade = z.enum([
  "imediato",
  "prioritario",
  "atencao",
  "informativo",
]);
export type Severidade = z.infer<typeof severidade>;

// ---------------------------------------------------------------------------
// Condição (para aparecer e para disparar alerta)
// ---------------------------------------------------------------------------

const valorComparavel = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Condição simples sobre um campo ou sobre o contexto do formulário.
 * `campo` é o caminho "bloco.campo" ("2.1.temperatura", "E.amamentou_anteriormente").
 * `contexto` é uma chave passada pela tela (ex: "ultimo_dia").
 * Em bloco repetido por bebê, o caminho aponta para o mesmo bebê.
 */
const alvoCondicao = z.union([
  z.object({ campo: z.string().min(3), contexto: z.undefined().optional() }),
  z.object({ contexto: idTecnico, campo: z.undefined().optional() }),
]);

const condicaoComparacao = z.object({
  operador: z.enum(["=", "!=", ">", ">=", "<", "<="]),
  valor: valorComparavel,
});
const condicaoLista = z.object({
  operador: z.enum(["em", "fora_de"]),
  valores: z.array(valorComparavel).min(1),
});
const condicaoFaixa = z.object({
  operador: z.enum(["entre", "fora_da_faixa"]),
  min: z.number(),
  max: z.number(),
});
const condicaoRespondido = z.object({
  operador: z.enum(["respondido", "sem_resposta"]),
});

const condicaoSimples = z.intersection(
  alvoCondicao,
  z.union([
    condicaoComparacao,
    condicaoLista,
    condicaoFaixa,
    condicaoRespondido,
  ]),
);

export type CondicaoSimples = z.infer<typeof condicaoSimples>;
export type Condicao =
  CondicaoSimples | { todas: Condicao[] } | { alguma: Condicao[] };

export const condicao: z.ZodType<Condicao> = z.lazy(() =>
  z.union([
    condicaoSimples,
    z.object({ todas: z.array(condicao).min(1) }),
    z.object({ alguma: z.array(condicao).min(1) }),
  ]),
);

// ---------------------------------------------------------------------------
// Regra de alerta ligada ao campo
// ---------------------------------------------------------------------------

/**
 * Ligação entre um campo e as regras do DOC 3 (PRD 9.2 coluna "Alerta" e
 * Apêndice B). A regra em si (descrição, conduta, se está ativa) mora em
 * `regra_alerta`; aqui fica o que o instrumento diz sobre o campo.
 * `condicao` ausente quer dizer que o PRD não dá um corte avaliável no
 * próprio campo (fica para o P40 e para a Edilaine).
 */
export const alertaLigado = z.object({
  /** O texto do PRD, como está ("≥ 7", "se não", "sem diurese ≥ 4 h"). */
  descricao: z.string().min(1),
  /** Regras do DOC 3 ligadas. Vazio quando o PRD diz "sem regra no DOC 3". */
  regras: z.array(codigoRegra),
  severidade: severidade.optional(),
  condicao: condicao.optional(),
  /** O que acontece além da faixa na tela (PRD 9.2 e Apêndice B). */
  acao: z.enum(["abrir_ocorrencia", "abrir_seletor_doc3"]).optional(),
  /** "Fonte: DOC 3", "Fonte: v4.0" (Apêndice B). */
  fonte: z.string().optional(),
  clinico: z.boolean().optional(),
  nota_clinica: z.string().optional(),
});
export type AlertaLigado = z.infer<typeof alertaLigado>;

// ---------------------------------------------------------------------------
// Opção
// ---------------------------------------------------------------------------

export const opcao = z.object({
  valor: idTecnico,
  rotulo: z.string().min(1),
  ajuda: z.string().optional(),
  /** Em múltipla escolha, marcar esta desmarca as outras (e vice-versa). */
  exclusiva: z.boolean().optional(),
  clinico: z.boolean().optional(),
  nota_clinica: z.string().optional(),
});
export type Opcao = z.infer<typeof opcao>;

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

const campoBase = z.object({
  id: idTecnico,
  rotulo: z.string().min(1),
  ajuda: z.string().optional(),
  obrigatorio: z.boolean().optional(),
  aparece_se: condicao.optional(),
  alertas: z.array(alertaLigado).optional(),
  /** Para onde o valor vai além da ficha (ex: tabela `medico`, PRD 9.1 bloco H). */
  destino: z.string().optional(),
  clinico: z.boolean().optional(),
  nota_clinica: z.string().optional(),
});

const campoTexto = campoBase.extend({
  tipo: z.literal("texto"),
  teclado: z.enum(["texto", "telefone"]).optional(),
  /**
   * Permite responder "não consegui" com justificativa no lugar do valor
   * (PRD 9.2, contato do pediatra no último dia).
   */
  justificar_ausencia: z
    .object({
      rotulo_acao: z.string().min(1),
      rotulo_justificativa: z.string().min(1),
    })
    .optional(),
});

const campoTextoLongo = campoBase.extend({
  tipo: z.literal("texto_longo"),
});

const campoSimNao = campoBase.extend({
  tipo: z.literal("sim_nao"),
});

const campoSimNaoTexto = campoBase.extend({
  tipo: z.literal("sim_nao_texto"),
  /**
   * Rótulo do texto complementar ("Quem?", "Local", "Estado"). Ausente
   * quando o PRD só diz "+ texto"; a tela usa um rótulo genérico.
   */
  rotulo_texto: z.string().min(1).optional(),
  /** Quando o texto aparece. Padrão: quando a resposta é sim. */
  texto_quando: z.enum(["sim", "nao", "sempre"]).optional(),
});

const campoEscala = campoBase.extend({
  tipo: z.literal("escala"),
  min: z.number().int().min(0),
  max: z.number().int().max(10),
  /** Descrição de cada ponto (DOC 4: NTS de 0 a 5). */
  pontos: z
    .array(z.object({ valor: z.number().int(), rotulo: z.string().min(1) }))
    .optional(),
  /** Classificação que acompanha a nota (PRD 9.2, LATCH: ótimo, regular, ruim). */
  complemento: z
    .object({ rotulo: z.string().min(1), opcoes: z.array(opcao).min(2) })
    .optional(),
});

const campoOpcaoUnica = campoBase.extend({
  tipo: z.literal("opcao_unica"),
  opcoes: z.array(opcao).min(2),
});

const campoMultipla = campoBase.extend({
  tipo: z.literal("multipla"),
  opcoes: z.array(opcao).min(2),
  /** A ordem em que a pessoa marca é a resposta (PRD 9.1: período em ordem). */
  ordenada: z.boolean().optional(),
});

const campoNumero = campoBase.extend({
  tipo: z.literal("numero"),
  unidade: z.string().optional(),
  /** Faixa aceita para conferir digitação. Sem faixa, nada é recusado. */
  faixa: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional(),
  casas_decimais: z.number().int().min(0).max(3).optional(),
  /** Número em partes (pressão arterial: sistólica e diastólica). */
  partes: z
    .array(z.object({ id: idTecnico, rotulo: z.string().min(1) }))
    .min(2)
    .optional(),
});

const campoData = campoBase.extend({
  tipo: z.literal("data"),
  preenchimento: z.enum(["ao_abrir", "ao_concluir"]).optional(),
});

const campoHora = campoBase.extend({
  tipo: z.literal("hora"),
  /** Preenchida automaticamente e editável (PRD 9.1: hora de início e de término). */
  preenchimento: z.enum(["ao_abrir", "ao_concluir"]).optional(),
});

/**
 * Campo que o sistema preenche e a pessoa não digita: coletador (vem do
 * login, PRD 9.1), assinatura (PRD 9.2) e idade gestacional, que nunca é
 * gravada e sempre é calculada da DPP (CLAUDE.md, PRD 6.10).
 */
const campoAutomatico = campoBase.extend({
  tipo: z.literal("automatico"),
  origem: z.enum(["login", "assinatura", "idade_gestacional_calculada"]),
});

export const campo = z.discriminatedUnion("tipo", [
  campoTexto,
  campoTextoLongo,
  campoSimNao,
  campoSimNaoTexto,
  campoEscala,
  campoOpcaoUnica,
  campoMultipla,
  campoNumero,
  campoData,
  campoHora,
  campoAutomatico,
]);
export type Campo = z.infer<typeof campo>;
export type TipoCampo = Campo["tipo"];

// ---------------------------------------------------------------------------
// Bloco
// ---------------------------------------------------------------------------

export const bloco = z.object({
  id: idBloco,
  titulo: z.string().min(1),
  ajuda: z.string().optional(),
  /** Bloco do recém-nascido: repete por bebê em gemelares (PRD 9.2). */
  repete_por_bebe: z.boolean().optional(),
  aparece_se: condicao.optional(),
  /** DOC 4: campo do DOC 2 que este bloco apoia ("DOC2_CHECKLIST:2.8.latch"). */
  apoia_campo: z.string().optional(),
  clinico: z.boolean().optional(),
  nota_clinica: z.string().optional(),
  campos: z.array(campo).min(1),
});
export type Bloco = z.infer<typeof bloco>;

// ---------------------------------------------------------------------------
// Catálogo do DOC 3 (sinais de alerta e acionamento médico)
// ---------------------------------------------------------------------------

export const catalogoAlertas = z.object({
  severidades: z
    .array(z.object({ id: severidade, significado: z.string().min(1) }))
    .min(1),
  grupos: z
    .array(
      z.object({
        id: idTecnico,
        titulo: z.string().min(1),
        condutas: z
          .array(z.object({ severidade, texto: z.string().min(1) }))
          .min(1),
        observacao: z.string().optional(),
        sinais: z
          .array(
            z.object({
              codigo: codigoRegra,
              descricao: z.string().min(1),
              severidade,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  notificacao: z
    .array(z.object({ severidade, texto: z.string().min(1) }))
    .optional(),
});
export type CatalogoAlertas = z.infer<typeof catalogoAlertas>;

// ---------------------------------------------------------------------------
// Definição do instrumento
// ---------------------------------------------------------------------------

const definicaoBase = z.object({
  codigo: codigoInstrumento,
  versao: versaoInstrumento,
  titulo: z.string().min(1),
  /** De onde veio o conteúdo ("PRD v4.2, 9.2"). */
  fonte: z.string().min(1),
  descricao: z.string().optional(),
  /** Campos preenchidos uma vez por acompanhamento (PRD 9.2, cabeçalho). */
  cabecalho: z.array(bloco).optional(),
  blocos: z.array(bloco).min(1),
  catalogo_alertas: catalogoAlertas.optional(),
});

/** Caminhos "bloco.campo" de todos os campos de uma lista de blocos. */
function caminhosDe(blocos: Bloco[]): Set<string> {
  const caminhos = new Set<string>();
  for (const b of blocos) {
    for (const c of b.campos) caminhos.add(`${b.id}.${c.id}`);
  }
  return caminhos;
}

/** Caminhos de campo citados numa condição (recursivo). */
export function camposDaCondicao(cond: Condicao): string[] {
  if ("todas" in cond) return cond.todas.flatMap(camposDaCondicao);
  if ("alguma" in cond) return cond.alguma.flatMap(camposDaCondicao);
  return typeof cond.campo === "string" ? [cond.campo] : [];
}

export const definicaoInstrumento = definicaoBase.superRefine((def, ctx) => {
  const todos = [...(def.cabecalho ?? []), ...def.blocos];

  const idsBloco = new Set<string>();
  for (const b of todos) {
    if (idsBloco.has(b.id)) {
      ctx.addIssue({
        code: "custom",
        message: `bloco repetido: ${b.id}`,
        path: ["blocos"],
      });
    }
    idsBloco.add(b.id);

    const idsCampo = new Set<string>();
    for (const c of b.campos) {
      if (idsCampo.has(c.id)) {
        ctx.addIssue({
          code: "custom",
          message: `campo repetido no bloco ${b.id}: ${c.id}`,
          path: ["blocos"],
        });
      }
      idsCampo.add(c.id);
      if ("opcoes" in c) {
        const valores = new Set(c.opcoes.map((o) => o.valor));
        if (valores.size !== c.opcoes.length) {
          ctx.addIssue({
            code: "custom",
            message: `opção repetida em ${b.id}.${c.id}`,
            path: ["blocos"],
          });
        }
      }
      if (c.tipo === "escala" && c.min >= c.max) {
        ctx.addIssue({
          code: "custom",
          message: `escala sem amplitude em ${b.id}.${c.id}`,
          path: ["blocos"],
        });
      }
    }
  }

  // Toda condição (de aparecer ou de alerta) aponta para um campo que existe.
  const caminhos = caminhosDe(todos);
  const conferir = (cond: Condicao | undefined, onde: string) => {
    if (!cond) return;
    for (const alvo of camposDaCondicao(cond)) {
      if (!caminhos.has(alvo)) {
        ctx.addIssue({
          code: "custom",
          message: `condição em ${onde} cita campo inexistente: ${alvo}`,
          path: ["blocos"],
        });
      }
    }
  };
  for (const b of todos) {
    conferir(b.aparece_se, b.id);
    for (const c of b.campos) {
      conferir(c.aparece_se, `${b.id}.${c.id}`);
      for (const a of c.alertas ?? []) conferir(a.condicao, `${b.id}.${c.id}`);
    }
  }
});

export type DefinicaoInstrumento = z.infer<typeof definicaoInstrumento>;

/**
 * Lê e valida uma definição (do banco ou do JSON em supabase/dados).
 * Lança erro com o caminho do problema quando a definição não confere.
 */
export function lerDefinicao(json: unknown): DefinicaoInstrumento {
  return definicaoInstrumento.parse(json);
}
