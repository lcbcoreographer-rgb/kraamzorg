import "server-only";

/**
 * Layout único das duas evoluções (PRD 9.5, "Formato do PDF"): A4,
 * cabeçalho com o logo, rodapé com paginação e aviso de confidencialidade
 * em toda página, e as seções de `ConteudoEvolucao` na ordem em que vieram.
 * Não decide texto nenhum: o que imprimir já foi montado e validado em
 * `conteudo-puerperal.ts` e `conteudo-neonatal.ts`.
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import {
  BlocoAssinatura,
  CabecalhoDocumento,
  Campo,
  ListaOrdenada,
  Paragrafo,
  RodapeDocumento,
  Secao,
  estilos,
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
            {secao.blocos.map((bloco, indice) => (
              <BlocoDocumento key={indice} bloco={bloco} />
            ))}
          </Secao>
        ))}

        <BlocoAssinatura {...conteudo.assinatura} />
      </Page>
    </Document>
  );
}
