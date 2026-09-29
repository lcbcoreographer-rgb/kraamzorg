import type {
  DadosFormularioContrato,
  EnderecoFormulario,
} from "@/lib/dados/tipos-venda";
import { ERROS } from "./textos";

/**
 * Validação do formulário seguro (P30 item 2), a mesma no navegador (etapa
 * a etapa, antes de "Continuar") e na ação de servidor (antes de chamar o
 * banco). O banco valida de novo (public.formulario_contrato_enviar): a
 * tela ajuda, a regra mora lá.
 *
 * Os valores ficam num registro plano de texto ("gestante.cpf",
 * "atendimento.cep", ...), que é o que o formulário guarda campo a campo.
 * Nada aqui registra, loga ou devolve o valor digitado: o erro é só a
 * frase (CPF nunca em log, URL ou Sentry, aceite do P30).
 */

export type Valores = Record<string, string>;
export type Erros = Record<string, string>;

export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** 000.000.000-00 enquanto digita (só dígitos, até 11). */
export function formatarCpf(texto: string): string {
  const d = apenasDigitos(texto).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 00000-000 enquanto digita. */
export function formatarCep(texto: string): string {
  const d = apenasDigitos(texto).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** dd/mm/aaaa enquanto digita. */
export function formatarData(texto: string): string {
  const d = apenasDigitos(texto).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Dígitos verificadores do CPF (mesma conta de privado.cpf_valido, 0005). */
export function cpfValido(texto: string): boolean {
  const d = apenasDigitos(texto);
  if (d.length !== 11) return false;
  const numeros = d.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += (numeros[i] ?? 0) * (10 - i);
  const dv1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  soma = 0;
  for (let i = 0; i < 10; i++) soma += (numeros[i] ?? 0) * (11 - i);
  const dv2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return numeros[9] === dv1 && numeros[10] === dv2;
}

export function erroCpf(texto: string): string | null {
  const d = apenasDigitos(texto);
  if (d.length === 0) return ERROS.obrigatorio;
  if (d.length < 11) return ERROS.cpfCurto(d.length);
  if (d.length > 11) return ERROS.cpfLongo(d.length);
  return cpfValido(d) ? null : ERROS.cpfDigito;
}

/** Duas palavras ou mais, só letras, apóstrofo, ponto e hífen (como o banco). */
export function erroNomeCompleto(texto: string): string | null {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (!limpo) return ERROS.obrigatorio;
  if (limpo.length > 160) return ERROS.nomeCompleto;
  return /^[\p{L}'.-]+( [\p{L}'.-]+)+$/u.test(limpo)
    ? null
    : ERROS.nomeCompleto;
}

export function erroEmail(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return ERROS.obrigatorio;
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(limpo) && limpo.length <= 200
    ? null
    : ERROS.email;
}

/** "17/05/1994" para "1994-05-17"; null se a data não existe. */
export function dataIso(texto: string): string | null {
  const achado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!achado) return null;
  const [, dia, mes, ano] = achado;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() !== Number(mes) - 1 ||
    data.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

/** hoje: "aaaa-mm-dd" no fuso de Brasília (quem chama calcula). */
export function erroDataNascimento(texto: string, hoje: string): string | null {
  if (!texto.trim()) return ERROS.obrigatorio;
  const iso = dataIso(texto);
  if (!iso) return ERROS.dataFormato;
  if (iso >= hoje) return ERROS.dataFutura;
  if (iso < "1900-01-01") return ERROS.dataAntiga;
  return null;
}

export const CAMPOS_ENDERECO = [
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
] as const;

export function errosEndereco(valores: Valores, prefixo: string): Erros {
  const erros: Erros = {};
  const v = (campo: string) => (valores[`${prefixo}.${campo}`] ?? "").trim();
  if (apenasDigitos(v("cep")).length !== 8) {
    erros[`${prefixo}.cep`] = v("cep") ? ERROS.cep : ERROS.obrigatorio;
  }
  for (const campo of ["logradouro", "numero", "bairro", "cidade"] as const) {
    if (!v(campo)) erros[`${prefixo}.${campo}`] = ERROS.obrigatorio;
  }
  if (!/^[A-Za-z]{2}$/.test(v("uf"))) {
    erros[`${prefixo}.uf`] = v("uf") ? ERROS.uf : ERROS.obrigatorio;
  }
  return erros;
}

export type IdEtapa = "voce" | "endereco" | "pagador" | "final";

export interface ContextoValidacao {
  pedePagador: boolean;
  /** Hoje em Brasília, "aaaa-mm-dd". */
  hoje: string;
}

export function etapasDoFormulario(pedePagador: boolean): IdEtapa[] {
  return pedePagador
    ? ["voce", "endereco", "pagador", "final"]
    : ["voce", "endereco", "final"];
}

export function validarEtapa(
  etapa: IdEtapa,
  valores: Valores,
  contexto: ContextoValidacao,
): Erros {
  const erros: Erros = {};
  const guardar = (campo: string, erro: string | null) => {
    if (erro) erros[campo] = erro;
  };
  const v = (campo: string) => valores[campo] ?? "";

  if (etapa === "voce") {
    guardar(
      "gestante.nomeCompleto",
      erroNomeCompleto(v("gestante.nomeCompleto")),
    );
    guardar("gestante.cpf", erroCpf(v("gestante.cpf")));
    guardar(
      "gestante.dataNascimento",
      erroDataNascimento(v("gestante.dataNascimento"), contexto.hoje),
    );
    guardar("gestante.email", erroEmail(v("gestante.email")));
  }

  if (etapa === "endereco") {
    Object.assign(erros, errosEndereco(valores, "gestante"));
    const mesmo = v("atendimentoMesmoEndereco");
    if (mesmo !== "sim" && mesmo !== "nao") {
      erros.atendimentoMesmoEndereco = ERROS.escolha;
    } else if (mesmo === "nao") {
      Object.assign(erros, errosEndereco(valores, "atendimento"));
    }
  }

  if (etapa === "pagador" && contexto.pedePagador) {
    guardar(
      "pagador.nomeCompleto",
      erroNomeCompleto(v("pagador.nomeCompleto")),
    );
    const cpf = erroCpf(v("pagador.cpf"));
    guardar("pagador.cpf", cpf);
    if (
      !cpf &&
      apenasDigitos(v("pagador.cpf")) === apenasDigitos(v("gestante.cpf"))
    ) {
      erros["pagador.cpf"] = ERROS.cpfIgualGestante;
    }
    guardar("pagador.email", erroEmail(v("pagador.email")));
    Object.assign(erros, errosEndereco(valores, "pagador"));
  }

  if (etapa === "final") {
    const nome = v("testemunha.nomeCompleto").trim();
    const email = v("testemunha.email").trim();
    if (nome || email) {
      guardar("testemunha.nomeCompleto", erroNomeCompleto(nome));
      if (!email) erros["testemunha.email"] = ERROS.testemunhaEmail;
      else guardar("testemunha.email", erroEmail(email));
    }
    if (v("consentimento") !== "sim") erros.consentimento = ERROS.consentimento;
  }

  return erros;
}

/** Todas as etapas; a primeira com erro é para onde a tela volta. */
export function validarTudo(
  valores: Valores,
  contexto: ContextoValidacao,
): { erros: Erros; primeiraEtapa: IdEtapa | null } {
  let primeiraEtapa: IdEtapa | null = null;
  const erros: Erros = {};
  for (const etapa of etapasDoFormulario(contexto.pedePagador)) {
    const daEtapa = validarEtapa(etapa, valores, contexto);
    if (Object.keys(daEtapa).length > 0 && !primeiraEtapa) {
      primeiraEtapa = etapa;
    }
    Object.assign(erros, daEtapa);
  }
  return { erros, primeiraEtapa };
}

function endereco(valores: Valores, prefixo: string): EnderecoFormulario {
  const v = (campo: string) => (valores[`${prefixo}.${campo}`] ?? "").trim();
  return {
    cep: apenasDigitos(v("cep")),
    logradouro: v("logradouro"),
    numero: v("numero"),
    complemento: v("complemento"),
    bairro: v("bairro"),
    cidade: v("cidade"),
    uf: v("uf").toUpperCase(),
  };
}

/** Os valores já validados no formato que o banco recebe. */
export function montarDados(
  valores: Valores,
  contexto: ContextoValidacao & { termoVersao: string },
): DadosFormularioContrato {
  const v = (campo: string) => (valores[campo] ?? "").trim();
  const mesmo = v("atendimentoMesmoEndereco") !== "nao";
  const nomeTestemunha = v("testemunha.nomeCompleto");
  return {
    gestante: {
      nomeCompleto: v("gestante.nomeCompleto").replace(/\s+/g, " "),
      cpf: apenasDigitos(v("gestante.cpf")),
      dataNascimento: dataIso(v("gestante.dataNascimento")) ?? "",
      email: v("gestante.email"),
      endereco: endereco(valores, "gestante"),
    },
    atendimentoNoMesmoEndereco: mesmo,
    enderecoAtendimento: mesmo ? null : endereco(valores, "atendimento"),
    pagador: contexto.pedePagador
      ? {
          nomeCompleto: v("pagador.nomeCompleto").replace(/\s+/g, " "),
          cpf: apenasDigitos(v("pagador.cpf")),
          email: v("pagador.email"),
          endereco: endereco(valores, "pagador"),
        }
      : null,
    testemunha: nomeTestemunha
      ? {
          nomeCompleto: nomeTestemunha.replace(/\s+/g, " "),
          email: v("testemunha.email"),
        }
      : null,
    consentimento: {
      aceito: v("consentimento") === "sim",
      versao: contexto.termoVersao,
    },
  };
}

/**
 * Campo do banco (public.formulario_contrato_enviar devolve
 * "gestante.cpf", "gestante.endereco", ...) para o campo da tela, com a
 * frase. Endereço inteiro inválido marca o CEP, o primeiro campo do bloco.
 */
export function errosDoServidor(erros: Record<string, string>): Erros {
  const tela: Erros = {};
  for (const [campo, codigo] of Object.entries(erros)) {
    switch (campo) {
      case "gestante.nome_completo":
        tela["gestante.nomeCompleto"] = ERROS.nomeCompleto;
        break;
      case "gestante.cpf":
        tela["gestante.cpf"] = ERROS.cpfDigito;
        break;
      case "gestante.data_nascimento":
        tela["gestante.dataNascimento"] = ERROS.dataFormato;
        break;
      case "gestante.email":
        tela["gestante.email"] = ERROS.email;
        break;
      case "gestante.endereco":
        tela["gestante.cep"] = ERROS.cep;
        break;
      case "endereco_atendimento":
        tela["atendimento.cep"] = ERROS.cep;
        break;
      case "pagador":
      case "pagador.nome_completo":
        tela["pagador.nomeCompleto"] = ERROS.nomeCompleto;
        break;
      case "pagador.cpf":
        tela["pagador.cpf"] =
          codigo === "igual_gestante"
            ? ERROS.cpfIgualGestante
            : ERROS.cpfDigito;
        break;
      case "pagador.email":
        tela["pagador.email"] = ERROS.email;
        break;
      case "pagador.endereco":
        tela["pagador.cep"] = ERROS.cep;
        break;
      case "testemunha.nome_completo":
        tela["testemunha.nomeCompleto"] = ERROS.nomeCompleto;
        break;
      case "testemunha.email":
        tela["testemunha.email"] = ERROS.email;
        break;
      case "consentimento":
        tela.consentimento = ERROS.consentimento;
        break;
      default:
        tela["gestante.nomeCompleto"] ??= ERROS.obrigatorio;
    }
  }
  return tela;
}

/** Em que etapa mora cada campo (para voltar à primeira com erro). */
export function etapaDoCampo(campo: string): IdEtapa {
  if (campo.startsWith("pagador.")) return "pagador";
  if (campo.startsWith("testemunha.") || campo === "consentimento")
    return "final";
  if (
    campo.startsWith("atendimento") ||
    CAMPOS_ENDERECO.some((c) => campo === `gestante.${c}`)
  ) {
    return "endereco";
  }
  return "voce";
}
