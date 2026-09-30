import { Mail, Phone, Users } from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { formatarTelefone } from "@/lib/formatacao";
import type { PessoaFicha } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";
import { rotuloPapelPessoa } from "../rotulos";

/**
 * Bloco "Pessoas" da ficha (protótipo `comercial-ficha.html`, `c4-lateral`;
 * direção "Colo", DESIGN.md 2.5: pessoas e conversas em argila). Cada pessoa
 * é um bloco próprio, a de contato principal primeiro (o repositório já
 * ordena assim); telefone é link `tel:` em pílula com o alvo mínimo de
 * 44 px. Família com o freio puxado: blocos brancos, sem tom de apoio.
 */
export function PainelPessoas({
  pessoas,
  semTom = false,
}: {
  pessoas: PessoaFicha[];
  semTom?: boolean;
}) {
  return (
    <SecaoBloco
      idTitulo="t-pessoas"
      titulo="Pessoas"
      icone={<Users />}
      tom="argila"
      semTom={semTom}
    >
      {pessoas.length === 0 ? (
        <p className="text-apoio text-texto-2">
          Nenhuma pessoa cadastrada ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pessoas.map((pessoa) => (
            <li
              key={pessoa.id}
              className={cn(
                "rounded-3 flex flex-col gap-1 p-4",
                semTom
                  ? "bg-superficie border-linha border"
                  : "bg-argila-clara",
              )}
            >
              <span className="text-corpo text-texto leading-snug font-semibold">
                {pessoa.nome}
              </span>
              <span className="text-apoio text-texto-2">
                {rotuloPapelPessoa(pessoa.papel)}
                {pessoa.contatoPrincipal ? " e contato principal" : ""}
              </span>
              {pessoa.telefoneE164 || pessoa.email ? (
                <span className="mt-1 flex flex-wrap gap-2">
                  {pessoa.telefoneE164 ? (
                    <a
                      href={`tel:${pessoa.telefoneE164}`}
                      className="rounded-pilula bg-superficie text-apoio text-texto min-h-toque hover:shadow-1 inline-flex items-center gap-2 px-3.5 font-mono tabular-nums no-underline"
                    >
                      <Phone
                        aria-hidden="true"
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                      />
                      {formatarTelefone(pessoa.telefoneE164)}
                    </a>
                  ) : null}
                  {pessoa.email ? (
                    <a
                      href={`mailto:${pessoa.email}`}
                      className="rounded-pilula bg-superficie text-apoio text-texto min-h-toque hover:shadow-1 inline-flex max-w-full items-center gap-2 px-3.5 break-all no-underline"
                    >
                      <Mail
                        aria-hidden="true"
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                      />
                      {pessoa.email}
                    </a>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SecaoBloco>
  );
}
