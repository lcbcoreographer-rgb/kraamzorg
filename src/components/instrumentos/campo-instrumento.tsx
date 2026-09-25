"use client";

import * as React from "react";
import { CampoTexto } from "@/components/ui/campo-texto";
import { CampoNumero } from "@/components/ui/campo-numero";
import { SimNao } from "@/components/ui/sim-nao";
import { Escala0a10 } from "@/components/ui/escala-0-a-10";
import { EscolhaUnica, type OpcaoEscolha } from "@/components/ui/escolha-unica";
import { EscolhaMultipla } from "@/components/ui/escolha-multipla";
import { Botao } from "@/components/ui/botao";
import type { Campo, Opcao } from "@/lib/instrumentos/schema";
import type {
  EnderecoCampo,
  ValorAusenciaJustificada,
  ValorCampo,
  ValorEscalaComplemento,
  ValorPartes,
  ValorSimNaoTexto,
} from "@/lib/instrumentos/respostas";
import { textosFormulario as t } from "./textos";

/**
 * Um campo do instrumento, desenhado com os controles do design system
 * (DESIGN.md seção 6) na densidade da enfermeira: alvo de 52 px, um toque
 * por resposta. Nada vem marcado: sem valor, nenhuma opção aparece
 * escolhida (DESIGN.md seção 8, "pré-preencher resposta clínica").
 *
 * `aoMudar(valor, salvar)`: `salvar` verdadeiro grava pelo motor offline
 * (toque em opção, saída do campo de texto ou de número); falso só
 * atualiza a tela enquanto a pessoa digita.
 */
export interface CampoInstrumentoProps {
  campo: Campo;
  endereco: EnderecoCampo;
  valor: ValorCampo | undefined;
  aoMudar: (valor: ValorCampo | null, salvar: boolean) => void;
  /** Texto mostrado em campo `automatico` (ex: nome de quem coleta, IG calculada). */
  valorAutomatico?: string;
}

