import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { exigirSessao } from "@/lib/auth/sessao";
import { localidade } from "@/lib/formatacao";
import { papelPrincipal } from "@/lib/navegacao";
import {
  obterFichaTela,
  obterFreioDesfazerSegundos,
} from "@/modules/crm/ficha/dados";
import { CabecalhoConversa } from "@/modules/agente/conversa-detalhe/componentes/cabecalho-conversa";
import { FaixaTransferencia } from "@/modules/agente/transferencias/componentes/faixa-transferencia";
import {
  listarFilaTela,
  obterTelefonePlantao,
} from "@/modules/agente/transferencias/dados";
import { DESTINO_DO_PAPEL } from "@/modules/agente/tipos";

export const metadata: Metadata = { title: "Transferência · Kraamzorg OS" };

/**
 * Pedido que a Isadora passou para a equipe sem conversa do WhatsApp
 * ligada (`handoff.conversa_id` nulo): abre ao lado da lista como uma
 * conversa, com a mesma faixa e as mesmas ações da antiga fila (assumir,
 * marcar na agenda, reenviar o aviso, encerrar). Sem mensagens e sem campo
 * de resposta: o caminho segue pela ficha da família. Dono: P27.
 */
export default async function PaginaPedidoSemConversa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const sessao = await exigirSessao("/conversas");
  const fila = await listarFilaTela();
  const transferencia = fila.find((t) => t.id === id && !t.conversaId);
  if (!transferencia) {
    // Encerrado agora há pouco (ou por outra pessoa): sai da fila e da lista.
    return (
      <section
        aria-labelledby="t-pedido-encerrado"
        className="bg-superficie lg:rounded-3 lg:shadow-1 flex h-full flex-col items-start gap-3 p-6"
      >
        <h2
          id="t-pedido-encerrado"
          className="font-titulo text-2 text-texto font-medium"
        >
          Este pedido não está mais aberto
        </h2>
        <p className="text-corpo text-texto-2">
          Ele foi encerrado há pouco e saiu de Esperando alguém. Nada mais
          precisa ser feito aqui.
        </p>
        <Botao asChild variante="secundario" tamanho="compacto">
          <Link href="/conversas?filtro=esperando">Ver quem espera</Link>
        </Botao>
      </section>
    );
  }

  const [ficha, freioDesfazerSegundos, telefonePlantao] = await Promise.all([
    transferencia.familiaId
      ? obterFichaTela(transferencia.familiaId)
      : Promise.resolve(null),
    transferencia.familiaId ? obterFreioDesfazerSegundos() : Promise.resolve(0),
    obterTelefonePlantao(),
  ]);
  const nome = transferencia.nomeFamilia ?? "Contato sem família";
  const principal = papelPrincipal(sessao.papeis);

  return (
    <section
      aria-label={`Transferência de ${nome}`}
      className="lg:rounded-3 lg:shadow-1 bg-fundo flex h-full min-h-0 flex-col overflow-hidden"
    >
      <CabecalhoConversa
        nome={nome}
        familiaId={transferencia.familiaId}
        estadoSensivel={ficha?.estadoSensivel ?? "normal"}
        podeReverter={
          sessao.papeis.includes("coordenacao") ||
          sessao.papeis.includes("diretoria")
        }
        freioDesfazerSegundos={freioDesfazerSegundos}
        ig={ficha?.idadeGestacional ?? null}
        lugar={ficha ? localidade(ficha.bairro, ficha.cidade) : null}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 lg:px-4">
        <FaixaTransferencia
          transferencia={transferencia}
          conversaId={null}
          usuarioId={sessao.usuarioId}
          destinoDoPapel={principal ? DESTINO_DO_PAPEL[principal] : undefined}
          telefonePlantao={telefonePlantao}
        />
        <div className="bg-superficie border-linha rounded-3 flex flex-col items-start gap-3 border p-4">
          <h3 className="text-3 text-texto font-semibold">
            Sem conversa do WhatsApp ligada
          </h3>
          <p className="text-apoio text-texto-2">
            Este pedido chegou sem uma conversa ligada a ele. Siga pela ficha da
            família: lá estão as outras conversas, os contatos e o que a Isadora
            já anotou.
          </p>
          {transferencia.familiaId ? (
            <Botao asChild variante="secundario" tamanho="compacto">
              <Link href={`/familias/${transferencia.familiaId}`}>
                Abrir a ficha da família
              </Link>
            </Botao>
          ) : null}
        </div>
      </div>
    </section>
  );
}
