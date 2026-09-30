import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { localidade } from "@/lib/formatacao";
import { papelPrincipal } from "@/lib/navegacao";
import { obterFreioDesfazerSegundos } from "@/modules/crm/ficha/dados";
import { obterConversaTela } from "@/modules/agente/conversa-detalhe/dados";
import { CabecalhoConversa } from "@/modules/agente/conversa-detalhe/componentes/cabecalho-conversa";
import { Compositor } from "@/modules/agente/conversa-detalhe/componentes/compositor";
import { FioMensagens } from "@/modules/agente/conversa-detalhe/componentes/fio-mensagens";
import {
  FaixaEstadoConversa,
  LinhaPausa,
  ResumoIsadora,
} from "@/modules/agente/conversa-detalhe/componentes/painel-resumo";
import { CorpoConversa } from "@/modules/agente/conversa-detalhe/componentes/corpo-conversa";
import { FaixaTransferencia } from "@/modules/agente/transferencias/componentes/faixa-transferencia";
import { obterTelefonePlantao } from "@/modules/agente/transferencias/dados";
import { DESTINO_DO_PAPEL } from "@/modules/agente/tipos";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Conversa · Kraamzorg OS" };

/**
 * Conversa aberta, ao lado da lista (pedido do dono em 30/09: "estilo
 * WhatsApp Web"). De cima para baixo: o cabeçalho da família (com o freio),
 * a transferência aberta e quem conduz a conversa, o resumo da Isadora,
 * as mensagens (rolagem própria, abrindo no fim) e o campo de resposta.
 * As ações são as de sempre: assumir, pausar, devolver, resolver, reenviar
 * o aviso, marcar como não lead. Dono: P27.
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
  const principal = papelPrincipal(sessao.papeis);
  const [freioDesfazerSegundos, telefonePlantao] = await Promise.all([
    ficha ? obterFreioDesfazerSegundos() : Promise.resolve(0),
    transferenciaAberta ? obterTelefonePlantao() : Promise.resolve(null),
  ]);
  const comFreio = conversa.situacao === "freio";

  return (
    <section
      aria-label={`Conversa com ${nome}`}
      className="lg:rounded-3 lg:shadow-1 flex h-full min-h-0 flex-col overflow-hidden"
    >
      <CabecalhoConversa
        nome={nome}
        familiaId={conversa.familiaId}
        estadoSensivel={ficha?.estadoSensivel ?? "normal"}
        podeReverter={podeReverterFreio}
        freioDesfazerSegundos={freioDesfazerSegundos}
        ig={ficha?.idadeGestacional ?? null}
        lugar={ficha ? localidade(ficha.bairro, ficha.cidade) : null}
        situacao={conversa.situacao}
        motivoEncerramento={conversa.agenteEncerradoMotivo}
        conversa={{
          id: conversa.id,
          nomeContato: conversa.nomeContato ?? nome,
          podePausar: conversa.situacao === "isadora",
          podeTriar:
            conversa.situacao === "isadora" || conversa.situacao === "pausada",
        }}
      />

      {/* O que pede a equipe vem no topo: a transferência aberta (faixa)
          e quem conduz a conversa. No computador fica preso embaixo do
          cabeçalho; no celular rola junto com as mensagens (CorpoConversa). */}
      <CorpoConversa
        quantidade={mensagens.length}
        comecarNoTopo={Boolean(transferenciaAberta)}
        topo={
          <>
            {transferenciaAberta ? (
              <FaixaTransferencia
                transferencia={transferenciaAberta}
                conversaId={conversa.id}
                usuarioId={sessao.usuarioId}
                destinoDoPapel={
                  principal ? DESTINO_DO_PAPEL[principal] : undefined
                }
                telefonePlantao={telefonePlantao}
                rodape={
                  conversa.situacao === "pausada" ? (
                    <LinhaPausa
                      pausaMotivo={conversa.pausaMotivo}
                      pausadoAte={conversa.agentePausadoAte}
                    />
                  ) : null
                }
              />
            ) : null}
            <FaixaEstadoConversa
              conversa={conversa}
              comTransferencia={Boolean(transferenciaAberta)}
              horasPausaHumano={horasPausaHumano}
              textoNaoLead={textoNaoLead}
              ficha={ficha}
            />
          </>
        }
      >
        {/* O resumo da Isadora abre o histórico, como o cartão de
            apresentação no começo de uma conversa do WhatsApp. Com o
            freio, o resumo comercial sai da tela (DESIGN.md, 11.8). */}
        {ficha && !comFreio ? (
          <div className="mx-auto mb-3 w-full max-w-xl">
            <ResumoIsadora ficha={ficha} />
          </div>
        ) : null}
        <FioMensagens mensagens={mensagens} />
      </CorpoConversa>

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
  );
}
