import "server-only";

/**
 * Layout do contrato (P31 item 1): A4, cabeçalho com o logo, rodapé com a
 * versão do modelo e a paginação em toda página, partes, cláusulas e a
 * frase de assinatura. Não decide texto: o que imprimir já foi montado e
 * conferido em `contrato-conteudo.ts`.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  CabecalhoDocumento,
  RodapeDocumento,
  Secao,
  estilos,
} from "./componentes";
import type { ConteudoContrato } from "./contrato-conteudo";
import { CORES, MARINHO_14, MARINHO_72 } from "./tokens";
import { FAMILIA_CORPO } from "./fontes";

export const METADADOS_CONTRATO = {
  title: "Contrato de cuidado domiciliar pós-parto",
  author: "Kraamzorg Brasil",
  subject: "Contrato de prestação de serviços",
  keywords: "kraamzorg, contrato",
  creator: "Kraamzorg OS",
  producer: "Kraamzorg OS",
  language: "pt-BR",
} as const;

/** "{id}.pdf": o nome do arquivo é sempre o id do contrato, nunca o de alguém. */
export function nomeArquivoContrato(contratoId: string): string {
  if (!/^[0-9a-fA-F-]{8,64}$/.test(contratoId)) {
    throw new RangeError("nomeArquivoContrato: id inválido");
  }
  return `${contratoId}.pdf`;
}

export function DocumentoContrato({
  conteudo,
}: {
  conteudo: ConteudoContrato;
}) {
  const rodape = `Modelo ${conteudo.versao}, emitido em ${conteudo.emitidoEm}. Documento confidencial, com dados pessoais protegidos pela Lei Geral de Proteção de Dados.`;
  return (
    <Document
      title={METADADOS_CONTRATO.title}
      author={METADADOS_CONTRATO.author}
      subject={METADADOS_CONTRATO.subject}
      keywords={METADADOS_CONTRATO.keywords}
      creator={METADADOS_CONTRATO.creator}
      producer={METADADOS_CONTRATO.producer}
      language={METADADOS_CONTRATO.language}
    >
      <Page size="A4" style={estilos.pagina}>
        <CabecalhoDocumento tituloDocumento="Contrato" />
        <RodapeDocumento aviso={rodape} />

        <Text style={estilos.tituloDocumento}>{conteudo.titulo}</Text>

        {conteudo.aviso ? (
          <View
            style={{
              backgroundColor: CORES.areia,
              padding: 8,
              marginBottom: 8,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontFamily: FAMILIA_CORPO, fontWeight: 600 }}>
              {conteudo.aviso}
            </Text>
          </View>
        ) : null}

        {conteudo.partes.map((parte) => (
          <Secao key={parte.titulo} titulo={parte.titulo}>
            {parte.linhas.map((linha) => (
              <Text key={linha.rotulo} style={estilos.campo}>
                <Text style={estilos.campoRotulo}>{linha.rotulo}: </Text>
                {linha.valor}
              </Text>
            ))}
          </Secao>
        ))}

        {conteudo.clausulas.map((clausula) => (
          <Secao key={clausula.titulo} titulo={clausula.titulo}>
            {clausula.paragrafos.map((p, i) => (
              <Text key={i} style={estilos.paragrafo}>
                {p}
              </Text>
            ))}
            {clausula.itens.map((item, i) => (
              <View key={i} style={estilos.listaItem}>
                <Text style={estilos.listaMarcador}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>{item}</Text>
              </View>
            ))}
            {clausula.valores.map((v) => (
              <View
                key={v.rotulo}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 2,
                  borderBottomWidth: 0.5,
                  borderBottomColor: MARINHO_14,
                }}
              >
                <Text style={{ color: MARINHO_72 }}>{v.rotulo}</Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: "right",
                    fontWeight: v.destaque ? 600 : 400,
                  }}
                >
                  {v.valor}
                </Text>
              </View>
            ))}
          </Secao>
        ))}

        <View style={estilos.assinatura} wrap={false}>
          <Text>{conteudo.assinaturas}</Text>
        </View>
      </Page>
    </Document>
  );
}
