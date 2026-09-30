import "server-only";
import { caminhoEvolucao } from "@/lib/armazenamento/caminhos";
import type { ArmazenamentoPrivado } from "@/lib/armazenamento/tipos";
import type {
  DadosEnvioEvolucao,
  EvolucaoRepositorio,
} from "@/lib/dados/tipos-evolucao";
import { formatarData } from "@/lib/formatacao";
import type { Emailer } from "@/lib/integracoes/fabrica";
import { AssuntoComDadoPessoalError } from "@/lib/integracoes/email/guarda";
import {
  preencherTexto,
  renderizarEvolucao,
  semTravessaoOuMeiaRisca,
  type ConteudoEvolucao,
} from "@/lib/pdf";
import { FRASES_ENVIO, type CodigoFalhaEnvio } from "./mensagens";

/**
 * Envio da evolução aprovada aos médicos (P41, PRD 9.5 e 23.5): imprime o PDF
 * a partir do conteúdo aprovado, guarda no storage privado (evolucoes/<id>.pdf),
 * manda um e-mail por médico com o PDF em anexo e registra o resultado no
 * banco. O assunto vem de `mensagem_modelo` e é conferido contra os nomes da
 * família antes de sair; o anexo leva o id do documento no nome, nunca o nome
 * de ninguém. Qualquer falha fica registrada como `erro_envio` com o motivo,
 * e a coordenação reenvia da própria tela.
 *
 * O modo demonstração usa o mesmo caminho: o e-mail cai na caixa de saída
 * local em vez de ir para a rede.
 */

export interface DependenciasEnvioEvolucao {
  evolucoes: Pick<EvolucaoRepositorio, "dadosEnvio" | "registrarEnvio">;
  email: Emailer;
  armazenamento: Pick<ArmazenamentoPrivado, "salvar">;
  renderizar?: typeof renderizarEvolucao;
}

export type ResultadoEnvioEvolucao =
  | { ok: true; enviados: number; falhas: number }
  | { ok: false; codigo: CodigoFalhaEnvio; motivo: string };

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/** Quem é o paciente no corpo do e-mail (o corpo pode levar nome; só o assunto e o anexo não). */
export function pacienteDoCorpo(dados: Record<string, unknown>): string {
  const paciente = texto(objeto(dados.paciente).nome);
  if (paciente) return paciente;
  const bebe = texto(objeto(dados.bebe).nome);
  if (bebe) return bebe;
  const filiacao = Array.isArray(dados.filiacao) ? dados.filiacao : [];
  const mae = texto(filiacao[0]);
  return mae ? `o bebê de ${mae}` : "o bebê";
}

export function periodoDoCorpo(dados: Record<string, unknown>): {
  inicio: string;
  fim: string;
} | null {
  const periodo = objeto(dados.periodo);
  const inicio = formatarData(texto(periodo.inicio) ?? "");
  const fim = formatarData(texto(periodo.fim) ?? "");
  return inicio && fim ? { inicio, fim } : null;
}

/**
 * Corpo do e-mail a partir do texto aprovado em `mensagem_modelo`
 * (email_evolucao_corpo). Cada valor é escapado; cada parágrafo do texto vira
 * um `<p>`. Devolve null se falta variável ou o texto tem travessão.
 */
export function corpoDoEmail(
  modelo: string,
  variaveis: Record<string, string>,
): string | null {
  try {
    const escapadas: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(variaveis)) {
      escapadas[chave] = escapar(valor);
    }
    const preenchido = preencherTexto("corpo", { corpo: modelo }, escapadas);
    if (!semTravessaoOuMeiaRisca(preenchido)) return null;
    return preenchido
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
  } catch {
    return null;
  }
}

async function falhar(
  deps: DependenciasEnvioEvolucao,
  relatorioId: string,
  codigo: CodigoFalhaEnvio,
): Promise<ResultadoEnvioEvolucao> {
  const motivo = FRASES_ENVIO[codigo];
  try {
    await deps.evolucoes.registrarEnvio({
      relatorioId,
      pdfPath: null,
      enviados: [],
      erro: motivo,
    });
  } catch {
    // Se nem o registro da falha entrou, a tela ainda mostra o motivo devolvido.
  }
  return { ok: false, codigo, motivo };
}

