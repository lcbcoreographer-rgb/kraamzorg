#!/usr/bin/env node
// =============================================================================
// supabase/checar-seed.mjs
//
// P08 (PROMPTS.md v2) · PRD 16.3, CLAUDE.md ("Dado real nunca sai de
// produção")
//
// Node puro (sem dependência de pacote nenhum: não mexe em package.json,
// PROMPTS.md pediu explicitamente "não pnpm seed:check"). Lê
// supabase/seed.sql e falha (saída != 0) se aparecer:
//
//   1. Um telefone fora do padrão fictício "+5511900000" + 2 a 6 dígitos
//      (qualquer "+55" seguido de 10 a 13 dígitos que não bata com esse
//      prefixo é reprovado, esteja ele onde estiver no arquivo).
//   2. Um nome fora do padrão fictício nas colunas de identidade que o seed
//      escreve (familia.nome_exibicao, pessoa.nome, bebe.nome, medico.nome,
//      profissional.nome, perfil.nome, conversa.nome_whatsapp e
//      conversa.nome_contato_salvo): todo valor precisa conter a palavra
//      "Teste".
//
// Não é um parser de SQL genérico: reconhece só o formato que este projeto
// usa para escrever supabase/seed.sql ("insert into <tabela> (<colunas>)
// values (<tupla>), (<tupla>), ... ;", sem dollar-quoting). Isso é
// suficiente porque o arquivo é escrito por nós, nesse formato, de
// propósito.
//
// Uso: node supabase/checar-seed.mjs [caminho/para/seed.sql]
// Padrão: supabase/seed.sql, relativo à raiz do repositório.
// =============================================================================

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const CAMINHO_SEED = resolve(RAIZ, process.argv[2] ?? join('supabase', 'seed.sql'));

const REGEX_TELEFONE_QUALQUER = /\+55\d{10,13}/g;
const REGEX_TELEFONE_FICTICIO = /^\+5511900000\d{2,6}$/;
const PALAVRA_FICTICIA = 'Teste';

// tabela -> colunas de identidade a conferir (nome precisa conter "Teste")
const COLUNAS_DE_NOME = {
  familia: ['nome_exibicao'],
  pessoa: ['nome'],
  bebe: ['nome'],
  medico: ['nome'],
  profissional: ['nome'],
  perfil: ['nome'],
  conversa: ['nome_whatsapp', 'nome_contato_salvo'],
};

function lerArquivo(caminho) {
  try {
    return readFileSync(caminho, 'utf8');
  } catch (erro) {
    console.error(`checar-seed: não consegui ler ${caminho}: ${erro.message}`);
    process.exit(2);
  }
}

// Remove comentários de linha (-- até o fim da linha) e de bloco (/* ... */),
// preservando quebras de linha (para os números de linha do relatório
// continuarem batendo) e sem mexer em conteúdo dentro de string ('...').
function removerComentarios(sql) {
  let saida = '';
  let i = 0;
  let dentroString = false;
  while (i < sql.length) {
    const c = sql[i];
    if (dentroString) {
      saida += c;
      if (c === "'") {
        if (sql[i + 1] === "'") {
          saida += sql[i + 1];
          i += 2;
          continue;
        }
        dentroString = false;
      }
      i += 1;
      continue;
    }
    if (c === "'") {
      dentroString = true;
      saida += c;
      i += 1;
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
        if (sql[i] === '\n') saida += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    saida += c;
    i += 1;
  }
  return saida;
}

function numeroDaLinha(sql, posicao) {
  let n = 1;
  for (let i = 0; i < posicao && i < sql.length; i += 1) {
    if (sql[i] === '\n') n += 1;
  }
  return n;
}

// Divide um texto em itens de nível 0, separados por `separador`, sem
// quebrar parênteses, colchetes nem strings ('...', com '' como escape).
function dividirNivel0(texto, separador) {
  const itens = [];
  let atual = '';
  let profundidade = 0;
  let dentroString = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (dentroString) {
      atual += c;
      if (c === "'") {
        if (texto[i + 1] === "'") {
          atual += texto[i + 1];
          i += 1;
        } else {
          dentroString = false;
        }
      }
      continue;
    }
    if (c === "'") {
      dentroString = true;
      atual += c;
      continue;
    }
    if (c === '(' || c === '[') profundidade += 1;
    if (c === ')' || c === ']') profundidade -= 1;
    if (c === separador && profundidade === 0) {
      itens.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  if (atual.trim() !== '') itens.push(atual);
  return itens.map((s) => s.trim());
}

// Acha, a partir de `inicio`, cada grupo top-level "(...)" antes do ";" de
// nível 0 que fecha o INSERT. Devolve a lista de tuplas (texto de dentro dos
// parênteses) e a posição logo depois do ";".
function extrairTuplas(sql, inicio) {
  const tuplas = [];
  let i = inicio;
  let dentroString = false;
  while (i < sql.length) {
    const c = sql[i];
    if (dentroString) {
      if (c === "'") {
        if (sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        dentroString = false;
      }
      i += 1;
      continue;
    }
    if (c === "'") {
      dentroString = true;
      i += 1;
      continue;
    }
    if (c === ';') {
      return { tuplas, fim: i + 1 };
    }
    if (c === '(') {
      let profundidade = 1;
      let j = i + 1;
      let dentroString2 = false;
      while (j < sql.length && profundidade > 0) {
        const cj = sql[j];
        if (dentroString2) {
          if (cj === "'") {
            if (sql[j + 1] === "'") {
              j += 2;
              continue;
            }
            dentroString2 = false;
          }
          j += 1;
          continue;
        }
        if (cj === "'") {
          dentroString2 = true;
          j += 1;
          continue;
        }
        if (cj === '(') profundidade += 1;
        if (cj === ')') profundidade -= 1;
        j += 1;
      }
      tuplas.push(sql.slice(i + 1, j - 1));
      i = j;
      continue;
    }
    i += 1;
  }
  return { tuplas, fim: i };
}

// Extrai o texto de dentro de uma string SQL '...'; se o campo não for uma
// string literal (é null, um número, uma expressão), devolve null.
function comoTextoLiteral(campo) {
  const s = campo.trim();
  const m = /^'((?:[^']|'')*)'/.exec(s);
  if (!m) return null;
  return m[1].replaceAll("''", "'");
}

