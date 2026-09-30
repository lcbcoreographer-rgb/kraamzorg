/**
 * Conteúdo do contrato antes de virar PDF (P31 item 1, PRD 22.2 C-11). Nada
 * de cláusula, rótulo ou frase de contrato mora aqui: tudo vem do modelo em
 * `parametro.contrato_modelo` (`ModeloContrato`), com as variáveis
 * preenchidas a partir dos dados do contrato. O que este arquivo decide é
 * onde cada dado entra, a variante de presente (sem valores para quem
 * recebe o cuidado, C-10) e a recusa de texto proibido.
 *
 * Função pura: o teste lê o texto que vai para o PDF sem extrair nada de
 * dentro do arquivo.
 */
import type {
  DadosParaContrato,
  ModeloContrato,
  PessoaDoContrato,
} from "@/lib/dados/tipos-contrato";
import type { EnderecoFormulario } from "@/lib/dados/tipos-venda";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { semTravessaoOuMeiaRisca } from "./textos";

export interface ParteContrato {
  titulo: string;
  linhas: { rotulo: string; valor: string }[];
}

export interface ClausulaContrato {
  titulo: string;
  paragrafos: string[];
  itens: string[];
  valores: { rotulo: string; valor: string; destaque: boolean }[];
}

export interface ConteudoContrato {
  titulo: string;
  aviso: string | null;
  versao: string;
  emitidoEm: string;
  variante: "completa" | "presente";
  partes: ParteContrato[];
  clausulas: ClausulaContrato[];
  assinaturas: string;
}

export type ResultadoConteudoContrato =
  { ok: true; conteudo: ConteudoContrato } | { ok: false; erros: string[] };

const VARIAVEL = /\{(\w+)\}/g;

/** Rótulos dos campos do bloco de cada parte: são rótulos de formulário, não cláusula. */
const ROTULOS = {
  nome: "Nome",
  documento: "Documento",
  endereco: "Endereço",
  cpf: "CPF",
  nascimento: "Nascimento",
  email: "E-mail",
  atendimento: "Local do atendimento",
} as const;

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11
    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    : cpf;
}

export function linhaDeEndereco(e: EnderecoFormulario): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const complemento = e.complemento ? `, ${e.complemento}` : "";
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [`${rua}${complemento}`, e.bairro, cidade, e.cep ? `CEP ${e.cep}` : ""]
    .filter((p) => p.trim() !== "")
    .join(", ");
}

function numeroBr(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    valor,
  );
}

function preencher(
  texto: string,
  variaveis: Record<string, string>,
  erros: string[],
): string {
  return texto.replace(VARIAVEL, (_m, nome: string) => {
    if (!(nome in variaveis)) {
      erros.push(`O modelo do contrato usa {${nome}}, que não tem valor.`);
      return "";
    }
    return variaveis[nome] ?? "";
  });
}

function parteDaPessoa(
  titulo: string,
  pessoa: PessoaDoContrato,
  extra: { rotulo: string; valor: string }[] = [],
): ParteContrato {
  const nascimento = pessoa.dataNascimento
    ? [
        {
          rotulo: ROTULOS.nascimento,
          valor: formatarData(pessoa.dataNascimento) ?? pessoa.dataNascimento,
        },
      ]
    : [];
  return {
    titulo,
    linhas: [
      { rotulo: ROTULOS.nome, valor: pessoa.nome },
      { rotulo: ROTULOS.cpf, valor: formatarCpf(pessoa.cpf) },
      ...nascimento,
      ...(pessoa.email ? [{ rotulo: ROTULOS.email, valor: pessoa.email }] : []),
      { rotulo: ROTULOS.endereco, valor: linhaDeEndereco(pessoa.endereco) },
      ...extra,
    ],
  };
}

function validarModelo(modelo: ModeloContrato): string[] {
  const erros: string[] = [];
  if (!modelo.versao) erros.push("O modelo do contrato não tem versão.");
  if (modelo.clausulas.length === 0) {
    erros.push("O modelo do contrato não tem cláusulas.");
  }
  return erros;
}

/**
 * Monta o conteúdo. Recusa (sem PDF) modelo sem cláusulas, variável do
 * modelo sem valor, texto com travessão ou meia-risca (CLAUDE.md) e valor
 * não finito.
 */
