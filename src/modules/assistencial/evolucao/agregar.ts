import type { BaseEvolucao, BebeDaBase } from "@/lib/dados/tipos-evolucao";
import type {
  DadosEvolucaoNeonatal,
  DadosEvolucaoPuerperal,
  Faixa,
  Pesagem,
  TipoAleitamento,
  ZonaKramer,
} from "@/lib/pdf/tipos";
import {
  calcularCurvaPeso,
  classificarEvolucaoPeso,
} from "@/lib/pdf/curva-peso";

/**
 * Do registro do checklist (DOC 2) e dos cadastros para a entrada dos
 * geradores de evolução (PRD 9.5). Função pura: recebe a base que
 * `api.base_evolucao` devolve e monta o que dá para calcular; o resto fica
 * vazio para a enfermeira completar na tela (campos que o checklist não tem,
 * K-01, e o julgamento clínico). Nada é presumido: dado que falta continua
 * faltando, e o gerador valida antes de a evolução ir para a revisão.
 *
 * Nenhum texto clínico mora aqui. Os textos-padrão (turgência, mucosas,
 * fontanela...) vêm de `base.textos` (chaves `evo_padrao_*` de
 * `mensagem_modelo`, rascunho até a Edilaine revisar) e os rótulos das
 * orientações, do próprio instrumento (`base.orientacoesRotulos`).
 */

export type ParcialProfundo<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends (infer U)[]
    ? U[]
    : NonNullable<T[K]> extends object
      ? ParcialProfundo<NonNullable<T[K]>>
      : T[K];
};

export type ParcialPuerperal = ParcialProfundo<DadosEvolucaoPuerperal>;
export type ParcialNeonatal = ParcialProfundo<DadosEvolucaoNeonatal>;

export interface NeonatalAgregado {
  bebeId: string;
  ordem: number;
  nome: string | null;
  dados: ParcialNeonatal;
}

export interface ResultadoAgregacao {
  puerperal: ParcialPuerperal;
  neonatais: NeonatalAgregado[];
}

type Objeto = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(",", "."));
    if (valor.trim() !== "" && Number.isFinite(n)) return n;
  }
  if (ehObjeto(valor) && "valor" in valor) return numero(valor.valor);
  return undefined;
}

/** Sim ou não simples (`true`) ou com texto (`{ resposta, texto }`). */
function simNao(valor: unknown): boolean | undefined {
  if (typeof valor === "boolean") return valor;
  if (ehObjeto(valor) && typeof valor.resposta === "boolean") {
    return valor.resposta;
  }
  return undefined;
}

function textoDe(valor: unknown): string | undefined {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (
    ehObjeto(valor) &&
    typeof valor.texto === "string" &&
    valor.texto.trim()
  ) {
    return valor.texto.trim();
  }
  return undefined;
}

function bloco(dados: Objeto, id: string): Objeto | undefined {
  const b = dados[id];
  return ehObjeto(b) ? b : undefined;
}

/** Item do bloco do RN (lista, um por bebê) do bebê dado; com um bebê só, o item sem `bebe_id` também vale. */
function blocoDoBebe(
  dados: Objeto,
  id: string,
  bebeId: string,
  unicoBebe: boolean,
): Objeto | undefined {
  const lista = dados[id];
  if (!Array.isArray(lista)) return undefined;
  const itens = lista.filter(ehObjeto);
  return (
    itens.find((item) => item.bebe_id === bebeId) ??
    (unicoBebe ? itens.find((item) => item.bebe_id === undefined) : undefined)
  );
}

function faixa(valores: number[]): Faixa | undefined {
  if (valores.length === 0) return undefined;
  // Uma casa decimal: o registro traz números como 36,6 e a soma em ponto
  // flutuante deixaria 36,800000000000004 na entrada guardada.
  const uma = (n: number) => Math.round(n * 10) / 10;
  return { min: uma(Math.min(...valores)), max: uma(Math.max(...valores)) };
}

const MS_DIA = 86_400_000;

function diaD(inicio: string, data: string): number {
  return (
    Math.round(
      (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) /
        MS_DIA,
    ) + 1
  );
}

function valida(data: string | null | undefined): data is string {
  return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data);
}

const ZONAS: Record<string, number> = {
  ausente: 0,
  zona_i: 1,
  zona_ii: 2,
  zona_iii: 3,
  zona_iv: 4,
  zona_v: 5,
};

function sexoDoBebe(bebe: BebeDaBase): "feminino" | "masculino" | undefined {
  return bebe.sexo === "feminino" || bebe.sexo === "masculino"
    ? bebe.sexo
    : undefined;
}

