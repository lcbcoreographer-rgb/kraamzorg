import type { Metadata } from "next";
import Link from "next/link";
import { Kanban } from "lucide-react";
import { ChaveDeCasa } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { ListaFamilias } from "@/modules/crm/ficha/componentes/lista-familias";
import { listarFamiliasTela } from "@/modules/crm/ficha/dados";
import { ORDENS, type OrdemFamilias } from "@/modules/crm/ficha/lista-familias";
import type { FamiliaListaTela } from "@/modules/crm/ficha/tipos";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

/** Quantas famílias a lista traz sem busca (o padrão de `listarFamilias`). */
const LIMITE_LISTA = 200;

function texto(pesquisa: Pesquisa, chave: string): string | undefined {
  const valor = pesquisa[chave];
  const primeiro = Array.isArray(valor) ? valor[0] : valor;
  return primeiro?.trim() || undefined;
}

/**
 * Lista de famílias (P16), porta de entrada da ficha 360 para quem não vem
 * de um cartão do pipeline (coordenação, financeiro, diretoria). A lista
 * inteira vem do servidor e a tela filtra, agrupa e ordena na hora
 * (`ListaFamilias`). `?busca=` continua valendo: o servidor procura pelo
 * nome ou pelo telefone, inclusive além do limite da lista.
 */
export default async function PaginaFamilias({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/familias");
  const pesquisa = await searchParams;
  const busca = texto(pesquisa, "busca");
  const ordemPedida = texto(pesquisa, "ordem");
  const ordem = ORDENS.some((o) => o.valor === ordemPedida)
    ? (ordemPedida as OrdemFamilias)
    : "nome";

  let familias: FamiliaListaTela[] = [];
  let resultadoBusca: FamiliaListaTela[] | undefined;
  let falhou = false;
  try {
    [familias, resultadoBusca] = await Promise.all([
      listarFamiliasTela(),
      busca ? listarFamiliasTela({ busca }) : Promise.resolve(undefined),
    ]);
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Famílias"
        lateral={
          <Botao
            asChild
            variante="fantasma"
            tamanho="compacto"
            iconeEsquerda={<Kanban aria-hidden="true" className="size-4" />}
          >
            <Link href="/pipeline">Ver pelo pipeline</Link>
          </Botao>
        }
      />

      <div className="pt-4">
        {falhou ? (
          <FaixaAlerta
            variante="erro"
            titulo="Não foi possível carregar as famílias agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : familias.length === 0 && !resultadoBusca?.length ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<ChaveDeCasa tamanho={104} />}
            titulo="Nenhuma família cadastrada ainda"
            texto="Quando a primeira família chegar pela Isadora ou for cadastrada no pipeline, ela entra nesta lista, com a ficha a um toque."
          />
        ) : (
          <ListaFamilias
            familias={familias}
            buscaInicial={busca ?? ""}
            resultadoBusca={resultadoBusca}
            ordemInicial={ordem}
            truncada={familias.length >= LIMITE_LISTA}
          />
        )}
      </div>
    </>
  );
}
