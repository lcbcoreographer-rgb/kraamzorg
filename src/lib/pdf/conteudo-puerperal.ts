/**
 * Conteúdo da evolução puerperal (PRD 9.5, tabela "Evolução de Enfermagem
 * Puerperal"). Dado calculável ou coletado em campo fechado entra direto
 * (`campo`); só os parágrafos que se repetem entre casos (PRD 9.5, "Textos
 * padrão") vêm de `mensagem_modelo`, preenchidos por `preencherTexto`.
 * Títulos de seção e rótulos de campo são a estrutura do PRD 9.5, não
 * texto de negócio.
 *
 * Chaves usadas em `textos` (destinatário `medico`, PRD 6.7):
 * - `evo_pue_abertura` {dia}
 * - `evo_pue_estabilidade` (só quando `estabilidadeHemodinamica`)
 * - `evo_pue_ferida_operatoria` (cesárea sem achado fora do padrão)
 * - `evo_pue_lesao_mama` {grau, lado, local, local_lado, dia_surgimento?, grau_final?}
 * - `evo_pue_dor_remissao_total` {inicial, dia_zerou}
 * - `evo_pue_dor_remissao_parcial` {inicial, final}
 * - `evo_pue_laser` {dias, finalidade, dose_j?}
 * - `evo_pue_ilib` {dias}
 * - `evo_pue_orientacoes_intro`
 * - `evo_pue_orientacoes_base_cesarea` / `evo_pue_orientacoes_base_vaginal`
 *   (a lista fixa de sinais de alerta, um item por linha; só o item de
 *   ferida operatória muda entre as duas)
 * - `evo_pue_encaminhamento` {motivos}
 * - `evo_pue_encaminhamento_medicacoes`, `evo_pue_encaminhamento_saude_mental`,
 *   `evo_pue_encaminhamento_nutricao`
 * - `evo_pue_conclusao_exclusivo` / `_misto` / `_complemento` {autonomia}
 *
 * Variável marcada com "?" só é passada quando o dado existe: o modelo que
 * a usar exige o dado, e a falta vira erro claro em vez de texto inventado.
 */
import {
  campo,
  lista,
  paragrafo,
  type Bloco,
  type ConteudoEvolucao,
  type SecaoConteudo,
} from "./conteudo";
import { calcularDiaDeVida } from "./curva-peso";
import { dataBr, faixaBr, numeroBr } from "./formatar";
import { preencherTexto, type Variaveis } from "./textos";
import type {
  DadosEvolucaoPuerperal,
  LesaoMama,
  TextosModelo,
  TipoAleitamento,
  TipoParto,
} from "./tipos";

const ROTULO_TIPO_PARTO: Record<TipoParto, string> = {
  vaginal: "normal",
  cesarea: "cesárea",
};

const ROTULO_AMAMENTACAO: Record<TipoAleitamento, string> = {
  exclusivo: "exclusiva",
  misto: "mista",
  complemento: "com complemento",
};

/** Lado concordando com o local ("mamilo esquerdo", "mama esquerda", "ambos os mamilos"). */
function localELado(lesao: LesaoMama): { lado: string; localLado: string } {
  const noMamilo = lesao.local === "mamilo";
  if (lesao.lado === "ambas") {
    return {
      lado: noMamilo ? "ambos" : "ambas",
      localLado: noMamilo ? "ambos os mamilos" : "ambas as mamas",
    };
  }
  const lado =
    lesao.lado === "esquerda"
      ? noMamilo
        ? "esquerdo"
        : "esquerda"
      : noMamilo
        ? "direito"
        : "direita";
  return { lado, localLado: `${lesao.local} ${lado}` };
}

function diasD(dias: number[]): string {
  return dias.map((dia) => `D${dia}`).join(", ");
}

function linhas(texto: string): string[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
}

