"use client";

import * as React from "react";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  Bot,
  Ellipsis,
  Hourglass,
  OctagonPause,
  UserCheck,
} from "lucide-react";
import { AvisoEfemero } from "@/components/ui/aviso-efemero";
import { Botao } from "@/components/ui/botao";
import { BotaoFreio } from "@/components/ui/botao-freio";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { rotulo } from "@/lib/rotulos-a-confirmar";
import { acaoAcionarFreio, acaoDesfazerFreio } from "@/modules/crm/ficha/acoes";
import { FaixaJustificarFreio } from "@/modules/crm/ficha/componentes/faixa-justificar-freio";
import { FolhaReverterFreio } from "@/modules/crm/ficha/componentes/folha-reverter-freio";
import { estadoInicialFicha } from "@/modules/crm/ficha/estado-acoes";
import { acaoMarcarNaoLead, acaoPausarConversa } from "../../acoes";
import { estadoInicialAgente } from "../../estado-acoes";
import { primeiroNome } from "../../formatacao";
import { CLASSIFICACOES_NAO_LEAD } from "../../loja-extra";
import { ROTULO_NAO_LEAD } from "../../tipos";
import type { SituacaoConversa } from "../../tipos";
import { AvatarContato } from "../../conversas/componentes/avatar-contato";
import { lerFiltro } from "../../conversas/lista";

const VARIANTE_SITUACAO: Record<
  SituacaoConversa,
  "neutro" | "marinho" | "aviso" | "contorno" | "sensivel"
> = {
  isadora: "neutro",
  equipe: "marinho",
  pausada: "aviso",
  nao_lead: "contorno",
  freio: "sensivel",
};

/**
 * Quem conduz, em poucas palavras, para caber ao lado do nome no celular.
 * A frase inteira está no bloco logo abaixo do cabeçalho.
 */
function quemConduz(
  situacao: SituacaoConversa,
  motivoEncerramento: string | null | undefined,
): string {
  if (situacao === "isadora") return "Isadora conduz";
  if (situacao === "equipe") {
    return motivoEncerramento === "reuniao_realizada"
      ? "Leonardo conduz"
      : "Equipe conduz";
  }
  if (situacao === "pausada") return "Isadora pausada";
  if (situacao === "freio") return "Isadora desligada";
  return rotulo("naoLead");
}

const ICONE_SITUACAO: Partial<Record<SituacaoConversa, React.ReactNode>> = {
  isadora: <Bot />,
  equipe: <UserCheck />,
  pausada: <Hourglass />,
  freio: <OctagonPause />,
};

export interface CabecalhoConversaProps {
  /** Nome da família, ou do contato quando não há família ligada. */
  nome: string;
  familiaId: string | null;
  estadoSensivel: EstadoSensivel;
  /** Coordenação ou diretoria: o selo "Freio ativo" abre a folha de reversão. */
  podeReverter: boolean;
  freioDesfazerSegundos: number;
  /** Semanas (calculadas da DPP) e lugar; some em modo sensível. */
  ig?: string | null;
  lugar?: string | null;
  /** Quem conduz a conversa (Isadora, equipe, Leonardo). */
  situacao?: SituacaoConversa | null;
  motivoEncerramento?: string | null;
  /** Ações do menu de três pontos; sem isto, só "Ver ficha". */
  conversa?: {
    id: string;
    nomeContato: string;
    podePausar: boolean;
    podeTriar: boolean;
  } | null;
}

/**
 * Cabeçalho da conversa aberta, como o do WhatsApp Web: o voltar (só no
 * celular), o avatar, o nome da família que leva à ficha, as semanas, o
 * lugar e quem conduz a conversa. À direita, o menu de três pontos (ver
 * ficha, pausar a Isadora, marcar como não lead) e o freio em um toque,
 * que fica no cabeçalho de toda tela da família (PRD 20.4). O fluxo do
 * freio é o mesmo da ficha (acionar, desfazer, reverter, justificar).
 */
