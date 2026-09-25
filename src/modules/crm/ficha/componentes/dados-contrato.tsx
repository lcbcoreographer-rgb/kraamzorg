"use client";

import * as React from "react";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarData } from "@/lib/formatacao";
import {
  acaoVerDadosContratoCompletos,
  estadoInicialDadosContrato,
} from "../acoes";
import type { DadosContratoTela } from "../tipos";

/**
 * Dados do contrato mascarados, com "mostrar" que exige AAL2 e grava a
 * leitura no log (`api.dados_contrato`, P16 item 5). Enquanto a pessoa não
 * preencheu o formulário seguro (P30), os campos aparecem como "aguardando".
 */
export function DadosContrato({
  pessoaId,
  mascarado,
}: {
  pessoaId: string;
  mascarado: DadosContratoTela | null;
}) {
  const [estado, acao, carregando] = useActionState(
    acaoVerDadosContratoCompletos,
    estadoInicialDadosContrato,
  );

  const dados = estado.dados ?? mascarado;
  const completo = estado.dados !== undefined;

  return (
    <Cartao className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Lock aria-hidden="true" className="text-texto-2 size-5" />
        <h2 className="font-titulo text-3 font-medium">Dados do contrato</h2>
        {mascarado?.preenchidoVia ? (
          <Selo variante="sucesso" className="ml-auto">
            Formulário preenchido
          </Selo>
        ) : null}
      </div>

      {!mascarado ? (
        <p className="text-apoio text-texto-2">
          Chegam pelo formulário seguro e ficam mascarados aqui. Ninguém pede
          CPF pela conversa.
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt className="text-apoio text-texto-2">CPF</dt>
          <dd className="text-corpo font-mono tabular-nums">
            {dados?.cpf ?? "aguardando"}
          </dd>
          <dt className="text-apoio text-texto-2">Nascimento</dt>
          <dd className="text-corpo font-mono tabular-nums">
            {completo && dados?.dataNascimento
              ? formatarData(dados.dataNascimento)
              : "•• / •• / ••••"}
          </dd>
          <dt className="text-apoio text-texto-2">Endereço</dt>
          <dd className="text-corpo">
            {dados?.endereco
              ? [
                  dados.endereco.logradouro,
                  dados.endereco.numero,
                  dados.endereco.bairro,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "aguardando"}
          </dd>
        </dl>
      )}

      {mascarado && !completo ? (
        <form action={acao} className="flex flex-col items-start gap-2">
          <input type="hidden" name="pessoaId" value={pessoaId} />
          <Botao
            type="submit"
            variante="fantasma"
            tamanho="compacto"
            carregando={carregando}
            rotuloCarregando="Confirmando"
            iconeEsquerda={<Lock aria-hidden="true" className="size-4" />}
          >
            Ver dados completos
          </Botao>
          <p className="text-mini text-texto-2">
            Ver os dados completos fica registrado no histórico, com seu nome e
            a hora.
          </p>
        </form>
      ) : null}
      {estado.erro ? (
        <p className="text-apoio text-alerta">{estado.erro}</p>
      ) : null}
      {completo ? (
        <p className="text-mini text-texto-2">
          Leitura registrada agora, com seu nome.
        </p>
      ) : null}
    </Cartao>
  );
}
