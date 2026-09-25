#!/usr/bin/env node
// =============================================================================
// scripts/baixar-municipios.mjs
//
// P08 (PROMPTS.md) · PRD 3.3 e 6.1 (tabela `municipio`)
//
// Gera supabase/dados/municipios_ibge.csv com a lista de municípios do IBGE
// e a respectiva região geográfica intermediária (divisão vigente desde
// 2017), usada por `privado` e pelo agente para responder "confirmar" a um
// município fora da tabela `cidade` que fica na mesma região intermediária
// de uma praça atendida (PRD 3.3).
//
// Node puro (sem dependência de pacote), duas camadas:
//
//   1. API de localidades do IBGE (https://servicodados.ibge.gov.br), download
//      direto. É a fonte oficial e cobre os 5570 municípios do país.
//   2. Se a rede não deixar (API bloqueada, como nesta máquina em 25/09/2026:
//      a tentativa devolveu erro de rede antes mesmo de qualquer resposta
//      HTTP), cai para uma lista compilada à mão, só com os municípios mais
//      prováveis de aparecer no atendimento: a Grande São Paulo (região
//      intermediária de São Paulo) e a região de Londrina (região
//      intermediária de Londrina), citados no PRD 3.3 ("Osasco, Taboão da
//      Serra ou Cambé"). NÃO é a lista completa do IBGE — é um subconjunto
//      documentado, para o sistema não ficar sem tabela `municipio` nenhuma
//      enquanto a rede desta máquina não libera a API. Os códigos e a região
//      intermediária de cada linha vêm do conhecimento geral sobre a divisão
//      do IBGE, não de um download conferido nesta sessão: antes de produção,
//      rode este script numa rede que alcance o IBGE e substitua o CSV pela
//      saída real da camada 1 (o script avisa no console qual camada gerou
//      o arquivo, e o cabeçalho do CSV também registra a origem).
//
// Uso:
//   node scripts/baixar-municipios.mjs
//   node scripts/baixar-municipios.mjs --uf=SP,PR   (default: todo o Brasil,
//                                                     camada 1; ignorado na
//                                                     camada 2, que já é um
//                                                     subconjunto fixo)
//
// Saída: supabase/dados/municipios_ibge.csv, colunas
//   codigo_ibge,nome,uf,regiao_intermediaria
// (mesmas colunas e nomes da tabela `municipio`, PRD 6.1).
// =============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const CSV_SAIDA = join(RAIZ, "supabase", "dados", "municipios_ibge.csv");

// Endpoint oficial: devolve todos os municípios do Brasil já com a árvore de
// região imediata → região intermediária (mesoregião antiga, substituída em
// 2017). Um único GET grande (~5570 linhas), por isso um timeout generoso.
const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

const TIMEOUT_MS = 15_000;

// -----------------------------------------------------------------------------
// Camada 2: subconjunto compilado à mão (ver aviso no cabeçalho do arquivo).
//
// Região intermediária de São Paulo: núcleo da Grande São Paulo (ABCD,
// Alto Tietê, oeste e norte metropolitano). Região intermediária de
// Londrina: municípios do entorno imediato citados no PRD 3.3 e vizinhos
// próximos. As praças já atendidas (São Paulo capital, Alphaville, Granja
// Viana/Cotia, ABC, Londrina, Apucarana, Arapongas) já são linhas de
// `cidade`, não de `municipio` (PRD 6.1: municipio é para o que fica FORA
// de `cidade`) — por isso não se repetem aqui.
// -----------------------------------------------------------------------------
const FALLBACK = [
  // --- Região Geográfica Intermediária de São Paulo -------------------------
  [3534401, "Osasco", "SP"],
  [3552205, "Taboão da Serra", "SP"],
  [3518800, "Guarulhos", "SP"],
  [3513801, "Diadema", "SP"],
  [3529401, "Mauá", "SP"],
  [3510609, "Carapicuíba", "SP"],
  [3522208, "Itapevi", "SP"],
  [3524303, "Jandira", "SP"],
  [3515004, "Embu das Artes", "SP"],
  [3509502, "Cajamar", "SP"],
  [3552502, "Suzano", "SP"],
  [3530607, "Mogi das Cruzes", "SP"],
  [3523107, "Itaquaquecetuba", "SP"],
  [3538907, "Poá", "SP"],
  [3515103, "Ferraz de Vasconcelos", "SP"],
  [3503208, "Arujá", "SP"],
  [3516309, "Franco da Rocha", "SP"],
  [3509007, "Caieiras", "SP"],
  [3516408, "Francisco Morato", "SP"],
  [3527801, "Mairiporã", "SP"],
  [3543303, "Ribeirão Pires", "SP"],
  [3543832, "Rio Grande da Serra", "SP"],
  // --- Região Geográfica Intermediária de Londrina ---------------------------
  [4104808, "Cambé", "PR"],
  [4111506, "Ibiporã", "PR"],
  [4121901, "Rolândia", "PR"],
  [4112108, "Jataizinho", "PR"],
  [4127882, "Tamarana", "PR"],
  [4124400, "Sertanópolis", "PR"],
  [4102554, "Bela Vista do Paraíso", "PR"],
  [4101408, "Assaí", "PR"],
].map(([codigo_ibge, nome, uf]) => ({
  codigo_ibge,
  nome,
  uf,
  regiao_intermediaria: uf === "SP" ? "São Paulo" : "Londrina",
}));

