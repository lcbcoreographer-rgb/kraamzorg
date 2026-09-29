import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { exigirSessao } from "@/lib/auth/sessao";
import { CabecalhoFicha } from "@/modules/crm/ficha/componentes/cabecalho-ficha";
import {
  datasDoCabecalho,
  MetaFicha,
} from "@/modules/crm/ficha/componentes/meta-ficha";
import { obterFreioDesfazerSegundos } from "@/modules/crm/ficha/dados";
import { obterConversaTela } from "@/modules/agente/conversa-detalhe/dados";
import { Compositor } from "@/modules/agente/conversa-detalhe/componentes/compositor";
import { FioMensagens } from "@/modules/agente/conversa-detalhe/componentes/fio-mensagens";
import {
  FaixaEstadoConversa,
  PainelResumo,
} from "@/modules/agente/conversa-detalhe/componentes/painel-resumo";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Conversa · Kraamzorg OS" };

/**
 * Conversa com a família (P27 item 1, protótipo `comercial-conversa.html`,
 * C2): mensagens, painel de resumo, pausar e retomar a Isadora, assumir e
 * resolver a transferência, marcar como não lead, abrir a ficha. Dono: P27.
 */
export default async function PaginaConversa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const sessao = await exigirSessao("/conversas");
  const tela = await obterConversaTela(id);
  if (!tela) notFound();

  const {
    conversa,
    mensagens,
    transferenciaAberta,
    ficha,
    formularioContrato,
    comercialRespondeNoApp,
    horasPausaHumano,
    textoNaoLead,
  } = tela;
  const nome =
    conversa.nomeFamilia ??
    conversa.nomeContato ??
    conversa.telefoneE164 ??
    "Contato";
  const podeReverterFreio =
    sessao.papeis.includes("coordenacao") ||
    sessao.papeis.includes("diretoria");

  return (
    <>
      <header className="flex items-center gap-2 pb-2">
        <Botao asChild variante="icone" aria-label="Voltar para as conversas">
          <Link href="/conversas">
            <ArrowLeft
              aria-hidden="true"
              className="size-5"
              strokeWidth={1.75}
            />
          </Link>
        </Botao>
        {!ficha ? (
          <h1 className="font-titulo text-2 text-texto">{nome}</h1>
        ) : null}
      </header>

      {ficha ? (
        <CabecalhoFicha
          familiaId={ficha.familiaId}
          nome={ficha.nome}
          meta={<MetaFicha ficha={ficha} />}
          datas={datasDoCabecalho(ficha)}
          estadoSensivelInicial={ficha.estadoSensivel}
          estadoSensivelEmInicial={ficha.estadoSensivelEm}
          podeReverter={podeReverterFreio}
          freioDesfazerSegundos={await obterFreioDesfazerSegundos()}
        />
      ) : null}

      {/* Ordem humana (DESIGN.md, 11.5). Celular: a faixa de estado logo
          abaixo do cabeçalho, depois o que a família disse, e o resumo com
          as ações por último. Computador: mensagens à esquerda; faixa,
          resumo e ações na coluna da direita. A ordem no DOM é a do
          celular, para o foco do teclado bater com o que se vê. */}
      <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-x-6">
        <div className="lg:col-start-2 lg:row-start-1">
          <FaixaEstadoConversa
            conversa={conversa}
            transferenciaAberta={transferenciaAberta}
            horasPausaHumano={horasPausaHumano}
            textoNaoLead={textoNaoLead}
          />
        </div>

        <section
          aria-label={`Conversa no WhatsApp com ${nome}`}
          className="flex flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1"
        >
          <FioMensagens mensagens={mensagens} />
          <Compositor
            conversaId={conversa.id}
            familiaId={conversa.familiaId}
            telefoneE164={conversa.telefoneE164}
            nomeContato={conversa.nomeContato ?? nome}
            formularioContrato={formularioContrato}
            comercialRespondeNoApp={comercialRespondeNoApp}
            freioAtivo={Boolean(ficha && ficha.estadoSensivel !== "normal")}
            ofereceTextoComercial={
              conversa.situacao !== "nao_lead" && conversa.situacao !== "freio"
            }
          />
        </section>

        <div className="lg:col-start-2 lg:row-start-2">
          <PainelResumo
            conversa={conversa}
            ficha={ficha}
            transferenciaAberta={transferenciaAberta}
          />
        </div>
      </div>
    </>
  );
}
