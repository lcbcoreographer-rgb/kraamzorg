import type { Papel } from "@/lib/auth/papeis";
import { obterLoja } from "@/lib/dados/demonstracao/loja";
import { ErroRepositorio } from "@/lib/dados/erros";
import { MENSAGENS_REGUA_SEED } from "./fixtures";
import { obterLojaConfiguracoes } from "./loja";
import type { ConfiguracoesModuloRepositorio } from "./repositorio";
import type { MensagemModeloDetalhe } from "./tipos";

/**
 * Implementação do modo demonstração (`src/lib/dados/modo.ts`): dados
 * fictícios em memória, mesmo recorte por papel que a RLS real aplicaria
 * (PRD 13), sem banco. Parâmetro e mensagem gravam na loja da fundação
 * (`@/lib/dados/demonstracao/loja`) para o resto do app continuar vendo o
 * mesmo dado; os domínios que a fundação ainda não guarda em loja alguma
 * (pacote, versão, região, cidade, condição comercial, termo de alerta,
 * faixa da régua) gravam na loja própria deste módulo.
 */

interface ContextoModulo {
  usuarioId: string | null;
  papeis: Papel[];
}

function ehDiretoria(papeis: readonly Papel[]): boolean {
  return papeis.includes("diretoria");
}

function ehCoordenacaoOuDiretoria(papeis: readonly Papel[]): boolean {
  return papeis.includes("coordenacao") || papeis.includes("diretoria");
}

function negar(motivo: string): never {
  throw new ErroRepositorio("sem_permissao", `demonstração: ${motivo}`);
}

/** Garante que as mensagens da régua (PRD 23.2) existem na loja da fundação. */
function garantirMensagensRegua(): void {
  const loja = obterLoja();
  for (const seed of MENSAGENS_REGUA_SEED) {
    if (loja.mensagensModelo.some((m) => m.chave === seed.chave)) continue;
    loja.mensagensModelo.push({
      chave: seed.chave,
      canal: seed.canal,
      destinatario: seed.destinatario,
      texto: seed.texto,
      variaveis: seed.variaveis,
      status: seed.status,
      aprovadoEm:
        seed.status === "aprovado"
          ? new Date(loja.criadaEm).toISOString()
          : null,
    });
  }
}

