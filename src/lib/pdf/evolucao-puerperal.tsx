import "server-only";

/**
 * Documento da evolução puerperal (PRD 9.5, tabela "Evolução de Enfermagem
 * Puerperal"). Monta o JSX a partir de `DadosEvolucaoPuerperal` e dos
 * textos aprovados (`TextosModelo`, chaves abaixo). Dado calculável ou
 * coletado em campo fechado aparece direto (`Campo`); só os parágrafos que
 * se repetem entre casos (PRD 9.5, "Textos padrão") vêm de
 * `mensagem_modelo`, preenchidos por `preencherTexto`.
 *
 * Chaves usadas em `textos` (destinatário `medico`, PRD 6.7):
 * - `evo_pue_abertura` {dia}
 * - `evo_pue_estabilidade` (sem variável; só quando `estabilidadeHemodinamica`)
 * - `evo_pue_ferida_operatoria` (sem variável; só quando há `feridaOperatoria` sem achado fora do padrão)
 * - `evo_pue_lesao_mama` {grau, lado, local} (só quando há `mamas.lesao`)
 * - `evo_pue_dor_remissao_total` {inicial, diaZerou} (só quando `dor.remissao === "total"`)
 * - `evo_pue_laser` {dias, finalidade} (só quando há `intervencoes.laser`)
 * - `evo_pue_ilib` {dias} (só quando há `intervencoes.ilib`)
 * - `evo_pue_orientacoes_intro` (sem variável)
 * - `evo_pue_orientacoes_base_cesarea` / `evo_pue_orientacoes_base_vaginal` (sem variável; a lista fixa de alerta, só o item de ferida operatória muda entre as duas)
 * - `evo_pue_encaminhamento` {motivos} (só quando há `encaminhamentos.retornoObstetrico`)
 * - `evo_pue_conclusao_exclusiva` / `evo_pue_conclusao_mista` / `evo_pue_conclusao_complemento` {autonomia}
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
import { calcularDiaDeVida } from "./curva-peso";
import { metadadosEvolucao } from "./metadados";
import { preencherTexto } from "./textos";
import type { DadosEvolucaoPuerperal, TextosModelo } from "./tipos";

const ROTULO_ORIGEM: Record<"vaginal" | "cesarea", string> = {
  vaginal: "Normal",
  cesarea: "Cesárea",
};

const ROTULO_AMAMENTACAO: Record<
  DadosEvolucaoPuerperal["conclusao"]["amamentacao"],
  string
> = {
  exclusivo: "exclusiva",
  misto: "mista",
  complemento: "com complemento",
};

function chaveConclusao(
  amamentacao: DadosEvolucaoPuerperal["conclusao"]["amamentacao"],
): string {
  return amamentacao === "exclusivo"
    ? "evo_pue_conclusao_exclusiva"
    : amamentacao === "misto"
      ? "evo_pue_conclusao_mista"
      : "evo_pue_conclusao_complemento";
}

export function EvolucaoPuerperalDocumento({
  dados,
  textos,
}: {
  dados: DadosEvolucaoPuerperal;
  textos: TextosModelo;
}) {
  const metadados = metadadosEvolucao("puerperal");
  const diaVidaBebe = calcularDiaDeVida(
    dados.historico.dataNascimentoBebe,
    dados.dataEmissao,
  );

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
          Evolução de Enfermagem Puerperal
        </Text>

        <Secao titulo="Identificação">
          <Campo
            rotulo="Paciente"
            valor={`${dados.paciente.nome}, ${dados.paciente.idade} anos`}
          />
        </Secao>

        <Secao titulo="Período de acompanhamento">
          <Paragrafo>
            {dados.periodo.inicio} a {dados.periodo.fim} (Kraamzorg Brasil)
          </Paragrafo>
        </Secao>

        <Secao titulo="Histórico">
          <Paragrafo>
            Parto {ROTULO_ORIGEM[dados.historico.tipoParto]}. Data de
            nascimento: {dados.historico.dataNascimentoBebe} (dia de vida{" "}
            {diaVidaBebe}). Data de alta: {dados.historico.dataAlta}.
          </Paragrafo>
        </Secao>

        <Secao titulo="Evolução geral">
          <Paragrafo>
            {preencherTexto("evo_pue_abertura", textos, {
              dia: dados.diaPuerperioFinal,
            })}
          </Paragrafo>
          {dados.estabilidadeHemodinamica ? (
            <Paragrafo>
              {preencherTexto("evo_pue_estabilidade", textos, {})}
            </Paragrafo>
          ) : null}
          {dados.evolucaoGeralTextoLivre ? (
            <Paragrafo>{dados.evolucaoGeralTextoLivre}</Paragrafo>
          ) : null}
        </Secao>

        <Secao titulo="Sinais vitais">
          <Campo
            rotulo="PA"
            valor={`${dados.sinaisVitais.paSistolica.min}/${dados.sinaisVitais.paDiastolica.min} a ${dados.sinaisVitais.paSistolica.max}/${dados.sinaisVitais.paDiastolica.max} mmHg`}
          />
          <Campo
            rotulo="FC"
            valor={`${dados.sinaisVitais.fc.min} a ${dados.sinaisVitais.fc.max} bpm`}
          />
          <Campo
            rotulo="Temperatura"
            valor={`${dados.sinaisVitais.temperatura.min} a ${dados.sinaisVitais.temperatura.max} °C`}
          />
          <Campo
            rotulo="SpO2"
            valor={`${dados.sinaisVitais.spo2.min}% a ${dados.sinaisVitais.spo2.max}%`}
          />
        </Secao>

        {dados.historico.tipoParto === "cesarea" && dados.feridaOperatoria ? (
          <Secao titulo="Ferida operatória">
            <Paragrafo>
              {dados.feridaOperatoria.textoLivre ??
                preencherTexto("evo_pue_ferida_operatoria", textos, {})}
            </Paragrafo>
          </Secao>
        ) : null}

        {dados.laceracaoPerineal ? (
          <Secao titulo="Períneo">
            <Campo
              rotulo="Laceração"
              valor={`grau ${dados.laceracaoPerineal.grau}, ${dados.laceracaoPerineal.local}`}
            />
            <Campo
              rotulo="Sutura"
              valor={dados.laceracaoPerineal.suturada ? "sim" : "não"}
            />
          </Secao>
        ) : null}

        <Secao titulo="Mamas">
          <Campo rotulo="Turgência" valor={dados.mamas.turgencia} />
          <Campo rotulo="Produção" valor={dados.mamas.producao} />
          {dados.mamas.lesao ? (
            <Paragrafo>
              {preencherTexto("evo_pue_lesao_mama", textos, {
                grau: dados.mamas.lesao.grau,
                lado: dados.mamas.lesao.lado,
                local: dados.mamas.lesao.local,
              })}
            </Paragrafo>
          ) : null}
        </Secao>

        <Secao titulo="Dor">
          <Campo
            rotulo="Escala"
            valor={`inicial ${dados.dor.escalaInicial}, máxima ${dados.dor.escalaMaxima}, final ${dados.dor.escalaFinal}`}
          />
          {dados.dor.remissao === "total" &&
          dados.dor.diaZerou !== undefined ? (
            <Paragrafo>
              {preencherTexto("evo_pue_dor_remissao_total", textos, {
                inicial: dados.dor.escalaInicial,
                diaZerou: dados.dor.diaZerou,
              })}
            </Paragrafo>
          ) : null}
          {dados.dor.textoLivre ? (
            <Paragrafo>{dados.dor.textoLivre}</Paragrafo>
          ) : null}
        </Secao>

        <Secao titulo="Eliminações">
          <Campo
            rotulo="Lóquios"
            valor={`${dados.eliminacoes.quantidade}, aspecto ${dados.eliminacoes.aspecto}`}
          />
        </Secao>

        {dados.intervencoes.laser || dados.intervencoes.ilib ? (
          <Secao titulo="Intervenções realizadas">
            {dados.intervencoes.laser ? (
              <Paragrafo>
                {preencherTexto("evo_pue_laser", textos, {
                  dias: dados.intervencoes.laser.dias.join(", "),
                  finalidade: dados.intervencoes.laser.finalidade,
                })}
              </Paragrafo>
            ) : null}
            {dados.intervencoes.ilib ? (
              <Paragrafo>
                {preencherTexto("evo_pue_ilib", textos, {
                  dias: dados.intervencoes.ilib.dias.join(", "),
                })}
              </Paragrafo>
            ) : null}
          </Secao>
        ) : null}

        <Secao titulo="Orientações de alta e conduta">
          <Paragrafo>
            {preencherTexto("evo_pue_orientacoes_intro", textos, {})}
          </Paragrafo>
          <Paragrafo>
            {preencherTexto(
              dados.historico.tipoParto === "cesarea"
                ? "evo_pue_orientacoes_base_cesarea"
                : "evo_pue_orientacoes_base_vaginal",
              textos,
              {},
            )}
          </Paragrafo>
          {dados.orientacoesAlta.itensPersonalizados.length > 0 ? (
            <ListaOrdenada itens={dados.orientacoesAlta.itensPersonalizados} />
          ) : null}
        </Secao>

        {dados.encaminhamentos?.retornoObstetrico ? (
          <Secao titulo="Encaminhamentos">
            <Paragrafo>
              {preencherTexto("evo_pue_encaminhamento", textos, {
                motivos:
                  dados.encaminhamentos.retornoObstetrico.motivos.join(", "),
              })}
            </Paragrafo>
            {dados.encaminhamentos.retornoObstetrico.data ? (
              <Campo
                rotulo="Previsão de consulta"
                valor={dados.encaminhamentos.retornoObstetrico.data}
              />
            ) : null}
          </Secao>
        ) : null}

        <Secao titulo="Conclusão">
          <Paragrafo>
            {preencherTexto(
              chaveConclusao(dados.conclusao.amamentacao),
              textos,
              {
                autonomia: dados.conclusao.autonomiaFamilia,
              },
            )}
          </Paragrafo>
          <Campo
            rotulo="Amamentação"
            valor={ROTULO_AMAMENTACAO[dados.conclusao.amamentacao]}
          />
          {dados.conclusao.producaoLeite ? (
            <Campo
              rotulo="Produção de leite"
              valor={dados.conclusao.producaoLeite}
            />
          ) : null}
        </Secao>

        {dados.contatoObstetra ? (
          <Secao titulo="Contato médico">
            <Campo rotulo="Obstetra" valor={dados.contatoObstetra.nome} />
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