export function montarConteudoPuerperal(
  dados: DadosEvolucaoPuerperal,
  textos: TextosModelo,
): ConteudoEvolucao {
  const secoes: SecaoConteudo[] = [];
  const cesarea = dados.historico.tipoParto === "cesarea";

  secoes.push({
    titulo: "Identificação",
    blocos: [
      campo("Paciente", `${dados.paciente.nome}, ${dados.paciente.idade} anos`),
      campo("Data do documento", dataBr(dados.dataEmissao)),
    ],
  });

  secoes.push({
    titulo: "Período de acompanhamento",
    blocos: [
      paragrafo(
        `${dataBr(dados.periodo.inicio)} a ${dataBr(dados.periodo.fim)} (Kraamzorg Brasil)`,
      ),
    ],
  });

  secoes.push({
    titulo: "Histórico",
    blocos: [
      campo("Parto", ROTULO_TIPO_PARTO[dados.historico.tipoParto]),
      campo("Nascimento", dataBr(dados.historico.dataNascimentoBebe)),
      campo("Alta hospitalar", dataBr(dados.historico.dataAlta)),
    ],
  });

  // K-11: o dia do nascimento é o dia 0 também para o puerpério.
  const diaPuerperio = calcularDiaDeVida(
    dados.historico.dataNascimentoBebe,
    dados.periodo.fim,
  );
  const evolucaoGeral: Bloco[] = [
    paragrafo(
      preencherTexto("evo_pue_abertura", textos, { dia: diaPuerperio }),
    ),
  ];
  if (dados.estabilidadeHemodinamica) {
    evolucaoGeral.push(
      paragrafo(preencherTexto("evo_pue_estabilidade", textos, {})),
    );
  }
  if (dados.evolucaoGeralTextoLivre) {
    evolucaoGeral.push(paragrafo(dados.evolucaoGeralTextoLivre));
  }
  secoes.push({ titulo: "Evolução geral", blocos: evolucaoGeral });

  const sinais = dados.sinaisVitais;
  const blocosSinais: Bloco[] = [
    campo(
      "PA",
      `${sinais.paSistolica.min}/${sinais.paDiastolica.min} a ${sinais.paSistolica.max}/${sinais.paDiastolica.max} mmHg`,
    ),
    campo("FC", `${faixaBr(sinais.fc)} bpm`),
    campo("Temperatura", `${faixaBr(sinais.temperatura)} °C`),
  ];
  if (sinais.spo2) {
    blocosSinais.push(campo("SpO2", `${faixaBr(sinais.spo2)}%`));
  }
  secoes.push({ titulo: "Sinais vitais", blocos: blocosSinais });

  if (cesarea && dados.feridaOperatoria) {
    const ferida = dados.feridaOperatoria;
    // Achado fora do padrão substitui a frase-padrão; a validação barra o
    // caso "com sinais flogísticos" sem descrição, para a frase de "sem
    // sinais" nunca sair sobre um achado diferente.
    const texto =
      ferida.textoLivre ??
      preencherTexto("evo_pue_ferida_operatoria", textos, {});
    secoes.push({ titulo: "Ferida operatória", blocos: [paragrafo(texto)] });
  }

  if (dados.laceracaoPerineal) {
    const laceracao = dados.laceracaoPerineal;
    secoes.push({
      titulo: "Períneo",
      blocos: [
        campo("Laceração", `grau ${laceracao.grau}, ${laceracao.local}`),
        campo("Sutura", laceracao.suturada ? "sim" : "não"),
      ],
    });
  }

  const blocosMamas: Bloco[] = [
    campo("Turgência", dados.mamas.turgencia),
    campo("Produção", dados.mamas.producao),
  ];
  const lesao = dados.mamas.lesao;
  if (lesao) {
    const { lado, localLado } = localELado(lesao);
    const variaveis: Variaveis = {
      grau: lesao.grau,
      lado,
      local: lesao.local,
      local_lado: localLado,
    };
    if (lesao.diaSurgimento !== undefined) {
      variaveis.dia_surgimento = lesao.diaSurgimento;
    }
    if (lesao.grauFinal !== undefined) variaveis.grau_final = lesao.grauFinal;
    blocosMamas.push(
      paragrafo(preencherTexto("evo_pue_lesao_mama", textos, variaveis)),
    );
    if (lesao.diaSurgimento !== undefined) {
      blocosMamas.push(
        campo("Lesão identificada em", `D${lesao.diaSurgimento}`),
      );
    }
    if (lesao.grauFinal !== undefined) {
      blocosMamas.push(campo("Grau final da lesão", lesao.grauFinal));
    }
  }
  secoes.push({ titulo: "Mamas", blocos: blocosMamas });

  const dor = dados.dor;
  const blocosDor: Bloco[] = [
    campo(
      "Escala de dor",
      `inicial ${dor.escalaInicial}, máxima ${dor.escalaMaxima}, final ${dor.escalaFinal}`,
    ),
  ];
  if (dor.remissao === "total" && dor.diaZerou !== undefined) {
    blocosDor.push(
      paragrafo(
        preencherTexto("evo_pue_dor_remissao_total", textos, {
          inicial: dor.escalaInicial,
          dia_zerou: dor.diaZerou,
        }),
      ),
    );
  } else if (dor.remissao === "parcial") {
    blocosDor.push(
      paragrafo(
        preencherTexto("evo_pue_dor_remissao_parcial", textos, {
          inicial: dor.escalaInicial,
          final: dor.escalaFinal,
        }),
      ),
    );
  }
  if (dor.textoLivre) blocosDor.push(paragrafo(dor.textoLivre));
  secoes.push({ titulo: "Dor", blocos: blocosDor });

  const { quantidade, aspecto } = dados.eliminacoes;
  secoes.push({
    titulo: "Eliminações",
    blocos: [
      campo(
        "Lóquios",
        aspecto ? `${quantidade}, aspecto ${aspecto}` : quantidade,
      ),
    ],
  });

  const { laser, ilib } = dados.intervencoes;
  if (laser || ilib) {
    const blocos: Bloco[] = [];
    if (laser) {
      const variaveis: Variaveis = {
        dias: diasD(laser.dias),
        finalidade: laser.finalidade,
      };
      if (laser.doseJ !== undefined) variaveis.dose_j = numeroBr(laser.doseJ);
      blocos.push(
        paragrafo(preencherTexto("evo_pue_laser", textos, variaveis)),
      );
    }
    if (ilib) {
      blocos.push(
        paragrafo(
          preencherTexto("evo_pue_ilib", textos, { dias: diasD(ilib.dias) }),
        ),
      );
    }
    secoes.push({ titulo: "Intervenções realizadas", blocos });
  }

  // O item de ferida operatória só existe na lista da cesárea (PRD 9.5):
  // o código escolhe a lista pelo tipo de parto, a enfermeira não precisa
  // lembrar de tirar nem de pôr.
  const itensAlerta = linhas(
    preencherTexto(
      cesarea
        ? "evo_pue_orientacoes_base_cesarea"
        : "evo_pue_orientacoes_base_vaginal",
      textos,
      {},
    ),
  );
  secoes.push({
    titulo: "Orientações de alta e conduta",
    blocos: [
      paragrafo(preencherTexto("evo_pue_orientacoes_intro", textos, {})),
      lista([...itensAlerta, ...dados.orientacoesAlta.itensPersonalizados]),
    ],
  });

  const encaminhamentos = dados.encaminhamentos;
  if (encaminhamentos) {
    const blocos: Bloco[] = [];
    const retorno = encaminhamentos.retornoObstetrico;
    if (retorno) {
      blocos.push(
        paragrafo(
          preencherTexto("evo_pue_encaminhamento", textos, {
            motivos: retorno.motivos.join(", "),
          }),
        ),
      );
      if (retorno.data) {
        blocos.push(campo("Previsão de consulta", dataBr(retorno.data)));
      }
    }
    if (encaminhamentos.medicacoes) {
      blocos.push(
        paragrafo(
          preencherTexto("evo_pue_encaminhamento_medicacoes", textos, {}),
        ),
      );
    }
    if (encaminhamentos.saudeMental) {
      blocos.push(
        paragrafo(
          preencherTexto("evo_pue_encaminhamento_saude_mental", textos, {}),
        ),
      );
    }
    if (encaminhamentos.nutricao) {
      blocos.push(
        paragrafo(
          preencherTexto("evo_pue_encaminhamento_nutricao", textos, {}),
        ),
      );
    }
    if (blocos.length > 0) {
      secoes.push({ titulo: "Encaminhamentos", blocos });
    }
  }

  const blocosConclusao: Bloco[] = [
    paragrafo(
      preencherTexto(
        `evo_pue_conclusao_${dados.conclusao.amamentacao}`,
        textos,
        {
          autonomia: dados.conclusao.autonomiaFamilia,
        },
      ),
    ),
    campo("Amamentação", ROTULO_AMAMENTACAO[dados.conclusao.amamentacao]),
  ];
  if (dados.conclusao.producaoLeite) {
    blocosConclusao.push(
      campo("Produção de leite", dados.conclusao.producaoLeite),
    );
  }
  secoes.push({ titulo: "Conclusão", blocos: blocosConclusao });

  if (dados.contatoObstetra) {
    secoes.push({
      titulo: "Contato médico",
      blocos: [campo("Obstetra", dados.contatoObstetra.nome)],
    });
  }

  const { nome, especialidade, conselho, conselhoUf, conselhoNumero } =
    dados.profissional;
  return {
    tipo: "puerperal",
    secoes,
    assinatura: { nome, especialidade, conselho, conselhoUf, conselhoNumero },
  };
}
