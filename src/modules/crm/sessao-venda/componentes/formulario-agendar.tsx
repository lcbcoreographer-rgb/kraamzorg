"use client";

import * as React from "react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { Condutor } from "@/lib/dados/tipos-venda";
import { acaoAgendarSessao, acaoRemarcarSessao } from "../acoes";
import { estadoInicialSessao } from "../estado-acoes";

/**
 * Marcar ou remarcar a conversa de orientação (P29 item 1). Dia e hora nos
 * seletores nativos do aparelho (no celular abrem a roda de data e hora),
 * quem conduz em pílulas e o link da reunião, que vai no lembrete da
 * véspera. O que a família disse à Isadora fica ao lado, em areia, para
 * quem marca não precisar abrir a conversa.
 */
export function FormularioAgendar({
  modo,
  familiaId,
  sessaoId,
  transferenciaId,
  opcoes,
  condutores,
  condutorAtual,
  linkAtual,
  hoje,
}: {
  modo: "marcar" | "remarcar";
  familiaId?: string;
  sessaoId?: string;
  transferenciaId?: string | null;
  opcoes?: string | null;
  condutores: Condutor[];
  condutorAtual?: string | null;
  linkAtual?: string | null;
  /** "aaaa-mm-dd" em Brasília: nada antes de hoje. */
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState(
    modo === "marcar" ? acaoAgendarSessao : acaoRemarcarSessao,
    estadoInicialSessao,
  );
  const [condutor, definirCondutor] = React.useState(
    condutorAtual ?? condutores[0]?.id ?? "",
  );
  const campos = estado.campos ?? {};

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      {familiaId ? (
        <input type="hidden" name="familiaId" value={familiaId} />
      ) : null}
      {sessaoId ? (
        <input type="hidden" name="sessaoId" value={sessaoId} />
      ) : null}
      {transferenciaId ? (
        <input type="hidden" name="transferenciaId" value={transferenciaId} />
      ) : null}
      {opcoes ? <input type="hidden" name="opcoes" value={opcoes} /> : null}

      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-5">
        <CampoTexto
          rotulo="Dia"
          name="data"
          type="date"
          min={hoje}
          required
          erro={campos.data}
        />
        <CampoTexto
          rotulo="Horário"
          name="hora"
          type="time"
          step={300}
          required
          erro={campos.hora}
          descricao="Horário de Brasília."
        />
      </div>

      {condutores.length > 0 ? (
        <>
          <input type="hidden" name="conduzidaPor" value={condutor} />
          <EscolhaUnica
            rotulo="Quem conduz a conversa"
            name="condutor-escolha"
            opcoes={condutores.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            valor={condutor}
            onMudar={definirCondutor}
            descricao={
              campos.conduzidaPor ??
              "Só quem conduz e a diretoria abrem a gravação e o resumo depois."
            }
          />
        </>
      ) : (
        <FaixaAlerta
          variante="prioritario"
          titulo="Ninguém disponível para conduzir"
        >
          A conversa precisa de alguém da coordenação ou da diretoria com acesso
          ativo. Fale com a diretoria.
        </FaixaAlerta>
      )}

      <CampoTexto
        rotulo="Link da reunião"
        name="linkReuniao"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://"
        defaultValue={linkAtual ?? undefined}
        required={modo === "marcar"}
        opcional={modo === "remarcar"}
        erro={campos.linkReuniao}
        descricao={
          modo === "marcar"
            ? "A família recebe este link no lembrete da véspera."
            : "Deixe em branco para manter o link atual."
        }
      />

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}

      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando={modo === "marcar" ? "Marcando" : "Remarcando"}
        disabled={condutores.length === 0}
        largaTotal
        className="tablet:w-auto self-start"
      >
        {modo === "marcar" ? "Marcar a conversa" : "Remarcar a conversa"}
      </Botao>
    </form>
  );
}
