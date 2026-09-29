"use client";

import * as React from "react";
import { ArrowLeft, CircleAlert, WifiOff } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { TextosFormulario } from "@/lib/dados/tipos-venda";
import { cn } from "@/lib/utils";
import { enviarFormularioContrato } from "../acoes";
import type { ResultadoEnvioTela } from "../estado-acoes";
import { dividirPrimeiraFrase } from "../frases";
import {
  BOTOES,
  ERROS,
  ETAPAS,
  EXEMPLOS,
  FORMULARIO_SEM_TEXTOS,
  ROTULOS,
  rotuloEtapa,
} from "../textos";
import {
  etapasDoFormulario,
  formatarCep,
  formatarCpf,
  formatarData,
  validarEtapa,
  type Erros,
  type IdEtapa,
  type Valores,
} from "../validacao";
import { CampoFamilia, idDoCampo } from "./campo-familia";
import {
  VerificacaoTurnstile,
  type ControleTurnstile,
} from "./verificacao-turnstile";

/**
 * Formulário seguro do contrato (P30 item 2; DESIGN.md 11.9, voz.md 3).
 * Coluna única no creme, etapas curtas mostradas em blocos da régua, a
 * pergunta em 17 px e a razão de cada dado sensível em uma linha. Cada
 * campo é guardado no sessionStorage desta aba enquanto a pessoa digita
 * (salvamento por campo): se a conexão cair ou a página recarregar, nada
 * some. A chave do rascunho é um resumo do link, nunca o link, e o
 * rascunho sai quando o envio é recebido ou o link deixa de valer.
 *
 * Textos que a família lê como conversa vêm prontos do banco
 * (mensagem_modelo formulario_*); rótulos, botões e erros de digitação
 * moram em textos.ts.
 */

interface Props {
  token: string;
  chaveRascunho: string;
  textos: TextosFormulario;
  pedePagador: boolean;
  nomeTestemunha: string | null;
  siteKey: string | null;
  hoje: string;
}

type Aviso =
  | { tipo: "corrigir"; texto: string }
  | { tipo: "conexao"; texto: string }
  | { tipo: "erro"; texto: string };

type Fase =
  | { tipo: "preenchendo" }
  | { tipo: "recebido" }
  | { tipo: "invalido" }
  | { tipo: "limite"; minutos: number | null };

const NOME_ETAPA: Record<IdEtapa, string> = ETAPAS;

function lerRascunho(chave: string): Valores {
  try {
    const bruto = window.sessionStorage.getItem(chave);
    const lido: unknown = bruto ? JSON.parse(bruto) : null;
    if (!lido || typeof lido !== "object" || Array.isArray(lido)) return {};
    const valores: Valores = {};
    for (const [campo, valor] of Object.entries(lido)) {
      if (typeof valor === "string") valores[campo] = valor;
    }
    return valores;
  } catch {
    return {};
  }
}

function gravarRascunho(chave: string, valores: Valores) {
  try {
    window.sessionStorage.setItem(chave, JSON.stringify(valores));
  } catch {
    // Aba privada ou armazenamento cheio: o formulário segue sem rascunho.
  }
}

function apagarRascunho(chave: string) {
  try {
    window.sessionStorage.removeItem(chave);
  } catch {
    // Sem armazenamento, nada a apagar.
  }
}

