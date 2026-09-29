import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  LockKeyhole,
  OctagonPause,
} from "lucide-react";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  hojeBrasilia,
  textoIdadeGestacional,
} from "@/modules/crm/pipeline/idade-gestacional";
import {
  quandoEmFrase,
  ROTULO_STATUS,
  VARIANTE_STATUS,
} from "@/modules/crm/sessao-venda/agenda";
import { EditorResumo } from "@/modules/crm/sessao-venda/componentes/editor-resumo";
import { FormularioAgendar } from "@/modules/crm/sessao-venda/componentes/formulario-agendar";
import { PainelDesfecho } from "@/modules/crm/sessao-venda/componentes/painel-desfecho";
import { PainelGravacao } from "@/modules/crm/sessao-venda/componentes/painel-gravacao";
import {
  lerGravacaoTela,
  listarCondutoresTela,
  obterSessaoTela,
  obterTermoGravacao,
  podeConduzirAgenda,
  resumoIaLigado,
} from "@/modules/crm/sessao-venda/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = {
  title: "Conversa de orientação · Kraamzorg OS",
};

type Pesquisa = Record<string, string | string[] | undefined>;

const FEITO: Record<string, string> = {
  marcada:
    "Conversa marcada. A família passou para Sessão agendada no pipeline e o lembrete da véspera já está nas tarefas.",
  remarcada:
    "Conversa remarcada. O lembrete antigo saiu das tarefas e o novo entrou com a data certa.",
};

/**
 * Uma conversa de orientação (P29): quando, com quem, o link, como foi e,
 * para quem conduziu e para a diretoria, o consentimento, a transcrição e
 * o resumo. Para os demais, a gravação nem é lida do banco.
 */
