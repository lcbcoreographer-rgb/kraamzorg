"use client";

import * as React from "react";
import { Check, CircleAlert, WifiOff } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { Escala0a10 } from "@/components/ui/escala-0-a-10";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { SimNao } from "@/components/ui/sim-nao";
import type {
  PerguntaPesquisa,
  TextosPesquisa,
} from "@/lib/dados/tipos-ocorrencia";
import { dividirPrimeiraFrase } from "@/modules/crm/formulario/frases";
import {
  VerificacaoTurnstile,
  type ControleTurnstile,
} from "@/modules/crm/formulario/componentes/verificacao-turnstile";
import { cn } from "@/lib/utils";
import { enviarPesquisaFamilia } from "../acoes";
import type { ResultadoEnvioPesquisaTela } from "../estado-acoes";
import {
  ERROS_PESQUISA,
  PESQUISA_SEM_TEXTOS,
  ROTULO_NAO,
  ROTULO_SIM,
} from "../textos";
import {
  montarRespostas,
  validarPesquisa,
  type ErrosPesquisa,
  type ValoresPesquisa,
} from "../validacao";

/**
 * Pesquisa de satisfação da família (P42, DESIGN.md 11.9, voz.md 3). Uma
 * coluna no creme, uma pergunta por bloco, a nota de 0 a 10 primeiro. As
 * respostas ficam guardadas nesta aba enquanto a pessoa preenche; se a
 * conexão cair, nada some. A chave do rascunho é um resumo do link, nunca o
 * link. Os textos que a família lê vêm do banco; o servidor confere tudo de
 * novo e a nota baixa não gera nenhuma mensagem automática.
 */

interface Props {
  token: string;
  chaveRascunho: string;
  nome: string | null;
  perguntas: PerguntaPesquisa[];
  textos: TextosPesquisa;
  siteKey: string | null;
}

type Aviso =
  | { tipo: "corrigir"; texto: string }
  | { tipo: "conexao"; texto: string }
  | { tipo: "erro"; texto: string };

type Fase =
  | { tipo: "preenchendo" }
  | { tipo: "recebido" }
  | { tipo: "invalido" }
  | { tipo: "limite" };

function lerRascunho(chave: string): ValoresPesquisa {
  try {
    const bruto = window.sessionStorage.getItem(chave);
    const lido: unknown = bruto ? JSON.parse(bruto) : null;
    if (!lido || typeof lido !== "object" || Array.isArray(lido)) return {};
    const valores: ValoresPesquisa = {};
    for (const [campo, valor] of Object.entries(lido)) {
      if (typeof valor === "string") valores[campo] = valor;
    }
    return valores;
  } catch {
    return {};
  }
}

function gravarRascunho(chave: string, valores: ValoresPesquisa) {
  try {
    window.sessionStorage.setItem(chave, JSON.stringify(valores));
  } catch {
    // Aba privada ou armazenamento cheio: a pesquisa segue sem rascunho.
  }
}

function apagarRascunho(chave: string) {
  try {
    window.sessionStorage.removeItem(chave);
  } catch {
    // Sem armazenamento, nada a apagar.
  }
}

