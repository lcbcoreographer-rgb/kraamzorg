"use client";

import * as React from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao } from "@/components/ui/campo-selecao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type {
  EventoHistorico,
  OcorrenciaDetalhe,
  PessoaResponsavel,
  StatusOcorrencia,
} from "@/lib/dados/tipos-ocorrencia";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoAtualizarOcorrencia } from "../acoes";
import {
  estadoInicialOcorrencia,
  type EstadoAcaoOcorrencia,
} from "../estado-acoes";
import {
  ACAO_STATUS,
  PRIORIDADES,
  proximosStatus,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  ROTULO_TIPO,
  STATUS_COM_NOTA,
  VARIANTE_PRIORIDADE,
  VARIANTE_STATUS,
} from "../rotulos";

/**
 * Uma ocorrência (P42): o que aconteceu, o prazo, quem cuida, o histórico e o
 * formulário de andamento. Ocorrência privada diz, no topo, que o contato é
 * pessoal e sem mensagem automática (voz.md 6). Resolver ou encerrar pede uma
 * nota de pelo menos 10 letras, que entra no histórico.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function descreverEvento(e: EventoHistorico): string {
  const partes: string[] = [];
  if (e.acao === "aberta") {
    partes.push(
      e.para && e.para !== "aberta"
        ? `Aberta e entregue a um responsável (${ROTULO_STATUS[e.para as StatusOcorrencia] ?? e.para})`
        : "Aberta",
    );
  } else if (e.de && e.para) {
    partes.push(
      `Passou de ${ROTULO_STATUS[e.de as StatusOcorrencia]?.toLowerCase() ?? e.de} para ${ROTULO_STATUS[e.para as StatusOcorrencia]?.toLowerCase() ?? e.para}`,
    );
  }
  if (e.prioridade) {
    partes.push(
      `prioridade ${ROTULO_PRIORIDADE[e.prioridade as keyof typeof ROTULO_PRIORIDADE]?.replace("Prioridade ", "") ?? e.prioridade}`,
    );
  }
  if (e.privada !== undefined) {
    partes.push(e.privada ? "marcada como privada" : "deixou de ser privada");
  }
  if (partes.length === 0 && e.acao === "atualizada") {
    partes.push(e.nota ? "Nota" : "Atualizada");
  }
  const frase = partes.join(", ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

export function PainelOcorrencia({
  ocorrencia,
  responsaveis,
}: {
  ocorrencia: OcorrenciaDetalhe;
  responsaveis: PessoaResponsavel[];
}) {
  const [estado, definirEstado] = React.useState<EstadoAcaoOcorrencia>(
    estadoInicialOcorrencia,
  );
  const [ocupado, iniciar] = React.useTransition();
  const [status, definirStatus] = React.useState<string>("");
  const proximos = proximosStatus(ocorrencia.status);
  const encerrada = ocorrencia.status === "encerrada";
  const exigeNota =
    status !== "" && STATUS_COM_NOTA.includes(status as StatusOcorrencia);

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const novoStatus = String(dados.get("status") ?? "");
    const responsavel = String(dados.get("responsavelId") ?? "");
    const prioridade = String(dados.get("prioridade") ?? "");
    const nota = String(dados.get("nota") ?? "").trim();
    definirEstado(estadoInicialOcorrencia);
    iniciar(async () => {
      const resposta = await acaoAtualizarOcorrencia({
        ocorrenciaId: ocorrencia.id,
        status: novoStatus || undefined,
        responsavelId:
          ocorrencia.podeGerir &&
          responsavel &&
          responsavel !== ocorrencia.responsavelId
            ? responsavel
            : undefined,
        prioridade:
          ocorrencia.podeGerir &&
          prioridade &&
          prioridade !== ocorrencia.prioridade
            ? prioridade
            : undefined,
        privada:
          ocorrencia.podeGerir &&
          ocorrencia.tipo !== "detrator" &&
          (dados.get("privada") === "on") !== ocorrencia.privada
            ? dados.get("privada") === "on"
            : undefined,
        nota: nota || undefined,
        versao: ocorrencia.versao,
      });
      definirEstado(resposta);
      if (!resposta.erro) definirStatus("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Situação da ocorrência"
        className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Selo variante={VARIANTE_STATUS[ocorrencia.status]}>
            {ROTULO_STATUS[ocorrencia.status]}
          </Selo>
          <Selo variante={VARIANTE_PRIORIDADE[ocorrencia.prioridade]}>
            {ROTULO_PRIORIDADE[ocorrencia.prioridade]}
          </Selo>
          <Selo variante="neutro">{ROTULO_TIPO[ocorrencia.tipo]}</Selo>
          {ocorrencia.privada ? (
            <Selo variante="sensivel" icone={<LockKeyhole />}>
              Privada
            </Selo>
          ) : null}
        </div>
        <p className="text-corpo text-texto whitespace-pre-line">
          {ocorrencia.descricao}
        </p>
        <p className="text-apoio text-texto-2">
          {ocorrencia.familiaNome ? (
            <>
              {ocorrencia.familiaId ? (
                <Link
                  href={`/familias/${ocorrencia.familiaId}`}
                  className="text-texto font-medium underline underline-offset-4"
                >
                  {ocorrencia.familiaNome}
                </Link>
              ) : (
                ocorrencia.familiaNome
              )}
              .{" "}
            </>
          ) : null}
          {ocorrencia.profissionalNome
            ? `Profissional ${ocorrencia.profissionalNome}. `
            : ""}
          {ocorrencia.responsavelNome
            ? `Com ${ocorrencia.responsavelNome}. `
            : "Ainda sem responsável. "}
          {ocorrencia.resolvidaEm ? (
            <>
              Resolvida em{" "}
              <span className="font-mono">
                {formatarDataHora(ocorrencia.resolvidaEm)}
              </span>
              .
            </>
          ) : ocorrencia.slaVenceEm ? (
            <>
              {ocorrencia.vencida
                ? "O prazo de resposta venceu em "
                : "Responder até "}
              <span className="font-mono">
                {formatarDataHora(ocorrencia.slaVenceEm)}
              </span>
              .
            </>
          ) : null}
        </p>
      </section>

      {ocorrencia.privada ? (
        <FaixaAlerta
          variante="sensivel"
          titulo="Ocorrência privada da coordenação"
        >
          O contato com a família é pessoal, pela coordenação, e nenhuma
          mensagem automática sai a partir dela.
        </FaixaAlerta>
      ) : null}

      {ocorrencia.podeGerir || !encerrada ? (
        <section
          aria-labelledby="andamento"
          className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
        >
          <h2 id="andamento" className="text-3 text-texto font-semibold">
            Andamento
          </h2>
          {encerrada ? (
            <p className="text-corpo text-texto-2">
              Esta ocorrência foi encerrada e não muda mais. Se o assunto
              voltou, abra uma nova.
            </p>
          ) : (
            <form
              onSubmit={aoEnviar}
              className="flex flex-col gap-4"
              noValidate
            >
              <CampoSelecao
                rotulo="Próximo passo"
                name="status"
                vazio="Manter como está"
                opcoes={proximos.map((s) => ({
                  valor: s,
                  rotulo: ACAO_STATUS[s],
                }))}
                value={status}
                onChange={(e) => definirStatus(e.target.value)}
                opcional
              />
              {ocorrencia.podeGerir ? (
                <>
                  <CampoSelecao
                    rotulo="Quem cuida"
                    name="responsavelId"
                    vazio="Sem responsável"
                    opcoes={responsaveis.map((r) => ({
                      valor: r.id,
                      rotulo: r.nome,
                    }))}
                    defaultValue={ocorrencia.responsavelId ?? ""}
                    descricao="Ao escolher uma pessoa, ela recebe um aviso no app."
                    opcional
                  />
                  <CampoSelecao
                    rotulo="Prioridade"
                    name="prioridade"
                    opcoes={PRIORIDADES.map((p) => ({
                      valor: p,
                      rotulo: ROTULO_PRIORIDADE[p],
                    }))}
                    defaultValue={ocorrencia.prioridade}
                    descricao="Mudar a prioridade recalcula o prazo de resposta."
                  />
                  {ocorrencia.tipo !== "detrator" ? (
                    <label className="text-corpo text-texto min-h-toque flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="privada"
                        defaultChecked={ocorrencia.privada}
                        className="size-5"
                      />
                      Ocorrência privada (só a coordenação e a diretoria veem)
                    </label>
                  ) : null}
                </>
              ) : null}
              <CampoTexto
                rotulo={
                  exigeNota ? "Nota (obrigatória)" : "Nota para o histórico"
                }
                name="nota"
                multilinha
                linhas={3}
                maxLength={2000}
                opcional={!exigeNota}
                descricao={
                  exigeNota
                    ? "Conte o que foi feito, em pelo menos 10 letras."
                    : "Fica registrada com a data e o seu nome."
                }
              />
              {estado.erro ? (
                <FaixaAlerta variante="erro" titulo={estado.erro} />
              ) : null}
              {estado.sucesso ? (
                <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
              ) : null}
              <div>
                <Botao
                  className="max-w-full text-balance whitespace-normal"
                  type="submit"
                  carregando={ocupado}
                  rotuloCarregando="Salvando"
                >
                  Salvar no histórico
                </Botao>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="historico"
        className="rounded-3 bg-superficie shadow-1 flex flex-col gap-3 p-5"
      >
        <h2 id="historico" className="text-3 text-texto font-semibold">
          Histórico
        </h2>
        {ocorrencia.historico.length === 0 ? (
          <p className="text-corpo text-texto-2">
            O histórico começa quando a ocorrência recebe o primeiro registro.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {[...ocorrencia.historico].reverse().map((e, i) => (
              <li key={`${e.em}-${i}`} className="border-linha border-l-2 pl-4">
                <p className="text-apoio text-texto-2 font-mono">
                  {formatarDataHora(e.em)}
                </p>
                <p className="text-corpo text-texto">{descreverEvento(e)}</p>
                {e.por && !UUID.test(e.por) ? (
                  <p className="text-apoio text-texto-2">Por {e.por}</p>
                ) : null}
                {e.nota ? (
                  <p className="text-corpo text-texto mt-1 whitespace-pre-line">
                    {e.nota}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