export async function enviarEvolucao(
  relatorioId: string,
  deps: DependenciasEnvioEvolucao,
): Promise<ResultadoEnvioEvolucao> {
  const dados: DadosEnvioEvolucao =
    await deps.evolucoes.dadosEnvio(relatorioId);

  const conteudo = dados.conteudo.conteudo as ConteudoEvolucao | null;
  if (!conteudo) return falhar(deps, relatorioId, "sem_conteudo");
  if (dados.destinatarios.length === 0) {
    return falhar(deps, relatorioId, "sem_destinatario");
  }
  const { tratamento, coordenacao, contato } = dados.config;
  if (!texto(tratamento) || !texto(coordenacao) || !texto(contato)) {
    return falhar(deps, relatorioId, "sem_configuracao");
  }
  const assunto = texto(dados.textos.assunto);
  const modelo = texto(dados.textos.corpo);
  if (!assunto || !modelo) return falhar(deps, relatorioId, "sem_texto_email");
  if (!semTravessaoOuMeiaRisca(assunto)) {
    return falhar(deps, relatorioId, "sem_texto_email");
  }
  const periodo = periodoDoCorpo(dados.conteudo.dados);
  if (!periodo) return falhar(deps, relatorioId, "sem_conteudo");

  const renderizar = deps.renderizar ?? renderizarEvolucao;
  let pdf: Uint8Array;
  let nomeArquivo: string;
  try {
    const resultado = await renderizar(relatorioId, conteudo);
    if (!resultado.ok) return falhar(deps, relatorioId, "pdf");
    pdf = new Uint8Array(resultado.buffer);
    nomeArquivo = resultado.nomeArquivo;
  } catch {
    return falhar(deps, relatorioId, "pdf");
  }

  const caminho = caminhoEvolucao(relatorioId);
  try {
    await deps.armazenamento.salvar(caminho, pdf, "application/pdf", true);
  } catch {
    return falhar(deps, relatorioId, "armazenamento");
  }

  const paciente = pacienteDoCorpo(dados.conteudo.dados);
  const enviados: {
    especialidade: string;
    medicoId: string;
    enviadoEm: string;
  }[] = [];
  let falhas = 0;
  let naoConfigurado = false;
  let dadoPessoal = false;
  for (const destinatario of dados.destinatarios) {
    const corpo = corpoDoEmail(modelo, {
      tratamento: tratamento!.trim(),
      medico: destinatario.nome,
      paciente,
      inicio: periodo.inicio,
      fim: periodo.fim,
      coordenacao: coordenacao!.trim(),
      contato: contato!.trim(),
    });
    if (!corpo) return falhar(deps, relatorioId, "sem_texto_email");
    try {
      await deps.email.enviar({
        para: [destinatario.email],
        assunto,
        corpoHtml: corpo,
        anexos: [
          { nomeArquivo, conteudo: pdf, tipoConteudo: "application/pdf" },
        ],
        nomesProibidosNoAssunto: dados.nomesProibidos,
      });
      enviados.push({
        especialidade: destinatario.especialidade,
        medicoId: destinatario.medicoId,
        enviadoEm: new Date().toISOString(),
      });
    } catch (erro) {
      falhas += 1;
      if (erro instanceof AssuntoComDadoPessoalError) dadoPessoal = true;
      if (
        erro instanceof Error &&
        erro.name === "ErroIntegracaoNaoConfigurada"
      ) {
        naoConfigurado = true;
      }
    }
  }

  if (enviados.length === 0) {
    return falhar(
      deps,
      relatorioId,
      dadoPessoal
        ? "dado_pessoal"
        : naoConfigurado
          ? "nao_configurado"
          : "falha_email",
    );
  }

  await deps.evolucoes.registrarEnvio({
    relatorioId,
    pdfPath: caminho,
    enviados,
  });
  return { ok: true, enviados: enviados.length, falhas };
}