function checarSeed(caminho) {
  const original = lerArquivo(caminho);
  const sql = removerComentarios(original);
  const problemas = [];

  // --- 1. Telefones fora do padrão, em qualquer lugar do arquivo ----------
  for (const m of sql.matchAll(REGEX_TELEFONE_QUALQUER)) {
    const telefone = m[0];
    if (!REGEX_TELEFONE_FICTICIO.test(telefone)) {
      problemas.push(
        `linha ${numeroDaLinha(sql, m.index)}: telefone "${telefone}" fora do padrão fictício ` +
          `(esperado +5511900000 seguido de 2 a 6 dígitos)`,
      );
    }
  }

  // --- 2. Nomes fora do padrão, nas colunas de identidade ------------------
  const regexInsert = /insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(([^)]*)\)\s*values\s*/gi;
  let m;
  while ((m = regexInsert.exec(sql)) !== null) {
    const tabela = m[1].split('.').pop().toLowerCase();
    const colunasAlvo = COLUNAS_DE_NOME[tabela];
    if (!colunasAlvo) continue;

    const colunas = m[2].split(',').map((c) => c.trim().toLowerCase());
    const indices = colunasAlvo
      .map((col) => colunas.indexOf(col))
      .filter((idx) => idx !== -1);
    if (indices.length === 0) continue;

    const { tuplas } = extrairTuplas(sql, regexInsert.lastIndex);
    for (const tupla of tuplas) {
      const campos = dividirNivel0(tupla, ',');
      for (const idx of indices) {
        if (idx >= campos.length) continue;
        const valor = comoTextoLiteral(campos[idx]);
        if (valor === null) continue; // não é literal de texto (ex.: subquery), não checamos aqui
        if (!valor.includes(PALAVRA_FICTICIA)) {
          const linha = numeroDaLinha(sql, m.index);
          problemas.push(
            `perto da linha ${linha}: ${tabela}.${colunasAlvo[indices.indexOf(idx)]} = "${valor}" ` +
              `não contém a palavra "${PALAVRA_FICTICIA}" (nome fora do padrão fictício)`,
          );
        }
      }
    }
  }

  return problemas;
}

const problemas = checarSeed(CAMINHO_SEED);

if (problemas.length > 0) {
  console.error(`checar-seed: ${problemas.length} problema(s) em ${CAMINHO_SEED}:\n`);
  for (const p of problemas) console.error(`  - ${p}`);
  console.error('\nSó dado sintético entra no seed: nome sempre com "Teste", telefone sempre +5511900000XX (CLAUDE.md).');
  process.exit(1);
}

console.log(`checar-seed: ok, nenhum nome nem telefone fora do padrão fictício em ${CAMINHO_SEED}.`);