export function FormularioContrato({
  token,
  chaveRascunho,
  textos,
  pedePagador,
  nomeTestemunha,
  siteKey,
  hoje,
}: Props) {
  const chave = `kz-formulario-${chaveRascunho}`;
  const etapas = React.useMemo(
    () => etapasDoFormulario(pedePagador),
    [pedePagador],
  );
  const [valores, definirValores] = React.useState<Valores>(() => {
    const iniciais: Valores = {};
    if (nomeTestemunha) iniciais["testemunha.nomeCompleto"] = nomeTestemunha;
    return iniciais;
  });
  const [indice, definirIndice] = React.useState(0);
  const [erros, definirErros] = React.useState<Erros>({});
  const [aviso, definirAviso] = React.useState<Aviso | null>(null);
  const [fase, definirFase] = React.useState<Fase>({ tipo: "preenchendo" });
  const [enviando, definirEnviando] = React.useState(false);
  const [verificacaoFalhou, definirVerificacaoFalhou] = React.useState(false);
  const verificacao = React.useRef<string | null>(null);
  const turnstile = React.useRef<ControleTurnstile>(null);
  const tituloEtapa = React.useRef<HTMLHeadingElement>(null);
  const tituloFinal = React.useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = React.useRef(true);

  // O rascunho só é lido depois da hidratação (o servidor não tem acesso
  // ao sessionStorage), e o que estiver lá vale mais que a sugestão.
  React.useEffect(() => {
    // Num callback, depois da pintura: o primeiro quadro é igual ao do
    // servidor (sem hidratação divergente) e o rascunho entra em seguida.
    const espera = window.setTimeout(() => {
      const rascunho = lerRascunho(chave);
      if (Object.keys(rascunho).length > 0) {
        definirValores((atuais) => ({ ...atuais, ...rascunho }));
      }
    }, 0);
    return () => window.clearTimeout(espera);
  }, [chave]);

  React.useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    tituloEtapa.current?.focus();
  }, [indice]);

  React.useEffect(() => {
    if (fase.tipo !== "preenchendo") tituloFinal.current?.focus();
  }, [fase]);

  const etapa = etapas[indice] ?? "voce";
  const ultima = indice === etapas.length - 1;
  const contexto = { pedePagador, hoje };

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

  function focarPrimeiroErro(errosAtuais: Erros) {
    const primeiro = Object.keys(errosAtuais)[0];
    if (!primeiro) return;
    window.requestAnimationFrame(() => {
      const alvo =
        document.getElementById(idDoCampo(primeiro)) ??
        document.querySelector<HTMLElement>(`[name="${primeiro}"]`);
      alvo?.focus();
    });
  }

  function irPara(novoIndice: number) {
    definirAviso(null);
    definirIndice(novoIndice);
    window.scrollTo({ top: 0 });
  }

  function continuar() {
    const daEtapa = validarEtapa(etapa, valores, contexto);
    if (Object.keys(daEtapa).length > 0) {
      definirErros(daEtapa);
      definirAviso({
        tipo: "corrigir",
        texto: textos.corrigir ?? ERROS.obrigatorio,
      });
      focarPrimeiroErro(daEtapa);
      return;
    }
    definirErros({});
    irPara(indice + 1);
  }

  async function enviar() {
    const daEtapa = validarEtapa(etapa, valores, contexto);
    if (Object.keys(daEtapa).length > 0) {
      definirErros(daEtapa);
      definirAviso({
        tipo: "corrigir",
        texto: textos.corrigir ?? ERROS.obrigatorio,
      });
      focarPrimeiroErro(daEtapa);
      return;
    }
    if (!siteKey || verificacaoFalhou) {
      definirAviso({ tipo: "erro", texto: ERROS.verificacaoIndisponivel });
      return;
    }
    if (!verificacao.current) {
      definirAviso({ tipo: "erro", texto: ERROS.verificacao });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      definirAviso({
        tipo: "conexao",
        texto: textos.sem_conexao ?? ERROS.verificacao,
      });
      return;
    }

    definirEnviando(true);
    definirAviso(null);
    let resultado: ResultadoEnvioTela;
    try {
      resultado = await enviarFormularioContrato({
        token,
        valores,
        verificacao: verificacao.current,
      });
    } catch {
      definirEnviando(false);
      turnstile.current?.reiniciar();
      definirAviso({
        tipo: "conexao",
        texto: textos.sem_conexao ?? ERROS.verificacao,
      });
      return;
    }
    definirEnviando(false);
    tratar(resultado);
  }

  function tratar(resultado: ResultadoEnvioTela) {
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
        definirFase({ tipo: "limite", minutos: resultado.minutos });
        window.scrollTo({ top: 0 });
        return;
      case "corrigir": {
        turnstile.current?.reiniciar();
        definirErros(resultado.erros);
        const destino = Math.max(0, etapas.indexOf(resultado.etapa));
        definirIndice(destino);
        definirAviso({
          tipo: "corrigir",
          texto: textos.corrigir ?? ERROS.obrigatorio,
        });
        focarPrimeiroErro(resultado.erros);
        return;
      }
      case "verificacao":
        turnstile.current?.reiniciar();
        definirAviso({
          tipo: "erro",
          texto:
            resultado.motivo === "indisponivel"
              ? ERROS.verificacaoIndisponivel
              : ERROS.verificacao,
        });
        return;
      default:
        turnstile.current?.reiniciar();
        definirAviso({
          tipo: "erro",
          texto: textos.erro_envio ?? FORMULARIO_SEM_TEXTOS,
        });
    }
  }

  const abertura = dividirPrimeiraFrase(textos.abertura ?? "");

  if (fase.tipo !== "preenchendo") {
    const texto =
      fase.tipo === "recebido"
        ? textos.fim
        : fase.tipo === "limite"
          ? textos.limite
          : textos.link_invalido;
    const partes = dividirPrimeiraFrase(texto ?? FORMULARIO_SEM_TEXTOS);
    return (
      <section
        aria-labelledby="formulario-fim"
        className="flex flex-col gap-4"
        data-fase={fase.tipo}
      >
        <h1
          id="formulario-fim"
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

  const v = (campo: string) => valores[campo] ?? "";
  const campo = (
    nome: string,
    rotulo: React.ReactNode,
    extra: Partial<React.ComponentProps<typeof CampoFamilia>> = {},
    formatar?: (texto: string) => string,
  ) => (
    <CampoFamilia
      key={nome}
      nome={nome}
      rotulo={rotulo}
      valor={v(nome)}
      onMudar={(texto) => mudar(nome, formatar ? formatar(texto) : texto)}
      erro={erros[nome]}
      {...extra}
    />
  );

  const blocoEndereco = (prefixo: string) => (
    <div className="flex flex-col gap-5">
      {campo(
        `${prefixo}.cep`,
        ROTULOS.cep,
        {
          inputMode: "numeric",
          autoComplete: "postal-code",
          placeholder: EXEMPLOS.cep,
          maxLength: 9,
          larguraCaixa: "max-w-[14rem]",
        },
        formatarCep,
      )}
      {campo(`${prefixo}.logradouro`, ROTULOS.logradouro, {
        autoComplete: "address-line1",
      })}
      <div className="tablet:grid-cols-[10rem_minmax(0,1fr)] grid grid-cols-1 gap-5">
        {campo(`${prefixo}.numero`, ROTULOS.numero, {
          autoComplete: "off",
        })}
        {campo(`${prefixo}.complemento`, ROTULOS.complemento, {
          opcional: true,
          autoComplete: "address-line2",
        })}
      </div>
      {campo(`${prefixo}.bairro`, ROTULOS.bairro, { autoComplete: "off" })}
      <div className="tablet:grid-cols-[minmax(0,1fr)_8rem] grid grid-cols-1 gap-5">
        {campo(`${prefixo}.cidade`, ROTULOS.cidade, {
          autoComplete: "address-level2",
        })}
        {campo(
          `${prefixo}.uf`,
          ROTULOS.uf,
          {
            autoComplete: "address-level1",
            placeholder: EXEMPLOS.uf,
            maxLength: 2,
            autoCapitalize: "characters",
            larguraCaixa: "max-w-[8rem]",
          },
          (texto) => texto.toUpperCase(),
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-titulo text-1 text-texto font-normal">
          {abertura.primeira || FORMULARIO_SEM_TEXTOS}
        </h1>
        {indice === 0 && abertura.resto ? (
          <p className="text-3 text-texto max-w-leitura">{abertura.resto}</p>
        ) : null}
        {indice === 0 && textos.abertura_apoio ? (
          <p className="text-corpo text-texto-2 max-w-leitura">
            {textos.abertura_apoio}
          </p>
        ) : null}
      </header>

      <form
        noValidate
        aria-labelledby="formulario-etapa"
        className="flex flex-col gap-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (enviando) return;
          if (ultima) void enviar();
          else continuar();
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <EtapasEmBlocos total={etapas.length} atual={indice} />
            <p className="text-corpo text-texto-2 shrink-0">
              {rotuloEtapa(indice + 1, etapas.length)}
            </p>
          </div>
          <h2
            id="formulario-etapa"
            ref={tituloEtapa}
            tabIndex={-1}
            className="font-titulo text-2 text-texto font-medium outline-none"
          >
            {NOME_ETAPA[etapa]}
          </h2>
        </div>

        {aviso ? <AvisoFormulario aviso={aviso} /> : null}

        {etapa === "voce" ? (
          <div className="flex flex-col gap-5">
            {campo("gestante.nomeCompleto", ROTULOS.nomeCompleto, {
              autoComplete: "name",
              autoCapitalize: "words",
            })}
            {campo(
              "gestante.cpf",
              ROTULOS.cpf,
              {
                ajuda: textos.ajuda_cpf,
                inputMode: "numeric",
                autoComplete: "off",
                placeholder: EXEMPLOS.cpf,
                maxLength: 14,
                larguraCaixa: "max-w-[18rem]",
              },
              formatarCpf,
            )}
            {campo(
              "gestante.dataNascimento",
              ROTULOS.dataNascimento,
              {
                inputMode: "numeric",
                autoComplete: "bday",
                placeholder: EXEMPLOS.dataNascimento,
                maxLength: 10,
                larguraCaixa: "max-w-[14rem]",
              },
              formatarData,
            )}
            {campo("gestante.email", ROTULOS.email, {
              ajuda: textos.ajuda_email,
              type: "email",
              inputMode: "email",
              autoComplete: "email",
              autoCapitalize: "none",
              spellCheck: false,
            })}
          </div>
        ) : null}

        {etapa === "endereco" ? (
          <div className="flex flex-col gap-8">
            <fieldset className="flex flex-col gap-5">
              <legend className="text-3 text-texto mb-3 font-semibold">
                {ROTULOS.enderecoCasa}
              </legend>
              {textos.ajuda_endereco ? (
                <p className="text-corpo text-texto-2 -mt-3">
                  {textos.ajuda_endereco}
                </p>
              ) : null}
              {blocoEndereco("gestante")}
            </fieldset>

            <EscolhaFamilia
              nome="atendimentoMesmoEndereco"
              pergunta={
                textos.pergunta_atendimento ?? ROTULOS.enderecoAtendimento
              }
              ajuda={textos.ajuda_atendimento}
              valor={v("atendimentoMesmoEndereco")}
              erro={erros.atendimentoMesmoEndereco}
              opcoes={[
                { valor: "sim", rotulo: ROTULOS.sim },
                { valor: "nao", rotulo: ROTULOS.nao },
              ]}
              onMudar={(valor) => mudar("atendimentoMesmoEndereco", valor)}
            />

            {v("atendimentoMesmoEndereco") === "nao" ? (
              <fieldset className="flex flex-col gap-5">
                <legend className="text-3 text-texto mb-3 font-semibold">
                  {ROTULOS.enderecoAtendimento}
                </legend>
                {blocoEndereco("atendimento")}
              </fieldset>
            ) : null}
          </div>
        ) : null}

        {etapa === "pagador" ? (
          <div className="flex flex-col gap-5">
            {textos.ajuda_pagador ? (
              <p className="text-corpo text-texto max-w-leitura">
                {textos.ajuda_pagador}
              </p>
            ) : null}
            {campo("pagador.nomeCompleto", ROTULOS.pagadorNome, {
              autoComplete: "off",
              autoCapitalize: "words",
            })}
            {campo(
              "pagador.cpf",
              ROTULOS.pagadorCpf,
              {
                inputMode: "numeric",
                autoComplete: "off",
                placeholder: EXEMPLOS.cpf,
                maxLength: 14,
                larguraCaixa: "max-w-[18rem]",
              },
              formatarCpf,
            )}
            {campo("pagador.email", ROTULOS.pagadorEmail, {
              type: "email",
              inputMode: "email",
              autoComplete: "off",
              autoCapitalize: "none",
              spellCheck: false,
            })}
            <fieldset className="mt-3 flex flex-col gap-5">
              <legend className="text-3 text-texto mb-3 font-semibold">
                {ROTULOS.pagadorEndereco}
              </legend>
              {blocoEndereco("pagador")}
            </fieldset>
          </div>
        ) : null}

        {etapa === "final" ? (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              {textos.ajuda_testemunha ? (
                <p className="text-corpo text-texto max-w-leitura">
                  {textos.ajuda_testemunha}
                </p>
              ) : null}
              {campo("testemunha.nomeCompleto", ROTULOS.testemunhaNome, {
                opcional: true,
                autoComplete: "off",
                autoCapitalize: "words",
              })}
              {campo("testemunha.email", ROTULOS.testemunhaEmail, {
                // Com o nome da testemunha escrito (ou sugerido), o e-mail
                // passa a ser pedido: é por ele que ela assina. "(opcional)"
                // ali faria a família pular o campo e voltar com erro.
                opcional: !v("testemunha.nomeCompleto").trim(),
                type: "email",
                inputMode: "email",
                autoComplete: "off",
                autoCapitalize: "none",
                spellCheck: false,
              })}
            </div>

            <Consentimento
              texto={textos.consentimento ?? FORMULARIO_SEM_TEXTOS}
              marcado={v("consentimento") === "sim"}
              erro={erros.consentimento}
              onMudar={(marcado) =>
                mudar("consentimento", marcado ? "sim" : "")
              }
            />

            {textos.privacidade ? (
              <p className="text-corpo text-texto-2 max-w-leitura">
                {textos.privacidade}
              </p>
            ) : null}
          </div>
        ) : null}

        {siteKey ? (
          <VerificacaoTurnstile
            ref={turnstile}
            siteKey={siteKey}
            onToken={(novo) => {
              verificacao.current = novo;
              if (novo) definirVerificacaoFalhou(false);
            }}
            onFalha={() => definirVerificacaoFalhou(true)}
          />
        ) : null}

        <div className="tablet:flex-row tablet:items-center tablet:justify-between flex flex-col-reverse gap-3 pt-2">
          {indice > 0 ? (
            <Botao
              variante="fantasma"
              iconeEsquerda={
                <ArrowLeft
                  className="size-4"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              }
              onClick={() => {
                definirErros({});
                irPara(indice - 1);
              }}
              disabled={enviando}
            >
              {BOTOES.voltar}
            </Botao>
          ) : (
            <span aria-hidden="true" className="tablet:block hidden" />
          )}
          <Botao
            type="submit"
            largaTotal
            className="tablet:w-auto"
            carregando={enviando}
            rotuloCarregando={BOTOES.enviando}
          >
            {ultima ? BOTOES.enviar : BOTOES.continuar}
          </Botao>
        </div>
      </form>
    </div>
  );
}

/**
 * "Etapa 2 de 3" em blocos, a mesma forma da régua de dias (DESIGN.md
 * 11.9): feita em marinho, a atual com a borda dourada (o único acento da
 * tela), as próximas tracejadas ("ainda não"). A frase ao lado é o que o
 * leitor de tela lê; os blocos são decorativos.
 */
function EtapasEmBlocos({ total, atual }: { total: number; atual: number }) {
  return (
    <ol
      aria-hidden="true"
      className="grid min-w-0 flex-1 gap-1.5"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={cn(
            "rounded-pilula h-2.5",
            i < atual && "bg-marinho",
            i === atual && "border-dourado bg-superficie border-2",
            i > atual && "border-marinho-50 border-[1.5px] border-dashed",
          )}
        />
      ))}
    </ol>
  );
}

