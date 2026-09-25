import type { Metadata } from "next";
import Link from "next/link";
import { OctagonPause, Search } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Cartao } from "@/components/ui/cartao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { localidade } from "@/lib/formatacao";
import { listarFamiliasTela } from "@/modules/crm/ficha/dados";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

function texto(pesquisa: Pesquisa, chave: string): string | undefined {
  const valor = pesquisa[chave];
  const primeiro = Array.isArray(valor) ? valor[0] : valor;
  return primeiro?.trim() || undefined;
}

/**
 * Lista de famílias (P16), porta de entrada da ficha 360 para quem não vem
 * de um cartão do pipeline (coordenação, financeiro, diretoria). Busca por
 * nome, como `FamiliasRepositorio.listarFamilias` já lê hoje (a busca por
 * telefone precisaria de um filtro novo na fundação, fora desta pasta:
 * ver `docs/sessoes/p16-ficha.md`, pendências).
 */
export default async function PaginaFamilias({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/familias");
  const pesquisa = await searchParams;
  const busca = texto(pesquisa, "busca");

  let familias: Awaited<ReturnType<typeof listarFamiliasTela>> = [];
  let falhou = false;
  try {
    familias = await listarFamiliasTela({ busca });
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela titulo="Famílias" />

      <form
        method="get"
        action="/familias"
        className="border-linha flex flex-col gap-3 border-b pt-4 pb-4 sm:flex-row sm:items-end"
      >
        <CampoTexto
          rotulo="Buscar"
          name="busca"
          defaultValue={busca}
          placeholder="Nome da família"
          containerClassName="min-w-48 flex-1"
          acessorio={
            <Search
              aria-hidden="true"
              className="text-texto-2 mr-3 size-4 shrink-0"
            />
          }
        />
      </form>

      <div className="pt-4">
        {falhou ? (
          <FaixaAlerta
            variante="imediato"
            titulo="Não foi possível carregar as famílias agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : familias.length === 0 ? (
          <EstadoVazio
            titulo={
              busca
                ? "Nenhuma família encontrada"
                : "Nenhuma família cadastrada ainda"
            }
            texto={
              busca
                ? "Confira o nome digitado ou tente outra busca."
                : "As famílias cadastradas no pipeline vão aparecer aqui, com acesso à ficha de cada uma."
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {familias.map((familia) => (
              <li key={familia.id}>
                {/* Selo de freio abaixo do bairro e da cidade, nunca ao
                    lado do nome (o nome ficava espremido, crítica do CRM,
                    P1 item 17). */}
                <Cartao
                  tocavel
                  href={`/familias/${familia.id}`}
                  className="flex flex-col gap-1.5"
                >
                  <span className="text-corpo font-semibold">
                    {familia.nome}
                  </span>
                  <span className="text-apoio text-texto-2 flex flex-wrap gap-x-3 gap-y-0.5">
                    {familia.idadeGestacional ? (
                      <span className="font-mono">
                        {familia.idadeGestacional}
                      </span>
                    ) : null}
                    {localidade(familia.bairro, familia.cidade) ? (
                      <span>{localidade(familia.bairro, familia.cidade)}</span>
                    ) : null}
                  </span>
                  {familia.naoContatar || familia.estadoSensivel !== "normal" ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {familia.naoContatar ? (
                        <Selo variante="aviso">Não contatar</Selo>
                      ) : null}
                      {familia.estadoSensivel !== "normal" ? (
                        <Selo
                          variante="sensivel"
                          icone={<OctagonPause aria-hidden="true" />}
                        >
                          {familia.estadoSensivel === "bloqueio_total"
                            ? "Freio em bloqueio total"
                            : familia.estadoSensivel === "atencao"
                              ? "Freio em atenção"
                              : "Encerrado sensível"}
                        </Selo>
                      ) : null}
                    </div>
                  ) : null}
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-mini text-texto-2 mt-2">
        <Link href="/pipeline" className="underline underline-offset-2">
          Ver pelo pipeline
        </Link>{" "}
        agrupa por estágio comercial, com mais filtros.
      </p>
    </>
  );
}
