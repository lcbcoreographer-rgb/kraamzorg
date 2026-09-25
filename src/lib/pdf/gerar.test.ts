// @vitest-environment node
/**
 * Teste de aceite do P41: "o acompanhamento do seed gera os PDFs certos;
 * conclusão incoerente bloqueia a aprovação; e-mail com anexo e assunto
 * sem dado pessoal" (o envio por e-mail é da onda B; aqui cobrimos a
 * geração e o bloqueio). Dado 100% sintético, no padrão de
 * `supabase/seed.sql` ("Família Teste", `@exemplo.invalid`, COREN
 * "TESTE-SP-...").
 */
import { describe, expect, it } from "vitest";
import {
  dadosNeonatalTeste,
  dadosPuerperalTeste,
  textosNeonatalTeste,
  textosPuerperalTeste,
} from "./__fixtures__/acompanhamento-sintetico";
import { lerPaginas, textoDasPaginas } from "./__fixtures__/ler-pdf";
import {
  gerarEvolucaoNeonatal,
  gerarEvolucaoPuerperal,
  rascunhoEvolucaoNeonatal,
  renderizarEvolucao,
} from "./gerar";

/**
 * Lê um valor do dicionário /Info do PDF (Title, Author...), direto do
 * buffer bruto: pdfkit grava string sem acento como literal `(...)` e
 * string com acento como objeto indireto `N 0 R` -> `N 0 obj (...)` em
 * UTF-16BE com BOM (`\xFE\xFF`), então o teste decodifica os dois jeitos
 * em vez de assumir um formato só.
 */
function lerInfoPdf(buffer: Buffer, chave: string): string | undefined {
  const texto = buffer.toString("latin1");
  const referencia = new RegExp(`/${chave}\\s+(\\d+)\\s+0\\s+R`).exec(texto);
  let conteudo: string | undefined;

  if (referencia) {
    const objeto = new RegExp(
      `${referencia[1]}\\s+0\\s+obj\\s*\\(([^]*?)\\)\\s*endobj`,
    ).exec(texto);
    conteudo = objeto?.[1];
  } else {
    const literal = new RegExp(`/${chave}\\s*\\(([^)]*)\\)`).exec(texto);
    conteudo = literal?.[1];
  }

  if (conteudo === undefined) return undefined;
  if (conteudo.startsWith("þÿ")) {
    const bigEndian = Buffer.from(conteudo.slice(2), "latin1");
    const littleEndian = Buffer.alloc(bigEndian.length);
    for (let i = 0; i + 1 < bigEndian.length; i += 2) {
      littleEndian[i] = bigEndian[i + 1]!;
      littleEndian[i + 1] = bigEndian[i]!;
    }
    return littleEndian.toString("utf16le");
  }
  return conteudo;
}

function textoBruto(buffer: Buffer): string {
  return buffer.toString("latin1");
}

describe("gerarEvolucaoPuerperal", () => {
  it("gera o PDF a partir de um acompanhamento sintético completo", async () => {
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalTeste(),
      textosPuerperalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(textoBruto(resultado.buffer).slice(0, 5)).toBe("%PDF-");
    expect(resultado.buffer.length).toBeGreaterThan(1000);
    expect(resultado.nomeArquivo).toBe(
      "8f14e45f-ceea-467e-adc9-15d044baf000.pdf",
    );
    // A4 = 595,28 x 841,89 pt
    expect(textoBruto(resultado.buffer)).toMatch(
      /\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/,
    );
  });

  it("metadados controlados: título e autor genéricos, idioma pt-BR, sem o nome da mãe", async () => {
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalTeste(),
      textosPuerperalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const titulo = lerInfoPdf(resultado.buffer, "Title");
    const autor = lerInfoPdf(resultado.buffer, "Author");
    const assunto = lerInfoPdf(resultado.buffer, "Subject");

    expect(titulo).toBe("Evolução de Enfermagem Puerperal");
    expect(autor).toBe("Kraamzorg Brasil");
    expect(textoBruto(resultado.buffer)).toContain("/Lang (pt-BR)");
    for (const valor of [titulo, autor, assunto]) {
      expect(valor).not.toMatch(/Marina|Aurora|Talita|Helena/);
    }
  });

  it("bloqueia quando a ferida operatória some numa cesárea (validação antes da aprovação)", async () => {
    const dados = dadosPuerperalTeste();
    dados.feridaOperatoria = undefined;
    const resultado = await gerarEvolucaoPuerperal(dados, textosPuerperalTeste);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros.some((e) => e.includes("ferida operatória"))).toBe(
      true,
    );
  });

  it("conclusão incoerente bloqueia: amamentação exclusiva com complemento registrado", async () => {
    const dados = dadosPuerperalTeste();
    dados.alimentacaoObservada = "complemento";
    const resultado = await gerarEvolucaoPuerperal(dados, textosPuerperalTeste);
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia sem contato do obstetra", async () => {
    const dados = dadosPuerperalTeste();
    dados.contatoObstetra = undefined;
    const resultado = await gerarEvolucaoPuerperal(dados, textosPuerperalTeste);
    expect(resultado.ok).toBe(false);
  });

  it("texto que falta em mensagem_modelo vira erro com a chave, não exceção", async () => {
    const textos = { ...textosPuerperalTeste };
    delete textos.evo_pue_estabilidade;
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalTeste(),
      textos,
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros[0]).toContain("evo_pue_estabilidade");
  });

  it("travessão num texto aprovado bloqueia a impressão", async () => {
    const textos = {
      ...textosPuerperalTeste,
      evo_pue_estabilidade: "Estável \u2014 sem intercorrências.",
    };
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalTeste(),
      textos,
    );
    expect(resultado.ok).toBe(false);
  });
});

