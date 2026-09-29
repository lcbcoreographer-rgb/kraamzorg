import "server-only";

/**
 * Layout único das duas evoluções (PRD 9.5, "Formato do PDF"): A4,
 * cabeçalho com o logo, rodapé com paginação e aviso de confidencialidade
 * em toda página, e as seções de `ConteudoEvolucao` na ordem em que vieram.
 * Não decide texto nenhum: o que imprimir já foi montado e validado em
 * `conteudo-puerperal.ts` e `conteudo-neonatal.ts`.
 */
import type * as React from "react";
import { Document, Page, Text } from "@react-pdf/renderer";
import {
  BlocoAssinatura,
  CabecalhoDocumento,
  Campo,
  ListaOrdenada,
  Paragrafo,
  RodapeDocumento,
  Secao,
  TabelaPeso,
  estilos,
  type LinhaPeso,
} from "./componentes";
import type { Bloco, ConteudoEvolucao } from "./conteudo";
import { metadadosEvolucao } from "./metadados";

function BlocoDocumento({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "paragrafo") return <Paragrafo>{bloco.texto}</Paragrafo>;
  if (bloco.tipo === "campo") {
    return <Campo rotulo={bloco.rotulo} valor={bloco.valor} />;
  }
  return <ListaOrdenada itens={bloco.itens} />;
}

/**
 * Lê as pesagens de volta dos campos da seção "Curva de peso" para a
 * tabela. Só apresentação: o conteúdo (e o rascunho que a enfermeira
 * edita) continua em campos de texto; um campo que não segue o formato
 * volta a sair como "Rótulo: valor".
 */
export function linhaPesoDoCampo(bloco: Bloco): LinhaPeso | null {
  if (bloco.tipo !== "campo") return null;
  const nascimento = /^(.+ g) \((\d{2}\/\d{2}\/\d{4})\)$/.exec(bloco.valor);
  if (bloco.rotulo === "Peso ao nascer" && nascimento) {
    return {
      data: nascimento[2]!,
      diaVida: "0",
      peso: nascimento[1]!,
      origem: "nascimento",
    };
  }
  const data = /^Peso em (\d{2}\/\d{2}\/\d{4})$/.exec(bloco.rotulo);
  const valor = /^(.+ g) \((.+)\), dia de vida (\d+)$/.exec(bloco.valor);
  if (data && valor) {
    return {
      data: data[1]!,
      diaVida: valor[3]!,
      peso: valor[1]!,
      origem: valor[2]!,
    };
  }
  return null;
}

function BlocosDaSecao({ blocos }: { blocos: Bloco[] }) {
  const linhas = blocos.map(linhaPesoDoCampo);
  const saida: React.ReactNode[] = [];
  let pesos: LinhaPeso[] = [];
  const fecharTabela = (chave: string) => {
    if (pesos.length > 0) {
      saida.push(<TabelaPeso key={`tabela-${chave}`} linhas={pesos} />);
      pesos = [];
    }
  };
  blocos.forEach((bloco, indice) => {
    const linha = linhas[indice];
    if (linha) {
      pesos.push(linha);
      return;
    }
    fecharTabela(String(indice));
    saida.push(<BlocoDocumento key={indice} bloco={bloco} />);
  });
  fecharTabela("fim");
  return <>{saida}</>;
}

export function DocumentoEvolucao({
  conteudo,
}: {
  conteudo: ConteudoEvolucao;
}) {
  const metadados = metadadosEvolucao(conteudo.tipo);

  return (
    <Document
      title={metadados.title}
      author={metadados.author}
      subject={metadados.subject}
      keywords={metadados.keywords}
      creator={metadados.creator}
      producer={metadados.producer}
      language={metadados.language}
    >
      <Page size="A4" style={estilos.pagina}>
        <CabecalhoDocumento tituloDocumento={metadados.title} />
        <RodapeDocumento />

        <Text style={estilos.tituloDocumento}>{metadados.title}</Text>

        {conteudo.secoes.map((secao) => (
          <Secao key={secao.titulo} titulo={secao.titulo}>
            {secao.titulo === "Curva de peso" ? (
              <BlocosDaSecao blocos={secao.blocos} />
            ) : (
              secao.blocos.map((bloco, indice) => (
                <BlocoDocumento key={indice} bloco={bloco} />
              ))
            )}
          </Secao>
        ))}

        <BlocoAssinatura {...conteudo.assinatura} />
      </Page>
    </Document>
  );
}
