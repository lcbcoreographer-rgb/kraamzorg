import "server-only";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import type { Json } from "@/lib/db/types";
import type {
  AberturaPesquisa,
  PerguntaPesquisa,
  PesquisaPublicaRepositorio,
  RespostasPesquisa,
  ResultadoEnvioPesquisa,
  TextosPesquisa,
  TipoPergunta,
} from "../tipos-ocorrencia";
import { exigir } from "./comum";

/**
 * Pesquisa pública na real (P42). Sem usuário logado: o servidor, depois de
 * conferir o Turnstile, chama só public.pesquisa_abrir e public.pesquisa_enviar
 * (0024) com o cliente de serviço (motivo pesquisa_publica), único papel com
 * execute nelas. As funções validam o token de uso único, a validade, o freio e
 * o limite de tentativas por dentro, e nunca devolvem dado da família além do
 * primeiro nome.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const numeroOuNulo = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : null;

function textos(valor: Json | undefined): TextosPesquisa {
  const saida: Record<string, string> = {};
  for (const [chave, t] of Object.entries(objeto(valor))) {
    if (typeof t === "string") saida[chave] = t;
  }
  return saida as TextosPesquisa;
}

function perguntas(valor: Json | undefined): PerguntaPesquisa[] {
  return (Array.isArray(valor) ? valor : []).map((p): PerguntaPesquisa => {
    const x = objeto(p);
    return {
      id: String(x.id),
      tipo: (texto(x.tipo) ?? "texto") as TipoPergunta,
      obrigatoria: x.obrigatoria === true,
      texto: String(x.texto ?? ""),
      ...(Array.isArray(x.opcoes)
        ? {
            opcoes: x.opcoes.map((o) => {
              const y = objeto(o);
              return { valor: String(y.valor), rotulo: String(y.rotulo ?? "") };
            }),
          }
        : {}),
      ...(texto(x.rotulo_min) ? { rotuloMin: texto(x.rotulo_min)! } : {}),
      ...(texto(x.rotulo_max) ? { rotuloMax: texto(x.rotulo_max)! } : {}),
    };
  });
}

export function aberturaPesquisaDoBanco(valor: Json): AberturaPesquisa {
  const r = objeto(valor);
  if (r.situacao === "limite") {
    return { situacao: "limite", minutos: numeroOuNulo(r.minutos), textos: textos(r.textos) };
  }
  if (r.situacao !== "valido") {
    return { situacao: "invalido", textos: textos(r.textos) };
  }
  return {
    situacao: "valido",
    nome: texto(r.nome),
    perguntas: perguntas(r.perguntas),
    textos: textos(r.textos),
  };
}

export function envioPesquisaDoBanco(valor: Json): ResultadoEnvioPesquisa {
  const r = objeto(valor);
  switch (r.situacao) {
    case "recebido":
      return { situacao: "recebido" };
    case "limite":
      return { situacao: "limite", minutos: numeroOuNulo(r.minutos) };
    case "corrigir": {
      const erros: Record<string, string> = {};
      for (const [campo, codigo] of Object.entries(objeto(r.erros))) {
        if (typeof codigo === "string") erros[campo] = codigo;
      }
      return { situacao: "corrigir", erros };
    }
    default:
      return { situacao: "invalido" };
  }
}

interface ClienteRpc {
  rpc(
    nome: string,
    argumentos: Record<string, unknown>,
  ): PromiseLike<{
    data: Json | null;
    error: { code?: string; message?: string } | null;
  }>;
}

export function criarPesquisaPublicaSupabase(): PesquisaPublicaRepositorio {
  const cliente = () =>
    criarClienteServico("pesquisa_publica") as unknown as ClienteRpc;
  return {
    async abrir(token, origem) {
      const resposta = await cliente().rpc("pesquisa_abrir", {
        p_token: token,
        p_origem: origem ?? null,
      });
      return aberturaPesquisaDoBanco(exigir(resposta, "pesquisa_abrir"));
    },
    async enviar(token, respostas: RespostasPesquisa, origem) {
      const resposta = await cliente().rpc("pesquisa_enviar", {
        p_token: token,
        p_respostas: respostas as Json,
        p_origem: origem ?? null,
      });
      return envioPesquisaDoBanco(exigir(resposta, "pesquisa_enviar"));
    },
  };
}
