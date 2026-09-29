"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { BloqueioAgenda } from "@/lib/dados/tipos-equipe";
import { formatarData } from "@/lib/formatacao";
import { acaoRemoverBloqueio, acaoSalvarBloqueio } from "../acoes";
import { estadoInicialEquipe } from "../estado-acoes";

function LinhaBloqueio({
  bloqueio,
  profissionalId,
}: {
  bloqueio: BloqueioAgenda;
  profissionalId: string;
}) {
  const [estado, acao, removendo] = useActionState(
    acaoRemoverBloqueio,
    estadoInicialEquipe,
  );
  return (
    <li className="border-linha flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3">
      <div className="min-w-0">
        <p className="text-corpo text-texto font-medium">{bloqueio.motivo}</p>
        <p className="text-apoio text-texto-2 font-mono">
          {formatarData(bloqueio.inicio)}
          {bloqueio.fim !== bloqueio.inicio
            ? ` a ${formatarData(bloqueio.fim)}`
            : ""}
        </p>
        {estado.erro ? (
          <p className="text-apoio text-alerta mt-1">{estado.erro}</p>
        ) : null}
      </div>
      <form action={acao}>
        <input type="hidden" name="id" value={bloqueio.id} />
        <input type="hidden" name="profissionalId" value={profissionalId} />
        <Botao
          type="submit"
          variante="fantasma"
          tamanho="compacto"
          carregando={removendo}
          rotuloCarregando="Removendo"
          aria-label={`Remover o bloqueio ${bloqueio.motivo}`}
        >
          Remover
        </Botao>
      </form>
    </li>
  );
}

/**
 * Bloqueios de agenda (P37 item 1): folga, férias ou impedimento. Ao salvar,
 * o banco devolve as visitas já marcadas nesses dias, e a tela leva a cada
 * uma para reagendar (nenhuma visita fica sem aviso).
 */
export function SecaoBloqueios({
  profissionalId,
  bloqueios,
  hoje,
}: {
  profissionalId: string;
  bloqueios: BloqueioAgenda[];
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoSalvarBloqueio,
    estadoInicialEquipe,
  );
  const campos = estado.campos ?? {};

  return (
    <div className="flex flex-col gap-5">
      {bloqueios.length === 0 ? (
        <p className="text-corpo text-texto-2">
          Nenhum bloqueio de agenda. Quando houver folga, férias ou um
          impedimento, cadastre aqui para a agenda avisar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bloqueios.map((b) => (
            <LinhaBloqueio
              key={b.id}
              bloqueio={b}
              profissionalId={profissionalId}
            />
          ))}
        </ul>
      )}

      <form
        action={acao}
        noValidate
        className="flex flex-col gap-4"
        aria-label="Cadastrar bloqueio de agenda"
      >
        <input type="hidden" name="profissionalId" value={profissionalId} />
        <div className="tablet:grid-cols-2 grid grid-cols-1 gap-4">
          <CampoTexto
            rotulo="Primeiro dia"
            name="inicio"
            type="date"
            min={hoje}
            required
            erro={campos.inicio}
          />
          <CampoTexto
            rotulo="Último dia"
            name="fim"
            type="date"
            min={hoje}
            required
            erro={campos.fim}
          />
        </div>
        <CampoTexto
          rotulo="Motivo"
          name="motivo"
          autoComplete="off"
          required
          erro={campos.motivo}
          descricao="Por exemplo: folga, férias, consulta. Só a coordenação vê."
        />
        {estado.erro ? (
          <FaixaAlerta variante="erro" titulo={estado.erro} />
        ) : null}
        {estado.sucesso ? (
          <FaixaAlerta
            variante={
              estado.visitasAfetadas && estado.visitasAfetadas.length > 0
                ? "prioritario"
                : "sucesso"
            }
            titulo={estado.sucesso}
          >
            {estado.visitasAfetadas && estado.visitasAfetadas.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {estado.visitasAfetadas.map((v) => (
                  <li key={v.visitaId}>
                    <Link
                      href={`/agenda/visitas/${v.visitaId}`}
                      className="text-corpo text-texto underline underline-offset-4"
                    >
                      Reagendar o dia {v.diaNumero}, de {formatarData(v.data)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </FaixaAlerta>
        ) : null}
        <Botao
          type="submit"
          variante="secundario"
          tamanho="compacto"
          carregando={enviando}
          rotuloCarregando="Salvando"
          className="self-start"
        >
          Salvar o bloqueio
        </Botao>
      </form>
    </div>
  );
}
