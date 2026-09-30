import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  DadosEmissaoNota,
  EstadoNota,
  ListaNotas,
  NotaDetalhe,
  NotaRepositorio,
  NotaResumo,
} from "../tipos-nota";
import { obterLoja } from "./loja";
import { obterLojaVenda } from "./venda";

/**
 * Nota fiscal no modo demonstração (P43): as mesmas regras de
 * 0024_evolucao_ocorrencia_nf.sql sobre uma loja em memória. Cada cobrança
 * paga do modo demonstração tem uma nota; as que a venda já emitiu entram
 * emitidas, as pagas depois entram pendentes, e três notas próprias mostram os
 * estados pendente, com erro e em processamento. O tomador é quem paga (C-10).
 */

export interface ContextoDemonstracaoNota {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

interface NotaDemo {
  id: string;
  cobrancaId: string;
  contratoId: string;
  origem: "venda" | "propria";
  familiaId: string;
  familiaNome: string;
  tomadorNome: string;
  parcela: number;
  valorCentavos: number;
  pagoEm: string;
  status: EstadoNota;
  numero: string | null;
  provider: string | null;
  providerRef: string | null;
  erro: string | null;
  tentativas: number;
  manual: boolean;
  pdfPath: string | null;
  xmlPath: string | null;
  emitidaEm: string | null;
  ultimaTentativaEm: number | null;
  versao: number;
  criadoEm: string;
}

interface LojaNotas {
  notas: NotaDemo[];
  servico: { codigo: string; descricao: string };
  automatica: boolean;
}

const CHAVE_GLOBAL = "__kraamzorgLojaNotas";

/** CPF sintético válido (dígitos verificadores certos), usado só na demonstração. */
const CPF_SINTETICO = "52998224725";

function id(n: number): string {
  return `00000000-0000-4000-8b00-${n.toString().padStart(12, "0")}`;
}

function criarLoja(): LojaNotas {
  const agora = Date.now();
  const dia = 86_400_000;
  const propria = (
    n: number,
    dados: Partial<NotaDemo> &
      Pick<NotaDemo, "familiaNome" | "tomadorNome" | "status">,
  ): NotaDemo => ({
    id: id(n),
    cobrancaId: id(100 + n),
    contratoId: id(300 + n),
    origem: "propria",
    familiaId: id(200 + n),
    parcela: 1,
    valorCentavos: 420000,
    pagoEm: new Date(agora - 2 * dia).toISOString(),
    numero: null,
    provider: "a_definir",
    providerRef: null,
    erro: null,
    tentativas: 0,
    manual: false,
    pdfPath: null,
    xmlPath: null,
    emitidaEm: null,
    ultimaTentativaEm: null,
    versao: 1,
    criadoEm: new Date(agora - 2 * dia).toISOString(),
    ...dados,
  });
  return {
    servico: { codigo: "05266", descricao: "Cuidado domiciliar pós-parto" },
    automatica: false,
    notas: [
      propria(1, {
        familiaNome: "Família Teste Íris",
        tomadorNome: "Carla Teste Pagadora",
        status: "pendente",
      }),
      propria(2, {
        familiaNome: "Família Teste Jade",
        tomadorNome: "Paulo Teste Pagador",
        status: "erro",
        tentativas: 1,
        erro: "O provedor recusou a nota: o CPF do tomador não confere com o nome. Confira o cadastro de quem paga e tente de novo.",
        ultimaTentativaEm: agora - 3 * 3_600_000,
      }),
      propria(3, {
        familiaNome: "Família Teste Lua",
        tomadorNome: "Marina Teste Lua",
        status: "processando",
        tentativas: 1,
        providerRef: "demo-ref-3",
        ultimaTentativaEm: agora - 60 * 60_000,
      }),
    ],
  };
}

function loja(): LojaNotas {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaNotas>;
  g[CHAVE_GLOBAL] ??= criarLoja();
  return g[CHAVE_GLOBAL]!;
}

/** Só para teste: volta a loja ao começo. */
export function reiniciarLojaNotas(): void {
  const g = globalThis as unknown as Record<string, LojaNotas>;
  g[CHAVE_GLOBAL] = criarLoja();
}

/** Liga a emissão automática (a configuração vem de parametro.nfse_emissao). */
export function definirEmissaoAutomaticaDemo(ligada: boolean): void {
  loja().automatica = ligada;
}

const CHAVE_FALHA = "__kraamzorgFalhaProvedorNota";

/**
 * Só na demonstração: a próxima emissão pelo provedor de mentira volta com
 * erro, para mostrar o motivo e o reenvio. Vale uma vez só.
 */
export function definirFalhaProvedorDemo(ligada: boolean): void {
  garantirDemonstracaoPermitida();
  (globalThis as unknown as Record<string, boolean>)[CHAVE_FALHA] = ligada;
}

/** Lê e apaga a falha combinada (uma emissão só). */
export function consumirFalhaProvedorDemo(): boolean {
  const g = globalThis as unknown as Record<string, boolean | undefined>;
  const ligada = g[CHAVE_FALHA] === true;
  g[CHAVE_FALHA] = false;
  return ligada;
}

function recusa(codigo: string, detalhe = ""): ErroRepositorio {
  return new ErroRepositorio("recusado", `nota:${codigo} ${detalhe}`.trim());
}

/** Cobrança paga do modo demonstração sem nota ainda: entra como pendente (privado.cobranca_confirmar). */
function materializar(l: LojaNotas): void {
  const lv = obterLojaVenda();
  const loj = obterLoja();
  for (const c of lv.cobrancas) {
    if (c.status !== "paga" || l.notas.some((n) => n.cobrancaId === c.id))
      continue;
    const k = lv.contratos.find((x) => x.id === c.contratoId);
    const pagador = loj.pessoas.find(
      (p) => p.id === (k?.pagadorPessoaId ?? k?.contratantePessoaId),
    );
    const familia = loj.familias.find((f) => f.id === c.familiaId);
    const emitida = c.notaStatus === "emitida";
    l.notas.push({
      id: crypto.randomUUID(),
      cobrancaId: c.id,
      contratoId: c.contratoId,
      origem: "venda",
      familiaId: c.familiaId,
      familiaNome: familia?.nome ?? "Família",
      tomadorNome: pagador?.nome ?? "Quem paga",
      parcela: c.parcela,
      valorCentavos: c.valorCentavos,
      pagoEm: c.pagoEm ?? new Date().toISOString(),
      status: emitida ? "emitida" : "pendente",
      numero: emitida ? (c.notaNumero ?? "1") : null,
      provider: emitida ? "nfse-teste" : "a_definir",
      providerRef: null,
      erro: null,
      tentativas: emitida ? 1 : 0,
      manual: false,
      pdfPath: null,
      xmlPath: null,
      emitidaEm: emitida ? (c.pagoEm ?? new Date().toISOString()) : null,
      ultimaTentativaEm: null,
      versao: 1,
      criadoEm: c.pagoEm ?? new Date().toISOString(),
    });
  }
}

/** Devolve à cobrança da venda o que a nota emitida mudou (a tela de cobrança mostra o número). */
function sincronizarComVenda(n: NotaDemo): void {
  if (n.origem !== "venda") return;
  const lv = obterLojaVenda();
  const c = lv.cobrancas.find((x) => x.id === n.cobrancaId);
  if (!c) return;
  c.notaStatus = n.status === "emitida" ? "emitida" : "pendente";
  c.notaNumero = n.numero;
  if (n.status === "emitida") {
    const o = obterLoja().oportunidades.find(
      (x) =>
        x.familiaId === n.familiaId && x.estagioP2 === "pagamento_confirmado",
    );
    if (o) o.estagioP2 = "nota_fiscal_emitida";
  }
}

export function criarNotaDemonstracao(
  contexto: ContextoDemonstracaoNota,
): NotaRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));

  function autorizar() {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (!tem("financeiro", "diretoria")) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem acesso",
      );
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige MFA");
    }
  }

  function dados(): LojaNotas {
    const l = loja();
    materializar(l);
    return l;
  }

  function nota(l: LojaNotas, notaId: string): NotaDemo {
    const n = l.notas.find((x) => x.id === notaId);
    if (!n) throw recusa("inexistente");
    return n;
  }

  function resumo(n: NotaDemo): NotaResumo {
    return {
      id: n.id,
      cobrancaId: n.cobrancaId,
      contratoId: n.contratoId,
      familiaId: n.familiaId,
      familiaNome: n.familiaNome,
      tomadorNome: n.tomadorNome,
      parcela: n.parcela,
      valorCentavos: n.valorCentavos,
      pagoEm: n.pagoEm,
      status: n.status,
      numero: n.numero,
      provider: n.provider,
      erro: n.erro,
      tentativas: n.tentativas,
      manual: n.manual,
      temPdf: n.pdfPath !== null,
      temXml: n.xmlPath !== null,
      emitidaEm: n.emitidaEm,
      criadoEm: n.criadoEm,
    };
  }

  return {
    async listar(situacao): Promise<ListaNotas> {
      autorizar();
      const l = dados();
      const todas = l.notas;
      const filtradas = situacao
        ? todas.filter((n) => n.status === situacao)
        : todas;
      const ordem: Record<EstadoNota, number> = {
        erro: 0,
        pendente: 1,
        processando: 2,
        emitida: 3,
        cancelada: 4,
      };
      return {
        resumo: {
          pendentes: todas.filter((n) => n.status === "pendente").length,
          processando: todas.filter((n) => n.status === "processando").length,
          emitidas: todas.filter((n) => n.status === "emitida").length,
          comErro: todas.filter((n) => n.status === "erro").length,
          canceladas: todas.filter((n) => n.status === "cancelada").length,
        },
        notas: [...filtradas]
          .sort(
            (a, b) =>
              ordem[a.status] - ordem[b.status] ||
              a.pagoEm.localeCompare(b.pagoEm),
          )
          .map(resumo),
        emissaoAutomatica: l.automatica,
      };
    },

    async obter(notaId): Promise<NotaDetalhe> {
      autorizar();
      const l = dados();
      const n = nota(l, notaId);
      return {
        ...resumo(n),
        tomadorTemCpf: true,
        cobrancaSituacao: "paga",
        providerRef: n.providerRef,
        versao: n.versao,
        codigoServico: l.servico.codigo,
        descricaoServico: l.servico.descricao,
        emissaoAutomatica: l.automatica,
        podeEmitir: n.status === "pendente" || n.status === "erro",
        podeConsultar: n.status === "processando" && n.providerRef !== null,
      };
    },

    async dadosEmissao(notaId): Promise<DadosEmissaoNota> {
      autorizar();
      const l = dados();
      const n = nota(l, notaId);
      if (n.status !== "pendente" && n.status !== "erro") {
        throw recusa(`${n.status}_nao_emite`);
      }
      return {
        notaId: n.id,
        cobrancaId: n.cobrancaId,
        familiaId: n.familiaId,
        status: n.status,
        valorCentavos: n.valorCentavos,
        codigoServico: l.servico.codigo,
        descricaoServico: l.servico.descricao,
        tomador: {
          nome: n.tomadorNome,
          cpf: CPF_SINTETICO,
          email: null,
          endereco: {
            logradouro: "Rua de Teste",
            numero: "200",
            bairro: "Bairro de Teste",
            cep: "01310100",
            uf: "SP",
            municipioCodigoIbge: "3550308",
          },
        },
      };
    },

    async iniciarEmissao(notaId) {
      autorizar();
      const n = nota(dados(), notaId);
      if (n.status === "emitida") throw recusa("ja_emitida");
      if (n.status === "cancelada") throw recusa("cancelada");
      if (
        n.status === "processando" &&
        n.ultimaTentativaEm !== null &&
        Date.now() - n.ultimaTentativaEm < 10 * 60_000
      ) {
        throw recusa("ja_processando");
      }
      n.status = "processando";
      n.tentativas += 1;
      n.ultimaTentativaEm = Date.now();
      n.erro = null;
      n.versao += 1;
    },

    async registrarResultado(notaId, resultado) {
      autorizar();
      const n = nota(dados(), notaId);
      if (n.status === "emitida") return { status: "emitida", mudou: false };
      if (n.status !== "processando") throw recusa("fora_do_processamento");
      if (resultado.providerRef) n.providerRef = resultado.providerRef;
      if (resultado.estado === "emitida") {
        if (!resultado.numero?.trim()) throw recusa("sem_numero");
        n.status = "emitida";
        n.numero = resultado.numero.trim();
        n.pdfPath = resultado.pdfPath ?? n.pdfPath;
        n.xmlPath = resultado.xmlPath ?? n.xmlPath;
        n.emitidaEm = new Date().toISOString();
        n.erro = null;
        n.provider = n.provider === "a_definir" ? "demonstracao" : n.provider;
        sincronizarComVenda(n);
      } else if (resultado.estado === "erro") {
        n.status = "erro";
        n.erro = (
          resultado.erro?.trim() || "O provedor não explicou o erro."
        ).slice(0, 500);
      }
      n.versao += 1;
      return { status: n.status, mudou: true };
    },

    async registrarManual(pedido) {
      autorizar();
      const n = nota(dados(), pedido.notaId);
      if (n.status !== "pendente" && n.status !== "erro") {
        throw recusa(`${n.status}_nao_aceita_manual`);
      }
      if (!pedido.numero.trim() || pedido.numero.length > 60)
        throw recusa("sem_numero");
      const hoje = new Date().toLocaleDateString("sv-SE", {
        timeZone: "America/Sao_Paulo",
      });
      if (pedido.emitidaEm > hoje || pedido.emitidaEm < "2020-01-01") {
        throw recusa("data_invalida");
      }
      n.status = "emitida";
      n.manual = true;
      n.numero = pedido.numero.trim();
      n.provider = pedido.provider?.trim() || n.provider;
      n.emitidaEm = `${pedido.emitidaEm}T15:00:00.000Z`;
      n.pdfPath = pedido.pdfPath ?? n.pdfPath;
      n.xmlPath = pedido.xmlPath ?? n.xmlPath;
      n.erro = null;
      n.versao += 1;
      sincronizarComVenda(n);
    },

    async caminhoArquivo(notaId, tipo) {
      autorizar();
      const n = nota(dados(), notaId);
      const caminho = tipo === "pdf" ? n.pdfPath : n.xmlPath;
      if (!caminho) throw recusa("sem_arquivo");
      return caminho;
    },
  };
}