export default async function PaginaSessaoVenda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Pesquisa>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const usuario = await exigirSessao("/sessoes-venda");
  const pesquisa = await searchParams;
  const feito =
    typeof pesquisa.feito === "string" ? FEITO[pesquisa.feito] : null;

  const sessao = await obterSessaoTela(id);
  if (!sessao) notFound();

  const podeMexer = podeConduzirAgenda(usuario);
  const sensivel =
    sessao.estadoSensivel === "bloqueio_total" ||
    sessao.estadoSensivel === "encerrado_sensivel";
  const agora = new Date();
  const hoje = hojeBrasilia(agora);
  const jaPassou = sessao.agendadaPara
    ? Date.parse(sessao.agendadaPara) <= agora.getTime()
    : true;
  const gravavel =
    sessao.status === "agendada" || sessao.status === "realizada";

  const [leitura, condutores, termo] = await Promise.all([
    gravavel
      ? lerGravacaoTela(sessao, usuario).catch(() => null)
      : Promise.resolve(null),
    podeMexer && sessao.status === "agendada" && !sensivel
      ? listarCondutoresTela().catch(() => [])
      : Promise.resolve([]),
    obterTermoGravacao(),
  ]);

  const tempo = sensivel
    ? null
    : textoIdadeGestacional(sessao.dpp, hoje, sessao.dataNascimento);

  return (
    <>
      <Link
        href="/sessoes-venda"
        className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Sessões de venda
      </Link>

      <div className="flex flex-col gap-6 pt-2">
        <header className="bg-superficie-2 -mx-4 flex flex-col gap-3 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-titulo text-1 text-texto font-normal">
              {sessao.nomeFamilia}
            </h1>
            {sensivel ? (
              <Selo
                variante="sensivel"
                icone={<OctagonPause strokeWidth={1.75} />}
              >
                Freio acionado
              </Selo>
            ) : (
              <Selo variante={VARIANTE_STATUS[sessao.status]}>
                {ROTULO_STATUS[sessao.status]}
              </Selo>
            )}
          </div>
          <p className="text-3 text-texto">
            Conversa de orientação
            {sessao.agendadaPara
              ? ` ${quandoEmFrase(sessao.agendadaPara, agora)}`
              : ""}
            {sessao.conduzidaPorNome ? `, com ${sessao.conduzidaPorNome}` : ""}.
          </p>
          <div className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {tempo ? (
              <span className="text-corpo text-texto font-mono">{tempo}</span>
            ) : null}
            {sessao.opcoesInformadas ? (
              <span>A família tinha sugerido: {sessao.opcoesInformadas}.</span>
            ) : null}
          </div>
          {sessao.linkReuniao && sessao.status === "agendada" && !sensivel ? (
            <Botao
              asChild
              variante="secundario"
              tamanho="compacto"
              className="self-start"
            >
              <a
                href={sessao.linkReuniao}
                target="_blank"
                rel="noreferrer noopener"
              >
                Abrir o link da reunião
                <ExternalLink
                  className="size-4"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              </a>
            </Botao>
          ) : null}
        </header>

        {feito ? (
          <FaixaAlerta variante="sucesso" titulo={feito} anunciar />
        ) : null}

        {sensivel ? (
          <FaixaAlerta
            variante="sensivel"
            titulo="Esta família está com o freio acionado"
          >
            A conversa de venda fica parada. Nenhuma mensagem automática sai
            para a família; o contato é da coordenação, pelo nome.
          </FaixaAlerta>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {podeMexer && sessao.status === "agendada" && !sensivel ? (
            <section
              aria-labelledby="como-foi"
              className="flex min-w-0 flex-col gap-6"
            >
              <div className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5">
                <h2
                  id="como-foi"
                  className="font-titulo text-2 text-texto font-medium"
                >
                  {jaPassou ? "Como foi" : "Antes da conversa"}
                </h2>
                <PainelDesfecho sessaoId={sessao.id} jaPassou={jaPassou} />
              </div>
              <details className="rounded-3 bg-superficie shadow-1 group p-5">
                <summary className="font-titulo text-2 text-texto min-h-toque flex cursor-pointer items-center font-medium">
                  Remarcar
                </summary>
                <div className="pt-4">
                  <FormularioAgendar
                    modo="remarcar"
                    sessaoId={sessao.id}
                    condutores={condutores}
                    condutorAtual={sessao.conduzidaPor}
                    linkAtual={null}
                    hoje={hoje}
                  />
                </div>
              </details>
            </section>
          ) : null}

          {gravavel && !sensivel ? (
            <section
              aria-labelledby="gravacao"
              className="rounded-3 bg-superficie shadow-1 flex min-w-0 flex-col gap-4 p-5"
            >
              <h2
                id="gravacao"
                className="font-titulo text-2 text-texto font-medium"
              >
                Gravação e resumo
              </h2>
              {leitura === null ? (
                <FaixaAlerta
                  variante="erro"
                  titulo="A gravação não abriu agora"
                >
                  Recarregue a página. Nada foi alterado.
                </FaixaAlerta>
              ) : leitura.situacao === "fechada" ? (
                <p className="text-corpo text-texto-2 flex items-start gap-3">
                  <LockKeyhole
                    className="text-texto-2 mt-1 size-4 shrink-0"
                    aria-hidden="true"
                    strokeWidth={1.75}
                  />
                  A gravação, a transcrição e o resumo desta conversa ficam só
                  com quem conduziu e com a diretoria.
                </p>
              ) : leitura.situacao === "mfa" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-corpo text-texto">
                    A gravação pede o código do aplicativo (MFA) antes de abrir.
                  </p>
                  <Botao
                    asChild
                    variante="secundario"
                    tamanho="compacto"
                    className="self-start"
                  >
                    <Link
                      href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(`/sessoes-venda/${sessao.id}`)}`}
                    >
                      Confirmar com o código
                    </Link>
                  </Botao>
                </div>
              ) : (
                <>
                  <PainelGravacao
                    sessaoId={sessao.id}
                    gravacao={leitura.gravacao}
                    termo={termo}
                  />
                  {leitura.gravacao?.consentimento &&
                  leitura.gravacao.transcricao ? (
                    <div className="border-linha flex flex-col gap-4 border-t pt-5">
                      <h3 className="text-3 text-texto font-semibold">
                        Resumo da conversa
                      </h3>
                      <EditorResumo
                        sessaoId={sessao.id}
                        resumo={leitura.gravacao.resumo}
                        iaLigada={resumoIaLigado()}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