function idDom(endereco: EnderecoCampo): string {
  return ["campo", endereco.bloco, endereco.campo, endereco.bebe ?? ""]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function rotuloCom(campo: Campo): React.ReactNode {
  if (!campo.obrigatorio || campo.tipo === "automatico") return campo.rotulo;
  return (
    <>
      {campo.rotulo}{" "}
      <span className="text-texto-2 font-normal">{t.obrigatorio}</span>
    </>
  );
}

function paraOpcoesEscolha(opcoes: Opcao[]): OpcaoEscolha[] {
  return opcoes.map((opcao) => ({
    valor: opcao.valor,
    rotulo: opcao.ajuda ? (
      <span className="flex flex-col py-1">
        <span>{opcao.rotulo}</span>
        <span className="text-mini font-normal opacity-80">{opcao.ajuda}</span>
      </span>
    ) : (
      opcao.rotulo
    ),
  }));
}

function numeroParaTexto(valor: number | null | undefined): string {
  return typeof valor === "number" ? String(valor).replace(".", ",") : "";
}

/** "36,5" → 36.5; "" → null; texto que não é número → undefined. */
function textoParaNumero(texto: string): number | null | undefined {
  const normalizado = texto.trim().replace(",", ".");
  if (normalizado === "") return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : undefined;
}

function Ajuda({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-apoio text-texto-2">
      {children}
    </p>
  );
}

export function CampoInstrumento({
  campo,
  endereco,
  valor,
  aoMudar,
  valorAutomatico,
}: CampoInstrumentoProps) {
  const id = idDom(endereco);
  const rotulo = rotuloCom(campo);

  switch (campo.tipo) {
    case "texto":
      return (
        <CampoDeTexto
          campo={campo}
          id={id}
          rotulo={rotulo}
          valor={valor}
          aoMudar={aoMudar}
        />
      );

    case "texto_longo":
      return (
        <CampoTexto
          id={id}
          rotulo={rotulo}
          multilinha
          linhas={4}
          descricao={campo.ajuda}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => aoMudar(e.target.value, false)}
          onBlur={(e) =>
            aoMudar(e.target.value.trim() === "" ? null : e.target.value, true)
          }
        />
      );

    case "sim_nao":
      return (
        <div data-campo={id}>
          <SimNao
            pergunta={rotulo}
            name={id}
            rotuloSim={t.sim}
            rotuloNao={t.nao}
            valor={
              typeof valor === "boolean" ? (valor ? "sim" : "nao") : undefined
            }
            onMudar={(v) => aoMudar(v === "sim", true)}
          />
          {campo.ajuda ? <Ajuda>{campo.ajuda}</Ajuda> : null}
        </div>
      );

    case "sim_nao_texto": {
      const atual =
        valor && typeof valor === "object" && "resposta" in valor
          ? (valor as ValorSimNaoTexto)
          : undefined;
      const quando = campo.texto_quando ?? "sim";
      const textoAparece = (resposta: boolean) =>
        quando === "sempre" ||
        (quando === "sim" && resposta) ||
        (quando === "nao" && !resposta);
      const mostraTexto = atual !== undefined && textoAparece(atual.resposta);
      return (
        <div data-campo={id} className="flex flex-col gap-3">
          <SimNao
            pergunta={rotulo}
            name={id}
            rotuloSim={t.sim}
            rotuloNao={t.nao}
            valor={atual ? (atual.resposta ? "sim" : "nao") : undefined}
            onMudar={(v) => {
              // O texto complementar só acompanha a resposta que o pede
              // ("Queixa de dor? Local" some no não, e o local digitado
              // antes não fica gravado escondido).
              const resposta = v === "sim";
              const texto = textoAparece(resposta) ? atual?.texto : undefined;
              aoMudar(
                texto !== undefined ? { resposta, texto } : { resposta },
                true,
              );
            }}
          />
          {campo.ajuda ? <Ajuda>{campo.ajuda}</Ajuda> : null}
          {mostraTexto ? (
            <CampoTexto
              id={`${id}-texto`}
              rotulo={campo.rotulo_texto ?? t.detalhe}
              value={atual?.texto ?? ""}
              onChange={(e) =>
                aoMudar(
                  { resposta: atual.resposta, texto: e.target.value },
                  false,
                )
              }
              onBlur={(e) =>
                aoMudar(
                  { resposta: atual.resposta, texto: e.target.value },
                  true,
                )
              }
            />
          ) : null}
        </div>
      );
    }

    case "escala": {
      const composto =
        valor && typeof valor === "object" && "valor" in valor
          ? (valor as ValorEscalaComplemento)
          : undefined;
      const nota =
        typeof valor === "number" ? valor : (composto?.valor ?? undefined);
      const mudarNota = (n: number) =>
        aoMudar(
          campo.complemento
            ? { valor: n, complemento: composto?.complemento }
            : n,
          true,
        );
      const escala =
        campo.min === 0 && campo.max === 10 && !campo.pontos ? (
          <Escala0a10
            rotulo={rotulo}
            name={id}
            valor={nota}
            onMudar={mudarNota}
          />
        ) : (
          <EscolhaUnica
            rotulo={rotulo}
            name={id}
            tamanho="checklist"
            opcoes={Array.from(
              { length: campo.max - campo.min + 1 },
              (_, i) => {
                const numero = campo.min + i;
                const ponto = campo.pontos?.find((p) => p.valor === numero);
                return {
                  valor: String(numero),
                  rotulo: ponto
                    ? `${numero} · ${ponto.rotulo}`
                    : String(numero),
                };
              },
            )}
            valor={nota === undefined ? undefined : String(nota)}
            onMudar={(v) => mudarNota(Number(v))}
          />
        );
      return (
        <div data-campo={id} className="flex flex-col gap-3 py-2">
          {escala}
          {campo.ajuda ? <Ajuda>{campo.ajuda}</Ajuda> : null}
          {campo.complemento ? (
            <EscolhaUnica
              rotulo={campo.complemento.rotulo}
              name={`${id}-complemento`}
              tamanho="checklist"
              opcoes={paraOpcoesEscolha(campo.complemento.opcoes)}
              valor={composto?.complemento}
              onMudar={(c) =>
                aoMudar(
                  { valor: composto?.valor ?? null, complemento: c },
                  true,
                )
              }
            />
          ) : null}
        </div>
      );
    }

    case "opcao_unica":
      return (
        <div data-campo={id} className="py-2">
          <EscolhaUnica
            rotulo={rotulo}
            name={id}
            tamanho="checklist"
            opcoes={paraOpcoesEscolha(campo.opcoes)}
            descricao={campo.ajuda}
            valor={typeof valor === "string" ? valor : undefined}
            onMudar={(v) => aoMudar(v, true)}
          />
        </div>
      );

    case "multipla": {
      const marcados = Array.isArray(valor) ? valor : [];
      const exclusivas = new Set(
        campo.opcoes.filter((o) => o.exclusiva).map((o) => o.valor),
      );
      const rotuloDe = (v: string) =>
        campo.opcoes.find((o) => o.valor === v)?.rotulo ?? v;
      return (
        <div data-campo={id} className="py-2">
          <EscolhaMultipla
            rotulo={rotulo}
            name={id}
            tamanho="checklist"
            opcoes={paraOpcoesEscolha(campo.opcoes)}
            descricao={
              campo.ordenada
                ? t.ordemEscolhida(marcados.map(rotuloDe))
                : campo.ajuda
            }
            valores={marcados}
            onMudar={(proximos) => {
              const novo = proximos.find((v) => !marcados.includes(v));
              let resultado = proximos;
              if (novo !== undefined && exclusivas.has(novo))
                resultado = [novo];
              else if (novo !== undefined)
                resultado = proximos.filter((v) => !exclusivas.has(v));
              aoMudar(resultado.length > 0 ? resultado : null, true);
            }}
          />
        </div>
      );
    }

    case "numero":
      return campo.partes ? (
        <NumeroEmPartes
          campo={campo}
          id={id}
          rotulo={rotulo}
          valor={valor}
          aoMudar={aoMudar}
        />
      ) : (
        <NumeroSimples
          campo={campo}
          id={id}
          rotulo={rotulo}
          valor={valor}
          aoMudar={aoMudar}
        />
      );

    case "data":
    case "hora":
      return (
        <CampoTexto
          id={id}
          rotulo={rotulo}
          type={campo.tipo === "data" ? "date" : "time"}
          descricao={campo.ajuda}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) =>
            aoMudar(e.target.value === "" ? null : e.target.value, true)
          }
        />
      );

    case "automatico":
      return (
        <div
          data-campo={id}
          className="border-linha flex flex-col gap-1 border-b py-3"
        >
          <span className="text-apoio text-texto font-semibold">
            {campo.rotulo}
          </span>
          {valorAutomatico ? (
            <span className="text-dado text-texto font-mono">
              {valorAutomatico}
            </span>
          ) : null}
          <Ajuda>{campo.ajuda ?? t.automatico[campo.origem]}</Ajuda>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------

type CampoDe<T extends Campo["tipo"]> = Extract<Campo, { tipo: T }>;

function CampoDeTexto({
  campo,
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  campo: CampoDe<"texto">;
  id: string;
  rotulo: React.ReactNode;
  valor: ValorCampo | undefined;
  aoMudar: CampoInstrumentoProps["aoMudar"];
}) {
  const ausencia =
    valor && typeof valor === "object" && "ausente" in valor
      ? (valor as ValorAusenciaJustificada)
      : undefined;

  if (campo.justificar_ausencia && ausencia) {
    return (
      <div data-campo={id} className="flex flex-col gap-2">
        <CampoTexto
          id={`${id}-justificativa`}
          rotulo={campo.justificar_ausencia.rotulo_justificativa}
          multilinha
          linhas={3}
          value={ausencia.justificativa}
          onChange={(e) =>
            aoMudar({ ausente: true, justificativa: e.target.value }, false)
          }
          onBlur={(e) =>
            aoMudar({ ausente: true, justificativa: e.target.value }, true)
          }
        />
        <Botao
          type="button"
          variante="fantasma"
          tamanho="compacto"
          className="self-start"
          onClick={() => aoMudar(null, true)}
        >
          {t.voltarAoValor}
        </Botao>
      </div>
    );
  }

  return (
    <div data-campo={id} className="flex flex-col gap-2">
      <CampoTexto
        id={id}
        rotulo={rotulo}
        type={campo.teclado === "telefone" ? "tel" : "text"}
        descricao={campo.ajuda}
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => aoMudar(e.target.value, false)}
        onBlur={(e) =>
          aoMudar(e.target.value.trim() === "" ? null : e.target.value, true)
        }
      />
      {campo.justificar_ausencia ? (
        <Botao
          type="button"
          variante="fantasma"
          tamanho="compacto"
          className="self-start"
          onClick={() => aoMudar({ ausente: true, justificativa: "" }, false)}
        >
          {campo.justificar_ausencia.rotulo_acao}
        </Botao>
      ) : null}
    </div>
  );
}

