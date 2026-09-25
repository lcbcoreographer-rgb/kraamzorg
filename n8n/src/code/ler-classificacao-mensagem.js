// Nó "Ler Classificação" do fluxo 3 (nó 19), depois do classificador semântico
// de saúde (`n8n/prompts/classificar-mensagem.md`, PRD 11.11 item 2 e 19.4).
// Função pura: recebe o resultado do filtro determinístico de termos (nó 17,
// `agente.checar_termos_alerta`) e a saída bruta do modelo, devolve a decisão
// final de alerta. O build embute este arquivo no nó Code; os testes importam
// a mesma função.
//
// Regras (PRD 11.11 item 2, 2a, 2b; 19.4 nó 19):
// - Falha do classificador (JSON inválido ou campo fora da lista) vira
//   `tipo_contato = lead`, `saude = nenhum`, `perda = false`, sem nunca
//   rebaixar um alerta que o filtro de termos já levantou.
// - `perda` vale para perda atual ou anterior; nunca desce para false por
//   causa da temporalidade.
// - `internacao = true` troca a mensagem padrão de saúde por
//   `alerta_internacao`, e `saude_mental = true` por `alerta_emocional`, cada
//   uma só quando o parâmetro de ativação correspondente está ligado;
//   desligado, vale `alerta_saude`.
// - O filtro de termos nunca é rebaixado pelo classificador: se o nó 17 já
//   decidiu `perda` (`bloqueio_total`) ou `saude` (`handoff_saude`), esse
//   resultado prevalece mesmo se o classificador falhar ou devolver "nenhum".

const SAUDE_VALIDOS = ['nenhum', 'pergunta_geral', 'relato_sintoma', 'urgencia'];
const TEMPORALIDADE_VALIDOS = ['atual', 'anterior', 'incerta', 'nenhuma'];

function classificacaoValida(objeto) {
  if (!objeto || typeof objeto !== 'object') return false;
  if (!SAUDE_VALIDOS.includes(objeto.saude)) return false;
  if (typeof objeto.perda !== 'boolean') return false;
  if (objeto.perda_temporalidade != null && !TEMPORALIDADE_VALIDOS.includes(objeto.perda_temporalidade)) return false;
  if (objeto.internacao != null && typeof objeto.internacao !== 'boolean') return false;
  if (objeto.saude_mental != null && typeof objeto.saude_mental !== 'boolean') return false;
  return true;
}

function analisarSaidaModelo(saidaModelo) {
  let objeto = null;
  try {
    objeto = typeof saidaModelo === 'string' ? JSON.parse(saidaModelo) : saidaModelo;
  } catch {
    objeto = null;
  }

  if (!classificacaoValida(objeto)) {
    return {
      classificadorFalhou: true,
      tipoContato: 'lead',
      saude: 'nenhum',
      perda: false,
      perdaTemporalidade: 'nenhuma',
      internacao: false,
      saudeMental: false,
    };
  }

  return {
    classificadorFalhou: false,
    tipoContato: objeto.tipo_contato ?? 'lead',
    saude: objeto.saude,
    perda: objeto.perda,
    perdaTemporalidade: objeto.perda_temporalidade ?? (objeto.perda ? 'incerta' : 'nenhuma'),
    internacao: Boolean(objeto.internacao),
    saudeMental: Boolean(objeto.saude_mental),
  };
}

export function lerClassificacaoMensagem({
  termoAlerta = { alerta: false, acao: null, chaveTexto: null },
  saidaModelo,
  parametrosAtivacao = { alertaInternacaoAtivo: false, alertaEmocionalAtivo: false },
}) {
  const classificacao = analisarSaidaModelo(saidaModelo);

  const classificadorSinalizaAlerta =
    classificacao.saude === 'relato_sintoma' || classificacao.saude === 'urgencia' || classificacao.perda === true;

  // O classificador nunca rebaixa o que o filtro de termos já decidiu.
  const termoIndicaPerda = termoAlerta.alerta && termoAlerta.acao === 'bloqueio_total';
  const termoIndicaSaude = termoAlerta.alerta && termoAlerta.acao === 'handoff_saude';

  let alerta = 'nenhum';
  if (termoIndicaPerda || classificacao.perda === true) {
    alerta = 'perda';
  } else if (termoIndicaSaude || classificadorSinalizaAlerta) {
    alerta = 'saude';
  }

  let chaveTexto = null;
  if (alerta === 'perda') {
    chaveTexto = 'perda';
  } else if (alerta === 'saude') {
    if (termoAlerta.chaveTexto === 'alerta_internacao') {
      chaveTexto = 'alerta_internacao';
    } else if (classificacao.internacao && parametrosAtivacao.alertaInternacaoAtivo) {
      chaveTexto = 'alerta_internacao';
    } else if (classificacao.saudeMental && parametrosAtivacao.alertaEmocionalAtivo) {
      chaveTexto = 'alerta_emocional';
    } else {
      chaveTexto = 'alerta_saude';
    }
  }

  return {
    alerta,
    chaveTexto,
    perda: alerta === 'perda' || classificacao.perda === true,
    perdaTemporalidade: classificacao.perdaTemporalidade,
    internacao: classificacao.internacao,
    saudeMental: classificacao.saudeMental,
    tipoContato: classificacao.tipoContato,
    classificadorFalhou: classificacao.classificadorFalhou,
  };
}
