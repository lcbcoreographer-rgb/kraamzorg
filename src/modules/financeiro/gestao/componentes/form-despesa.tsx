"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type Despesa,
  type OrigemLead,
} from "@/lib/dados/tipos-gestao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { centavosParaCampo } from "../../cobrancas/valor";
import { acaoSalvarDespesa } from "../acoes";
import { estadoInicialGestao } from "../estado-acoes";
import { ROTULO_CATEGORIA, ROTULO_ORIGEM } from "../textos";
import { useAcaoGestao } from "../use-acao";

const CANAIS: OrigemLead[] = [
  "meta_ads",
  "google",
  "instagram_organico",
  "site",
  "indicacao_medica",
  "indicacao_cliente",
  "indicacao_amigo",
  "presente",
  "evento",
  "outro",
];

/**
 * Lançar ou corrigir uma despesa paga (P46 item 1). Data até hoje, categoria
 * da lista, valor em reais que vira centavos, e o canal só quando a despesa é
 * de marketing e anúncios (é dele que sai o custo por canal do painel).
 */
export function FormDespesa({
  hoje,
  despesa,
  voltarPara,
}: {
  hoje: string;
  /** Presente quando é uma correção. */
  despesa?: Despesa;
  voltarPara: string;
}) {
  const { estado, enviar, pendente } = useAcaoGestao(
    acaoSalvarDespesa,
    estadoInicialGestao,
  );
  const [categoria, definirCategoria] = React.useState<CategoriaDespesa>(
    despesa?.categoria ?? "outros",
  );
  const campos = estado.campos ?? {};

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {despesa ? <input type="hidden" name="id" value={despesa.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          rotulo="Dia do pagamento"
          name="data"
          type="date"
          max={hoje}
          required
          defaultValue={despesa?.data ?? hoje}
          erro={campos.data}
        />
        <CampoTexto
          rotulo="Valor em reais"
          name="valor"
          inputMode="decimal"
          required
          placeholder="1.250,00"
          defaultValue={despesa ? centavosParaCampo(despesa.valorCentavos) : ""}
          erro={campos.valor}
        />
        <CampoSelecao
          rotulo="Categoria"
          name="categoria"
          value={categoria}
          onChange={(e) => definirCategoria(e.target.value as CategoriaDespesa)}
          opcoes={CATEGORIAS_DESPESA.map((c) => ({
            valor: c,
            rotulo: ROTULO_CATEGORIA[c],
          }))}
          erro={campos.categoria}
        />
        {categoria === "marketing_anuncios" ? (
          <CampoSelecao
            rotulo="Canal"
            name="canal"
            opcional
            opcaoVazia="Sem canal específico"
            defaultValue={despesa?.canal ?? ""}
            descricao="O canal a que o gasto se refere. É ele que aparece no custo por canal do painel."
            opcoes={CANAIS.map((c) => ({ valor: c, rotulo: ROTULO_ORIGEM[c] }))}
            erro={campos.canal}
          />
        ) : null}
        <CampoTexto
          rotulo="O que foi pago"
          name="descricao"
          required
          maxLength={200}
          defaultValue={despesa?.descricao ?? ""}
          erro={campos.descricao}
          containerClassName="sm:col-span-2"
        />
        <CampoTexto
          rotulo="Fornecedor"
          name="fornecedor"
          opcional
          maxLength={120}
          defaultValue={despesa?.fornecedor ?? ""}
          containerClassName="sm:col-span-2"
        />
      </div>

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <p
          role="status"
          className="text-corpo text-sucesso flex items-start gap-2 font-medium"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {estado.sucesso}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Botao
          type="submit"
          carregando={pendente}
          rotuloCarregando={despesa ? "Salvando" : "Lançando"}
        >
          {despesa ? "Salvar a correção" : "Lançar despesa"}
        </Botao>
        {despesa ? (
          <Link
            href={voltarPara}
            className="text-texto text-apoio font-semibold underline decoration-1 underline-offset-4"
          >
            Cancelar a correção
          </Link>
        ) : null}
      </div>
    </form>
  );
}