function foraDaFaixa(campo: CampoDe<"numero">, numero: number): boolean {
  return (
    (campo.faixa?.min !== undefined && numero < campo.faixa.min) ||
    (campo.faixa?.max !== undefined && numero > campo.faixa.max)
  );
}

function NumeroSimples({
  campo,
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  campo: CampoDe<"numero">;
  id: string;
  rotulo: React.ReactNode;
  valor: ValorCampo | undefined;
  aoMudar: CampoInstrumentoProps["aoMudar"];
}) {
  const [texto, definirTexto] = React.useState(
    numeroParaTexto(typeof valor === "number" ? valor : undefined),
  );
  const [erro, definirErro] = React.useState<string | undefined>();

  return (
    <CampoNumero
      id={id}
      rotulo={rotulo}
      unidade={campo.unidade}
      faixa={campo.faixa}
      descricao={campo.ajuda}
      erro={erro}
      value={texto}
      onChange={(e) => definirTexto(e.target.value)}
      onBlur={(e) => {
        const numero = textoParaNumero(e.target.value);
        if (numero === undefined) {
          definirErro(t.numeroInvalido);
          return;
        }
        if (numero !== null && foraDaFaixa(campo, numero)) {
          definirErro(t.foraDaFaixa);
          return;
        }
        definirErro(undefined);
        aoMudar(numero, true);
      }}
    />
  );
}