function csvEscapar(valor) {
  const texto = String(valor);
  if (/[",\n]/.test(texto)) {
    return '"' + texto.replaceAll('"', '""') + '"';
  }
  return texto;
}

function paraCsv(linhas, origem) {
  const cabecalho = [
    `# origem: ${origem}`,
    "# colunas: codigo_ibge,nome,uf,regiao_intermediaria (PRD 6.1, tabela municipio)",
  ];
  const corpo = linhas.map((l) =>
    [l.codigo_ibge, l.nome, l.uf, l.regiao_intermediaria]
      .map(csvEscapar)
      .join(","),
  );
  return (
    [...cabecalho, "codigo_ibge,nome,uf,regiao_intermediaria", ...corpo].join(
      "\n",
    ) + "\n"
  );
}

// Extrai a região geográfica intermediária de um item da API de localidades
// do IBGE (regiao-imediata.regiao-intermediaria.nome). Município sem essa
// árvore preenchida (nunca deveria acontecer na API real) é descartado.
function extrairRegiaoIntermediaria(municipio) {
  return municipio?.["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? null;
}

function extrairUf(municipio) {
  return (
    municipio?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    municipio?.microrregiao?.mesorregiao?.UF?.sigla ??
    null
  );
}

async function tentarIbge() {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(URL_IBGE, { signal: controlador.signal });
    if (!resposta.ok) {
      throw new Error(`IBGE devolveu HTTP ${resposta.status}`);
    }
    const dados = await resposta.json();
    if (!Array.isArray(dados) || dados.length < 5000) {
      throw new Error(
        `resposta do IBGE com ${dados?.length ?? 0} município(s), esperado ~5570`,
      );
    }
    const linhas = dados
      .map((m) => ({
        codigo_ibge: m.id,
        nome: m.nome,
        uf: extrairUf(m),
        regiao_intermediaria: extrairRegiaoIntermediaria(m),
      }))
      .filter((l) => l.codigo_ibge && l.nome && l.uf && l.regiao_intermediaria);
    if (linhas.length < 5000) {
      throw new Error(
        `só ${linhas.length} município(s) com região intermediária preenchida`,
      );
    }
    return linhas;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  await mkdir(dirname(CSV_SAIDA), { recursive: true });

  let linhas;
  let origem;
  try {
    console.log(`baixar-municipios: tentando a API do IBGE (${URL_IBGE})...`);
    linhas = await tentarIbge();
    origem =
      `API de localidades do IBGE (servicodados.ibge.gov.br), baixada em ` +
      `${new Date().toISOString()} por scripts/baixar-municipios.mjs`;
    console.log(
      `baixar-municipios: ${linhas.length} municípios baixados da API do IBGE.`,
    );
  } catch (erro) {
    console.warn(
      `baixar-municipios: não deu para baixar da API do IBGE (${erro.message}).`,
    );
    console.warn(
      "baixar-municipios: usando o subconjunto compilado à mão (Grande São Paulo e " +
        "região de Londrina, PRD 3.3) — NÃO é a lista completa do IBGE. Rode este " +
        "script de novo numa rede que alcance servicodados.ibge.gov.br para substituir " +
        "por download real antes de produção.",
    );
    linhas = FALLBACK;
    origem =
      "Subconjunto compilado à mão nesta sessão (API do IBGE bloqueada nesta rede em " +
      "25/09/2026), cobrindo só a Grande São Paulo e a região de Londrina citadas no " +
      "PRD 3.3. Não confirmado por download. Ver comentário no topo de scripts/baixar-municipios.mjs.";
  }

  linhas.sort((a, b) =>
    a.uf === b.uf
      ? a.nome.localeCompare(b.nome, "pt-BR")
      : a.uf.localeCompare(b.uf),
  );
  await writeFile(CSV_SAIDA, paraCsv(linhas, origem), "utf8");
  console.log(
    `baixar-municipios: gravado ${CSV_SAIDA} (${linhas.length} linhas).`,
  );
}

main().catch((erro) => {
  console.error("baixar-municipios: falhou.", erro);
  process.exitCode = 1;
});
