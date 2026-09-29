"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, User, Users } from "lucide-react";
import { AbasInferiores } from "@/components/ui/abas-inferiores";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { hojeEmBrasilia } from "@/lib/agenda/datas";
import { lerDiaDoAparelho } from "../cache-portal";
import type { FamiliaPortal } from "@/lib/dados/tipos-equipe";
import { BotaoSairPortal } from "./botao-sair-portal";
import { HojeCliente } from "./hoje-cliente";
import { IndicadorPortal } from "./indicador-portal";
import { ListaFamilias } from "./lista-familias";
import { ProvedorPortal, usePortal } from "./provedor-portal";

type Aba = "hoje" | "minhas-familias" | "alertas" | "perfil";
const ABAS: Aba[] = ["hoje", "minhas-familias", "alertas", "perfil"];

function abaDe(valor: string | null): Aba {
  return ABAS.find((a) => a === valor) ?? "hoje";
}

/**
 * Casco do portal sem sinal (P38 item 2). O service worker leva para cá
 * qualquer abertura do portal quando não há conexão. A página não traz dado
 * de família: tudo vem do IndexedDB do aparelho (o dia guardado por 24 horas
 * e a fila de registros). Por isso ela é pública e o mesmo arquivo serve a
 * qualquer pessoa: sem o aparelho da enfermeira, não mostra nada.
 */
function ConteudoDoCasco() {
  const parametros = useSearchParams();
  const aba = abaDe(parametros.get("de"));
  const { db } = usePortal();
  const [familias, definirFamilias] = useState<FamiliaPortal[] | null>(null);
  const [diaDoCache, definirDiaDoCache] = useState<string | null>(null);

  useEffect(() => {
    if (!db || aba !== "minhas-familias") return;
    let ativo = true;
    void lerDiaDoAparelho(db)
      .catch(() => null)
      .then((guardado) => {
        if (!ativo) return;
        definirFamilias(guardado?.familias ?? []);
        definirDiaDoCache(guardado?.dia ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [db, aba]);

  // O título de "Hoje" não leva a data: esta página é gerada uma vez e
  // guardada; a data do dia guardado aparece dentro do Hoje.
  const titulo =
    aba === "hoje"
      ? "Hoje"
      : aba === "minhas-familias"
        ? "Famílias"
        : aba === "alertas"
          ? "Alertas"
          : "Perfil";

  return (
    <>
      <main
        id="conteudo"
        tabIndex={-1}
        className="max-w-portal mx-auto w-full px-4 pb-[calc(88px+env(safe-area-inset-bottom))]"
      >
        <header className="bg-fundo border-linha sticky top-0 z-[var(--z-barra)] -mx-4 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
          <h1 className="font-titulo text-display text-texto font-normal">
            {titulo}
          </h1>
          <div className="ml-auto">
            <IndicadorPortal />
          </div>
        </header>

        {aba === "hoje" ? (
          <HojeCliente inicial={null} familias={[]} hoje={null} />
        ) : null}

        {aba === "minhas-familias" ? (
          <div className="flex flex-col gap-4 pt-6">
            {familias === null ? (
              <p className="text-corpo text-texto-2" role="status">
                Carregando as famílias guardadas neste aparelho.
              </p>
            ) : (
              <ListaFamilias
                familias={familias}
                hoje={diaDoCache ?? hojeEmBrasilia()}
                comLink={false}
              />
            )}
          </div>
        ) : null}

        {aba === "alertas" ? (
          <div className="pt-6">
            <EstadoVazio
              nivelTitulo="h2"
              titulo="Os alertas abrem com sinal"
              texto="Sem conexão, o aplicativo mostra o Hoje e as famílias guardadas neste aparelho. Os alertas voltam quando o sinal voltar."
            />
          </div>
        ) : null}

        {aba === "perfil" ? (
          <div className="flex flex-col gap-5 pt-6">
            <FaixaAlerta variante="info" titulo="Sem sinal agora">
              Seu perfil completo abre quando a conexão voltar. O que você
              registrar continua salvo neste aparelho e sobe sozinho.
            </FaixaAlerta>
            <BotaoSairPortal />
          </div>
        ) : null}
      </main>

      <AbasInferiores
        rotulo="Navegação do portal sem sinal"
        itens={[
          {
            rotulo: "Hoje",
            href: "/portal-offline?de=hoje",
            icone: <CalendarCheck aria-hidden="true" />,
            ativo: aba === "hoje",
          },
          {
            rotulo: "Famílias",
            href: "/portal-offline?de=minhas-familias",
            icone: <Users aria-hidden="true" />,
            ativo: aba === "minhas-familias",
          },
          {
            rotulo: "Alertas",
            href: "/portal-offline?de=alertas",
            icone: <Bell aria-hidden="true" />,
            ativo: aba === "alertas",
          },
          {
            rotulo: "Perfil",
            href: "/portal-offline?de=perfil",
            icone: <User aria-hidden="true" />,
            ativo: aba === "perfil",
          },
        ]}
      />
    </>
  );
}

export function CascoOffline() {
  return (
    <ProvedorPortal usuarioId={null}>
      <ConteudoDoCasco />
    </ProvedorPortal>
  );
}
