"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/utils";
import type { Papel } from "@/lib/auth/papeis";
import type { NumeroPipeline } from "@/lib/dados/tipos";
import {
  destinosPermitidos,
  papelProvavelmenteConfirma,
  rotuloEstagio,
} from "../estagios";
import { acaoTransicionar, estadoInicialPipeline } from "../acoes";
import type { CartaoPipelineTela } from "../tipos";
import { FolhaPerda } from "./folha-perda";

/**
 * "Mover para" (P15 item 2, protótipo `comercial-pipeline.html`). Só lista
 * os destinos de `destinosPermitidos`; "Perdido" abre a folha de motivo em
 * vez de mudar na hora. Quem barra de verdade é `privado.transicionar`.
 */
export function MenuMover({
  cartao,
  pipeline,
  papeis,
}: {
  cartao: CartaoPipelineTela;
  pipeline: NumeroPipeline;
  /** Papéis da sessão logada, só para atenuar (não esconder) uma opção que o
   * papel provavelmente não confirma (cosmético; quem barra é o banco). */
  papeis: readonly Papel[];
}) {
  const [aberto, definirAberto] = React.useState(false);
  const [perdaAberta, definirPerdaAberta] = React.useState(false);
  const [pendente, iniciarTransicao] = React.useTransition();
  const [erro, definirErro] = React.useState<string | null>(null);

  const estagioAtual = pipeline === 1 ? cartao.estagioP1 : cartao.estagioP2;
  const destinos = destinosPermitidos(pipeline, estagioAtual);

  if (destinos.length === 0) return null;

  function mover(para: string) {
    if (para === "perdido") {
      definirAberto(false);
      definirPerdaAberta(true);
      return;
    }
    definirErro(null);
    const formulario = new FormData();
    formulario.set("oportunidadeId", cartao.oportunidadeId);
    formulario.set("pipeline", String(pipeline));
    formulario.set("para", para);
    iniciarTransicao(async () => {
      const resultado = await acaoTransicionar(
        estadoInicialPipeline,
        formulario,
      );
      if (resultado.erro) definirErro(resultado.erro);
      definirAberto(false);
    });
  }

  return (
    <>
      <DropdownMenu.Root open={aberto} onOpenChange={definirAberto}>
        <DropdownMenu.Trigger asChild>
          <Botao
            variante="fantasma"
            tamanho="compacto"
            disabled={pendente}
            iconeDireita={<ChevronDown aria-hidden="true" className="size-4" />}
          >
            Mover para
          </Botao>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={4}
            className="rounded-2 border-linha bg-superficie shadow-2 z-50 flex min-w-56 flex-col gap-1 border p-2"
          >
            <DropdownMenu.Label className="text-mini text-texto-2 px-2 pt-1 pb-1">
              A partir de {rotuloEstagio(pipeline, estagioAtual as never)}
            </DropdownMenu.Label>
            {destinos.map((destino) => {
              const provavel = papelProvavelmenteConfirma(
                papeis,
                destino.papelMinimo,
                estagioAtual,
              );
              return (
                <DropdownMenu.Item
                  key={destino.estagio}
                  onSelect={(evento) => {
                    evento.preventDefault();
                    mover(destino.estagio);
                  }}
                  className={cn(
                    "rounded-pilula text-apoio text-texto min-h-toque flex cursor-pointer items-center gap-2 px-3 font-medium outline-none select-none",
                    "hover:bg-marinho-08 data-[highlighted]:bg-marinho-08",
                    !provavel && "text-texto-2",
                  )}
                >
                  <ArrowRight aria-hidden="true" className="size-4" />
                  {destino.rotulo}
                  {destino.estagio === "perdido" ? ", com motivo" : ""}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {erro ? (
        <p role="alert" className="text-apoio text-alerta mt-1">
          {erro}
        </p>
      ) : null}
      <FolhaPerda
        aberta={perdaAberta}
        aoFechar={() => definirPerdaAberta(false)}
        oportunidadeId={cartao.oportunidadeId}
        pipeline={pipeline}
        nomeFamilia={cartao.nomeFamilia}
      />
    </>
  );
}
