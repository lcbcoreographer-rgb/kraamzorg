import "server-only";
import type { Json } from "@/lib/db/types";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import type { LinhaRegraAlerta } from "@/lib/regras-alerta";
import type { EstadoSensivel } from "../tipos";
import type {
  AdendoRegistro,
  AlertaClinicoResumo,
  AlertaDaVisita,
  AssistencialRepositorio,
  AudioDaVisita,
  BebeChecklist,
  ChecklistVisita,
  EstadoVisita,
  MedicoChecklist,
  ParametrosChecklist,
  RegistroAnterior,
  RegistroAssinado,
  SeveridadeAlerta,
} from "../tipos-assistencial";
import { exigir, rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Checklist e alertas na real (P39 e P40): tudo pelas funções do schema api
 * da 0023_checklist_alertas.sql, com a sessão do usuário. Papel, AAL e
 * família atribuída são conferidos dentro de cada função; a leitura de
 * tabela assistencial passa por assistencial.ler_*, que grava o log. Nenhuma
 * tabela assistencial é lida direto daqui.
 *
 * `rpcPendente` chama pelo nome, sem tipo: `src/lib/db/types.ts` é gerado do
 * banco (`pnpm db:types:local`) e ainda não conhece as funções da 0023.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const numero = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : null;
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const booleano = (v: Json | undefined, padrao: boolean): boolean =>
  typeof v === "boolean" ? v : padrao;

export function alertaDaVisitaDoBanco(valor: Json): AlertaDaVisita {
  const a = objeto(valor);
  return {
    id: texto(a.id) ?? "",
    regraId: texto(a.regra_id) ?? "",
    bebeId: texto(a.bebe_id),
    severidade: (texto(a.severidade) ?? "imediato") as SeveridadeAlerta,
    campo: texto(a.campo),
    valorObservado: texto(a.valor_observado),
    conduta: texto(a.conduta) ?? "",
    reconhecidoEm: texto(a.reconhecido_em),
    sinalIdentificado: texto(a.sinal_identificado),
    acionadoEm: texto(a.acionado_em),
    orientacaoMedica: texto(a.orientacao_medica),
    condutaAdotada: texto(a.conduta_adotada),
    fechadoEm: texto(a.fechado_em),
    versao: numero(a.versao) ?? 1,
  };
}

export function alertaResumoDoBanco(valor: Json): AlertaClinicoResumo {
  const a = objeto(valor);
  return {
    ...alertaDaVisitaDoBanco(valor),
    familiaId: texto(a.familia_id) ?? "",
    nomeFamilia: texto(a.nome_exibicao) ?? "",
    estadoSensivel: (texto(a.estado_sensivel) ?? "normal") as EstadoSensivel,
    visitaId: texto(a.visita_id),
    diaNumero: numero(a.dia_numero),
    grupo: texto(a.grupo) ?? "",
    descricao: texto(a.descricao) ?? "",
    criadoEm: texto(a.criado_em) ?? "",
  };
}

function parametrosDoBanco(valor: Json | undefined): ParametrosChecklist {
  const p = objeto(valor);
  const audio = objeto(p.audio_visita);
  return {
    transcricaoAudioAtiva: booleano(p.transcricao_audio_ativa, false),
    seletorSinaisAtivo: booleano(p.seletor_sinais_doc3_ativo, false),
    supervisaoTelefone: texto(p.supervisao_medica_telefone) ?? "",
    audioUrlAssinadaSegundos: numero(p.audio_url_assinada_segundos) ?? 60,
    audio: {
      duracaoMaxSeg: numero(audio.duracao_max_seg) ?? 0,
      tamanhoMaxBytes: numero(audio.tamanho_max_bytes) ?? 0,
      tipos: lista(audio.tipos).filter(
        (t): t is string => typeof t === "string",
      ),
    },
  };
}

export function checklistDoBanco(valor: Json): ChecklistVisita {
  const c = objeto(valor);
  const v = objeto(c.visita);
  const f = objeto(c.familia);
  const a = objeto(c.acompanhamento);
  const pr = objeto(c.profissional);
  const inst = c.instrumento ? objeto(c.instrumento) : null;
  const reg = c.registro ? objeto(c.registro) : null;

  const registro: RegistroAssinado | null = reg
    ? {
        id: texto(reg.id) ?? "",
        profissionalId: texto(reg.profissional_id) ?? "",
        instrumentoVersao: texto(reg.instrumento_versao) ?? "",
        dados: objeto(reg.dados) as Record<string, unknown>,
        resumoDescritivo: texto(reg.resumo_descritivo) ?? "",
        assinadoEm: texto(reg.assinado_em) ?? "",
        assinatura: texto(reg.assinatura) ?? "",
        adendos: lista(reg.adendos).map((x): AdendoRegistro => {
          const ad = objeto(x);
          return {
            id: texto(ad.id) ?? "",
            motivo: texto(ad.motivo) ?? "",
            conteudo: texto(ad.conteudo) ?? "",
            criadoEm: texto(ad.criado_em) ?? "",
            autor: texto(ad.autor),
          };
        }),
      }
    : null;

  return {
    visita: {
      id: texto(v.id) ?? "",
      acompanhamentoId: texto(v.acompanhamento_id) ?? "",
      profissionalId: texto(v.profissional_id) ?? "",
      diaNumero: numero(v.dia_numero) ?? 0,
      data: texto(v.data) ?? "",
      horaPrevista: texto(v.hora_prevista),
      estado: (texto(v.estado) ?? "agendada") as EstadoVisita,
      checkinEm: texto(v.checkin_em),
      checkoutEm: texto(v.checkout_em),
      versao: numero(v.versao) ?? 1,
    },
    familia: {
      id: texto(f.id) ?? "",
      nomeExibicao: texto(f.nome_exibicao) ?? "",
      bairro: texto(f.bairro),
      estadoSensivel: (texto(f.estado_sensivel) ?? "normal") as EstadoSensivel,
      dpp: texto(f.dpp),
      dataNascimento: texto(f.data_nascimento),
      dataAlta: texto(f.data_alta),
      dataInicioEfetivo: texto(f.data_inicio_efetivo),
      gemelar: booleano(f.gemelar, false),
    },
    diasContratados: numero(a.dias_contratados) ?? 0,
    ultimoDia: booleano(a.ultimo_dia, false),
    profissional: {
      id: texto(pr.id) ?? "",
      nome: texto(pr.nome) ?? "",
      conselho: texto(pr.conselho),
      conselhoUf: texto(pr.conselho_uf),
      conselhoNumero: texto(pr.conselho_numero),
    },
    instrumento: inst
      ? {
          versao: texto(inst.versao) ?? "",
          definicao: lerDefinicao(inst.definicao),
        }
      : null,
    instrumentoDoc4: c.instrumento_doc4 ? lerDefinicao(c.instrumento_doc4) : null,
    bebes: lista(c.bebes).map((x): BebeChecklist => {
      const b = objeto(x);
      return {
        id: texto(b.id) ?? "",
        ordem: numero(b.ordem) ?? 1,
        nome: texto(b.nome),
        dataNascimento: texto(b.data_nascimento),
        pesoNascimentoG: numero(b.peso_nascimento_g),
        pesoAltaG: numero(b.peso_alta_g),
      };
    }),
    medicos: lista(c.medicos).map((x): MedicoChecklist => {
      const m = objeto(x);
      return {
        id: texto(m.id) ?? "",
        especialidade: (texto(m.especialidade) ??
          "outro") as MedicoChecklist["especialidade"],
        nome: texto(m.nome) ?? "",
        telefoneE164: texto(m.telefone_e164),
        email: texto(m.email),
      };
    }),
    regras: lista(c.regras).map((x): LinhaRegraAlerta => {
      const r = objeto(x);
      return {
        id: texto(r.id) ?? "",
        grupo: texto(r.grupo) ?? "",
        descricao: texto(r.descricao) ?? "",
        severidade: texto(r.severidade) ?? "",
        conduta: texto(r.conduta) ?? "",
        campo: texto(r.campo),
        condicao: r.condicao ?? null,
        instrumento_versao: texto(r.instrumento_versao) ?? "",
        ativa: booleano(r.ativa, false),
      };
    }),
    registro,
    anteriores: lista(c.anteriores).map((x): RegistroAnterior => {
      const an = objeto(x);
      return {
        visitaId: texto(an.visita_id) ?? "",
        diaNumero: numero(an.dia_numero) ?? 0,
        data: texto(an.data) ?? "",
        dados: objeto(an.dados) as Record<string, unknown>,
        resumoDescritivo: texto(an.resumo_descritivo),
      };
    }),
    alertas: lista(c.alertas).map(alertaDaVisitaDoBanco),
    audios: lista(c.audios).map((x): AudioDaVisita => {
      const au = objeto(x);
      return {
        id: texto(au.id) ?? "",
        duracaoSeg: numero(au.duracao_seg),
        status: (texto(au.status) ?? "pendente") as AudioDaVisita["status"],
        criadoEm: texto(au.criado_em) ?? "",
        transcricao: texto(au.transcricao),
      };
    }),
    parametros: parametrosDoBanco(c.parametros),
  };
}

export function criarAssistencialSupabase(
  contexto: ContextoSupabase,
): AssistencialRepositorio {
  const { cliente } = contexto;
  return {
    async obterChecklist(visitaId) {
      try {
        const resposta = await rpcPendente(cliente, "checklist_visita", {
          visita_id: visitaId,
        });
        return checklistDoBanco(resposta);
      } catch (erro) {
        // Visita de outra profissional ou que não existe: a tela mostra o
        // "não encontrada" (sem contar quem é de quem).
        const detalhe = erro instanceof Error ? erro.message : "";
        if (
          (erro as { codigo?: string }).codigo === "sem_permissao" ||
          (erro as { codigo?: string }).codigo === "nao_encontrado" ||
          /P0002|não existe/.test(detalhe)
        ) {
          return null;
        }
        throw erro;
      }
    },

    async registrarAtendimento(registro, alertas) {
      const resposta = objeto(
        await rpcPendente(cliente, "registrar_atendimento", {
          visita_id: registro.visitaId,
          dados: registro.dados as Json,
          resumo: registro.resumoDescritivo,
          assinado_em_ms: registro.assinadoEmMs,
          assinatura: registro.assinatura,
          instrumento_versao: registro.instrumentoVersao,
          alertas: alertas.map((a) => ({
            regra_id: a.regraId,
            bebe_id: a.bebeId,
            campo: a.campo,
            valor_observado: a.valorObservado,
          })) as Json,
        }),
      );
      return {
        registroId: texto(resposta.id) ?? "",
        jaRegistrado: booleano(resposta.ja_registrado, false),
      };
    },

    async registrarAdendo(registroId, motivo, conteudo) {
      await rpcPendente(cliente, "registrar_adendo", {
        registro_id: registroId,
        motivo,
        conteudo,
      });
    },

    async listarAlertas(situacao, familiaId) {
      const resposta = await rpcPendente(cliente, "alertas_clinicos", {
        situacao,
        familia_id: familiaId ?? null,
      });
      return lista(resposta).map(alertaResumoDoBanco);
    },

    async registrarAcionamento(pedido) {
      await rpcPendente(cliente, "registrar_acionamento_alerta", {
        alerta_id: pedido.alertaId,
        versao_base: pedido.versaoBase,
        sinal_identificado: pedido.sinalIdentificado ?? null,
        acionado_em: pedido.acionadoEm ?? null,
        orientacao_medica: pedido.orientacaoMedica ?? null,
        conduta_adotada: pedido.condutaAdotada ?? null,
      });
    },

    async fecharAlerta(alertaId, versaoBase) {
      await rpcPendente(cliente, "fechar_alerta_clinico", {
        alerta_id: alertaId,
        versao_base: versaoBase,
      });
    },

    async registrarAlerta(pedido) {
      const resposta = objeto(
        await rpcPendente(cliente, "registrar_alerta_clinico", {
          visita_id: pedido.visitaId,
          regra_id: pedido.regraId,
          instrumento_versao: pedido.instrumentoVersao,
          bebe_id: pedido.bebeId,
          campo: pedido.campo,
          valor_observado: pedido.valorObservado,
          manual: pedido.manual,
        }),
      );
      return {
        id: texto(resposta.id) ?? "",
        criado: booleano(resposta.criado, false),
      };
    },

    async telefoneSupervisao() {
      const resposta = await rpcPendente(cliente, "supervisao_medica_telefone", {});
      return typeof resposta === "string" ? resposta : "";
    },

    async situacaoContatoMedico(familiaId) {
      const r = objeto(
        await rpcPendente(cliente, "contato_medico_situacao", {
          familia_id: familiaId,
        }),
      );
      return {
        obstetra: booleano(r.obstetra, false),
        pediatra: booleano(r.pediatra, false),
        tarefaAberta: booleano(r.tarefa_aberta, false),
        evolucaoBloqueada: booleano(r.evolucao_bloqueada, true),
      };
    },

    async registrarAudio(visitaId, arquivoPath, duracaoSeg) {
      const r = objeto(
        await rpcPendente(cliente, "registrar_anexo_audio", {
          visita_id: visitaId,
          arquivo_path: arquivoPath,
          duracao_seg: duracaoSeg,
        }),
      );
      return { id: texto(r.id) ?? "" };
    },

    async audioParaOuvir(audioId) {
      const r = objeto(
        await rpcPendente(cliente, "audio_da_visita_para_ouvir", {
          audio_id: audioId,
        }),
      );
      return {
        arquivoPath: texto(r.arquivo_path) ?? "",
        validadeSeg: numero(r.validade_seg) ?? 60,
      };
    },

    async acionarFreio(familiaId) {
      exigir(
        await cliente.schema("api").rpc("acionar_freio", {
          familia_id: familiaId,
          estado: "bloqueio_total",
        }),
        "api.acionar_freio",
      );
    },
  };
}
