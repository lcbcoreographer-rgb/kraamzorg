"use client";

import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { Candidata, PapelDesignacao } from "@/lib/dados/tipos-operacao";
import { estadoInicialOperacao } from "../../comum/estado-acoes";
import { useAcao } from "../../comum/use-acao";
import {
  ROTULO_ESTADO_ENFERMEIRA,
  ROTULO_PAPEL_DESIGNACAO,
} from "../../comum/rotulos";
import { acaoAtribuirDesignacao, acaoOferecerDesignacao } from "../acoes";

/** Uma linha por enfermeira: nome e, em texto pequeno, o que a coordenação precisa saber. */
function rotuloCandidata(c: Candidata) {
  const notas: string[] = [];
  notas.push(c.naRegiao ? "na praça da família" : "fora da praça");
  if (c.estadoHoje && ROTULO_ESTADO_ENFERMEIRA[c.estadoHoje]) {
    notas.push(ROTULO_ESTADO_ENFERMEIRA[c.estadoHoje]!.toLowerCase());
  }
  if (c.titularesNaJanela > 0) {
    notas.push(
      `${c.titularesNaJanela} ${c.titularesNaJanela === 1 ? "família" : "famílias"} na janela`,
    );
  }
  if (c.bloqueioNaJanela) notas.push("com bloqueio na janela");
  // O estado de hoje já pode ser "oferta pendente": não repetir na linha.
  if (c.ofertaPendente && !notas.includes("oferta pendente"))
    notas.push("oferta pendente");
  return (
    <span className="flex flex-col text-left leading-tight">
      <span>{c.nome}</span>
      <span className="text-mini text-texto-2 font-normal">
        {notas.join(", ")}
      </span>
    </span>
  );
}

/**
 * Designar titular ou backup (P36 item 1). O caminho comum é a oferta: a
 * enfermeira tem o prazo do parâmetro para aceitar ou recusar. A atribuição
 * direta é para urgência, pede o motivo e fica no histórico.
 */
export function FormularioDesignar({
  familiaId,
  papel,
  candidatas,
}: {
  familiaId: string;
  papel: PapelDesignacao;
  candidatas: Candidata[];
}) {
  const {
    estado: estadoOferta,
    enviar: oferecer,
    pendente: oferecendo,
  } = useAcao(acaoOferecerDesignacao, estadoInicialOperacao);
  const {
    estado: estadoDireto,
    enviar: atribuir,
    pendente: atribuindo,
  } = useAcao(acaoAtribuirDesignacao, estadoInicialOperacao);
  const disponiveis = candidatas.filter((c) => !c.jaNestaFamilia);
  const rotuloPapel = ROTULO_PAPEL_DESIGNACAO[papel].toLowerCase();

  if (disponiveis.length === 0) {
    return (
      <FaixaAlerta
        variante="prioritario"
        titulo="Nenhuma enfermeira disponível"
      >
        Não há enfermeira ativa que possa assumir este papel. Confira a equipe.
      </FaixaAlerta>
    );
  }

  const opcoes = disponiveis.map((c) => ({
    valor: c.profissionalId,
    rotulo: rotuloCandidata(c),
  }));

  return (
    <div className="flex flex-col gap-4" data-designar={papel}>
      <form onSubmit={oferecer} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="familiaId" value={familiaId} />
        <input type="hidden" name="papel" value={papel} />
        <EscolhaUnica
          rotulo={`Quem será a ${rotuloPapel}`}
          name="profissionalId"
          opcoes={opcoes}
        />
        {estadoOferta.campos?.profissionalId ? (
          <p className="text-apoio text-alerta" role="alert">
            {estadoOferta.campos.profissionalId}
          </p>
        ) : null}
        {estadoOferta.erro ? (
          <FaixaAlerta variante="erro" titulo={estadoOferta.erro} />
        ) : null}
        {estadoOferta.sucesso ? (
          <FaixaAlerta variante="sucesso" titulo={estadoOferta.sucesso} />
        ) : null}
        <Botao
          type="submit"
          carregando={oferecendo}
          rotuloCarregando="Enviando"
          className="self-start"
        >
          Fazer a oferta
        </Botao>
      </form>

      <details className="border-linha rounded-3 border p-4">
        <summary className="text-corpo text-texto min-h-toque cursor-pointer font-semibold">
          Atribuir direto, em urgência
        </summary>
        <form
          onSubmit={atribuir}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <input type="hidden" name="familiaId" value={familiaId} />
          <input type="hidden" name="papel" value={papel} />
          <EscolhaUnica
            rotulo={`Quem assume como ${rotuloPapel}`}
            name="profissionalId"
            opcoes={opcoes}
          />
          <CampoTexto
            rotulo="Motivo da atribuição direta"
            name="motivo"
            multilinha
            linhas={2}
            required
            descricao="Fica no histórico com o seu nome. A enfermeira é avisada e a família entra na lista dela."
            erro={estadoDireto.campos?.motivo}
          />
          {estadoDireto.erro ? (
            <FaixaAlerta variante="erro" titulo={estadoDireto.erro} />
          ) : null}
          {estadoDireto.sucesso ? (
            <FaixaAlerta variante="sucesso" titulo={estadoDireto.sucesso} />
          ) : null}
          <Botao
            type="submit"
            variante="secundario"
            carregando={atribuindo}
            rotuloCarregando="Atribuindo"
            className="self-start"
          >
            Atribuir agora
          </Botao>
        </form>
      </details>
    </div>
  );
}
