"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardPen, WifiOff } from "lucide-react";
import { JanelaManha, NuvemSemSinal } from "@/components/ilustracoes";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { ItemBloco, ListaBlocos } from "@/components/ui/lista-blocos";
import { TileIcone } from "@/components/ui/tile-icone";
import { horaEmBrasilia, somarDias } from "@/lib/agenda/datas";
import type {
  FamiliaPortal,
  FichaPendentePortal,
  PortalHoje,
  VisitaPortal,
} from "@/lib/dados/tipos-equipe";
import { guardarDiaNoAparelho, lerDiaDoAparelho } from "../cache-portal";
import {
  aplicarMarcasLocais,
  lerMarcasLocais,
  registrarChegadaNoAparelho,
  registrarSaidaNoAparelho,
  type VisitaNaTela,
} from "../registro-local";
import { diaEmFrase, diaDeTotal, visitasDoDiaSeguinte } from "../textos";
import { CartaoVisita } from "./cartao-visita";
import { usePortal } from "./provedor-portal";

interface DadosDoDia {
  dia: string;
  visitas: VisitaPortal[];
  fichasPendentes: FichaPendentePortal[];
  familias: FamiliaPortal[];
  /** Quando os dados foram lidos do aparelho (não do servidor). */
  doAparelhoEm: number | null;
}

/**
 * Conteúdo do Hoje da enfermeira (P38 itens 1 e 2). Com sinal, recebe as
 * visitas do servidor e guarda o dia no aparelho (24 horas, apagado no
 * logout). Sem sinal, a página de sem sinal entrega `inicial = null` e este
 * componente lê o dia do aparelho. Nos dois casos, a chegada e a saída vão
 * pelo motor offline: gravam a hora na hora do toque e sobem quando há sinal.
 */