function tipoPartoDoBebe(bebe: BebeDaBase): "vaginal" | "cesarea" | undefined {
  return bebe.tipoParto === "vaginal" || bebe.tipoParto === "cesarea"
    ? bebe.tipoParto
    : undefined;
}

function profissional(base: BaseEvolucao) {
  const p = base.profissional;
  if (!p) return undefined;
  return {
    nome: p.nome,
    funcao: p.funcao,
    // O rótulo da função vem de parametro.profissional_funcoes; sem cadastro fica vazio e a validação acusa.
    especialidade: base.funcoes[p.funcao] ?? "",
    conselho: p.conselho ?? "",
    conselhoUf: p.conselhoUf ?? "",
    conselhoNumero: p.conselhoNumero ?? "",
  };
}

function contato(base: BaseEvolucao, especialidade: "obstetra" | "pediatra") {
  const medico = base.medicos.find(
    (m) => m.especialidade === especialidade && m.temEmail,
  );
  return medico
    ? { nome: medico.nome, email: medico.emailMascarado ?? undefined }
    : undefined;
}

function periodo(
  base: BaseEvolucao,
): { inicio: string; fim: string } | undefined {
  const datas = base.visitas
    .map((v) => v.data)
    .filter(valida)
    .sort();
  if (datas.length === 0) return undefined;
  return { inicio: datas[0]!, fim: datas[datas.length - 1]! };
}

export function agregarPuerperal(base: BaseEvolucao): ParcialPuerperal {
  const per = periodo(base);
  const visitas = [...base.visitas].sort((a, b) => a.diaNumero - b.diaNumero);
  const bebePrincipal = base.bebes[0];
  const inicio = per?.inicio;

  const sistolica: number[] = [];
  const diastolica: number[] = [];
  const fc: number[] = [];
  const temperatura: number[] = [];
  const evn: { dia: number; valor: number }[] = [];
  const ferida: boolean[] = [];
  const lesoes: { dia: number; lado: "esquerda" | "direita" | "ambas" }[] = [];
  const laserDias: number[] = [];
  const ilibDias: number[] = [];

  for (const visita of visitas) {
    const dia = inicio ? diaD(inicio, visita.data) : visita.diaNumero;
    const d = visita.dados;

    const sinais = bloco(d, "2.1");
    if (sinais) {
      const pa = sinais.pressao_arterial;
      if (ehObjeto(pa) && ehObjeto(pa.partes)) {
        const s = numero(pa.partes.sistolica);
        const dt = numero(pa.partes.diastolica);
        if (s !== undefined) sistolica.push(s);
        if (dt !== undefined) diastolica.push(dt);
      }
      const f = numero(sinais.frequencia_cardiaca);
      if (f !== undefined) fc.push(f);
      const t = numero(sinais.temperatura);
      if (t !== undefined) temperatura.push(t);
    }

    const dor = bloco(d, "2.6");
    const valorDor = dor ? numero(dor.evn) : undefined;
    if (valorDor !== undefined) evn.push({ dia, valor: valorDor });

    const cirurgica = bloco(d, "2.2");
    const semInfeccao = cirurgica
      ? simNao(cirurgica.cesarea_sem_sinais_infeccao)
      : undefined;
    if (semInfeccao !== undefined) ferida.push(semInfeccao);

    const lesao = bloco(d, "2.7")?.lesao_mamilar;
    if (lesao === "direita" || lesao === "esquerda" || lesao === "ambas") {
      lesoes.push({ dia, lado: lesao });
    }

    const fbm = bloco(d, "2.9")?.fbm_aplicada;
    if (Array.isArray(fbm)) {
      if (fbm.includes("analgesia") || fbm.includes("reparacao")) {
        laserDias.push(dia);
      }
      if (fbm.includes("ilib")) ilibDias.push(dia);
    }
  }

  const parcial: ParcialPuerperal = {
    paciente: base.paciente
      ? {
          nome: base.paciente.nome,
          ...(base.paciente.idade !== null
            ? { idade: base.paciente.idade }
            : {}),
        }
      : undefined,
    periodo: per,
    historico: {
      tipoParto: bebePrincipal ? tipoPartoDoBebe(bebePrincipal) : undefined,
      dataNascimentoBebe:
        base.acompanhamento.dataNascimento ??
        base.bebes
          .map((b) => b.dataNascimento)
          .filter(valida)
          .sort()[0],
      dataAlta: base.acompanhamento.dataAlta ?? undefined,
    },
    sinaisVitais: {
      paSistolica: faixa(sistolica),
      paDiastolica: faixa(diastolica),
      fc: faixa(fc),
      temperatura: faixa(temperatura),
    },
    mamas: {
      turgencia: base.textos.evo_padrao_turgencia,
      producao: base.textos.evo_padrao_producao,
    },
    eliminacoes: { quantidade: base.textos.evo_padrao_loquios_quantidade },
    intervencoes: {},
    orientacoesAlta: { itensPersonalizados: [] },
    contatoObstetra: contato(base, "obstetra"),
    profissional: profissional(base),
    dataEmissao: base.hoje,
  };

  if (lesoes.length > 0) {
    const ultima = lesoes[lesoes.length - 1]!;
    parcial.mamas = {
      ...parcial.mamas,
      lesao: {
        lado: ultima.lado,
        local: "mamilo",
        diaSurgimento: lesoes[0]!.dia,
      },
    };
  }

  if (
    bebePrincipal &&
    tipoPartoDoBebe(bebePrincipal) === "cesarea" &&
    ferida.length > 0
  ) {
    parcial.feridaOperatoria = { semSinaisFlogisticos: ferida.every(Boolean) };
  }

  if (evn.length > 0) {
    const inicial = evn[0]!.valor;
    const final = evn[evn.length - 1]!.valor;
    const maxima = Math.max(...evn.map((e) => e.valor));
    let diaZerou: number | undefined;
    if (final === 0) {
      // primeiro dia a partir do qual a dor ficou em 0 até o fim
      let indice = evn.length - 1;
      while (indice > 0 && evn[indice - 1]!.valor === 0) indice -= 1;
      diaZerou = evn[indice]!.dia;
    }
    parcial.dor = {
      escalaInicial: inicial,
      escalaMaxima: maxima,
      escalaFinal: final,
      ...(diaZerou !== undefined ? { diaZerou } : {}),
      remissao:
        final === 0 && inicial > 0
          ? "total"
          : final > 0 && final < inicial
            ? "parcial"
            : final === 0
              ? "total"
              : "nenhuma",
    };
  }

  if (laserDias.length > 0) {
    parcial.intervencoes = {
      ...parcial.intervencoes,
      laser: {
        dias: laserDias,
        finalidade: base.textos.evo_padrao_laser_finalidade,
      },
    };
  }
  if (ilibDias.length > 0) {
    parcial.intervencoes = {
      ...parcial.intervencoes,
      ilib: { dias: ilibDias },
    };
  }
  return parcial;
}

