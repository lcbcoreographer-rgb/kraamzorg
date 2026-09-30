"use client";

import * as React from "react";
import { MantaDobrada } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { Oferta } from "@/lib/dados/tipos-operacao";
import { CartaoOferta } from "./cartao-oferta";

/**
 * Lista de ofertas da enfermeira. Depois que ela responde, o servidor deixa
 * de listar a oferta; o cartão respondido fica na tela com o resultado (o
 * que aconteceu com a família) até ela sair, para a resposta não sumir sem
 * aviso. A próxima abertura da tela já vem só com as pendentes.
 */
export function ListaOfertas({ ofertas }: { ofertas: Oferta[] }) {
  const [respondidas, definirRespondidas] = React.useState<Oferta[]>([]);

  const marcar = React.useCallback((oferta: Oferta) => {
    definirRespondidas((atuais) =>
      atuais.some((o) => o.designacaoId === oferta.designacaoId)
        ? atuais
        : [...atuais, oferta],
    );
  }, []);

  const visiveis = [
    ...ofertas,
    ...respondidas.filter(
      (r) => !ofertas.some((o) => o.designacaoId === r.designacaoId),
    ),
  ];

  if (visiveis.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        ilustracao={<MantaDobrada tamanho={112} />}
        titulo="Nenhuma oferta esperando resposta"
        texto="Quando a coordenação oferecer uma família, ela aparece aqui com o prazo para você responder."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {visiveis.map((o) => (
        <li key={o.designacaoId}>
          <CartaoOferta oferta={o} aoResponder={marcar} />
        </li>
      ))}
    </ul>
  );
}