export function montarConteudoContrato(
  dados: DadosParaContrato,
  agora: Date = new Date(),
): ResultadoConteudoContrato {
  const { modelo } = dados;
  const erros = validarModelo(modelo);
  if (erros.length > 0) return { ok: false, erros };

  const presente = dados.contrato.variante === "presente";
  const horasTotais = dados.pacote.dias * dados.pacote.horasPorVisita;
  const conta = dados.contrato.conta;
  const variaveis: Record<string, string> = {
    pacote: dados.pacote.nome,
    profissional: modelo.profissional,
    dias: String(dados.pacote.dias),
    horas_por_visita: numeroBr(dados.pacote.horasPorVisita),
    horas_totais: numeroBr(horasTotais),
    parcelas: String(conta.parcelas),
    pagador: dados.pagador?.nome ?? "",
  };

  const partes: ParteContrato[] = [
    {
      titulo: modelo.partes.contratada,
      linhas: [
        { rotulo: ROTULOS.nome, valor: dados.kraamzorg.razaoSocial },
        { rotulo: ROTULOS.documento, valor: dados.kraamzorg.documento },
        { rotulo: ROTULOS.endereco, valor: dados.kraamzorg.endereco },
      ],
    },
    parteDaPessoa(
      modelo.partes.contratante,
      dados.contratante,
      dados.familia.enderecoAtendimento
        ? [
            {
              rotulo: ROTULOS.atendimento,
              valor: linhaDeEndereco(dados.familia.enderecoAtendimento),
            },
          ]
        : [],
    ),
  ];
  // No presente, quem recebe o cuidado não recebe o CPF nem o endereço de
  // quem paga: o nome de quem presenteia aparece só na cláusula de pagamento.
  if (dados.pagador && !presente) {
    partes.push(parteDaPessoa(modelo.partes.pagador, dados.pagador));
  }
  if (dados.testemunha) {
    partes.push({
      titulo: modelo.partes.testemunha,
      linhas: [{ rotulo: ROTULOS.nome, valor: dados.testemunha.nome }],
    });
  }

  const clausulas: ClausulaContrato[] = [];
  for (const c of modelo.clausulas) {
    if (c.somentePresente && !presente) continue;
    if (c.valores && presente) continue;
    const clausula: ClausulaContrato = {
      titulo: c.titulo,
      paragrafos: [preencher(c.texto, variaveis, erros)],
      itens: c.comFrentes ? [...modelo.frentes] : [],
      valores: [],
    };
    if (c.valores) {
      const v = modelo.valores;
      clausula.valores.push({
        rotulo: v.pacote,
        valor: formatarMoeda(conta.valorCentavos),
        destaque: false,
      });
      if (conta.descontoCentavos > 0) {
        clausula.valores.push({
          rotulo: v.desconto,
          valor: formatarMoeda(-conta.descontoCentavos),
          destaque: false,
        });
      }
      if (conta.taxaCentavos > 0) {
        clausula.valores.push({
          rotulo: v.taxa,
          valor: formatarMoeda(conta.taxaCentavos),
          destaque: false,
        });
      }
      clausula.valores.push({
        rotulo: v.total,
        valor: formatarMoeda(conta.totalCentavos),
        destaque: true,
      });
      clausula.valores.push({
        rotulo: v.forma,
        valor: preencher(
          conta.parcelas > 1 ? v.formaParcelada : v.formaUmaVez,
          variaveis,
          erros,
        ),
        destaque: false,
      });
    }
    clausulas.push(clausula);
  }

  const conteudo: ConteudoContrato = {
    titulo: modelo.titulo,
    aviso: modelo.aprovado ? null : modelo.avisoRascunho,
    versao: modelo.versao,
    emitidoEm:
      formatarData(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(agora),
      ) ?? "",
    variante: presente ? "presente" : "completa",
    partes,
    clausulas,
    assinaturas: preencher(modelo.assinaturas, variaveis, erros),
  };

  for (const texto of textosDoContrato(conteudo)) {
    if (!semTravessaoOuMeiaRisca(texto)) {
      erros.push("O contrato tem travessão ou meia-risca. Troque no modelo.");
      break;
    }
  }
  if (erros.length > 0) return { ok: false, erros: [...new Set(erros)] };
  return { ok: true, conteudo };
}

/** Todo texto que o documento imprime, na ordem, para auditoria e teste. */
export function textosDoContrato(c: ConteudoContrato): string[] {
  const textos: string[] = [c.titulo, c.versao, c.emitidoEm];
  if (c.aviso) textos.push(c.aviso);
  for (const parte of c.partes) {
    textos.push(parte.titulo);
    for (const l of parte.linhas) textos.push(l.rotulo, l.valor);
  }
  for (const cl of c.clausulas) {
    textos.push(cl.titulo, ...cl.paragrafos, ...cl.itens);
    for (const v of cl.valores) textos.push(v.rotulo, v.valor);
  }
  textos.push(c.assinaturas);
  return textos;
}
