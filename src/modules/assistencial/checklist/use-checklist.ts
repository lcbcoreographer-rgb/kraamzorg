"use client";

import * as React from "react";
import {
  avaliarAlertasDoCampo,
  avaliarAlertasDoRegistro,
  bebesDoFormulario,
  catalogoDasLinhas,
  chaveAlerta,
  montarDados,
  resumoDoDia,
  assinarRegistro,
  type AcionamentoAlerta,
  type ContextoAvaliacao,
} from "@/lib/checklist/registro";
import {
  aplicarResposta,
  comAcionamento,
  comDisparos,
  comSinalManual,
  marcarEnfileirados,
  novosDisparos,
} from "@/lib/checklist/estado";
import {
  enfileirarAdendo,
  enfileirarNovoAlerta,
  enfileirarRegistroAssinado,
  guardarRegrasNoAparelho,
} from "@/lib/checklist/fila";
import {
  armazemDoAparelho,
  rascunhoVazio,
  type ArmazemDeAudios,
  type ArmazemDeRascunhos,
  type RascunhoChecklist,
} from "@/lib/checklist/rascunho";
import {
  confirmarTextoTrazido,
  descartarTextoTrazido,
  referenciaDoDiaAnterior,
  trazerTexto,
} from "@/lib/checklist/referencia";
import type { SinalDoSeletor } from "@/lib/checklist/alertas";
import type { ChecklistVisita } from "@/lib/dados/tipos-assistencial";
import {
  comValor,
  type EnderecoCampo,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import { bancoOffline, type BancoOffline } from "@/lib/sync/db";
import {
  iniciarMotorSincronizacao,
  processarFila,
  type EnviarLote,
} from "@/lib/sync/motor";
import { horaAgoraEmBrasilia } from "../componentes/folha-acionamento";

/**
 * Estado da tela do checklist (P39, P40): o rascunho no aparelho, os
 * alertas que disparam no campo, a fila de envio e a assinatura. Toda
 * gravação vai primeiro para o aparelho (Dexie) e só depois sobe pela fila
 * do motor offline (P12); nada depende de conexão para responder, avaliar
 * um alerta ou assinar.
 */

export interface Aparelho {
  armazem: ArmazemDeRascunhos & ArmazemDeAudios;
  banco: BancoOffline;
  /** Substitui o envio real (teste). */
  enviar?: EnviarLote;
}

export interface EstadoDaFila {
  pendentes: number;
  comErro: number;
  /** Último item de fila do registro assinado desta visita. */
  registro: { estado: string; erroMensagem?: string } | null;
  sincronizadoEm: Date | null;
}

const FILA_VAZIA: EstadoDaFila = {
  pendentes: 0,
  comErro: 0,
  registro: null,
  sincronizadoEm: null,
};

async function lerFila(
  banco: BancoOffline,
  visitaId: string,
): Promise<Omit<EstadoDaFila, "sincronizadoEm">> {
  const itens = (await banco.fila.toArray()).filter((i) => {
    if (i.entidadeId === visitaId) return true;
    const p = i.payload as { visitaId?: string } | null;
    return p?.visitaId === visitaId;
  });
  const pendentes = itens.filter((i) =>
    ["rascunho_local", "enviando", "erro"].includes(i.estado),
  );
  const registros = itens
    .filter(
      (i) =>
        i.entidade === "registro_atendimento" &&
        i.payload &&
        typeof i.payload === "object" &&
        "dados" in (i.payload as object),
    )
    .sort((a, b) => a.criadoNoClienteEm.localeCompare(b.criadoNoClienteEm));
  const ultimo = registros.at(-1);
  return {
    pendentes: pendentes.length,
    comErro: pendentes.filter((i) => i.estado === "erro").length,
    registro: ultimo
      ? { estado: ultimo.estado, erroMensagem: ultimo.erroMensagem }
      : null,
  };
}

export interface UsarChecklistArgs {
  checklist: ChecklistVisita;
  usuarioId: string;
  aparelho?: Aparelho;
  agora?: () => Date;
}

export function useChecklist({
  checklist,
  usuarioId,
  aparelho: injetado,
  agora = () => new Date(),
}: UsarChecklistArgs) {
  const [aparelho, definirAparelho] = React.useState<Aparelho | null>(
    injetado ?? null,
  );
  const [rascunho, definirRascunho] = React.useState<RascunhoChecklist | null>(
    null,
  );
  const ref = React.useRef<RascunhoChecklist | null>(null);
  const [online, definirOnline] = React.useState(true);
  const [fila, definirFila] = React.useState<EstadoDaFila>(FILA_VAZIA);
  const jaEnfileirando = React.useRef(new Set<string>());
  const sincronizadoEm = React.useRef<Date | null>(null);
  const pendentesAntes = React.useRef(0);

  const definicao = checklist.instrumento?.definicao ?? null;
  const versao = checklist.instrumento?.versao ?? "";
  const bebes = React.useMemo(
    () => bebesDoFormulario(checklist.bebes),
    [checklist.bebes],
  );
  const catalogo = React.useMemo(
    () => catalogoDasLinhas(checklist.regras).catalogo,
    [checklist.regras],
  );
  const contextoAvaliacao: ContextoAvaliacao = React.useMemo(
    () => ({
      catalogo,
      bebes: checklist.bebes,
      anteriores: checklist.anteriores,
      dataVisita: checklist.visita.data,
    }),
    [catalogo, checklist.bebes, checklist.anteriores, checklist.visita.data],
  );

  // O aparelho (Dexie) só existe no navegador.
  React.useEffect(() => {
    if (injetado) return;
    const espera = window.setTimeout(
      () =>
        definirAparelho({
          armazem: armazemDoAparelho(),
          banco: bancoOffline(),
        }),
      0,
    );
    return () => window.clearTimeout(espera);
  }, [injetado]);

  // Carrega o rascunho da visita, ou começa um com o que é fato do check-in.
  const visitaId = checklist.visita.id;
  React.useEffect(() => {
    if (!aparelho || !definicao) return;
    let cancelado = false;
    void (async () => {
      const salvo = await aparelho.armazem.ler(visitaId);
      if (cancelado) return;
      let inicial = salvo;
      if (!inicial) {
        inicial = rascunhoVazio(
          visitaId,
          usuarioId,
          versao,
          {
            blocos: {},
            por_bebe: {},
          },
          agora(),
        );
        // Data e horário são fatos do check-in (editáveis), não julgamento clínico.
        if (checklist.visita.checkinEm) {
          inicial = {
            ...inicial,
            respostas: comValor(
              comValor(
                inicial.respostas,
                { bloco: "1", campo: "data" },
                checklist.visita.data,
              ),
              { bloco: "1", campo: "horario" },
              horaAgoraEmBrasilia(new Date(checklist.visita.checkinEm)),
            ),
          };
        }
        await aparelho.armazem.salvar(inicial);
      }
      ref.current = inicial;
      definirRascunho(inicial);
    })();
    return () => {
      cancelado = true;
    };
    // O rascunho é lido uma vez por visita; o resto da tela mexe nele pelo ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aparelho, visitaId]);

  // Regras no aparelho e gatilhos de envio da fila (conexão, foco, espera crescente).
  React.useEffect(() => {
    if (!aparelho) return;
    void guardarRegrasNoAparelho(aparelho.banco, checklist.regras).catch(
      () => undefined,
    );
    return iniciarMotorSincronizacao(aparelho.banco, {
      enviar: aparelho.enviar,
    });
  }, [aparelho, checklist.regras]);

  // Conexão: faixa "sem sinal" (informativa, nunca vermelha).
  React.useEffect(() => {
    const atualizar = () => definirOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  // Estado da fila desta visita, para o indicador de sincronização.
  React.useEffect(() => {
    if (!aparelho) return;
    let cancelado = false;
    const ler = async () => {
      const estado = await lerFila(aparelho.banco, visitaId);
      if (cancelado) return;
      if (pendentesAntes.current > 0 && estado.pendentes === 0) {
        sincronizadoEm.current = new Date();
      }
      pendentesAntes.current = estado.pendentes;
      definirFila({ ...estado, sincronizadoEm: sincronizadoEm.current });
    };
    void ler();
    const intervalo = window.setInterval(() => void ler(), 1_200);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [aparelho, visitaId]);

  /** Grava o rascunho no aparelho (e na tela). `persistir=false` só atualiza a tela. */
  const guardar = React.useCallback(
    (proximo: RascunhoChecklist, persistir = true) => {
      ref.current = proximo;
      definirRascunho(proximo);
      if (persistir && aparelho) void aparelho.armazem.salvar(proximo);
    },
    [aparelho],
  );

  const tentarEnviar = React.useCallback(() => {
    if (!aparelho) return;
    void processarFila(aparelho.banco, aparelho.enviar, undefined, {
      ignorarEspera: true,
    }).catch(() => undefined);
  }, [aparelho]);

  /** Envia à fila os alertas que ainda não foram, na ordem em que surgiram. */
  const enfileirarPendentes = React.useCallback(
    async (base: RascunhoChecklist): Promise<RascunhoChecklist> => {
      if (!aparelho) return base;
      let atual = base;
      const feitos: string[] = [];
      for (const d of base.disparados.filter((x) => !x.enfileirado)) {
        // Dois campos salvos em seguida não enfileiram o mesmo alerta duas vezes.
        const chave = chaveAlerta(d.regraId, d.bebeId);
        if (jaEnfileirando.current.has(chave)) continue;
        jaEnfileirando.current.add(chave);
        await enfileirarNovoAlerta(aparelho.banco, usuarioId, {
          visitaId,
          regraId: d.regraId,
          instrumentoVersao: versao,
          bebeId: d.bebeId,
          campo: d.campo,
          valorObservado: d.valorObservado,
          manual: d.manual,
        });
        feitos.push(chaveAlerta(d.regraId, d.bebeId));
      }
      if (feitos.length > 0) {
        atual = marcarEnfileirados(atual, feitos);
        tentarEnviar();
      }
      return atual;
    },
    [aparelho, usuarioId, visitaId, versao, tentarEnviar],
  );

  const aoMudarCampo = React.useCallback(
    (endereco: EnderecoCampo, valor: ValorCampo | null, salvar: boolean) => {
      const atual = ref.current;
      if (!atual || !definicao) return;
      let proximo = aplicarResposta(
        atual,
        { definicao, bebes, ultimoDia: checklist.ultimoDia },
        endereco,
        valor,
      );
      if (!salvar) {
        guardar(proximo, false);
        return;
      }
      // Avalia a regra no próprio aparelho, no momento em que o campo é salvo.
      const dados = montarDados({
        definicao,
        respostas: proximo.respostas,
        bebes,
        ultimoDia: checklist.ultimoDia,
        acionamentos: proximo.acionamentos,
      });
      const novos = novosDisparos(
        proximo,
        avaliarAlertasDoCampo(endereco, dados, contextoAvaliacao),
      );
      proximo = comDisparos(proximo, novos);
      guardar(proximo);
      if (novos.length > 0) {
        void enfileirarPendentes(proximo).then((depois) => {
          // O rascunho pode ter mudado enquanto a fila gravava.
          const corrente = ref.current ?? depois;
          const marcados = depois.disparados
            .filter((d) => d.enfileirado)
            .map((d) => chaveAlerta(d.regraId, d.bebeId));
          guardar(marcarEnfileirados(corrente, marcados));
        });
      }
    },
    [
      definicao,
      bebes,
      checklist.ultimoDia,
      contextoAvaliacao,
      guardar,
      enfileirarPendentes,
    ],
  );

  const irParaEtapa = React.useCallback(
    (indice: number) => {
      const atual = ref.current;
      if (!atual) return;
      guardar({ ...atual, etapa: indice });
    },
    [guardar],
  );

  const trazer = React.useCallback(
    (endereco: EnderecoCampo) => {
      const atual = ref.current;
      if (!atual) return;
      const referencia = referenciaDoDiaAnterior(
        checklist.anteriores,
        endereco,
      );
      if (!referencia) return;
      guardar({
        ...atual,
        trazidos: trazerTexto(atual.trazidos, endereco, referencia),
      });
    },
    [checklist.anteriores, guardar],
  );

  const confirmarTrazido = React.useCallback(
    (endereco: EnderecoCampo, texto: string) => {
      const atual = ref.current;
      if (!atual) return;
      const { respostas, trazidos } = confirmarTextoTrazido(
        atual.respostas,
        atual.trazidos,
        endereco,
        texto,
      );
      guardar({ ...atual, respostas, trazidos });
    },
    [guardar],
  );

  const descartarTrazido = React.useCallback(
    (endereco: EnderecoCampo) => {
      const atual = ref.current;
      if (!atual) return;
      guardar({
        ...atual,
        trazidos: descartarTextoTrazido(atual.trazidos, endereco),
      });
    },
    [guardar],
  );

  const salvarAcionamento = React.useCallback(
    (acionamento: AcionamentoAlerta) => {
      const atual = ref.current;
      if (!atual) return;
      guardar(comAcionamento(atual, acionamento));
    },
    [guardar],
  );

  const registrarSinal = React.useCallback(
    (
      sinal: SinalDoSeletor,
      bebeId: string | null,
      observacao: string | null,
    ): "registrado" | "ja_registrado" => {
      const atual = ref.current;
      if (!atual) return "ja_registrado";
      const { rascunho: comSinal, disparo } = comSinalManual(
        atual,
        sinal,
        bebeId,
        observacao,
      );
      if (!disparo) return "ja_registrado";
      guardar(comSinal);
      void enfileirarPendentes(comSinal).then((depois) => {
        const corrente = ref.current ?? depois;
        const marcados = depois.disparados
          .filter((d) => d.enfileirado)
          .map((d) => chaveAlerta(d.regraId, d.bebeId));
        guardar(marcarEnfileirados(corrente, marcados));
      });
      return "registrado";
    },
    [guardar, enfileirarPendentes],
  );

  const [assinando, definirAssinando] = React.useState(false);
  const [erroAoAssinar, definirErroAoAssinar] = React.useState(false);

  /** Assina no aparelho, na hora, e põe o registro inteiro na fila (D-05). */
  const assinar = React.useCallback(async (): Promise<boolean> => {
    const atual = ref.current;
    if (!atual || !aparelho || !definicao) return false;
    definirAssinando(true);
    definirErroAoAssinar(false);
    try {
      const dados = montarDados({
        definicao,
        respostas: atual.respostas,
        bebes,
        ultimoDia: checklist.ultimoDia,
        acionamentos: atual.acionamentos,
      });
      // Reavaliação completa antes de assinar: o que a regra viu nos campos
      // e algum caso que o aparelho ainda não tinha visto entram na fila
      // antes do registro, na ordem de criação.
      let corrente = comDisparos(
        atual,
        novosDisparos(
          atual,
          avaliarAlertasDoRegistro(dados, contextoAvaliacao),
        ),
      );
      guardar(corrente);
      corrente = await enfileirarPendentes(corrente);

      const registro = await assinarRegistro({
        visitaId,
        profissionalId: checklist.profissional.id,
        instrumentoVersao: versao,
        dados,
        resumo: resumoDoDia(atual.respostas),
        agora: agora(),
      });
      await enfileirarRegistroAssinado(aparelho.banco, usuarioId, registro);
      guardar({ ...corrente, assinadoEmMs: registro.assinadoEmMs });
      tentarEnviar();
      return true;
    } catch {
      definirErroAoAssinar(true);
      return false;
    } finally {
      definirAssinando(false);
    }
  }, [
    aparelho,
    definicao,
    bebes,
    checklist.ultimoDia,
    checklist.profissional.id,
    contextoAvaliacao,
    guardar,
    enfileirarPendentes,
    visitaId,
    versao,
    agora,
    usuarioId,
    tentarEnviar,
  ]);

  /** Adendo com motivo, pela fila: sobe depois do registro e não altera o original. */
  const fazerAdendo = React.useCallback(
    async (motivo: string, conteudo: string): Promise<void> => {
      if (!aparelho) return;
      await enfileirarAdendo(
        aparelho.banco,
        usuarioId,
        visitaId,
        motivo,
        conteudo,
      );
      tentarEnviar();
    },
    [aparelho, usuarioId, visitaId, tentarEnviar],
  );

  /** O registro subiu: o rascunho deste aparelho já não faz falta. */
  const limparRascunho = React.useCallback(async () => {
    if (!aparelho) return;
    await aparelho.armazem.apagar(visitaId);
    ref.current = null;
  }, [aparelho, visitaId]);

  return {
    aparelho,
    carregado: rascunho !== null,
    rascunho,
    online,
    fila,
    bebes,
    catalogo,
    contextoAvaliacao,
    aoMudarCampo,
    irParaEtapa,
    trazer,
    confirmarTrazido,
    descartarTrazido,
    salvarAcionamento,
    registrarSinal,
    assinar,
    assinando,
    erroAoAssinar,
    fazerAdendo,
    tentarEnviar,
    limparRascunho,
  };
}
