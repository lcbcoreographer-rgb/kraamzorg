import "server-only";

/**
 * Documento da evolução neonatal (PRD 9.5, tabela "Evolução de Enfermagem
 * Neonatal"), um por bebê. Mesma disciplina do documento puerperal
 * (`evolucao-puerperal.tsx`): dado calculável aparece direto, só o texto
 * que se repete entre casos vem de `mensagem_modelo`.
 *
 * A concordância de gênero (PRD 9.5) é explícita: cada chamada a
 * `preencherTexto` que descreve o bebê recebe as variáveis de gênero já
 * resolvidas por `concordar(dados.bebe.sexo, ...)`, nunca escritas fixas no
 * texto nem no código.
 *
 * Chaves usadas em `textos`:
 * - `evo_neo_identificacao` {sexo, dia_vida, tipo_parto, filiacao}
 * - `evo_neo_estado_geral` {reatividade, mucosas, temp_min, temp_max, fontanela}
 * - `evo_neo_ictericia` {zona, intensidade} (só quando há `ictericia`)
 * - `evo_neo_respiratorio` {fr_min, fr_max}
 * - `evo_neo_cardiovascular` {fc_min, fc_max, spo2_min, spo2_max}
 * - `evo_neo_abdomen_coto` {estado_coto}
 * - `evo_neo_alimentacao_exclusivo` / `_misto` / `_complemento` {succao}
 * - `evo_neo_genitalia_masculina` / `evo_neo_genitalia_feminina` (sem variável)
 * - `evo_neo_eliminacoes` (sem variável)
 * - `evo_neo_conclusao` {adjetivos, aleitamento, evolucao_peso, estado_ictericia, filho}
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
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
import { calcularCurvaPeso } from "./curva-peso";
import { metadadosEvolucao } from "./metadados";
import { concordar, preencherTexto } from "./textos";
import type { DadosEvolucaoNeonatal, TextosModelo } from "./tipos";

const ROTULO_TIPO_PARTO: Record<"vaginal" | "cesarea", string> = {
  vaginal: "normal",
  cesarea: "cesárea",
};

const ROTULO_ORIGEM_PESAGEM: Record<string, string> = {
  alta_hospitalar: "alta hospitalar",
  domicilio: "domicílio",
  pediatra: "pediatra",
};

function chaveAlimentacao(
  tipo: DadosEvolucaoNeonatal["alimentacao"]["tipo"],
): string {
  return tipo === "exclusivo"
    ? "evo_neo_alimentacao_exclusivo"
    : tipo === "misto"
      ? "evo_neo_alimentacao_misto"
      : "evo_neo_alimentacao_complemento";
}

const ROTULO_ALEITAMENTO: Record<
  DadosEvolucaoNeonatal["conclusao"]["aleitamento"],
  string
> = {
  exclusivo: "em aleitamento materno exclusivo",
  misto: "em aleitamento materno misto",
  complemento: "em aleitamento com complemento",
};

const ROTULO_GANHO_PESO: Record<
  DadosEvolucaoNeonatal["conclusao"]["ganhoPeso"],
  string
> = {
  progressivo: "ganho de peso progressivo",
  estavel: "peso estável",
  perda: "perda de peso, em acompanhamento",
};

const ROTULO_ICTERICIA_CONCLUSAO: Record<
  DadosEvolucaoNeonatal["conclusao"]["ictericia"],
  string
> = {
  ausente: "sem icterícia",
  regressao: "com icterícia em regressão",
  presente: "com icterícia em acompanhamento",
};

export function EvolucaoNeonatalDocumento({
  dados,
  textos,
}: {
  dados: DadosEvolucaoNeonatal;
  textos: TextosModelo;
}) {
  const metadados = metadadosEvolucao("neonatal");
  const curva = calcularCurvaPeso(
    dados.bebe.pesoNascimentoG,
    dados.bebe.dataNascimento,
    dados.pesagens,
  );
  const sexo = dados.bebe.sexo;

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

        <Text style={estilos.tituloDocumento}>
          Evolução de Enfermagem Neonatal
        </Text>

        <Secao titulo="Período de acompanhamento">
          <Paragrafo>
            {dados.periodo.inicio} a {dados.periodo.fim} (Kraamzorg Brasil)
          </Paragrafo>
        </Secao>

        <Secao titulo="Identificação">
          <Paragrafo>
            {preencherTexto("evo_neo_identificacao", textos, {
              sexo: concordar(sexo, "masculino", "feminino"),
              dia_vida: dados.diaVidaFinal,
              tipo_parto: ROTULO_TIPO_PARTO[dados.bebe.tipoParto],
              filiacao: dados.filiacao.join(" e "),
            })}
          </Paragrafo>
          <Campo rotulo="Data" valor={dados.dataEmissao} />
        </Secao>

        <Secao titulo="Curva de peso">
          <Campo rotulo="Peso ao nascer" valor={`${curva.pesoNascimentoG} g`} />
          {dados.pesagens.map((pesagem, indice) => (
            <Campo
              key={`${pesagem.data}-${indice}`}
              rotulo={`Peso ${pesagem.data}`}
              valor={`${pesagem.pesoG} g (${ROTULO_ORIGEM_PESAGEM[pesagem.origem]})`}
            />
          ))}
          <Campo
            rotulo="Menor peso"
            valor={`${curva.menorPesoG} g, em ${curva.dataMenorPeso} (dia de vida ${curva.diaVidaMenorPeso})`}
          />
          <Campo
            rotulo="Perda em relação ao nascimento"
            valor={`${curva.perdaPercentual}%`}
          />
          <Campo
            rotulo="Ganho desde o menor peso"
            valor={`${curva.ganhoAbsolutoG} g em ${curva.diasEntreMenorEFinal} dias, ganho médio de ${curva.ganhoMedioDiarioGDia} g/dia`}
          />
        </Secao>

        <Secao titulo="Estado geral">
          <Paragrafo>
            {preencherTexto("evo_neo_estado_geral", textos, {
              reatividade: dados.estadoGeral.reatividade,
              mucosas: dados.estadoGeral.mucosas,
              temp_min: dados.estadoGeral.temperatura.min,
              temp_max: dados.estadoGeral.temperatura.max,
              fontanela: dados.estadoGeral.fontanela,
            })}
          </Paragrafo>
        </Secao>

        {dados.ictericia ? (
          <Secao titulo="Icterícia">
            <Paragrafo>
              {preencherTexto("evo_neo_ictericia", textos, {
                zona: dados.ictericia.zonaKramer,
                intensidade: dados.ictericia.intensidade ?? "leve",
              })}
            </Paragrafo>
          </Secao>
        ) : null}

        <Secao titulo="Sistema respiratório">
          <Paragrafo>
            {preencherTexto("evo_neo_respiratorio", textos, {
              fr_min: dados.respiratorio.fr.min,
              fr_max: dados.respiratorio.fr.max,
            })}
          </Paragrafo>
        </Secao>

        <Secao titulo="Aparelho cardiovascular">
          <Paragrafo>
            {preencherTexto("evo_neo_cardiovascular", textos, {
              fc_min: dados.cardiovascular.fc.min,
              fc_max: dados.cardiovascular.fc.max,
              spo2_min: dados.cardiovascular.spo2.min,
              spo2_max: dados.cardiovascular.spo2.max,
            })}
          </Paragrafo>
        </Secao>

        <Secao titulo="Abdômen e coto umbilical">
          <Paragrafo>
            {preencherTexto("evo_neo_abdomen_coto", textos, {
              estado_coto: dados.abdomeCoto.estadoCoto,
            })}
          </Paragrafo>
          {dados.abdomeCoto.dataQueda ? (
            <Campo rotulo="Queda do coto" valor={dados.abdomeCoto.dataQueda} />
          ) : null}
        </Secao>

        <Secao titulo="Alimentação">
          <Paragrafo>
            {preencherTexto(chaveAlimentacao(dados.alimentacao.tipo), textos, {
              succao: dados.alimentacao.succao,
            })}
          </Paragrafo>
          {dados.alimentacao.complementoMl !== undefined ? (
            <Campo
              rotulo="Complemento"
              valor={`${dados.alimentacao.complementoMl} ml`}
            />
          ) : null}
        </Secao>

        <Secao titulo="Genitália e eliminações">
          <Paragrafo>
            {preencherTexto(
              sexo === "feminino"
                ? "evo_neo_genitalia_feminina"
                : "evo_neo_genitalia_masculina",
              textos,
              {},
            )}
          </Paragrafo>
          <Paragrafo>
            {preencherTexto("evo_neo_eliminacoes", textos, {})}
          </Paragrafo>
          <View>
            <Text>
              Diurese{" "}
              {dados.genitaliaEliminacoes.diurese ? "presente" : "ausente"},
              evacuações{" "}
              {dados.genitaliaEliminacoes.evacuacoes ? "presentes" : "ausentes"}
              .
            </Text>
          </View>
        </Secao>

        {dados.orientacoesCondutas.length > 0 ? (
          <Secao titulo="Orientações e condutas">
            <ListaOrdenada itens={dados.orientacoesCondutas} />
          </Secao>
        ) : null}

        <Secao titulo="Conclusão">
          <Paragrafo>
            {preencherTexto("evo_neo_conclusao", textos, {
              adjetivos: concordar(
                sexo,
                "calmo, ativo e reativo",
                "calma, ativa e reativa",
              ),
              aleitamento: ROTULO_ALEITAMENTO[dados.conclusao.aleitamento],
              evolucao_peso: ROTULO_GANHO_PESO[dados.conclusao.ganhoPeso],
              estado_ictericia:
                ROTULO_ICTERICIA_CONCLUSAO[dados.conclusao.ictericia],
              filho: concordar(sexo, "filho", "filha"),
            })}
          </Paragrafo>
          {dados.conclusao.vinculoTexto ? (
            <Paragrafo>{dados.conclusao.vinculoTexto}</Paragrafo>
          ) : null}
        </Secao>

        {dados.contatoPediatra ? (
          <Secao titulo="Contato médico">
            <Campo rotulo="Pediatra" valor={dados.contatoPediatra.nome} />
          </Secao>
        ) : null}

        <BlocoAssinatura
          nome={dados.profissional.nome}
          funcao={dados.profissional.funcao}
          conselho={dados.profissional.conselho}
          conselhoUf={dados.profissional.conselhoUf}
          conselhoNumero={dados.profissional.conselhoNumero}
        />
      </Page>
    </Document>
  );
}
