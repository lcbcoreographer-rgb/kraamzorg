"use client";

import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import type { AutorizacaoEnfermeiraPortal } from "@/lib/dados/tipos-relacao";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { acaoSalvarAutorizacao } from "../acoes";

function LinhaEnfermeira({ e }: { e: AutorizacaoEnfermeiraPortal }) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarAutorizacao,
    estadoInicialRelacao,
  );
  return (
    <li className="rounded-3 bg-superficie shadow-1 p-4">
      <form
        onSubmit={acao}
        className="flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        <input type="hidden" name="profissionalId" value={e.profissionalId} />
        <span className="text-corpo text-texto min-w-[12rem] font-semibold">
          {e.nome}
        </span>
        <label className="text-corpo text-texto min-h-toque flex items-center gap-2">
          <input
            type="checkbox"
            name="autorizaNome"
            value="sim"
            defaultChecked={e.autorizaNome}
            className="size-5"
          />
          A família vê o nome
        </label>
        <label className="text-corpo text-texto min-h-toque flex items-center gap-2">
          <input
            type="checkbox"
            name="autorizaFoto"
            value="sim"
            defaultChecked={e.autorizaFoto}
            className="size-5"
          />
          A família vê a foto
          {!e.temFoto ? (
            <span className="text-apoio text-texto-2">
              (ainda sem foto enviada)
            </span>
          ) : null}
        </label>
        <Botao
          type="submit"
          variante="secundario"
          tamanho="compacto"
          carregando={salvando}
          rotuloCarregando="Salvando"
          aria-label={`Salvar a autorização de ${e.nome}`}
        >
          Salvar
        </Botao>
        <span role="status" className="text-apoio text-texto-2">
          {estado.erro ?? estado.sucesso ?? ""}
        </span>
      </form>
    </li>
  );
}

/** Autorização de nome e foto das enfermeiras para o portal (P49): registra o que cada uma concordou. */
export function AutorizacoesEnfermeiras({
  enfermeiras,
}: {
  enfermeiras: AutorizacaoEnfermeiraPortal[];
}) {
  if (enfermeiras.length === 0) {
    return (
      <p className="text-corpo text-texto-2">
        Nenhuma enfermeira ativa no cadastro.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {enfermeiras.map((e) => (
        <LinhaEnfermeira key={e.profissionalId} e={e} />
      ))}
    </ul>
  );
}
