/**
 * Campos que a enfermeira confere ou completa na evolução (PRD 9.5): o que o
 * checklist não registra (K-01, marcado [clínico] no PRD) e o julgamento
 * clínico (conclusão, encaminhamentos, orientações). Cada campo é um caminho
 * dentro da entrada dos geradores (`src/lib/pdf/tipos.ts`); a tela e a ação
 * de salvar leem esta mesma lista, então um campo novo entra num lugar só.
 *
 * Os rótulos e as opções aqui são texto de interface. Nenhum texto que sai no
 * PDF mora neste arquivo: ele vem de `mensagem_modelo`.
 */

export type TipoCampo =
  | "texto"
  | "textolongo"
  | "numero"
  | "data"
  | "simnao"
  | "opcao"
  | "lista"
  | "faixa";

export interface OpcaoCampo {
  valor: string;
  rotulo: string;
}

export interface CampoEditavel {
  /** Caminho com pontos dentro da entrada do gerador ("conclusao.amamentacao"). */
  caminho: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: OpcaoCampo[];
  ajuda?: string;
  obrigatorio?: boolean;
  /** Bloco da tela: o que falta no checklist ou o julgamento da enfermeira. */
  grupo: "completar" | "julgamento";
  /** Só aparece quando a entrada tem este caminho (ex: grau da lesão, só se há lesão). */
  quando?: string;
  /** Só aparece quando a entrada NÃO tem este caminho (dado que o cadastro devia trazer). */
  quandoFalta?: boolean;
  unidade?: string;
}

export type Dados = Record<string, unknown>;

// --- Caminho com pontos ---------------------------------------------------------------

