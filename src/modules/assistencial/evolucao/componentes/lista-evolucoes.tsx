import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type {
  AcompanhamentoEvolucao,
  ListaEvolucoes,
} from "@/lib/dados/tipos-evolucao";
import { formatarData } from "@/lib/formatacao";
import {
  frasePrazo,
  ROTULO_SITUACAO,
  ROTULO_STATUS,
  rotuloDocumento,
  slugDoDocumento,
  VARIANTE_SITUACAO,
  VARIANTE_STATUS,
} from "../documento";

/**
 * A lista de evoluções (P41): um cartão por acompanhamento concluído, com o
 * prazo em frase, os documentos (um puerperal e um neonatal por bebê) e o
 * estado de cada um. Cartão que precisa de ação vem primeiro. A enfermeira e
 * a coordenação usam a mesma lista; muda só a base dos links.
 */

function Documento({
  acompanhamento,
  documento,
  base,
  totalBebes,
}: {
  acompanhamento: AcompanhamentoEvolucao;
  documento: AcompanhamentoEvolucao["documentos"][number];
  base: string;
  totalBebes: number;
}) {
  const rotulo = rotuloDocumento(
    documento.tipo,
    documento.bebeOrdem,
    documento.bebeNome,
    totalBebes,
  );
  const href = `${base}/${acompanhamento.acompanhamentoId}/${slugDoDocumento(documento)}`;
  return (
    <li>
      <Link
        href={href}
        className="min-h-toque hover:bg-marinho-08 rounded-2 -mx-2 flex items-center gap-3 px-2 py-2 text-inherit no-underline"
      >
        <span className="text-corpo text-texto min-w-0 flex-1 font-medium">
          {rotulo}
        </span>
        {documento.status ? (
          <Selo variante={VARIANTE_STATUS[documento.status]}>
            {ROTULO_STATUS[documento.status]}
          </Selo>
        ) : (
          <Selo variante="contorno">Não iniciada</Selo>
        )}
        {documento.comErros ? (
          <Selo variante="aviso">Com pontos a corrigir</Selo>
        ) : null}
        <ChevronRight
          className="text-texto-2 size-4 shrink-0"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function ListaEvolucoesTela({
  lista,
  base,
  baseFamilia,
  filtro,
}: {
  lista: ListaEvolucoes;
  base: "/evolucoes" | "/minhas-evolucoes";
  baseFamilia: "/familias" | "/minhas-familias";
  filtro: "abertas" | "todas";
}) {
  if (lista.acompanhamentos.length === 0) {
    return (
      <EstadoVazio
        titulo={
          filtro === "abertas"
            ? "Nenhuma evolução pendente"
            : "Nenhuma evolução ainda"
        }
        texto={
          filtro === "abertas"
            ? "Quando uma família terminar o último dia contratado, a evolução dela aparece aqui com o prazo para preencher e enviar aos médicos."
            : "As evoluções aparecem quando uma família termina o último dia contratado."
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {lista.acompanhamentos.map((a) => (
        <li key={a.acompanhamentoId}>
          <Cartao className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <h2 className="font-titulo text-2 text-texto font-medium">
                  {a.familiaNome}
                </h2>
                <p className="text-apoio text-texto-2">
                  Último dia em{" "}
                  <span className="font-mono">
                    {formatarData(a.concluidoEm)}
                  </span>
                  {a.profissionalNome ? `, com ${a.profissionalNome}` : ""}
                </p>
              </div>
              <Selo variante={VARIANTE_SITUACAO[a.situacao]}>
                {ROTULO_SITUACAO[a.situacao]}
              </Selo>
            </div>
            <p className="text-corpo text-texto">
              {frasePrazo(
                a.situacao,
                a.prazoAviso,
                a.prazoEscala,
                formatarData,
              )}
            </p>
            {a.bloqueadoContato ? (
              <FaixaAlerta
                variante="prioritario"
                titulo="Falta o contato do médico"
                acoes={
                  <Link
                    href={`${baseFamilia}/${a.familiaId}`}
                    className="text-apoio text-texto min-h-toque inline-flex items-center font-semibold underline underline-offset-4"
                  >
                    Abrir a ficha da família
                  </Link>
                }
              >
                Nenhum médico da família tem e-mail ou telefone no cadastro. Sem
                isso o documento não segue; a coordenação cadastra o contato na
                ficha.
              </FaixaAlerta>
            ) : null}
            <ul className="border-linha flex flex-col border-t pt-2">
              {a.documentos.map((d) => (
                <Documento
                  key={`${d.tipo}-${d.bebeId ?? "mae"}`}
                  acompanhamento={a}
                  documento={d}
                  base={base}
                  totalBebes={
                    a.documentos.filter((x) => x.tipo === "neonatal").length
                  }
                />
              ))}
            </ul>
          </Cartao>
        </li>
      ))}
    </ul>
  );
}
