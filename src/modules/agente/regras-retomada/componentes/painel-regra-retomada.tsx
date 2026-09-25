"use client";

import { estadoInicialAdmin } from "../../estado-acoes";
import * as React from "react";
import { useActionState, useState } from "react";
import { Bot } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoSalvarRegraRetomada } from "../../admin-acoes";
import { JANELAS_RETOMADA_HORAS } from "../../tipos";
import type { RegraRetomadaTela } from "../dados";

/**
 * Janela de retomada de quem parou de responder (P27 item 1, PRD 11.3;
 * protótipo `comercial-agente-regras.html`, C6). Só a diretoria altera.
 */
export function PainelRegraRetomada({
  regra,
  podeEditar,
}: {
  regra: RegraRetomadaTela;
  podeEditar: boolean;
}) {
  const [estado, acao, salvando] = useActionState(
    acaoSalvarRegraRetomada,
    estadoInicialAdmin,
  );
  const [horas, definirHoras] = useState(
    regra.horas === null ? "" : String(regra.horas),
  );
  // As opções do protótipo (C6) mais o valor gravado, se a diretoria tiver
  // salvo outro pelo banco: a tela nunca esconde o valor em vigor.
  const opcoesHoras = [
    ...new Set([
      ...JANELAS_RETOMADA_HORAS,
      ...(regra.horas === null ? [] : [regra.horas]),
    ]),
  ].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      <FaixaAlerta variante="info" titulo="Quando a Isadora nunca retoma">
        A Isadora nunca retoma conversa de família com freio nem conversa já
        assumida pela equipe.
      </FaixaAlerta>

      {podeEditar ? (
        <form action={acao} className="flex flex-col gap-4">
          <EscolhaUnica
            rotulo="Retomar quem parou de responder depois de"
            name="horas"
            valor={horas}
            onMudar={definirHoras}
            opcoes={opcoesHoras.map((h) => ({
              valor: String(h),
              rotulo: `${h} h${h === 48 ? " (padrão)" : h === 24 ? " (mínimo)" : ""}`,
            }))}
          />
          {estado.erro ? (
            <FaixaAlerta variante="imediato" titulo="Não deu para salvar">
              {estado.erro}
            </FaixaAlerta>
          ) : null}
          {estado.sucesso ? (
            <p className="text-sucesso text-apoio" role="status">
              {estado.sucesso}
            </p>
          ) : null}
          <div>
            <Botao
              type="submit"
              carregando={salvando}
              rotuloCarregando="Salvando"
            >
              Salvar regra de retomada
            </Botao>
          </div>
        </form>
      ) : regra.horas !== null ? (
        <p className="text-corpo text-texto">
          Hoje a retomada acontece{" "}
          <span className="font-mono">{regra.horas} h</span> depois da última
          mensagem. Para mudar, fale com a diretoria.
        </p>
      ) : (
        <p className="text-corpo text-texto">
          A janela de retomada é definida pela diretoria. Para mudar, fale com a
          diretoria.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {regra.textoPosPdf ? (
          <div className="bg-superficie-2 rounded-3 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-texto font-semibold">
                Depois da apresentação
              </span>
              <Selo
                variante={
                  regra.textoPosPdf.status === "aprovado" ? "sucesso" : "aviso"
                }
                icone={<Bot />}
              >
                {regra.textoPosPdf.status === "aprovado"
                  ? "Aprovado"
                  : "Rascunho para aprovação"}
              </Selo>
            </div>
            <p className="text-corpo text-texto">{regra.textoPosPdf.texto}</p>
          </div>
        ) : null}
        {regra.textoPosAbertura ? (
          <div className="bg-superficie-2 rounded-3 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-texto font-semibold">
                Depois só da abertura
              </span>
              <Selo
                variante={
                  regra.textoPosAbertura.status === "aprovado"
                    ? "sucesso"
                    : "aviso"
                }
                icone={<Bot />}
              >
                {regra.textoPosAbertura.status === "aprovado"
                  ? "Aprovado"
                  : "Rascunho para aprovação"}
              </Selo>
            </div>
            <p className="text-corpo text-texto">
              {regra.textoPosAbertura.texto}
            </p>
          </div>
        ) : null}
      </div>

      {regra.atualizadoEm ? (
        <p className="text-mini text-texto-2">
          Última alteração em {formatarDataHora(regra.atualizadoEm)}.
        </p>
      ) : null}
    </div>
  );
}