export function agregarNeonatal(
  base: BaseEvolucao,
  bebe: BebeDaBase,
): ParcialNeonatal {
  const per = periodo(base);
  const unico = base.bebes.length === 1;
  const visitas = [...base.visitas].sort((a, b) => a.diaNumero - b.diaNumero);
  const sexo = sexoDoBebe(bebe);

  const pesagens: Pesagem[] = [];
  if (
    bebe.pesoAltaG &&
    valida(base.acompanhamento.dataAlta) &&
    base.acompanhamento.dataAlta !== bebe.dataNascimento
  ) {
    pesagens.push({
      data: base.acompanhamento.dataAlta,
      pesoG: bebe.pesoAltaG,
      origem: "alta_hospitalar",
    });
  }
  const temperatura: number[] = [];
  const fc: number[] = [];
  const fr: number[] = [];
  const zonas: number[] = [];
  let respiraSemEsforco: boolean | undefined;
  let diurese: boolean | undefined;
  let textoCoto: string | undefined;
  const orientacoes: string[] = [];

  for (const visita of visitas) {
    const d = visita.dados;
    const sinais = blocoDoBebe(d, "3.1", bebe.id, unico);
    if (sinais) {
      const peso = numero(sinais.peso);
      if (peso !== undefined && peso > 0 && valida(visita.data)) {
        pesagens.push({ data: visita.data, pesoG: peso, origem: "domicilio" });
      }
      const t = numero(sinais.temperatura);
      if (t !== undefined) temperatura.push(t);
      const f = numero(sinais.frequencia_cardiaca);
      if (f !== undefined) fc.push(f);
      const r = numero(sinais.frequencia_respiratoria);
      if (r !== undefined) fr.push(r);
    }
    const avaliacao = blocoDoBebe(d, "3", bebe.id, unico);
    if (avaliacao) {
      const cor = avaliacao.cor_da_pele_icterica;
      if (typeof cor === "string" && cor in ZONAS) zonas.push(ZONAS[cor]!);
      const semEsforco = simNao(avaliacao.respiracao_sem_sinais_esforco);
      if (semEsforco !== undefined) respiraSemEsforco = semEsforco;
    }
    const cuidados = blocoDoBebe(d, "3.2", bebe.id, unico) ?? bloco(d, "3.2");
    if (cuidados) {
      const fraldas = simNao(cuidados.troca_fraldas_avaliacao_diurese);
      if (fraldas !== undefined) diurese = fraldas;
      const coto = textoDe(cuidados.coto_umbilical_avaliado);
      if (coto) textoCoto = coto;
    }
    for (const chave of ["4", "5"]) {
      const b = bloco(d, chave);
      if (!b) continue;
      for (const [campo, valor] of Object.entries(b)) {
        const rotulo = base.orientacoesRotulos[`${chave}.${campo}`];
        if (rotulo && simNao(valor) === true && !orientacoes.includes(rotulo)) {
          orientacoes.push(rotulo);
        }
      }
    }
  }

  const reatividade =
    sexo === "feminino"
      ? base.textos.evo_padrao_reatividade_feminino
      : base.textos.evo_padrao_reatividade_masculino;

  const parcial: ParcialNeonatal = {
    bebeId: bebe.id,
    bebe: {
      ...(bebe.nome ? { nome: bebe.nome } : {}),
      sexo,
      tipoParto: tipoPartoDoBebe(bebe),
      dataNascimento: bebe.dataNascimento ?? undefined,
      pesoNascimentoG: bebe.pesoNascimentoG ?? undefined,
    },
    filiacao: base.filiacao,
    periodo: per,
    pesagens,
    estadoGeral: {
      reatividade: sexo ? reatividade : undefined,
      mucosas: base.textos.evo_padrao_mucosas,
      temperatura: faixa(temperatura),
      fontanela: base.textos.evo_padrao_fontanela,
    },
    respiratorio: {
      fr: faixa(fr),
      esforco:
        respiraSemEsforco === true ? base.textos.evo_padrao_esforco : undefined,
    },
    cardiovascular: { fc: faixa(fc) },
    abdomeCoto: { estadoCoto: textoCoto ?? base.textos.evo_padrao_coto },
    alimentacao: { succao: base.textos.evo_padrao_succao },
    genitaliaEliminacoes: diurese !== undefined ? { diurese } : {},
    orientacoesCondutas: orientacoes,
    contatoPediatra: contato(base, "pediatra"),
    profissional: profissional(base),
    dataEmissao: base.hoje,
  };

  if (zonas.length > 0) {
    const ultima = zonas[zonas.length - 1]!;
    const maxima = Math.max(...zonas);
    if (ultima > 0) {
      const tendencia =
        ultima < maxima
          ? "regressao"
          : ultima > zonas[0]!
            ? "progressao"
            : "estavel";
      parcial.ictericia = {
        zonaKramer: ultima as ZonaKramer,
        zonaMaxima: maxima as ZonaKramer,
        tendencia,
      };
    }
  }
  return parcial;
}