export function FormularioPesquisa({
  token,
  chaveRascunho,
  nome,
  perguntas,
  textos,
  siteKey,
}: Props) {
  const chave = `kz-pesquisa-${chaveRascunho}`;
  const [valores, definirValores] = React.useState<ValoresPesquisa>({});
  const [erros, definirErros] = React.useState<ErrosPesquisa>({});
  const [aviso, definirAviso] = React.useState<Aviso | null>(null);
  const [fase, definirFase] = React.useState<Fase>({ tipo: "preenchendo" });
  const [enviando, definirEnviando] = React.useState(false);
  const [verificacaoFalhou, definirVerificacaoFalhou] = React.useState(false);
  const verificacao = React.useRef<string | null>(null);
  const turnstile = React.useRef<ControleTurnstile>(null);
  const tituloFinal = React.useRef<HTMLHeadingElement>(null);

  // O rascunho só é lido depois da hidratação (o servidor não tem acesso ao sessionStorage).
  React.useEffect(() => {
    const espera = window.setTimeout(() => {
      const rascunho = lerRascunho(chave);
      if (Object.keys(rascunho).length > 0) {
        definirValores((atuais) => ({ ...atuais, ...rascunho }));
      }
    }, 0);
    return () => window.clearTimeout(espera);
  }, [chave]);

  React.useEffect(() => {
    if (fase.tipo !== "preenchendo") tituloFinal.current?.focus();
  }, [fase]);

  function mudar(campo: string, valor: string) {
    definirValores((atuais) => {
      const novos = { ...atuais, [campo]: valor };
      gravarRascunho(chave, novos);
      return novos;
    });
    if (erros[campo]) {
      definirErros((atuais) => {
        const { [campo]: _removido, ...resto } = atuais;
        return resto;
      });
    }
  }

  function focarPrimeiroErro(errosAtuais: Record<string, string>) {
    const primeiro = Object.keys(errosAtuais)[0];
    if (!primeiro) return;
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-pergunta="${primeiro}"]`)
        ?.scrollIntoView({ block: "center" });
      document
        .querySelector<HTMLElement>(
          `[data-pergunta="${primeiro}"] input, [data-pergunta="${primeiro}"] textarea`,
        )
        ?.focus();
    });
  }

  async function enviar() {
    const encontrados = validarPesquisa(perguntas, valores);
    if (Object.keys(encontrados).length > 0) {
      definirErros(encontrados);
      definirAviso({
        tipo: "corrigir",
        texto: textos.corrigir ?? ERROS_PESQUISA.obrigatorio,
      });
      focarPrimeiroErro(encontrados);
      return;
    }
    if (!siteKey || verificacaoFalhou) {
      definirAviso({
        tipo: "erro",
        texto: ERROS_PESQUISA.verificacaoIndisponivel,
      });
      return;
    }
    if (!verificacao.current) {
      definirAviso({ tipo: "erro", texto: ERROS_PESQUISA.verificacao });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      definirAviso({ tipo: "conexao", texto: ERROS_PESQUISA.conexao });
      return;
    }

    definirEnviando(true);
    definirAviso(null);
    let resultado: ResultadoEnvioPesquisaTela;
    try {
      resultado = await enviarPesquisaFamilia({
        token,
        respostas: montarRespostas(perguntas, valores),
        verificacao: verificacao.current,
      });
    } catch {
      definirEnviando(false);
      turnstile.current?.reiniciar();
      definirAviso({ tipo: "conexao", texto: ERROS_PESQUISA.conexao });
      return;
    }
    definirEnviando(false);
    tratar(resultado);
  }

  function tratar(resultado: ResultadoEnvioPesquisaTela) {
    switch (resultado.situacao) {
      case "recebido":
        apagarRascunho(chave);
        definirFase({ tipo: "recebido" });
        window.scrollTo({ top: 0 });
        return;
      case "invalido":
        apagarRascunho(chave);
        definirFase({ tipo: "invalido" });
        window.scrollTo({ top: 0 });
        return;
      case "limite":
        definirFase({ tipo: "limite" });
        window.scrollTo({ top: 0 });
        return;
      case "corrigir": {
        turnstile.current?.reiniciar();
        const daTela: ErrosPesquisa = {};
        for (const [campo, codigo] of Object.entries(resultado.erros)) {
          daTela[campo] = codigo === "obrigatorio" ? "obrigatorio" : "invalido";
        }
        definirErros(daTela);
        definirAviso({
          tipo: "corrigir",
          texto: textos.corrigir ?? ERROS_PESQUISA.obrigatorio,
        });
        focarPrimeiroErro(daTela);
        return;
      }
      case "verificacao":
        turnstile.current?.reiniciar();
        definirAviso({
          tipo: "erro",
          texto:
            resultado.motivo === "indisponivel"
              ? ERROS_PESQUISA.verificacaoIndisponivel
              : ERROS_PESQUISA.verificacao,
        });
        return;
      default:
        turnstile.current?.reiniciar();
        definirAviso({ tipo: "erro", texto: ERROS_PESQUISA.envio });
    }
  }

  if (fase.tipo !== "preenchendo") {
    const texto =
      fase.tipo === "recebido"
        ? textos.agradecimento
        : fase.tipo === "limite"
          ? textos.limite
          : textos.link_invalido;
    const partes = dividirPrimeiraFrase(
      (texto ?? PESQUISA_SEM_TEXTOS).replace(/\{nome\}/g, nome ?? ""),
    );
    return (
      <section
        aria-labelledby="pesquisa-fim"
        className={cn(
          "flex flex-col gap-4",
          fase.tipo === "recebido"
            ? "rounded-colo bg-salvia-clara px-5 pt-6 pb-12"
            : "rounded-3 bg-superficie border-linha border p-5",
        )}
        data-fase={fase.tipo}
      >
        {fase.tipo === "recebido" ? (
          <span
            aria-hidden="true"
            className="rounded-pilula bg-salvia-media inline-flex size-12 items-center justify-center"
          >
            <Check className="size-6" strokeWidth={2} />
          </span>
        ) : null}
        <h1
          id="pesquisa-fim"
          ref={tituloFinal}
          tabIndex={-1}
          className="font-titulo text-1 text-texto font-normal outline-none"
        >
          {partes.primeira}
        </h1>
        {partes.resto ? (
          <p className="text-3 text-texto max-w-leitura">{partes.resto}</p>
        ) : null}
      </section>
    );
  }

  const abertura = (textos.abertura ?? "")
    .replace(/\{nome\}/g, nome ?? "")
    .trim();

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-colo bg-dourado-claro flex flex-col gap-3 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {textos.titulo ?? PESQUISA_SEM_TEXTOS}
        </h1>
        {abertura ? (
          <p className="text-3 text-texto max-w-leitura">{abertura}</p>
        ) : null}
      </header>

      <form
        noValidate
        aria-label={textos.titulo ?? "Pesquisa"}
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!enviando) void enviar();
        }}
      >
        {aviso ? <AvisoPesquisa aviso={aviso} /> : null}

        {perguntas.map((pergunta) => (
          // Uma pergunta por cartão, como no checklist (direção "Colo"):
          // sem resposta, branco com sombra; respondida, assenta em areia.
          <div
            key={pergunta.id}
            data-pergunta={pergunta.id}
            className={cn(
              "rounded-3 ease-estado p-5 transition-[background-color,box-shadow] duration-220",
              (valores[pergunta.id] ?? "") !== ""
                ? "bg-areia-clara"
                : "bg-superficie shadow-1",
              erros[pergunta.id] && "outline-alerta-borda outline outline-2",
            )}
          >
            <Pergunta
              pergunta={pergunta}
              valor={valores[pergunta.id] ?? ""}
              erro={erros[pergunta.id]}
              onMudar={(valor) => mudar(pergunta.id, valor)}
            />
          </div>
        ))}

        {siteKey ? (
          <VerificacaoTurnstile
            ref={turnstile}
            siteKey={siteKey}
            onToken={(t) => {
              verificacao.current = t;
            }}
            onFalha={() => definirVerificacaoFalhou(true)}
          />
        ) : null}

        <div className="pt-2">
          <Botao
            type="submit"
            largaTotal
            carregando={enviando}
            rotuloCarregando="Enviando"
          >
            {textos.enviar ?? "Enviar as minhas respostas"}
          </Botao>
        </div>
      </form>
    </div>
  );
}

function Pergunta({
  pergunta,
  valor,
  erro,
  onMudar,
}: {
  pergunta: PerguntaPesquisa;
  valor: string;
  erro: "obrigatorio" | "invalido" | undefined;
  onMudar: (valor: string) => void;
}) {
  const rotulo = pergunta.obrigatoria
    ? pergunta.texto
    : `${pergunta.texto} (opcional)`;
  const mensagemErro = erro ? ERROS_PESQUISA[erro] : undefined;
  return (
    <div className="flex flex-col gap-3">
      {pergunta.tipo === "escala_0_10" ? (
        <Escala0a10
          rotulo={rotulo}
          name={pergunta.id}
          valor={valor === "" ? undefined : Number(valor)}
          onMudar={(n) => onMudar(String(n))}
          extremoMin={pergunta.rotuloMin}
          extremoMax={pergunta.rotuloMax}
          tamanhoTexto="familia"
        />
      ) : pergunta.tipo === "sim_nao" ? (
        <SimNao
          pergunta={rotulo}
          name={pergunta.id}
          valor={valor === "sim" || valor === "nao" ? valor : undefined}
          onMudar={onMudar}
          rotuloSim={ROTULO_SIM}
          rotuloNao={ROTULO_NAO}
          arranjo="cartao"
        />
      ) : pergunta.tipo === "opcao" ? (
        <EscolhaUnica
          rotulo={rotulo}
          name={pergunta.id}
          opcoes={(pergunta.opcoes ?? []).map((o) => ({
            valor: o.valor,
            rotulo: o.rotulo,
          }))}
          valor={valor}
          onMudar={onMudar}
          tamanhoTexto="familia"
        />
      ) : (
        <CampoTexto
          rotulo={pergunta.texto}
          name={pergunta.id}
          multilinha
          linhas={4}
          maxLength={2000}
          opcional={!pergunta.obrigatoria}
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
        />
      )}
      {mensagemErro ? (
        <p
          role="alert"
          className="text-apoio text-alerta flex items-start gap-2 font-medium"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {mensagemErro}
        </p>
      ) : null}
    </div>
  );
}

function AvisoPesquisa({ aviso }: { aviso: Aviso }) {
  const Icone = aviso.tipo === "conexao" ? WifiOff : CircleAlert;
  return (
    <div
      role="alert"
      className="rounded-2 border-linha bg-superficie flex items-start gap-3 border p-4"
    >
      <Icone
        className={cn(
          "mt-0.5 size-5 shrink-0",
          aviso.tipo === "conexao" ? "text-texto-2" : "text-alerta",
        )}
        aria-hidden="true"
        strokeWidth={1.75}
      />
      <p className="text-corpo text-texto">{aviso.texto}</p>
    </div>
  );
}