describe("o que chega ao médico dentro do PDF", () => {
  it("toda página tem cabeçalho, aviso de confidencialidade (LGPD art. 11) e paginação", async () => {
    const resultado = await gerarEvolucaoPuerperal(
      dadosPuerperalTeste(),
      textosPuerperalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const lidas = lerPaginas(resultado.buffer);
    const paginas = lidas.map((pagina) => pagina.texto);
    expect(paginas.length).toBeGreaterThanOrEqual(2);
    paginas.forEach((pagina, indice) => {
      expect(pagina).toContain("Kraamzorg Brasil");
      expect(pagina).toContain("Lei Geral de Proteção de Dados, artigo 11");
      expect(pagina).toContain(`Página ${indice + 1} de ${paginas.length}`);
      // Impresso de fato: dentro da folha, na faixa de baixo (y do PDF
      // cresce de baixo para cima), não desenhado fora da página.
      const { altura, largura, trechos } = lidas[indice]!;
      const rodape = trechos.filter(
        (t) => t.texto.startsWith("Página") || t.texto.startsWith("Documento"),
      );
      expect(rodape).toHaveLength(2);
      for (const trecho of rodape) {
        expect(trecho.y).toBeGreaterThan(0);
        expect(trecho.y).toBeLessThan(altura * 0.1);
        expect(trecho.x).toBeGreaterThanOrEqual(0);
        expect(trecho.x).toBeLessThan(largura);
      }
    });
    const tudo = paginas.join(" ");
    expect(tudo).toContain("Paciente no 7º dia de puerpério");
    expect(tudo).toContain("COREN/SP TESTE-SP-0001");
    expect(tudo).toContain("Enfermeira obstetra");
    expect(tudo).not.toContain("enfermeira_obstetrica");
    expect(tudo).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("menina: o PDF diz 'filha' e 'nascida', nunca 'filho' ou 'nascido'", async () => {
    const resultado = await gerarEvolucaoNeonatal(
      dadosNeonatalTeste(),
      textosNeonatalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const tudo = textoDasPaginas(resultado.buffer).join(" ");
    expect(tudo).toContain("filha de Marina Teste Aurora");
    expect(tudo).toContain("nascida por parto cesárea");
    expect(tudo).not.toMatch(/\bfilho\b|\bnascido\b/);
    expect(tudo).toContain("Página 1 de");
  });
});

describe("gerarEvolucaoNeonatal", () => {
  it("gera o PDF do bebê a partir do mesmo acompanhamento sintético", async () => {
    const resultado = await gerarEvolucaoNeonatal(
      dadosNeonatalTeste(),
      textosNeonatalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(textoBruto(resultado.buffer).slice(0, 5)).toBe("%PDF-");
    expect(resultado.nomeArquivo).toBe(
      "8f14e45f-ceea-467e-adc9-15d044baf001.pdf",
    );
  });

  it("gera um PDF por bebê em gemelares, cada um com o próprio id no nome do arquivo", async () => {
    const segundo = dadosNeonatalTeste();
    segundo.id = "8f14e45f-ceea-467e-adc9-15d044baf003";
    segundo.bebeId = "8f14e45f-ceea-467e-adc9-15d044baf004";
    segundo.bebe = {
      ...segundo.bebe,
      sexo: "masculino",
      nome: "Bebê Teste Aurora 2",
    };
    const [a, b] = await Promise.all([
      gerarEvolucaoNeonatal(dadosNeonatalTeste(), textosNeonatalTeste),
      gerarEvolucaoNeonatal(segundo, textosNeonatalTeste),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.nomeArquivo).not.toBe(b.nomeArquivo);
  });

  it("metadados sem nome do bebê nem da mãe", async () => {
    const resultado = await gerarEvolucaoNeonatal(
      dadosNeonatalTeste(),
      textosNeonatalTeste,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const titulo = lerInfoPdf(resultado.buffer, "Title");
    const autor = lerInfoPdf(resultado.buffer, "Author");

    expect(titulo).toBe("Evolução de Enfermagem Neonatal");
    expect(autor).toBe("Kraamzorg Brasil");
    expect(titulo).not.toMatch(/Aurora|Marina/);
    expect(autor).not.toMatch(/Aurora|Marina/);
  });

  it("conclusão incoerente bloqueia: ganho progressivo com o bebê ainda perdendo peso", async () => {
    const dados = dadosNeonatalTeste();
    dados.pesagens = [
      { data: "2026-09-04", pesoG: 3250, origem: "alta_hospitalar" },
      { data: "2026-09-11", pesoG: 3100, origem: "domicilio" },
    ];
    dados.conclusao = { ...dados.conclusao, ganhoPeso: "progressivo" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatalTeste);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros.some((e) => e.includes("peso"))).toBe(true);
  });

  it("conclusão incoerente bloqueia: aleitamento exclusivo contra complemento registrado", async () => {
    const dados = dadosNeonatalTeste();
    dados.alimentacao = {
      ...dados.alimentacao,
      tipo: "complemento",
      complementoMl: 30,
    };
    dados.conclusao = { ...dados.conclusao, aleitamento: "exclusivo" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatalTeste);
    expect(resultado.ok).toBe(false);
  });

  it("conclusão incoerente bloqueia: sem icterícia na conclusão havendo registro de icterícia", async () => {
    const dados = dadosNeonatalTeste();
    dados.conclusao = { ...dados.conclusao, ictericia: "ausente" };

    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatalTeste);
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia sem contato do pediatra", async () => {
    const dados = dadosNeonatalTeste();
    dados.contatoPediatra = undefined;
    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatalTeste);
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia pesagem domiciliar fora do período do acompanhamento", async () => {
    const dados = dadosNeonatalTeste();
    dados.pesagens = [
      ...dados.pesagens,
      { data: "2026-09-30", pesoG: 3500, origem: "domicilio" },
    ];
    const resultado = await gerarEvolucaoNeonatal(dados, textosNeonatalTeste);
    expect(resultado.ok).toBe(false);
  });
});

describe("rascunho e renderização separados (base da onda B)", () => {
  it("o rascunho editado pela enfermeira é o que vai para o PDF", async () => {
    const rascunho = rascunhoEvolucaoNeonatal(
      dadosNeonatalTeste(),
      textosNeonatalTeste,
    );
    expect(rascunho.ok).toBe(true);
    if (!rascunho.ok) return;
    const conclusao = rascunho.conteudo.secoes.find(
      (s) => s.titulo === "Conclusão",
    )!;
    conclusao.blocos.push({
      tipo: "paragrafo",
      texto: "Família segura nos cuidados de rotina.",
    });
    const resultado = await renderizarEvolucao(
      "8f14e45f-ceea-467e-adc9-15d044baf001",
      rascunho.conteudo,
    );
    expect(resultado.ok).toBe(true);
  });

  it("recusa id que não serve de nome de arquivo (nome de paciente, por exemplo)", async () => {
    const rascunho = rascunhoEvolucaoNeonatal(
      dadosNeonatalTeste(),
      textosNeonatalTeste,
    );
    if (!rascunho.ok) throw new Error("rascunho inválido");
    await expect(
      renderizarEvolucao("Bebê Teste Aurora", rascunho.conteudo),
    ).rejects.toThrow(RangeError);
  });
});