function AvisoFormulario({ aviso }: { aviso: Aviso }) {
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

function EscolhaFamilia({
  nome,
  pergunta,
  ajuda,
  valor,
  erro,
  opcoes,
  onMudar,
}: {
  nome: string;
  pergunta: React.ReactNode;
  ajuda?: React.ReactNode;
  valor: string;
  erro?: string;
  opcoes: { valor: string; rotulo: string }[];
  onMudar: (valor: string) => void;
}) {
  const id = idDoCampo(nome);
  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={
        [ajuda ? `${id}-ajuda` : null, erro ? `${id}-erro` : null]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <legend className="text-3 text-texto mb-2 font-medium">{pergunta}</legend>
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-corpo text-texto-2 -mt-2">
          {ajuda}
        </p>
      ) : null}
      <div className="tablet:flex-row flex flex-col gap-2">
        {opcoes.map((opcao, i) => {
          const marcado = valor === opcao.valor;
          return (
            <label
              key={opcao.valor}
              className={cn(
                "rounded-pilula text-corpo min-h-toque-campo flex cursor-pointer items-center gap-3 border-[1.5px] px-5 font-medium select-none",
                "has-[:focus-visible]:outline-foco has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                marcado
                  ? "border-acao bg-acao text-acao-texto"
                  : "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
                erro && !marcado && "border-alerta",
              )}
            >
              <input
                type="radio"
                name={nome}
                id={i === 0 ? id : undefined}
                value={opcao.valor}
                checked={marcado}
                onChange={() => onMudar(opcao.valor)}
                className="size-5 shrink-0 accent-current"
              />
              {opcao.rotulo}
            </label>
          );
        })}
      </div>
      {erro ? (
        <p
          id={`${id}-erro`}
          className="text-corpo text-alerta flex items-start gap-2 font-medium"
        >
          <CircleAlert
            className="mt-1 size-4 shrink-0"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          <span>{erro}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

function Consentimento({
  texto,
  marcado,
  erro,
  onMudar,
}: {
  texto: string;
  marcado: boolean;
  erro?: string;
  onMudar: (marcado: boolean) => void;
}) {
  const id = idDoCampo("consentimento");
  return (
    <div
      className={cn(
        "rounded-3 bg-superficie flex flex-col gap-4 border p-5",
        erro ? "border-alerta border-2" : "border-linha",
      )}
    >
      <p id={`${id}-texto`} className="text-corpo text-texto max-w-leitura">
        {texto}
      </p>
      <label
        htmlFor={id}
        className="min-h-toque text-3 text-texto flex cursor-pointer items-center gap-3 font-medium"
      >
        <input
          id={id}
          name="consentimento"
          type="checkbox"
          checked={marcado}
          onChange={(evento) => onMudar(evento.target.checked)}
          aria-describedby={[`${id}-texto`, erro ? `${id}-erro` : null]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={erro ? true : undefined}
          className="rounded-1 size-6 shrink-0"
        />
        {ROTULOS.consentimento}
      </label>
      {erro ? (
        <p
          id={`${id}-erro`}
          className="text-corpo text-alerta flex items-start gap-2 font-medium"
        >
          <CircleAlert
            className="mt-1 size-4 shrink-0"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          <span>{erro}</span>
        </p>
      ) : null}
    </div>
  );
}
