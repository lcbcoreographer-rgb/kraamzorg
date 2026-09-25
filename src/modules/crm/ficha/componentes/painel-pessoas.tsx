import { Users } from "lucide-react";
import { Cartao } from "@/components/ui/cartao";
import { formatarTelefone } from "@/lib/formatacao";
import type { PessoaFicha } from "@/lib/dados/tipos";
import { rotuloPapelPessoa } from "../rotulos";

/**
 * Bloco "Pessoas" da ficha (protótipo `comercial-ficha.html`, `c4-lateral`).
 * A pessoa de contato principal vem primeiro (o repositório já ordena
 * assim); telefone é link `tel:` com o alvo mínimo de 44 px.
 */
export function PainelPessoas({ pessoas }: { pessoas: PessoaFicha[] }) {
  return (
    <Cartao className="flex flex-col gap-3" aria-labelledby="t-pessoas">
      <div className="flex items-center gap-2">
        <Users aria-hidden="true" className="text-texto-2 size-5" />
        <h2 id="t-pessoas" className="font-titulo text-3 font-medium">
          Pessoas
        </h2>
      </div>
      {pessoas.length === 0 ? (
        <p className="text-apoio text-texto-2">
          Nenhuma pessoa cadastrada ainda.
        </p>
      ) : (
        <div className="flex flex-col">
          {pessoas.map((pessoa, i) => (
            <div
              key={pessoa.id}
              className={
                "flex flex-col gap-0.5 py-3" +
                (i === 0 ? " pt-0" : "") +
                (i < pessoas.length - 1 ? " border-linha border-b" : " pb-0")
              }
            >
              <span className="text-corpo text-texto font-semibold">
                {pessoa.nome}
              </span>
              <span className="text-apoio text-texto-2">
                {rotuloPapelPessoa(pessoa.papel)}
                {pessoa.contatoPrincipal ? " e contato principal" : ""}
              </span>
              {pessoa.telefoneE164 ? (
                <a
                  href={`tel:${pessoa.telefoneE164}`}
                  className="text-apoio min-h-toque inline-flex items-center font-mono tabular-nums"
                >
                  {formatarTelefone(pessoa.telefoneE164)}
                </a>
              ) : null}
              {pessoa.email ? (
                <a
                  href={`mailto:${pessoa.email}`}
                  className="text-apoio break-all"
                >
                  {pessoa.email}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
