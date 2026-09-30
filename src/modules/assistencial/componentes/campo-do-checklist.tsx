"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { CampoInstrumento } from "@/components/instrumentos";
import {
  ehCampoDeTextoRepetivel,
  referenciaNumerica,
  type ReferenciaDoDia,
  type TextoTrazido,
} from "@/lib/checklist/referencia";
import type { EnderecoCampo, ValorCampo } from "@/lib/instrumentos/respostas";
import type { Bloco, Campo } from "@/lib/instrumentos/schema";
import { cn } from "@/lib/utils";
import { textos } from "../checklist/textos";

/**
 * Um campo do checklist na tela da enfermeira: o controle do instrumento
 * (`CampoInstrumento`, um toque por resposta, nada marcado) mais o que só o
 * checklist tem (P39 item 1):
 *
 * - Campo numérico mostra "No D3 foi 36,9 °C." só como referência; nunca
 *   preenche.
 * - Campo de texto que costuma se repetir oferece "Trazer o texto do D3".
 *   O texto chega num quadro tracejado dourado ("confirme antes de
 *   salvar") e só vira resposta com "Vale para hoje". Sem confirmação, o
 *   campo não conta como respondido e não é assinado.
 * - Colar texto que cita outra família do aparelho avisa antes de salvar.
 * - Campo que disparou alerta ganha o contorno do estado (vermelho, ou
 *   ameixa na família em luto ou intercorrência).
 * - Botões de consulta do DOC 4 (LATCH, NTS, laserterapia) junto do campo.
 */
export interface CampoDoChecklistProps {
  campo: Campo;
  endereco: EnderecoCampo;
  valor: ValorCampo | undefined;
  aoMudar: (valor: ValorCampo | null, salvar: boolean) => void;
  /** Valor do dia anterior para este campo, se houver. */
  referencia: ReferenciaDoDia | null;
  /** Texto de outro dia esperando confirmação, se houver. */
  trazido: TextoTrazido | undefined;
  aoTrazer: () => void;
  aoConfirmarTrazido: (texto: string) => void;
  aoDescartarTrazido: () => void;
  /** Alerta ligado a este campo: contorno do estado. */
  alerta: "imediato" | "prioritario" | "sensivel" | null;
  /** Blocos do DOC 4 que apoiam este campo (janela de consulta). */
  apoios: Bloco[];
  aoAbrirApoio: (bloco: Bloco) => void;
  nomeDaFamilia: string;
  /** Nomes de outras famílias que estão neste aparelho (colagem vigiada). */
  nomesDeOutrasFamilias: string[];
  valorAutomatico?: string;
}

export function CampoDoChecklist({
  campo,
  endereco,
  valor,
  aoMudar,
  referencia,
  trazido,
  aoTrazer,
  aoConfirmarTrazido,
  aoDescartarTrazido,
  alerta,
  apoios,
  aoAbrirApoio,
  nomeDaFamilia,
  nomesDeOutrasFamilias,
  valorAutomatico,
}: CampoDoChecklistProps) {
  const [colado, definirColado] = React.useState<string | null>(null);

  const referenciaNumero =
    referencia && campo.tipo === "numero"
      ? referenciaNumerica(campo, referencia.valor)
      : null;
  const respondido =
    valor !== undefined &&
    valor !== null &&
    !(typeof valor === "string" && valor.trim() === "");
  const podeTrazer =
    ehCampoDeTextoRepetivel(campo) &&
    referencia !== null &&
    typeof referencia.valor === "string" &&
    !respondido &&
    !trazido;

  function vigiarColagem(evento: React.ClipboardEvent<HTMLDivElement>) {
    const texto = evento.clipboardData?.getData("text") ?? "";
    const normalizado = texto.toLocaleLowerCase("pt-BR");
    const citada = nomesDeOutrasFamilias.find(
      (nome) =>
        nome !== nomeDaFamilia &&
        normalizado.includes(nome.toLocaleLowerCase("pt-BR")),
    );
    definirColado(citada ?? null);
  }

  return (
    <div
      onPaste={vigiarColagem}
      data-alerta={alerta ?? undefined}
      className={cn(
        "flex flex-col gap-2",
        alerta &&
          "rounded-2 -mx-2 border-2 px-2 py-2 " +
            (alerta === "sensivel"
              ? "border-sensivel-borda bg-sensivel-lavado"
              : alerta === "imediato"
                ? "border-alerta bg-alerta-lavado"
                : "border-aviso bg-aviso-lavado"),
      )}
    >
      {trazido ? (
        <TextoTrazidoPainel
          campo={campo}
          trazido={trazido}
          nomeDaFamilia={nomeDaFamilia}
          aoConfirmar={aoConfirmarTrazido}
          aoDescartar={aoDescartarTrazido}
        />
      ) : (
        <CampoInstrumento
          campo={campo}
          endereco={endereco}
          valor={valor}
          aoMudar={aoMudar}
          valorAutomatico={valorAutomatico}
        />
      )}

      {referenciaNumero && referencia ? (
        <p className="text-apoio text-texto-2 flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {textos.referencia(referencia.diaNumero, referenciaNumero)}
          </span>
        </p>
      ) : null}

      {podeTrazer && referencia ? (
        <div>
          <Botao variante="fantasma" tamanho="compacto" onClick={aoTrazer}>
            {textos.trazerTexto(referencia.diaNumero)}
          </Botao>
        </div>
      ) : null}

      {colado ? (
        <p className="text-apoio text-aviso-texto font-medium" role="status">
          {textos.textoColadoOutraFamilia(colado)}
        </p>
      ) : null}

      {apoios.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {apoios.map((bloco) => (
            <Botao
              key={bloco.id}
              variante="secundario"
              tamanho="compacto"
              onClick={() => aoAbrirApoio(bloco)}
            >
              {textos.apoio.consultar}: {bloco.titulo}
            </Botao>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TextoTrazidoPainel({
  campo,
  trazido,
  nomeDaFamilia,
  aoConfirmar,
  aoDescartar,
}: {
  campo: Campo;
  trazido: TextoTrazido;
  nomeDaFamilia: string;
  aoConfirmar: (texto: string) => void;
  aoDescartar: () => void;
}) {
  const [texto, definirTexto] = React.useState(trazido.texto);
  const id = React.useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-titulo`}
      className="rounded-2 border-dourado bg-dourado-lavado flex flex-col gap-3 border-2 border-dashed p-3"
    >
      <p id={`${id}-titulo`} className="text-apoio text-texto font-semibold">
        {campo.rotulo}
      </p>
      <p className="text-apoio text-texto font-semibold">
        {textos.textoTrazidoTitulo(trazido.deDia, nomeDaFamilia)}
      </p>
      <CampoTexto
        id={`${id}-texto`}
        rotulo={campo.rotulo}
        multilinha
        linhas={3}
        estado="copiado"
        value={texto}
        onChange={(e) => definirTexto(e.target.value)}
        descricao={textos.textoTrazidoAjuda}
      />
      <div className="flex flex-wrap gap-2">
        <Botao tamanho="compacto" onClick={() => aoConfirmar(texto)}>
          {textos.valeParaHoje}
        </Botao>
        <Botao variante="secundario" tamanho="compacto" onClick={aoDescartar}>
          {textos.apagarEEscrever}
        </Botao>
      </div>
    </div>
  );
}
