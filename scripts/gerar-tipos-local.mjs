#!/usr/bin/env node
/**
 * Gera src/lib/db/types.ts lendo o banco local por introspecção SQL, no
 * mesmo formato do `supabase gen types typescript` (tipo Database com os
 * schemas public e api: Tables com Row, Insert, Update e Relationships;
 * Views; Functions com Args e Returns; Enums; CompositeTypes; e os
 * utilitários Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes e
 * Constants no fim).
 *
 * Existe porque esta máquina não tem Docker, e `supabase gen types --local`
 * precisa do Supabase local rodando em contêiner. Com Docker de verdade,
 * use `pnpm db:types` (CLI oficial); os dois geram o mesmo formato, então o
 * código do app não muda quando um troca pelo outro.
 *
 * Uso (banco de supabase/sem-docker no ar, ver README dessa pasta):
 *   PGPORT=54350 pnpm db:types:local
 *
 * Variáveis: KZ_DB_URL (URL completa, tem prioridade) ou PGHOST (padrão
 * 127.0.0.1), PGPORT (padrão 54329, o do sem-docker), PGUSER (padrão
 * postgres), PGDATABASE (padrão kraamzorg). KZ_TIPOS_SAIDA muda o arquivo
 * de saída (padrão src/lib/db/types.ts). Nenhuma senha em arquivo: o
 * cluster local aceita o usuário postgres por conexão local.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCHEMAS = ["api", "public"];
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = resolve(RAIZ, process.env.KZ_TIPOS_SAIDA ?? "src/lib/db/types.ts");

const conexao = process.env.KZ_DB_URL
  ? { connectionString: process.env.KZ_DB_URL }
  : {
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 54329),
      user: process.env.PGUSER ?? "postgres",
      database: process.env.PGDATABASE ?? "kraamzorg",
    };

const cliente = new pg.Client(conexao);

// Mesmo mapeamento do postgres-meta (gerador da CLI do Supabase).
const PRIMITIVOS = {
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  oid: "number",
  money: "string",
  bytea: "string",
  bpchar: "string",
  varchar: "string",
  text: "string",
  citext: "string",
  name: "string",
  char: "string",
  uuid: "string",
  date: "string",
  time: "string",
  timetz: "string",
  timestamp: "string",
  timestamptz: "string",
  interval: "string",
  inet: "string",
  cidr: "string",
  macaddr: "string",
  tsvector: "unknown",
  tsquery: "unknown",
  vector: "string",
  json: "Json",
  jsonb: "Json",
  void: "undefined",
  record: "Record<string, unknown>",
  unknown: "unknown",
};

function ordenar(lista, chave) {
  return [...lista].sort((a, b) =>
    chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0,
  );
}

function nomeSeguro(nome) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(nome) ? nome : JSON.stringify(nome);
}

async function main() {
  await cliente.connect();

  const tipos = new Map();
  const { rows: linhasTipos } = await cliente.query(`
    select t.oid::int as oid, t.typname, n.nspname, t.typtype, t.typcategory,
           t.typelem::int as typelem, t.typbasetype::int as typbasetype,
           t.typrelid::int as typrelid
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
  `);
  for (const t of linhasTipos) tipos.set(t.oid, t);

  const { rows: enums } = await cliente.query(
    `
    select n.nspname as schema, t.typname as nome,
           array_agg(e.enumlabel::text order by e.enumsortorder) as valores
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = any($1)
    group by 1, 2
  `,
    [SCHEMAS],
  );

  const { rows: relacoes } = await cliente.query(
    `
    select c.oid::int as oid, n.nspname as schema, c.relname as nome, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any($1) and c.relkind in ('r', 'p', 'v', 'm', 'f')
  `,
    [SCHEMAS],
  );
  const relacaoPorOid = new Map(relacoes.map((r) => [r.oid, r]));

  const { rows: colunas } = await cliente.query(
    `
    select a.attrelid::int as relid, a.attname as nome, a.atttypid::int as tipo,
           a.attnotnull as nao_nulo, a.atthasdef as tem_padrao,
           a.attidentity as identidade, a.attgenerated as gerada, a.attnum
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any($1) and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.attnum > 0 and not a.attisdropped
  `,
    [SCHEMAS],
  );

  const { rows: chavesEstrangeiras } = await cliente.query(
    `
    select con.conname as nome, con.conrelid::int as relid, con.confrelid::int as refid,
           (select array_agg(a.attname::text order by k.ord) from unnest(con.conkey) with ordinality k(num, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.num) as colunas,
           (select array_agg(a.attname::text order by k.ord) from unnest(con.confkey) with ordinality k(num, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.num) as colunas_ref,
           exists (
             select 1 from pg_constraint u
             where u.conrelid = con.conrelid and u.contype in ('p', 'u')
               and (select array_agg(x order by x) from unnest(u.conkey) x)
                 = (select array_agg(x order by x) from unnest(con.conkey) x)
           ) as um_para_um
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f' and n.nspname = any($1)
  `,
    [SCHEMAS],
  );

  const { rows: funcoes } = await cliente.query(
    `
    select p.oid::int as oid, n.nspname as schema, p.proname as nome,
           p.prorettype::int as retorno, p.proretset as conjunto,
           coalesce(p.proallargtypes::int[], p.proargtypes::int[]) as tipos_args,
           p.proargmodes::text[] as modos, p.proargnames as nomes_args,
           p.pronargs as n_entrada, p.pronargdefaults as n_padrao
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = any($1) and p.prokind = 'f'
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
  `,
    [SCHEMAS],
  );

  const { rows: compostos } = await cliente.query(
    `
    select t.typname as nome, n.nspname as schema, t.typrelid::int as relid
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_class c on c.oid = t.typrelid
    where n.nspname = any($1) and t.typtype = 'c' and c.relkind = 'c'
  `,
    [SCHEMAS],
  );

  await cliente.end();

  const colunasPorRelacao = new Map();
  for (const c of colunas) {
    if (!colunasPorRelacao.has(c.relid)) colunasPorRelacao.set(c.relid, []);
    colunasPorRelacao.get(c.relid).push(c);
  }

  function tsTipo(oid) {
    const t = tipos.get(oid);
    if (!t) return "unknown";
    if (t.typtype === "e") {
      if (SCHEMAS.includes(t.nspname)) {
        return `Database[${JSON.stringify(t.nspname)}]["Enums"][${JSON.stringify(t.typname)}]`;
      }
      return "string";
    }
    if (t.typcategory === "A" && t.typelem) return `${envolver(tsTipo(t.typelem))}[]`;
    if (t.typtype === "d") return tsTipo(t.typbasetype);
    if (t.typtype === "c" && t.typrelid) {
      const rel = relacaoPorOid.get(t.typrelid);
      if (rel) {
        const grupo = rel.relkind === "v" || rel.relkind === "m" ? "Views" : "Tables";
        return `Database[${JSON.stringify(rel.schema)}][${JSON.stringify(grupo)}][${JSON.stringify(rel.nome)}]["Row"]`;
      }
      const composto = compostos.find((x) => x.relid === t.typrelid);
      if (composto) {
        return `Database[${JSON.stringify(composto.schema)}]["CompositeTypes"][${JSON.stringify(composto.nome)}]`;
      }
      return "Record<string, unknown>";
    }
    return PRIMITIVOS[t.typname] ?? "unknown";
  }

  function envolver(tipo) {
    return tipo.includes("|") ? `(${tipo})` : tipo;
  }

  const saida = [];
  const escrever = (linha = "") => saida.push(linha);

  escrever("// Gerado por scripts/gerar-tipos-local.mjs (pnpm db:types:local).");
  escrever("// Não edite à mão: rode o script de novo depois de cada migration.");
  escrever("// Mesmo formato do `supabase gen types typescript` (pnpm db:types).");
  escrever();
  escrever("export type Json =");
  escrever("  | string");
  escrever("  | number");
  escrever("  | boolean");
  escrever("  | null");
  escrever("  | { [key: string]: Json | undefined }");
  escrever("  | Json[]");
  escrever();
  escrever("export type Database = {");
  escrever("  // Permite instanciar o createClient com as opções certas do PostgREST.");
  escrever("  __InternalSupabase: {");
  escrever('    PostgrestVersion: "12"');
  escrever("  }");

  const vazio = (indent) => [`${indent}  [_ in never]: never`];

  for (const schema of SCHEMAS) {
    escrever(`  ${schema}: {`);

    // Tables
    const tabelas = ordenar(
      relacoes.filter((r) => r.schema === schema && ["r", "p", "f"].includes(r.relkind)),
      (r) => r.nome,
    );
    escrever("    Tables: {");
    if (tabelas.length === 0) vazio("    ").forEach((l) => escrever(l));
    for (const tabela of tabelas) {
      const cols = ordenar(colunasPorRelacao.get(tabela.oid) ?? [], (c) => c.nome);
      escrever(`      ${nomeSeguro(tabela.nome)}: {`);
      escrever("        Row: {");
      for (const c of cols) {
        const tipo = tsTipo(c.tipo);
        escrever(`          ${nomeSeguro(c.nome)}: ${c.nao_nulo ? tipo : `${tipo} | null`}`);
      }
      escrever("        }");
      escrever("        Insert: {");
      for (const c of cols) {
        const tipo = tsTipo(c.tipo);
        if (c.gerada === "s" || c.identidade === "a") {
          escrever(`          ${nomeSeguro(c.nome)}?: never`);
          continue;
        }
        const opcional = !c.nao_nulo || c.tem_padrao || c.identidade === "d";
        escrever(
          `          ${nomeSeguro(c.nome)}${opcional ? "?" : ""}: ${c.nao_nulo ? tipo : `${tipo} | null`}`,
        );
      }
      escrever("        }");
      escrever("        Update: {");
      for (const c of cols) {
        const tipo = tsTipo(c.tipo);
        if (c.gerada === "s" || c.identidade === "a") {
          escrever(`          ${nomeSeguro(c.nome)}?: never`);
          continue;
        }
        escrever(`          ${nomeSeguro(c.nome)}?: ${c.nao_nulo ? tipo : `${tipo} | null`}`);
      }
      escrever("        }");
      escreverRelacionamentos(tabela.oid, "        ");
      escrever("      }");
    }
    escrever("    }");

    // Views
    const views = ordenar(
      relacoes.filter((r) => r.schema === schema && ["v", "m"].includes(r.relkind)),
      (r) => r.nome,
    );
    escrever("    Views: {");
    if (views.length === 0) vazio("    ").forEach((l) => escrever(l));
    for (const view of views) {
      const cols = ordenar(colunasPorRelacao.get(view.oid) ?? [], (c) => c.nome);
      escrever(`      ${nomeSeguro(view.nome)}: {`);
      escrever("        Row: {");
      for (const c of cols) escrever(`          ${nomeSeguro(c.nome)}: ${tsTipo(c.tipo)} | null`);
      escrever("        }");
      escreverRelacionamentos(view.oid, "        ");
      escrever("      }");
    }
    escrever("    }");

    // Functions
    const doSchema = funcoes.filter((f) => f.schema === schema);
    const nomesFuncoes = [...new Set(doSchema.map((f) => f.nome))].sort();
    escrever("    Functions: {");
    if (nomesFuncoes.length === 0) vazio("    ").forEach((l) => escrever(l));
    for (const nome of nomesFuncoes) {
      const sobrecargas = doSchema.filter((f) => f.nome === nome);
      const descricoes = sobrecargas.map(descreverFuncao).filter(Boolean);
      if (descricoes.length === 0) continue;
      escrever(`      ${nomeSeguro(nome)}:`);
      descricoes.forEach((d, i) => {
        escrever(`        ${descricoes.length > 1 ? "| " : ""}{`);
        escrever(`          Args: ${d.args}`);
        escrever(`          Returns: ${d.retorno}`);
        escrever(`        }${i === descricoes.length - 1 ? "" : ""}`);
      });
    }
    escrever("    }");

    // Enums
    const enumsDoSchema = ordenar(
      enums.filter((e) => e.schema === schema),
      (e) => e.nome,
    );
    escrever("    Enums: {");
    if (enumsDoSchema.length === 0) vazio("    ").forEach((l) => escrever(l));
    for (const e of enumsDoSchema) {
      escrever(`      ${nomeSeguro(e.nome)}:`);
      e.valores.forEach((v) => escrever(`        | ${JSON.stringify(v)}`));
    }
    escrever("    }");

    // CompositeTypes
    const compostosDoSchema = ordenar(
      compostos.filter((c) => c.schema === schema),
      (c) => c.nome,
    );
    escrever("    CompositeTypes: {");
    if (compostosDoSchema.length === 0) vazio("    ").forEach((l) => escrever(l));
    for (const c of compostosDoSchema) {
      const cols = ordenar(colunasPorRelacao.get(c.relid) ?? [], (x) => x.nome);
      escrever(`      ${nomeSeguro(c.nome)}: {`);
      for (const col of cols) escrever(`        ${nomeSeguro(col.nome)}: ${tsTipo(col.tipo)} | null`);
      escrever("      }");
    }
    escrever("    }");

    escrever("  }");
  }
  escrever("}");
  escrever();
  escrever(UTILITARIOS);
  escrever();

  // Constants: listas dos enums, para validação (zod) e rótulos.
  escrever("export const Constants = {");
  for (const schema of SCHEMAS) {
    const enumsDoSchema = ordenar(
      enums.filter((e) => e.schema === schema),
      (e) => e.nome,
    );
    escrever(`  ${schema}: {`);
    escrever("    Enums: {");
    for (const e of enumsDoSchema) {
      escrever(`      ${nomeSeguro(e.nome)}: [`);
      e.valores.forEach((v) => escrever(`        ${JSON.stringify(v)},`));
      escrever("      ],");
    }
    escrever("    },");
    escrever("  },");
  }
  escrever("} as const");

  await writeFile(SAIDA, `${saida.join("\n")}\n`, "utf8");
  console.log(
    `tipos gerados em ${SAIDA}: ${relacoes.length} tabelas e views, ${funcoes.length} funções, ${enums.length} enums`,
  );

  function escreverRelacionamentos(relid, indent) {
    const fks = ordenar(
      chavesEstrangeiras.filter((f) => f.relid === relid && relacaoPorOid.has(f.refid)),
      (f) => f.nome,
    );
    if (fks.length === 0) {
      escrever(`${indent}Relationships: []`);
      return;
    }
    escrever(`${indent}Relationships: [`);
    for (const fk of fks) {
      const ref = relacaoPorOid.get(fk.refid);
      escrever(`${indent}  {`);
      escrever(`${indent}    foreignKeyName: ${JSON.stringify(fk.nome)}`);
      escrever(`${indent}    columns: [${fk.colunas.map((c) => JSON.stringify(c)).join(", ")}]`);
      escrever(`${indent}    isOneToOne: ${fk.um_para_um}`);
      escrever(`${indent}    referencedRelation: ${JSON.stringify(ref.nome)}`);
      escrever(`${indent}    referencedColumns: [${fk.colunas_ref.map((c) => JSON.stringify(c)).join(", ")}]`);
      escrever(`${indent}  },`);
    }
    escrever(`${indent}]`);
  }

  function descreverFuncao(f) {
    const tiposArgs = f.tipos_args ?? [];
    const modos = f.modos ?? tiposArgs.map(() => "i");
    const nomes = f.nomes_args ?? [];
    const entradas = [];
    const saidasTabela = [];
    tiposArgs.forEach((oid, i) => {
      const modo = modos[i];
      const nome = nomes[i];
      if (modo === "i" || modo === "b" || modo === "v") entradas.push({ oid, nome });
      if (modo === "t" || modo === "o" || modo === "b") saidasTabela.push({ oid, nome });
    });
    // Sem nome de argumento o PostgREST não consegue chamar por RPC.
    if (entradas.some((a) => !a.nome)) return null;

    const primeiraComPadrao = entradas.length - (f.n_padrao ?? 0);
    const args =
      entradas.length === 0
        ? "never"
        : `{ ${ordenar(
            entradas.map((a, i) => ({ ...a, opcional: i >= primeiraComPadrao })),
            (a) => a.nome,
          )
            .map((a) => `${nomeSeguro(a.nome)}${a.opcional ? "?" : ""}: ${tsTipo(a.oid)}`)
            .join("; ")} }`;

    let retorno;
    const temTabela = modos.includes("t");
    if (temTabela || (saidasTabela.length > 1 && modos.includes("o"))) {
      const campos = ordenar(saidasTabela, (s) => s.nome)
        .map((s) => `${nomeSeguro(s.nome)}: ${tsTipo(s.oid)}`)
        .join("; ");
      retorno = `{ ${campos} }${f.conjunto ? "[]" : ""}`;
    } else {
      const base = tsTipo(f.retorno);
      retorno = f.conjunto ? `${envolver(base)}[]` : base;
    }
    return { args, retorno };
  }
}

const UTILITARIOS = `type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never`;

main().catch(async (erro) => {
  console.error(`não foi possível gerar os tipos: ${erro.message}`);
  console.error(
    "Confira se o banco local está no ar (supabase/sem-docker/scripts/iniciar.sh) e a porta em PGPORT.",
  );
  try {
    await cliente.end();
  } catch {
    // conexão já fechada
  }
  process.exit(1);
});