export function HojeCliente({
  inicial,
  familias,
  hoje,
}: {
  inicial: PortalHoje | null;
  familias: FamiliaPortal[];
  /** "aaaa-mm-dd" em Brasília, quando a página vem do servidor. */
  hoje: string | null;
}) {
  const { db, usuarioId, online, atualizar, versaoFila } = usePortal();
  const [dados, definirDados] = useState<DadosDoDia | null>(
    inicial
      ? {
          dia: inicial.dia,
          visitas: inicial.visitas,
          fichasPendentes: inicial.fichasPendentes,
          familias,
          doAparelhoEm: null,
        }
      : null,
  );
  const [carregouDoAparelho, definirCarregouDoAparelho] = useState(
    inicial !== null,
  );
  const [naTela, definirNaTela] = useState<VisitaNaTela[]>([]);
  const [ocupada, definirOcupada] = useState<string | null>(null);

  // O servidor mandou dados novos (a tela foi renovada): vale o que ele mandou.
  useEffect(() => {
    if (!inicial) return;
    const espera = setTimeout(() => {
      definirDados({
        dia: inicial.dia,
        visitas: inicial.visitas,
        fichasPendentes: inicial.fichasPendentes,
        familias,
        doAparelhoEm: null,
      });
      definirCarregouDoAparelho(true);
    }, 0);
    return () => clearTimeout(espera);
  }, [inicial, familias]);

  // Guarda o dia no aparelho (com sinal) ou lê o dia guardado (sem sinal).
  useEffect(() => {
    if (!db) return;
    let ativo = true;
    (async () => {
      if (inicial) {
        await guardarDiaNoAparelho(db, inicial, familias).catch(
          () => undefined,
        );
        return;
      }
      const guardado = await lerDiaDoAparelho(db).catch(() => null);
      if (!ativo) return;
      if (guardado) {
        definirDados({
          dia: guardado.dia,
          visitas: guardado.visitas,
          fichasPendentes: guardado.fichasPendentes,
          familias: guardado.familias,
          doAparelhoEm: guardado.buscadoEm,
        });
      }
      definirCarregouDoAparelho(true);
    })();
    return () => {
      ativo = false;
    };
  }, [db, inicial, familias]);

  // As marcas do aparelho por cima das visitas.
  useEffect(() => {
    if (!db || !dados) return;
    let ativo = true;
    (async () => {
      const lista = await Promise.all(
        dados.visitas.map(async (v) =>
          aplicarMarcasLocais(v, await lerMarcasLocais(db, v.visitaId)),
        ),
      );
      if (ativo) definirNaTela(lista);
    })();
    return () => {
      ativo = false;
    };
  }, [db, dados, versaoFila]);

  const registrar = useCallback(
    async (visita: VisitaNaTela, passo: "chegada" | "saida") => {
      if (!db || !usuarioId) return;
      definirOcupada(visita.visitaId);
      try {
        if (passo === "chegada")
          await registrarChegadaNoAparelho(db, usuarioId, visita);
        else await registrarSaidaNoAparelho(db, usuarioId, visita);
        atualizar();
      } finally {
        definirOcupada(null);
      }
    },
    [db, usuarioId, atualizar],
  );

  const hojeReal = hoje ?? dados?.dia ?? null;
  const amanha = hojeReal ? somarDias(hojeReal, 1) : null;
  const doDiaSeguinte =
    amanha && dados ? visitasDoDiaSeguinte(dados.familias, amanha) : [];

  if (!dados) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        {!online ? <FaixaSemSinal /> : null}
        {carregouDoAparelho ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={<NuvemSemSinal tamanho={112} />}
            titulo="Ainda não há visitas salvas neste aparelho"
            texto="Abra o Hoje uma vez com sinal. As visitas do dia ficam guardadas aqui por 24 horas e abrem mesmo sem conexão."
          />
        ) : (
          <p className="text-corpo text-texto-2" role="status">
            Carregando as visitas de hoje.
          </p>
        )}
      </div>
    );
  }

  const pendencias = dados.fichasPendentes;
  const lista = naTela.length > 0 ? naTela : [];

  return (
    <div className="flex flex-col gap-6 pt-6">
      {!online ? <FaixaSemSinal /> : null}

      {dados.doAparelhoEm ? (
        <FaixaAlerta
          variante="info"
          titulo={`Visitas de ${diaEmFrase(dados.dia)}, salvas às ${horaEmBrasilia(new Date(dados.doAparelhoEm))}`}
        >
          Estes dados estão guardados neste aparelho e valem por 24 horas. O que
          você registrar sobe sozinho quando houver sinal.
        </FaixaAlerta>
      ) : null}

      {pendencias.length > 0 ? (
        <section
          aria-labelledby="fichas-pendentes"
          className="flex flex-col gap-3"
        >
          <h2 id="fichas-pendentes" className="font-titulo text-2 text-texto">
            {pendencias.length === 1 ? "Ficha pendente" : "Fichas pendentes"}
          </h2>
          <ListaBlocos>
            {pendencias.map((f) => (
              <ItemBloco
                key={f.visitaId}
                fundo="tom"
                tom="areia"
                icone={<ClipboardPen />}
                titulo={`${diaDeTotal(f.diaNumero, f.diasContratados)} da ${f.nomeExibicao}`}
                apoio="Falta o registro da visita."
                href={inicial ? `/visita/${f.visitaId}` : undefined}
              />
            ))}
          </ListaBlocos>
        </section>
      ) : null}

      <section
        aria-labelledby="visitas-de-hoje"
        className="flex scroll-mt-4 flex-col gap-3"
      >
        <h2 id="visitas-de-hoje" className="font-titulo text-2 text-texto">
          Visitas de hoje
        </h2>
        {dados.visitas.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            ilustracao={<JanelaManha tamanho={112} />}
            titulo="Nenhuma visita marcada para hoje"
            texto="Quando a coordenação marcar uma visita, ela aparece aqui com o endereço e o horário."
            acao={
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                iconeEsquerda={<CalendarDays aria-hidden="true" />}
              >
                <Link href="/perfil">Ver minha semana</Link>
              </Botao>
            }
          />
        ) : (
          lista.map((v) => (
            <CartaoVisita
              key={v.visitaId}
              visita={v}
              ocupado={ocupada === v.visitaId}
              aoChegar={() => void registrar(v, "chegada")}
              aoSair={() => void registrar(v, "saida")}
              offline={inicial === null}
            />
          ))
        )}
      </section>

      {doDiaSeguinte.length > 0 && amanha ? (
        <section
          aria-labelledby="visitas-de-amanha"
          className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-5"
        >
          <div className="flex items-center gap-3">
            <TileIcone tom="lavanda" forma="quadrado">
              <CalendarDays />
            </TileIcone>
            <h2
              id="visitas-de-amanha"
              className="font-titulo text-2 text-texto"
            >
              Amanhã, {diaEmFrase(amanha)}
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {doDiaSeguinte.map((v) => (
              <li
                key={`${v.familiaId}-${v.diaNumero}`}
                className="rounded-2 bg-superficie min-h-toque flex items-center gap-3 px-4 py-2"
              >
                <span className="text-corpo text-texto min-w-0 flex-1 font-semibold">
                  {v.nomeExibicao}
                </span>
                <span className="text-apoio text-texto-2 font-mono">
                  {v.horaPrevista ? `${v.horaPrevista}, ` : ""}D{v.diaNumero}
                </span>
              </li>
            ))}
          </ul>
          {inicial ? (
            <Botao
              asChild
              variante="fantasma"
              tamanho="compacto"
              className="self-start"
              iconeEsquerda={<CalendarDays aria-hidden="true" />}
            >
              <Link href="/perfil">Ver minha semana</Link>
            </Botao>
          ) : null}
        </section>
      ) : inicial ? (
        <Botao
          asChild
          variante="fantasma"
          tamanho="compacto"
          className="self-start"
          iconeEsquerda={<CalendarDays aria-hidden="true" />}
        >
          <Link href="/perfil">Ver minha semana</Link>
        </Botao>
      ) : null}
    </div>
  );
}

function FaixaSemSinal() {
  return (
    <FaixaAlerta variante="info" titulo="Sem sinal agora">
      <span className="inline-flex items-start gap-2">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />O
        registro está salvo no aparelho e sobe sozinho quando a conexão voltar.
      </span>
    </FaixaAlerta>
  );
}
