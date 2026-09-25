"use client";

import * as React from "react";
import doc1 from "../../../../supabase/dados/instrumentos/doc1.json";
import doc2 from "../../../../supabase/dados/instrumentos/doc2.json";
import doc3 from "../../../../supabase/dados/instrumentos/doc3.json";
import doc4 from "../../../../supabase/dados/instrumentos/doc4.json";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { SimNao } from "@/components/ui/sim-nao";
import { FormularioInstrumento } from "@/components/instrumentos";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import { criarPersistenciaEmMemoria } from "@/lib/instrumentos/persistencia";

const DEFINICOES = {
  doc1: lerDefinicao(doc1),
  doc2: lerDefinicao(doc2),
  doc3: lerDefinicao(doc3),
  doc4: lerDefinicao(doc4),
};
type ChaveDoc = keyof typeof DEFINICOES;

const BEBES_FICTICIOS = [
  { id: "bebe-1", rotulo: "Bebê 1" },
  { id: "bebe-2", rotulo: "Bebê 2" },
];

export function VitrineInstrumentos() {
  const [doc, definirDoc] = React.useState<ChaveDoc>("doc2");
  const [gemelar, definirGemelar] = React.useState<"sim" | "nao">("sim");
  const [ultimoDia, definirUltimoDia] = React.useState<"sim" | "nao">("nao");
  const chave = `${doc}-${gemelar}-${ultimoDia}`;
  const persistencia = React.useMemo(
    () => criarPersistenciaEmMemoria(),
    // Nova persistência a cada troca de cenário (o formulário também remonta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave],
  );

  return (
    <main className="mx-auto flex w-full max-w-[40rem] flex-col gap-4 pb-8">
      <header className="flex flex-col gap-3 px-4 pt-8">
        <p className="text-mini text-texto-2 font-mono">
          /design-system/instrumentos · fora do ar em produção
        </p>
        <h1 className="font-titulo text-display text-texto">Instrumentos v1</h1>
        <p className="text-corpo text-texto-2">
          Formulário gerado da definição JSON, com dados fictícios. Nada é
          gravado fora desta tela.
        </p>
        <EscolhaUnica
          rotulo="Instrumento"
          name="instrumento"
          valor={doc}
          onMudar={(v) => definirDoc(v as ChaveDoc)}
          opcoes={(Object.keys(DEFINICOES) as ChaveDoc[]).map((k) => ({
            valor: k,
            rotulo: DEFINICOES[k].titulo,
          }))}
        />
        {doc === "doc2" ? (
          <>
            <SimNao
              pergunta="Gemelar"
              name="gemelar"
              rotuloSim="Sim"
              rotuloNao="Não"
              valor={gemelar}
              onMudar={definirGemelar}
            />
            <SimNao
              pergunta="Último dia"
              name="ultimo-dia"
              rotuloSim="Sim"
              rotuloNao="Não"
              valor={ultimoDia}
              onMudar={definirUltimoDia}
            />
          </>
        ) : null}
      </header>

      <FormularioInstrumento
        key={chave}
        definicao={DEFINICOES[doc]}
        persistencia={persistencia}
        bebes={
          gemelar === "sim" ? BEBES_FICTICIOS : BEBES_FICTICIOS.slice(0, 1)
        }
        contexto={{ ultimo_dia: ultimoDia === "sim" }}
        valoresAutomaticos={{ "B.coletador": "Coordenação Teste" }}
      />
    </main>
  );
}
