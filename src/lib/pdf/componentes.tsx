import "server-only";

/**
 * Peças visuais comuns às duas evoluções: cabeçalho com o logo, rótulo de
 * campo, seção e rodapé com paginação e aviso de confidencialidade (PRD
 * 9.5, "Formato do PDF"). Só os tokens e a tipografia de `docs/design/
 * DESIGN.md` (PROMPTS.md, P41): não há tela de referência para o PDF, e
 * nenhum destes componentes decide texto de negócio, só onde ele entra na
 * página.
 */
import path from "node:path";
import fs from "node:fs";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import { CORES, MARINHO_14, MARINHO_62, MARINHO_72 } from "./tokens";
import { FAMILIA_CORPO, FAMILIA_DADO, FAMILIA_TITULO } from "./fontes";

const CAMINHO_LOGO = path.join(
  process.cwd(),
  "public/brand/logo-provisorio.png",
);

/**
 * `@react-pdf/renderer` embute a imagem pelo conteúdo, não pelo caminho:
 * lida em Buffer uma vez por processo, como as fontes (`fontes.ts`).
 */
let logoEmBuffer: Buffer | undefined;
function logoDocumento(): Buffer {
  logoEmBuffer ??= fs.readFileSync(CAMINHO_LOGO);
  return logoEmBuffer;
}

/**
 * Entrelinha de 1,4 escrita em pontos ("14pt"): o @react-pdf/renderer
 * multiplica todo número pelo fontSize do próprio estilo e, sem fontSize
 * ali, pelo padrão de 18 pt (entrelinha de 25 pt no corpo de 10).
 */
const TAMANHO_CORPO = 10;
const ENTRELINHA = `${TAMANHO_CORPO * 1.4}pt`;
const TAMANHO_RODAPE = 7.5;

export const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 96,
    paddingBottom: 64,
    paddingHorizontal: 42,
    fontFamily: FAMILIA_CORPO,
    fontSize: TAMANHO_CORPO,
    color: CORES.marinho,
    // Sem lineHeight aqui de propósito: herdado pelo texto dinâmico da
    // paginação ("Página X de Y"), qualquer lineHeight faz o
    // @react-pdf/renderer 4.9 desenhar o rodapé inteiro fora da folha (y
    // perto de 5.900 pt numa página de 842), e o aviso de confidencialidade
    // some junto. Reproduzido na verificação do P41 e coberto pelo teste
    // "toda página tem cabeçalho, aviso de confidencialidade..." de
    // gerar.test.ts. O entrelinha vai em cada estilo de texto do corpo.
  },
  cabecalho: {
    position: "absolute",
    top: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: MARINHO_14,
    paddingBottom: 12,
  },
  logo: {
    height: 44,
  },
  cabecalhoTextos: {
    alignItems: "flex-end",
  },
  cabecalhoMarca: {
    fontFamily: FAMILIA_TITULO,
    fontWeight: 500,
    fontSize: 13,
    color: CORES.marinho,
  },
  cabecalhoTitulo: {
    fontFamily: FAMILIA_CORPO,
    fontWeight: 600,
    fontSize: 10,
    color: MARINHO_72,
    marginTop: 2,
  },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: MARINHO_14,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rodapeAviso: {
    fontSize: TAMANHO_RODAPE,
    lineHeight: 1.4, // fontSize no mesmo estilo: 1,4 x 7,5 pt
    color: MARINHO_62,
    maxWidth: 380,
  },
  rodapePagina: {
    fontFamily: FAMILIA_DADO,
    fontSize: TAMANHO_RODAPE,
    color: MARINHO_62,
  },
  tituloDocumento: {
    fontFamily: FAMILIA_TITULO,
    fontWeight: 500,
    fontSize: 17,
    color: CORES.marinho,
    marginBottom: 10,
  },
  secao: {
    marginTop: 10,
  },
  rotuloSecao: {
    fontFamily: FAMILIA_CORPO,
    fontWeight: 600,
    fontSize: 9.5,
    color: MARINHO_72,
    textTransform: "none",
    marginBottom: 3,
  },
  campo: {
    marginBottom: 2,
    lineHeight: ENTRELINHA,
  },
  campoRotulo: {
    fontWeight: 600,
  },
  paragrafo: {
    marginBottom: 4,
    lineHeight: ENTRELINHA,
  },
  dado: {
    fontFamily: FAMILIA_DADO,
  },
  listaItem: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
    lineHeight: ENTRELINHA,
  },
  listaMarcador: {
    width: 14,
  },
  assinatura: {
    lineHeight: ENTRELINHA,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: MARINHO_14,
    paddingTop: 8,
  },
});

export function CabecalhoDocumento({
  tituloDocumento,
}: {
  tituloDocumento: string;
}) {
  return (
    <View style={estilos.cabecalho} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), não <img> de HTML; não tem prop alt. */}
      <Image src={logoDocumento()} style={estilos.logo} />
      <View style={estilos.cabecalhoTextos}>
        <Text style={estilos.cabecalhoMarca}>Kraamzorg Brasil</Text>
        <Text style={estilos.cabecalhoTitulo}>{tituloDocumento}</Text>
      </View>
    </View>
  );
}

/** LGPD art. 11 (dado de saúde é dado pessoal sensível) e paginação, em toda página (PRD 9.5). */
export function RodapeDocumento() {
  return (
    <View style={estilos.rodape} fixed>
      <Text style={estilos.rodapeAviso}>
        Documento confidencial, com dado de saúde protegido pela Lei Geral de
        Proteção de Dados, artigo 11. Uso restrito à equipe assistencial e aos
        profissionais médicos indicados.
      </Text>
      <Text
        style={estilos.rodapePagina}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

export function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <View style={estilos.secao} wrap={false}>
      <Text style={estilos.rotuloSecao}>{titulo}</Text>
      {children}
    </View>
  );
}

/** "Rótulo: valor", como os documentos reais (docs/analise-evolucoes.md, seção 1): rótulo em negrito, sem dois-pontos duplicado. */
export function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Text style={estilos.campo}>
      <Text style={estilos.campoRotulo}>{rotulo}: </Text>
      {valor}
    </Text>
  );
}

export function Paragrafo({ children }: { children: ReactNode }) {
  return <Text style={estilos.paragrafo}>{children}</Text>;
}

export function ListaOrdenada({ itens }: { itens: string[] }) {
  return (
    <View>
      {itens.map((item, indice) => (
        <View key={`${indice}-${item.slice(0, 12)}`} style={estilos.listaItem}>
          <Text style={estilos.listaMarcador}>{indice + 1}.</Text>
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function BlocoAssinatura({
  nome,
  especialidade,
  conselho,
  conselhoUf,
  conselhoNumero,
}: {
  nome: string;
  especialidade: string;
  conselho: string;
  conselhoUf: string;
  conselhoNumero: string;
}) {
  return (
    <View style={estilos.assinatura} wrap={false}>
      <Text>{`Responsável: ${nome}. ${conselho}/${conselhoUf} ${conselhoNumero}.`}</Text>
      <Text style={{ color: MARINHO_62, fontSize: 9, marginTop: 2 }}>
        {especialidade}
      </Text>
    </View>
  );
}