export function criarConfiguracoesModuloDemonstracao(
  contexto: ContextoModulo,
): ConfiguracoesModuloRepositorio {
  const lojaModulo = () => obterLojaConfiguracoes();

  function proximoId(prefixo: string): string {
    return `${prefixo}-${crypto.randomUUID()}`;
  }

  return {
    // --- Parâmetros ---------------------------------------------------------
    async atualizarParametro(chave, valor) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria altera parâmetros");
      const loja = obterLoja();
      const parametro = loja.parametros.find((p) => p.chave === chave);
      if (!parametro) {
        throw new ErroRepositorio(
          "nao_encontrado",
          `demonstração: parâmetro ${chave}`,
        );
      }
      const antes = parametro.valor;
      parametro.valor = valor;
      parametro.atualizadoEm = new Date().toISOString();
      const modulo = lojaModulo();
      const lista = (modulo.historicoParametros[chave] ??= []);
      lista.unshift({
        id: modulo.proximoHistorico++,
        valorAntes: antes,
        valorDepois: valor,
        usuarioId: contexto.usuarioId,
        criadoEm: parametro.atualizadoEm,
      });
    },

    async criarParametro(chave, valor, descricao) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria cria parâmetros");
      const loja = obterLoja();
      if (loja.parametros.some((p) => p.chave === chave)) {
        throw new ErroRepositorio(
          "recusado",
          `demonstração: parâmetro ${chave} já existe`,
        );
      }
      const agora = new Date().toISOString();
      loja.parametros.push({ chave, valor, descricao, atualizadoEm: agora });
      const modulo = lojaModulo();
      const lista = (modulo.historicoParametros[chave] ??= []);
      lista.unshift({
        id: modulo.proximoHistorico++,
        valorAntes: null,
        valorDepois: valor,
        usuarioId: contexto.usuarioId,
        criadoEm: agora,
      });
    },

    async historicoParametro(chave) {
      if (!ehDiretoria(contexto.papeis)) return [];
      return [...(lojaModulo().historicoParametros[chave] ?? [])];
    },

    // --- Pacotes e versões ---------------------------------------------------
    async listarPacotesComVersoes() {
      if (!ehDiretoria(contexto.papeis)) return [];
      const loja = lojaModulo();
      return [...loja.pacotes]
        .sort((a, b) => a.ordem - b.ordem)
        .map((pacote) => ({
          ...pacote,
          versoes: loja.versoes
            .filter((v) => v.pacoteId === pacote.id)
            .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio)),
        }));
    },

    async criarPacote(pedido) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria cria pacotes");
      const loja = lojaModulo();
      const pacoteId = proximoId("pacote");
      const pacote = {
        id: pacoteId,
        nome: pedido.nome,
        linha: pedido.linha,
        dias: pedido.dias,
        gemelar: pedido.gemelar,
        paginaPdf: pedido.paginaPdf,
        ordem: loja.pacotes.length + 1,
        ativo: true,
      };
      loja.pacotes.push(pacote);
      const versaoId = proximoId("versao");
      const versao = {
        id: versaoId,
        pacoteId,
        valorCentavos: pedido.valorCentavos,
        horasPorVisita: pedido.horasPorVisita,
        parcelasMaxSemJuros: pedido.parcelasMaxSemJuros,
        destaque: null,
        vigenciaInicio: pedido.vigenciaInicio,
        vigenciaFim: null,
        inclui: pedido.inclui,
        naoInclui: pedido.naoInclui,
      };
      loja.versoes.push(versao);
      return pacote;
    },

    async criarVersaoPacote(pedido) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria cria versão de preço");
      const loja = lojaModulo();
      if (!loja.pacotes.some((p) => p.id === pedido.pacoteId)) {
        throw new ErroRepositorio("nao_encontrado", "demonstração: pacote");
      }
      const vigente = loja.versoes.find(
        (v) => v.pacoteId === pedido.pacoteId && v.vigenciaFim === null,
      );
      if (vigente) {
        const diaAnterior = new Date(pedido.vigenciaInicio + "T00:00:00Z");
        diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
        if (diaAnterior.toISOString().slice(0, 10) < vigente.vigenciaInicio) {
          throw new ErroRepositorio(
            "recusado",
            "demonstração: a nova vigência precisa começar depois da versão atual",
          );
        }
        // Fecha a versão atual: ela nunca é editada de outra forma (PRD 13,
        // aceite do P13). Contratos antigos continuam com o id dela.
        vigente.vigenciaFim = diaAnterior.toISOString().slice(0, 10);
      }
      const nova = {
        id: proximoId("versao"),
        pacoteId: pedido.pacoteId,
        valorCentavos: pedido.valorCentavos,
        horasPorVisita: pedido.horasPorVisita,
        parcelasMaxSemJuros: pedido.parcelasMaxSemJuros,
        destaque: pedido.destaque,
        vigenciaInicio: pedido.vigenciaInicio,
        vigenciaFim: null,
        inclui: pedido.inclui,
        naoInclui: pedido.naoInclui,
      };
      loja.versoes.push(nova);
      return nova;
    },

    async ativarPacote(pacoteId, ativo) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria altera pacotes");
      const pacote = lojaModulo().pacotes.find((p) => p.id === pacoteId);
      if (!pacote)
        throw new ErroRepositorio("nao_encontrado", "demonstração: pacote");
      pacote.ativo = ativo;
    },

    // --- Regiões e localidades -------------------------------------------------
    async listarRegioesDetalhe() {
      if (!ehDiretoria(contexto.papeis)) return [];
      return [...lojaModulo().regioes].sort((a, b) =>
        a.nome.localeCompare(b.nome),
      );
    },

    async criarRegiao(dados) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria cria regiões");
      const nova = { id: proximoId("regiao"), ...dados };
      lojaModulo().regioes.push(nova);
      return nova;
    },

    async atualizarRegiao(id, dados) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria altera regiões");
      const regiao = lojaModulo().regioes.find((r) => r.id === id);
      if (!regiao)
        throw new ErroRepositorio("nao_encontrado", "demonstração: região");
      Object.assign(regiao, dados);
    },

    async listarCidades() {
      if (!ehDiretoria(contexto.papeis)) return [];
      return [...lojaModulo().cidades].sort((a, b) =>
        a.nome.localeCompare(b.nome),
      );
    },

    async criarCidade(dados) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria cria cidades");
      const nova = { id: proximoId("cidade"), ...dados };
      lojaModulo().cidades.push(nova);
      return nova;
    },

    async atualizarCidade(id, dados) {
      if (!ehDiretoria(contexto.papeis)) negar("só a diretoria altera cidades");
      const cidade = lojaModulo().cidades.find((c) => c.id === id);
      if (!cidade)
        throw new ErroRepositorio("nao_encontrado", "demonstração: cidade");
      Object.assign(cidade, dados);
    },

    // --- Condições comerciais --------------------------------------------------
    async listarCondicoesComerciais() {
      if (!ehDiretoria(contexto.papeis)) return [];
      return [...lojaModulo().condicoesComerciais].sort((a, b) =>
        a.nome.localeCompare(b.nome),
      );
    },

    async criarCondicaoComercial(dados) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria cria condições comerciais");
      const nova = { id: proximoId("condicao"), ...dados };
      lojaModulo().condicoesComerciais.push(nova);
      return nova;
    },

    async atualizarCondicaoComercial(id, dados) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria altera condições comerciais");
      const condicao = lojaModulo().condicoesComerciais.find(
        (c) => c.id === id,
      );
      if (!condicao)
        throw new ErroRepositorio(
          "nao_encontrado",
          "demonstração: condição comercial",
        );
      Object.assign(condicao, dados);
    },

    // --- Mensagens -------------------------------------------------------------
    async listarMensagensDetalhe() {
      if (!ehDiretoria(contexto.papeis)) return [];
      garantirMensagensRegua();
      const loja = obterLoja();
      const aprovacoes = lojaModulo().aprovacoesMensagens;
      return loja.mensagensModelo
        .map((m): MensagemModeloDetalhe => ({
          ...m,
          aprovadoPor: aprovacoes[m.chave] ?? null,
          atualizadoEm: new Date(loja.criadaEm).toISOString(),
        }))
        .sort((a, b) => a.chave.localeCompare(b.chave));
    },

    async salvarRascunhoMensagem(chave, dados) {
      if (!ehDiretoria(contexto.papeis))
        negar(
          "só a diretoria edita mensagens (destinatário família, equipe ou agente)",
        );
      garantirMensagensRegua();
      const loja = obterLoja();
      const existente = loja.mensagensModelo.find((m) => m.chave === chave);
      if (existente) {
        existente.texto = dados.texto;
        existente.canal = dados.canal;
        existente.destinatario = dados.destinatario;
        existente.variaveis = dados.variaveis;
        existente.status = "rascunho";
        existente.aprovadoEm = null;
      } else {
        loja.mensagensModelo.push({
          chave,
          canal: dados.canal,
          destinatario: dados.destinatario,
          texto: dados.texto,
          variaveis: dados.variaveis,
          status: "rascunho",
          aprovadoEm: null,
        });
      }
      delete lojaModulo().aprovacoesMensagens[chave];
    },

    async aprovarMensagem(chave) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria aprova mensagens");
      if (!contexto.usuarioId) negar("sessão sem usuário");
      const loja = obterLoja();
      const mensagem = loja.mensagensModelo.find((m) => m.chave === chave);
      if (!mensagem)
        throw new ErroRepositorio("nao_encontrado", "demonstração: mensagem");
      mensagem.status = "aprovado";
      mensagem.aprovadoEm = new Date().toISOString();
      lojaModulo().aprovacoesMensagens[chave] = contexto.usuarioId;
    },

    async arquivarMensagem(chave) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria arquiva mensagens");
      const loja = obterLoja();
      const mensagem = loja.mensagensModelo.find((m) => m.chave === chave);
      if (!mensagem)
        throw new ErroRepositorio("nao_encontrado", "demonstração: mensagem");
      mensagem.status = "arquivado";
    },

    // --- Termos de alerta (coordenação, PRD 13) ---------------------------------
    async listarTermosAlerta() {
      if (!ehCoordenacaoOuDiretoria(contexto.papeis)) return [];
      return [...lojaModulo().termosAlerta].sort((a, b) =>
        a.termo.localeCompare(b.termo),
      );
    },

    async criarTermoAlerta(dados) {
      if (!ehCoordenacaoOuDiretoria(contexto.papeis))
        negar("só a coordenação ou a diretoria cria termos de alerta");
      const novo = { id: proximoId("termo"), ...dados };
      lojaModulo().termosAlerta.push(novo);
      return novo;
    },

    async atualizarTermoAlerta(id, dados) {
      if (!ehCoordenacaoOuDiretoria(contexto.papeis))
        negar("só a coordenação ou a diretoria altera termos de alerta");
      const termo = lojaModulo().termosAlerta.find((t) => t.id === id);
      if (!termo)
        throw new ErroRepositorio(
          "nao_encontrado",
          "demonstração: termo de alerta",
        );
      Object.assign(termo, dados);
    },

    // --- Faixas da régua (PRD 10.3) ----------------------------------------------
    async listarFaixasRegua() {
      if (!ehDiretoria(contexto.papeis)) return [];
      return [...lojaModulo().reguaFaixas].sort((a, b) => a.ordem - b.ordem);
    },

    async atualizarFaixaRegua(id, dados) {
      if (!ehDiretoria(contexto.papeis))
        negar("só a diretoria altera as faixas da régua");
      const faixa = lojaModulo().reguaFaixas.find((f) => f.id === id);
      if (!faixa)
        throw new ErroRepositorio(
          "nao_encontrado",
          "demonstração: faixa da régua",
        );
      Object.assign(faixa, dados);
    },
  };
}
