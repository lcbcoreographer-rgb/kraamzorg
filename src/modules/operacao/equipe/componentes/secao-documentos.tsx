"use client";

import { useActionState, useId } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { DocumentoProfissional } from "@/lib/dados/tipos-equipe";
import { formatarData } from "@/lib/formatacao";
import { acaoSalvarDocumento } from "../acoes";
import { estadoInicialEquipe } from "../estado-acoes";
import { ROTULO_SITUACAO_DOCUMENTO } from "../textos";

const VARIANTE_SITUACAO = {
  vencido: "alerta",
  vencendo: "aviso",
  em_dia: "sucesso",
  sem_validade: "neutro",
} as const;

/**
 * Documentos com validade da profissional (P37 item 1, PRD 6.5 O-02): a
 * lista com a situação de cada um (vencido, vence em breve, em dia) e o
 * formulário para cadastrar ou renovar. O tipo aceita sugestões do
 * parâmetro, mas a coordenação pode escrever outro. O aviso antes do
 * vencimento chega à coordenação pela automação documento_vencendo.
 */
export function SecaoDocumentos({
  profissionalId,
  documentos,
  tiposSugeridos,
}: {
  profissionalId: string;
  documentos: DocumentoProfissional[];
  tiposSugeridos: string[];
}) {
  const [estado, acao, enviando] = useActionState(
    acaoSalvarDocumento,
    estadoInicialEquipe,
  );
  const campos = estado.campos ?? {};
  const listaId = useId();

  return (
    <div className="flex flex-col gap-5">
      {documentos.length === 0 ? (
        <p className="text-corpo text-texto-2">
          Nenhum documento cadastrado ainda. Cadastre a carteira do conselho e o
          que mais tiver validade.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documentos.map((d) => (
            <li
              key={d.id}
              className="rounded-2 bg-areia-clara flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-corpo text-texto font-medium">{d.tipo}</p>
                <p className="text-apoio text-texto-2 font-mono">
                  {d.numero ? `${d.numero} · ` : ""}
                  {d.validade
                    ? `validade ${formatarData(d.validade)}`
                    : "sem validade"}
                </p>
              </div>
              <Selo variante={VARIANTE_SITUACAO[d.situacao]}>
                {ROTULO_SITUACAO_DOCUMENTO[d.situacao]}
              </Selo>
            </li>
          ))}
        </ul>
      )}

      <form
        action={acao}
        noValidate
        className="flex flex-col gap-4"
        aria-label="Cadastrar documento"
      >
        <input type="hidden" name="profissionalId" value={profissionalId} />
        <datalist id={listaId}>
          {tiposSugeridos.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="tablet:grid-cols-3 grid grid-cols-1 gap-4">
          <CampoTexto
            rotulo="Tipo"
            name="tipo"
            list={listaId}
            autoComplete="off"
            required
            erro={campos.tipo}
          />
          <CampoTexto
            rotulo="Número"
            name="numero"
            autoComplete="off"
            opcional
          />
          <CampoTexto
            rotulo="Validade"
            name="validade"
            type="date"
            opcional
            erro={campos.validade}
          />
        </div>
        {estado.erro ? (
          <FaixaAlerta variante="erro" titulo={estado.erro} />
        ) : null}
        {estado.sucesso ? (
          <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
        ) : null}
        <Botao
          type="submit"
          variante="secundario"
          tamanho="compacto"
          carregando={enviando}
          rotuloCarregando="Salvando"
          className="self-start"
        >
          Salvar o documento
        </Botao>
      </form>
    </div>
  );
}