function NumeroEmPartes({
  campo,
  id,
  rotulo,
  valor,
  aoMudar,
}: {
  campo: CampoDe<"numero">;
  id: string;
  rotulo: React.ReactNode;
  valor: ValorCampo | undefined;
  aoMudar: CampoInstrumentoProps["aoMudar"];
}) {
  const partes = campo.partes ?? [];
  const atual =
    valor && typeof valor === "object" && "partes" in valor
      ? (valor as ValorPartes).partes
      : {};
  const [textos, definirTextos] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(partes.map((p) => [p.id, numeroParaTexto(atual[p.id])])),
  );
  const [erro, definirErro] = React.useState<string | undefined>();

  function salvar(proximos: Record<string, string>) {
    const numeros: Record<string, number | null> = {};
    for (const parte of partes) {
      const numero = textoParaNumero(proximos[parte.id] ?? "");
      if (numero === undefined) {
        definirErro(t.numeroInvalido);
        return;
      }
      numeros[parte.id] = numero;
    }
    definirErro(undefined);
    const vazio = Object.values(numeros).every((n) => n === null);
    aoMudar(vazio ? null : { partes: numeros }, true);
  }

  return (
    <fieldset data-campo={id} className="flex flex-col gap-2 border-0 p-0 py-2">
      <legend className="text-apoio text-texto mb-2 font-semibold">
        {rotulo}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {partes.map((parte) => (
          <CampoNumero
            key={parte.id}
            id={`${id}-${parte.id}`}
            rotulo={parte.rotulo}
            unidade={campo.unidade}
            value={textos[parte.id] ?? ""}
            onChange={(e) =>
              definirTextos((anterior) => ({
                ...anterior,
                [parte.id]: e.target.value,
              }))
            }
            onBlur={(e) => salvar({ ...textos, [parte.id]: e.target.value })}
          />
        ))}
      </div>
      {erro ? (
        <p role="alert" className="text-apoio text-alerta font-medium">
          {erro}
        </p>
      ) : campo.ajuda ? (
        <Ajuda>{campo.ajuda}</Ajuda>
      ) : null}
    </fieldset>
  );
}