export function agregarBase(base: BaseEvolucao): ResultadoAgregacao {
  return {
    puerperal: agregarPuerperal(base),
    neonatais: [...base.bebes]
      .sort((a, b) => a.ordem - b.ordem)
      .map((bebe) => ({
        bebeId: bebe.id,
        ordem: bebe.ordem,
        nome: bebe.nome,
        dados: agregarNeonatal(base, bebe),
      })),
  };
}

// --- Sugestões de conclusão (calculadas, a enfermeira confirma ou troca) ---------------------

/** Conclusão sugerida do neonatal a partir do que foi observado; a validação compara depois com o que a enfermeira escolheu. */
export function sugerirConclusaoNeonatal(dados: ParcialNeonatal): {
  aleitamento?: TipoAleitamento;
  ganhoPeso?: "progressivo" | "estavel" | "perda";
  ictericia?: "ausente" | "regressao" | "presente";
} {
  const saida: ReturnType<typeof sugerirConclusaoNeonatal> = {};
  if (dados.alimentacao?.tipo) saida.aleitamento = dados.alimentacao.tipo;
  const nascimento = dados.bebe?.dataNascimento;
  const peso = dados.bebe?.pesoNascimentoG;
  if (nascimento && peso && dados.pesagens && dados.pesagens.length > 0) {
    try {
      saida.ganhoPeso = classificarEvolucaoPeso(
        calcularCurvaPeso(peso, nascimento, dados.pesagens as Pesagem[]),
      );
    } catch {
      // peso inválido: a validação do gerador acusa
    }
  }
  if (dados.ictericia) {
    saida.ictericia =
      dados.ictericia.tendencia === "regressao" ? "regressao" : "presente";
  } else if (dados.estadoGeral) {
    saida.ictericia = "ausente";
  }
  return saida;
}