function ehObjeto(valor: unknown): valor is Dados {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

export function obter(dados: Dados, caminho: string): unknown {
  let atual: unknown = dados;
  for (const parte of caminho.split(".")) {
    if (!ehObjeto(atual)) return undefined;
    atual = atual[parte];
  }
  return atual;
}

/** Copia `dados` com o valor no caminho; `undefined` apaga a chave (e o objeto que ficar vazio). */
export function definir(dados: Dados, caminho: string, valor: unknown): Dados {
  const partes = caminho.split(".");
  const copia: Dados = { ...dados };
  const [primeira, ...resto] = partes;
  if (primeira === undefined) return copia;
  if (resto.length === 0) {
    if (valor === undefined) delete copia[primeira];
    else copia[primeira] = valor;
    return copia;
  }
  const filho = ehObjeto(copia[primeira]) ? copia[primeira] : {};
  const novoFilho = definir(filho, resto.join("."), valor);
  if (Object.keys(novoFilho).length === 0) delete copia[primeira];
  else copia[primeira] = novoFilho;
  return copia;
}

export function tem(dados: Dados, caminho: string): boolean {
  const valor = obter(dados, caminho);
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  return true;
}

// --- Campos do puerperal --------------------------------------------------------------

const AMAMENTACAO: OpcaoCampo[] = [
  { valor: "exclusivo", rotulo: "Exclusivo" },
  { valor: "misto", rotulo: "Misto" },
  { valor: "complemento", rotulo: "Com complemento" },
];

export const CAMPOS_PUERPERAL: CampoEditavel[] = [
  {
    caminho: "paciente.idade",
    rotulo: "Idade da paciente",
    tipo: "numero",
    unidade: "anos",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
    ajuda: "O cadastro da família não tem a idade.",
  },
  {
    caminho: "historico.tipoParto",
    rotulo: "Tipo de parto",
    tipo: "opcao",
    opcoes: [
      { valor: "vaginal", rotulo: "Vaginal" },
      { valor: "cesarea", rotulo: "Cesárea" },
    ],
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "historico.dataAlta",
    rotulo: "Data da alta",
    tipo: "data",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "sinaisVitais.paSistolica",
    rotulo: "Pressão sistólica no período",
    tipo: "faixa",
    unidade: "mmHg",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
    ajuda: "Menor e maior valor registrado.",
  },
  {
    caminho: "sinaisVitais.paDiastolica",
    rotulo: "Pressão diastólica no período",
    tipo: "faixa",
    unidade: "mmHg",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "sinaisVitais.fc",
    rotulo: "Frequência cardíaca no período",
    tipo: "faixa",
    unidade: "bpm",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "sinaisVitais.temperatura",
    rotulo: "Temperatura no período",
    tipo: "faixa",
    unidade: "°C",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "mamas.lesao.grau",
    rotulo: "Grau da lesão mamilar",
    tipo: "texto",
    grupo: "completar",
    quando: "mamas.lesao",
    obrigatorio: true,
    ajuda: "O checklist registra o lado e a escala NTS, não o grau.",
  },
  {
    caminho: "mamas.lesao.grauFinal",
    rotulo: "Grau da lesão no último dia",
    tipo: "texto",
    grupo: "completar",
    quando: "mamas.lesao",
  },
  {
    caminho: "feridaOperatoria.textoLivre",
    rotulo: "O que você encontrou na ferida operatória",
    tipo: "textolongo",
    grupo: "completar",
    quando: "feridaOperatoria",
    ajuda:
      "Preencha quando o checklist registrou sinais de infecção. O texto padrão de ferida sem sinais não vale nesse caso.",
  },
  {
    caminho: "intervencoes.laser.finalidade",
    rotulo: "Finalidade da laserterapia",
    tipo: "texto",
    grupo: "completar",
    quando: "intervencoes.laser",
    obrigatorio: true,
  },
  {
    caminho: "alimentacaoObservada",
    rotulo: "Aleitamento observado no período",
    tipo: "opcao",
    opcoes: AMAMENTACAO,
    grupo: "completar",
    obrigatorio: true,
    ajuda:
      "O checklist não tem este campo. A conclusão é conferida contra o que você marcar aqui.",
  },
  {
    caminho: "estabilidadeHemodinamica",
    rotulo: "Todos os sinais vitais ficaram na referência o período inteiro?",
    tipo: "simnao",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "evolucaoGeralTextoLivre",
    rotulo: "Estado geral no último dia, comparado aos anteriores",
    tipo: "textolongo",
    grupo: "julgamento",
  },
  {
    caminho: "mamas.turgencia",
    rotulo: "Mamas",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "mamas.producao",
    rotulo: "Produção de leite",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "eliminacoes.quantidade",
    rotulo: "Lóquios, quantidade",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "dor.textoLivre",
    rotulo: "Contexto da dor (local, o que aliviou)",
    tipo: "textolongo",
    grupo: "julgamento",
  },
  {
    caminho: "orientacoesAlta.itensPersonalizados",
    rotulo: "Orientações de alta além das padrão",
    tipo: "lista",
    grupo: "julgamento",
    ajuda: "Uma por linha.",
  },
  {
    caminho: "encaminhamentos.retornoObstetrico.motivos",
    rotulo: "Motivos do retorno obstétrico",
    tipo: "lista",
    grupo: "julgamento",
    ajuda: "Um por linha. Deixe vazio se não há retorno.",
  },
  {
    caminho: "encaminhamentos.retornoObstetrico.data",
    rotulo: "Data do retorno obstétrico",
    tipo: "data",
    grupo: "julgamento",
  },
  {
    caminho: "encaminhamentos.medicacoes",
    rotulo: "Orientada a manter as medicações de uso contínuo?",
    tipo: "simnao",
    grupo: "julgamento",
  },
  {
    caminho: "encaminhamentos.saudeMental",
    rotulo: "Retorno com a equipe de saúde mental?",
    tipo: "simnao",
    grupo: "julgamento",
  },
  {
    caminho: "encaminhamentos.nutricao",
    rotulo: "Retorno com a equipe de nutrição?",
    tipo: "simnao",
    grupo: "julgamento",
  },
  {
    caminho: "conclusao.amamentacao",
    rotulo: "Conclusão sobre a amamentação",
    tipo: "opcao",
    opcoes: AMAMENTACAO,
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "conclusao.autonomiaFamilia",
    rotulo: "Autonomia e segurança da família",
    tipo: "textolongo",
    grupo: "julgamento",
    obrigatorio: true,
  },
];

// --- Campos do neonatal ---------------------------------------------------------------

export const CAMPOS_NEONATAL: CampoEditavel[] = [
  {
    caminho: "bebe.sexo",
    rotulo: "Sexo do bebê",
    tipo: "opcao",
    opcoes: [
      { valor: "feminino", rotulo: "Feminino" },
      { valor: "masculino", rotulo: "Masculino" },
    ],
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
    ajuda: "O texto do documento concorda com o sexo do bebê.",
  },
  {
    caminho: "bebe.tipoParto",
    rotulo: "Tipo de parto",
    tipo: "opcao",
    opcoes: [
      { valor: "vaginal", rotulo: "Vaginal" },
      { valor: "cesarea", rotulo: "Cesárea" },
    ],
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "bebe.dataNascimento",
    rotulo: "Data de nascimento",
    tipo: "data",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "bebe.pesoNascimentoG",
    rotulo: "Peso ao nascer",
    tipo: "numero",
    unidade: "g",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "estadoGeral.temperatura",
    rotulo: "Temperatura no período",
    tipo: "faixa",
    unidade: "°C",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "respiratorio.fr",
    rotulo: "Frequência respiratória no período",
    tipo: "faixa",
    unidade: "rpm",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "cardiovascular.fc",
    rotulo: "Frequência cardíaca no período",
    tipo: "faixa",
    unidade: "bpm",
    grupo: "completar",
    quandoFalta: true,
    obrigatorio: true,
  },
  {
    caminho: "respiratorio.esforco",
    rotulo: "Esforço respiratório",
    tipo: "texto",
    grupo: "completar",
    obrigatorio: true,
    ajuda:
      "O checklist registrou sinais de esforço, ou não registrou. Descreva o que você viu.",
  },
  {
    caminho: "genitaliaEliminacoes.diurese",
    rotulo: "Diurese presente?",
    tipo: "simnao",
    grupo: "completar",
    obrigatorio: true,
  },
  {
    caminho: "genitaliaEliminacoes.evacuacoes",
    rotulo: "Evacuações presentes?",
    tipo: "simnao",
    grupo: "completar",
    obrigatorio: true,
    ajuda: "O checklist do recém-nascido não tem este campo.",
  },
  {
    caminho: "abdomeCoto.dataQueda",
    rotulo: "Data da queda do coto",
    tipo: "data",
    grupo: "completar",
  },
  {
    caminho: "alimentacao.tipo",
    rotulo: "Aleitamento observado no período",
    tipo: "opcao",
    opcoes: AMAMENTACAO,
    grupo: "completar",
    obrigatorio: true,
    ajuda:
      "O checklist não tem este campo. A conclusão é conferida contra o que você marcar aqui.",
  },
  {
    caminho: "alimentacao.complementoMl",
    rotulo: "Complemento após as mamadas",
    tipo: "numero",
    unidade: "ml",
    grupo: "completar",
    ajuda: "Só se o aleitamento for com complemento.",
  },
  {
    caminho: "estadoGeral.reatividade",
    rotulo: "Reatividade",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "estadoGeral.mucosas",
    rotulo: "Mucosas",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "estadoGeral.fontanela",
    rotulo: "Fontanela",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "abdomeCoto.estadoCoto",
    rotulo: "Coto umbilical",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "alimentacao.succao",
    rotulo: "Sucção",
    tipo: "texto",
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "orientacoesCondutas",
    rotulo: "Orientações e condutas do período",
    tipo: "lista",
    grupo: "julgamento",
    ajuda: "Uma por linha. Já vêm as que o checklist registrou.",
  },
  {
    caminho: "conclusao.aleitamento",
    rotulo: "Conclusão sobre o aleitamento",
    tipo: "opcao",
    opcoes: AMAMENTACAO,
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "conclusao.ganhoPeso",
    rotulo: "Conclusão sobre o peso",
    tipo: "opcao",
    opcoes: [
      { valor: "progressivo", rotulo: "Ganho progressivo" },
      { valor: "estavel", rotulo: "Estável" },
      { valor: "perda", rotulo: "Perda em acompanhamento" },
    ],
    grupo: "julgamento",
    obrigatorio: true,
    ajuda: "Conferida contra a curva de peso, a partir do menor peso.",
  },
  {
    caminho: "conclusao.ictericia",
    rotulo: "Conclusão sobre a icterícia",
    tipo: "opcao",
    opcoes: [
      { valor: "ausente", rotulo: "Sem icterícia" },
      { valor: "regressao", rotulo: "Em regressão" },
      { valor: "presente", rotulo: "Em acompanhamento" },
    ],
    grupo: "julgamento",
    obrigatorio: true,
  },
  {
    caminho: "conclusao.vinculoTexto",
    rotulo: "Vínculo dos pais com o bebê (se quiser acrescentar)",
    tipo: "textolongo",
    grupo: "julgamento",
  },
];

export function camposDoTipo(tipo: "puerperal" | "neonatal"): CampoEditavel[] {
  return tipo === "puerperal" ? CAMPOS_PUERPERAL : CAMPOS_NEONATAL;
}

/** Campos que a tela mostra para esta entrada (respeita `quando` e `quandoFalta`). */
export function camposVisiveis(
  tipo: "puerperal" | "neonatal",
  dados: Dados,
): CampoEditavel[] {
  const digitados = manuais(dados);
  return camposDoTipo(tipo).filter((campo) => {
    if (campo.quando && !tem(dados, campo.quando)) return false;
    if (
      campo.quandoFalta &&
      tem(dados, campo.caminho) &&
      !digitados.includes(campo.caminho)
    ) {
      // dado que veio do cadastro ou do checklist não se digita de novo
      return false;
    }
    return true;
  });
}

/** Caminhos que a enfermeira digitou por falta do dado no cadastro ou no checklist: seguem editáveis. */
export function manuais(dados: Dados): string[] {
  const lista = dados._manual;
  return Array.isArray(lista)
    ? lista.filter((item): item is string => typeof item === "string")
    : [];
}

// --- Leitura do formulário -----------------------------------------------------------

function textoCampo(formulario: FormData, nome: string): string | undefined {
  const bruto = formulario.get(nome);
  if (typeof bruto !== "string") return undefined;
  const limpo = bruto.trim();
  return limpo === "" ? undefined : limpo;
}

function numeroCampo(formulario: FormData, nome: string): number | undefined {
  const texto = textoCampo(formulario, nome);
  if (texto === undefined) return undefined;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Aplica à entrada os campos que vieram no formulário. Campo que não veio (a
 * tela não o mostrou) não muda; campo que veio vazio é apagado. Devolve a
 * entrada nova e os campos numéricos ou de faixa que não deu para ler.
 */
export function aplicarFormulario(
  tipo: "puerperal" | "neonatal",
  dados: Dados,
  formulario: FormData,
): { dados: Dados; erros: string[] } {
  let atual = dados;
  const erros: string[] = [];
  const digitados = new Set(manuais(dados));
  for (const campo of camposDoTipo(tipo)) {
    const nome = campo.caminho;
    if (campo.quandoFalta) {
      const veio =
        formulario.has(nome) ||
        formulario.has(`${nome}.min`) ||
        formulario.has(`${nome}.max`);
      if (veio) digitados.add(nome);
    }
    switch (campo.tipo) {
      case "texto":
      case "textolongo":
      case "data":
      case "opcao": {
        if (!formulario.has(nome)) break;
        atual = definir(atual, nome, textoCampo(formulario, nome));
        break;
      }
      case "numero": {
        if (!formulario.has(nome)) break;
        const bruto = textoCampo(formulario, nome);
        const n = numeroCampo(formulario, nome);
        if (bruto !== undefined && n === undefined) {
          erros.push(`${campo.rotulo}: escreva um número.`);
          break;
        }
        atual = definir(atual, nome, n);
        break;
      }
      case "simnao": {
        if (!formulario.has(nome)) break;
        const valor = textoCampo(formulario, nome);
        atual = definir(
          atual,
          nome,
          valor === "sim" ? true : valor === "nao" ? false : undefined,
        );
        break;
      }
      case "lista": {
        if (!formulario.has(nome)) break;
        const linhas = (textoCampo(formulario, nome) ?? "")
          .split("\n")
          .map((linha) => linha.trim())
          .filter((linha) => linha !== "");
        atual = definir(atual, nome, linhas.length > 0 ? linhas : undefined);
        break;
      }
      case "faixa": {
        if (!formulario.has(`${nome}.min`) && !formulario.has(`${nome}.max`)) {
          break;
        }
        const min = numeroCampo(formulario, `${nome}.min`);
        const max = numeroCampo(formulario, `${nome}.max`);
        if (min === undefined && max === undefined) {
          atual = definir(atual, nome, undefined);
        } else if (min === undefined || max === undefined) {
          erros.push(`${campo.rotulo}: preencha o menor e o maior valor.`);
        } else {
          atual = definir(atual, nome, { min, max });
        }
        break;
      }
    }
  }
  if (digitados.size > 0) atual = { ...atual, _manual: [...digitados] };
  return { dados: atual, erros };
}

// --- O que precisa existir antes de o gerador validar ---------------------------------

interface Requerido {
  caminho: string;
  falta: string;
}

const REQUERIDOS_COMUNS: Requerido[] = [
  {
    caminho: "periodo.inicio",
    falta:
      "Nenhuma visita com registro assinado: o período do acompanhamento ainda não existe.",
  },
  {
    caminho: "periodo.fim",
    falta: "Falta o fim do período do acompanhamento.",
  },
  {
    caminho: "profissional.nome",
    falta:
      "Falta a profissional responsável. Confira a designação do acompanhamento.",
  },
];

const REQUERIDOS_PUERPERAL: Requerido[] = [
  ...REQUERIDOS_COMUNS,
  {
    caminho: "paciente.nome",
    falta: "Falta a paciente no cadastro da família.",
  },
  {
    caminho: "historico.dataNascimentoBebe",
    falta: "Falta a data de nascimento do bebê no cadastro.",
  },
  {
    caminho: "dor.escalaInicial",
    falta: "O checklist não registrou a escala de dor (EVN) em nenhuma visita.",
  },
];

const REQUERIDOS_NEONATAL: Requerido[] = [
  ...REQUERIDOS_COMUNS,
  {
    caminho: "filiacao",
    falta: "Falta a filiação: cadastre a mãe na ficha da família.",
  },
  {
    caminho: "pesagens",
    falta: "Nenhuma pesagem no período. Registre o peso do bebê no checklist.",
  },
];

export function faltasDaEntrada(
  tipo: "puerperal" | "neonatal",
  dados: Dados,
): string[] {
  const faltas: string[] = [];
  const requeridos =
    tipo === "puerperal" ? REQUERIDOS_PUERPERAL : REQUERIDOS_NEONATAL;
  for (const item of requeridos) {
    const valor = obter(dados, item.caminho);
    const vazio =
      valor === undefined ||
      valor === null ||
      (typeof valor === "string" && valor.trim() === "") ||
      (Array.isArray(valor) && valor.length === 0);
    if (vazio) faltas.push(item.falta);
  }
  for (const campo of camposDoTipo(tipo)) {
    if (!campo.obrigatorio) continue;
    if (campo.quando && !tem(dados, campo.quando)) continue;
    if (!tem(dados, campo.caminho)) {
      faltas.push(
        `Falta preencher: ${campo.rotulo.toLowerCase().replace(/[?.]+$/, "")}.`,
      );
    }
  }
  return faltas;
}
