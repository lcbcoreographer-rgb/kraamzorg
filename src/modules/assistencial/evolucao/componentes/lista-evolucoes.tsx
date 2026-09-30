import Link from "next/link";
import { Baby, ChevronRight, ClipboardPen, House } from "lucide-react";
import { MantaDobrada } from "@/components/ilustracoes";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
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
        className="rounded-2 bg-superficie ease-estado hover:bg-marinho-08 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-inherit no-underline transition-colors duration-140"
      >
        <TileIcone tom="areia" forma="quadrado" tamanho="p">
          {documento.tipo === "neonatal" ? <Baby /> : <ClipboardPen />}
        </TileIcone>
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
        ilustracao={<MantaDobrada tamanho={112} />}
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
    <ul className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {lista.acompanhamentos.map((a) => (
        <li key={a.acompanhamentoId}>
          <Cartao
            variante={a.situacao === "concluida" ? "salvia" : "padrao"}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <TileIcone tom={a.situacao === "concluida" ? "salvia" : "areia"}>
                <House />
              </TileIcone>
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
                base === "/minhas-evolucoes" ? "enfermeira" : "equipe",
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
            <ul
              className={
                a.situacao === "concluida"
                  ? "flex flex-col gap-2"
                  : "rounded-3 bg-areia-clara -mx-2 flex flex-col gap-2 p-2 lg:-mx-1"
              }
            >
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