export function CabecalhoConversa({
  nome,
  familiaId,
  estadoSensivel,
  podeReverter,
  freioDesfazerSegundos,
  ig,
  lugar,
  situacao,
  motivoEncerramento,
  conversa,
}: CabecalhoConversaProps) {
  const router = useRouter();
  const parametros = useSearchParams();
  const filtro = lerFiltro(parametros.get("filtro"));
  const voltar =
    filtro === "todas" ? "/conversas" : `/conversas?filtro=${filtro}`;

  const freioAtivo = estadoSensivel !== "normal";
  const modoSensivel =
    estadoSensivel === "bloqueio_total" ||
    estadoSensivel === "encerrado_sensivel";

  // Freio: mesmo caminho da ficha (CabecalhoFicha), com o "Desfazer" no
  // aviso efêmero pelo prazo que o banco devolver.
  const formDesfazerRef = useRef<HTMLFormElement>(null);
  const [avisoAberto, definirAvisoAberto] = useState(false);
  const [avisoTexto, definirAvisoTexto] = useState<React.ReactNode>(null);
  const [prazoDesfazer, definirPrazoDesfazer] = useState(0);
  const [reverterAberto, definirReverterAberto] = useState(false);
  const [acionouAgora, definirAcionouAgora] = useState(false);
  const fecharAviso = React.useCallback(() => definirAvisoAberto(false), []);

  const [estadoAcionar, acaoAcionar, acionando] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoAcionarFreio(estadoInicialFicha, formulario);
      if (!resultado.erro) {
        definirAvisoTexto(
          `Freio acionado. Nenhuma mensagem automática sai para ${nome}.`,
        );
        definirPrazoDesfazer(
          resultado.desfazerSegundos ?? freioDesfazerSegundos,
        );
        definirAcionouAgora(true);
        definirAvisoAberto(true);
        router.refresh();
      }
      return resultado;
    },
    estadoInicialFicha,
  );

  const [, acaoDesfazer] = useActionState(
    async (_anterior: typeof estadoInicialFicha, formulario: FormData) => {
      const resultado = await acaoDesfazerFreio(estadoInicialFicha, formulario);
      if (!resultado.erro) {
        definirAvisoAberto(false);
        definirAcionouAgora(false);
        router.refresh();
      } else {
        definirAvisoTexto(resultado.erro);
        definirPrazoDesfazer(0);
        definirAvisoAberto(true);
      }
      return resultado;
    },
    estadoInicialFicha,
  );

  // Menu da conversa: pausar a Isadora e a triagem de não lead.
  const formPausarRef = useRef<HTMLFormElement>(null);
  const [mostrarNaoLead, definirMostrarNaoLead] = useState(false);
  const [estadoPausar, acaoPausar, pausando] = useActionState(
    acaoPausarConversa,
    estadoInicialAgente,
  );
  const [estadoNaoLead, acaoNaoLead, marcandoNaoLead] = useActionState(
    acaoMarcarNaoLead,
    estadoInicialAgente,
  );

  const temMenu = Boolean(
    familiaId || conversa?.podePausar || conversa?.podeTriar,
  );

  return (
    <div className="bg-superficie flex shrink-0 flex-col">
      <header className="flex items-center gap-2 px-2 py-2 lg:gap-3 lg:px-4 lg:py-3">
        <Botao
          asChild
          variante="icone"
          aria-label="Voltar para as conversas"
          className="lg:hidden"
        >
          <Link href={voltar}>
            <ArrowLeft
              aria-hidden="true"
              className="size-5"
              strokeWidth={1.75}
            />
          </Link>
        </Botao>
        <AvatarContato
          nome={nome}
          jeito={modoSensivel ? "sensivel" : "pessoa"}
          tamanho="p"
          className="max-tablet:hidden lg:size-12"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-titulo text-3 tablet:text-2 text-texto line-clamp-2 leading-tight font-medium">
            {familiaId ? (
              <Link href={`/familias/${familiaId}`} className="hover:underline">
                {nome}
              </Link>
            ) : (
              nome
            )}
          </h2>
          <div className="text-mini text-texto-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {situacao ? (
              <Selo
                variante={VARIANTE_SITUACAO[situacao]}
                icone={ICONE_SITUACAO[situacao]}
              >
                {quemConduz(situacao, motivoEncerramento)}
              </Selo>
            ) : null}
            {!modoSensivel && ig ? (
              <span className="font-mono">{ig}</span>
            ) : null}
            {lugar ? <span className="max-tablet:hidden">{lugar}</span> : null}
          </div>
        </div>

        {temMenu ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Botao
                variante="icone"
                aria-label={`Mais ações para ${nome}`}
                aria-busy={pausando || undefined}
              >
                <Ellipsis
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={1.75}
                />
              </Botao>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="rounded-2 border-linha bg-superficie shadow-2 z-50 flex min-w-60 flex-col gap-1 border p-2"
              >
                {familiaId ? (
                  <DropdownMenu.Item asChild>
                    <Link
                      href={`/familias/${familiaId}`}
                      className={CLASSE_ITEM}
                    >
                      Ver ficha da família
                    </Link>
                  </DropdownMenu.Item>
                ) : null}
                {conversa?.podePausar ? (
                  <DropdownMenu.Item
                    className={CLASSE_ITEM}
                    onSelect={() => formPausarRef.current?.requestSubmit()}
                  >
                    Pausar a Isadora
                  </DropdownMenu.Item>
                ) : null}
                {conversa?.podeTriar ? (
                  <DropdownMenu.Item
                    className={CLASSE_ITEM}
                    onSelect={() => definirMostrarNaoLead(true)}
                  >
                    {rotulo("marcarNaoLead")}
                  </DropdownMenu.Item>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}

        {familiaId ? (
          freioAtivo ? (
            podeReverter ? (
              <button
                type="button"
                onClick={() => definirReverterAberto(true)}
                className="rounded-pilula bg-sensivel-lavado text-mini text-sensivel min-h-toque inline-flex shrink-0 items-center gap-1.5 px-3 font-semibold whitespace-nowrap"
              >
                <OctagonPause className="size-4" aria-hidden="true" />
                Freio ativo
              </button>
            ) : (
              <span className="rounded-pilula bg-sensivel-lavado text-mini text-sensivel inline-flex min-h-7 shrink-0 items-center gap-1.5 px-3 font-semibold whitespace-nowrap">
                <OctagonPause className="size-4" aria-hidden="true" />
                Freio ativo
              </span>
            )
          ) : (
            <form action={acaoAcionar} className="shrink-0">
              <input type="hidden" name="familiaId" value={familiaId} />
              <BotaoFreio
                type="submit"
                aria-busy={acionando || undefined}
                aria-label={`Freio: pausa na hora todas as mensagens automáticas para ${nome}`}
                className="px-3 lg:px-4"
              >
                Freio
              </BotaoFreio>
            </form>
          )
        ) : null}
      </header>

      {estadoAcionar.erro ? (
        <div className="px-3 pb-3 lg:px-4">
          <FaixaAlerta variante="erro" titulo={estadoAcionar.erro} />
        </div>
      ) : null}
      {estadoPausar.erro ? (
        <div className="px-3 pb-3 lg:px-4">
          <FaixaAlerta variante="erro" titulo="A Isadora não foi pausada">
            {estadoPausar.erro}
          </FaixaAlerta>
        </div>
      ) : null}
      {familiaId && freioAtivo ? (
        <div className="px-3 pb-3 empty:hidden lg:px-4">
          <FaixaJustificarFreio familiaId={familiaId} pendente={acionouAgora} />
        </div>
      ) : null}

      {conversa && mostrarNaoLead ? (
        <form
          action={acaoNaoLead}
          className="border-linha mx-3 mb-3 flex flex-col gap-3 border-t pt-3 lg:mx-4"
        >
          <input type="hidden" name="conversaId" value={conversa.id} />
          <EscolhaUnica
            rotulo="Não é lead porque"
            name="classificacao"
            opcoes={CLASSIFICACOES_NAO_LEAD.map((valor) => ({
              valor,
              rotulo: ROTULO_NAO_LEAD[valor],
            }))}
          />
          <p className="text-apoio text-texto-2">
            A Isadora encaminha {primeiroNome(conversa.nomeContato)} e para de
            responder depois disso.
          </p>
          {estadoNaoLead.erro ? (
            <FaixaAlerta variante="erro" titulo="A classificação não foi salva">
              {estadoNaoLead.erro}
            </FaixaAlerta>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              tamanho="compacto"
              carregando={marcandoNaoLead}
              rotuloCarregando="Salvando"
            >
              {rotulo("marcarNaoLead")}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              tamanho="compacto"
              onClick={() => definirMostrarNaoLead(false)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : null}

      {conversa?.podePausar ? (
        <form ref={formPausarRef} action={acaoPausar} hidden>
          <input type="hidden" name="conversaId" value={conversa.id} />
          <input type="hidden" name="origem" value="pausar" />
        </form>
      ) : null}

      {familiaId ? (
        <>
          <form ref={formDesfazerRef} action={acaoDesfazer} hidden>
            <input type="hidden" name="familiaId" value={familiaId} />
          </form>
          <AvisoEfemero
            aberto={avisoAberto}
            aoFechar={fecharAviso}
            texto={avisoTexto}
            duracaoSegundos={prazoDesfazer > 0 ? prazoDesfazer : 6}
            rotuloAcao={prazoDesfazer > 0 ? "Desfazer" : undefined}
            aoAcionarAcao={
              prazoDesfazer > 0
                ? () => formDesfazerRef.current?.requestSubmit()
                : undefined
            }
          />
          {podeReverter ? (
            <FolhaReverterFreio
              familiaId={familiaId}
              nome={nome}
              estadoAtual={estadoSensivel}
              aberto={reverterAberto}
              aoFechar={() => definirReverterAberto(false)}
              aoSalvar={({ texto }) => {
                definirAvisoTexto(texto);
                definirPrazoDesfazer(0);
                definirAvisoAberto(true);
                router.refresh();
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const CLASSE_ITEM =
  "rounded-pilula text-apoio text-texto min-h-toque data-[highlighted]:bg-marinho-08 hover:bg-marinho-08 flex cursor-pointer items-center gap-2 px-3 font-medium no-underline outline-none select-none";
