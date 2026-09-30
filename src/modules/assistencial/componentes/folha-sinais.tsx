"use client";

import * as React from "react";
import { PhoneCall } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoRodape,
} from "@/components/ui/dialogo";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import {
  linkDeLigacao,
  tituloDoAchado,
  varianteDaFaixa,
  type SinalDoSeletor,
} from "@/lib/checklist/alertas";
import { textos } from "../checklist/textos";

/**
 * Seletor dos sinais do DOC 3 que não têm campo no checklist (PRD 9.3, K-07,
 * P40 item 2): "Registrar outro sinal de alerta", fixo no rodapé de toda
 * etapa. A lista vem de `regra_alerta` (sinais sem campo avaliável no DOC 2)
 * e fica desligada até a coordenação clínica validá-la: enquanto o
 * parâmetro `seletor_sinais_doc3_ativo` for falso, a folha só manda ligar
 * para a supervisão médica. Escolhido o sinal, a conduta aprovada aparece
 * na hora; registrar cria o alerta como qualquer outro (coordenação avisada
 * quando houver sinal, ocorrência privada se for saúde mental imediata).
 */
export interface FolhaSinaisProps {
  aberto: boolean;
  aoFechar: () => void;
  ativo: boolean;
  telefone: string;
  sinais: SinalDoSeletor[];
  /** Bebês da visita, para os sinais do recém-nascido. */
  bebes: { id: string; rotulo: string }[];
  familiaSensivel: boolean;
  aoRegistrar: (
    sinal: SinalDoSeletor,
    bebeId: string | null,
    observacao: string | null,
  ) => "registrado" | "ja_registrado";
}

export function FolhaSinais({
  aberto,
  aoFechar,
  ativo,
  telefone,
  sinais,
  bebes,
  familiaSensivel,
  aoRegistrar,
}: FolhaSinaisProps) {
  const link = linkDeLigacao(telefone);
  return (
    <Dialogo open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      <DialogoConteudo
        titulo={textos.seletor.titulo}
        descricao={ativo ? textos.seletor.ajuda : undefined}
        rotuloFechar={textos.alerta.fecharJanela}
      >
        {ativo ? (
          <Seletor
            sinais={sinais}
            bebes={bebes}
            familiaSensivel={familiaSensivel}
            telefone={telefone}
            aoRegistrar={aoRegistrar}
            aoFechar={aoFechar}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <FaixaAlerta
              variante="info"
              titulo={textos.seletor.desligadoTitulo}
            >
              {textos.seletor.desligadoTexto}
            </FaixaAlerta>
            {link ? (
              <Botao asChild variante="perigo">
                <a href={link}>
                  <PhoneCall className="size-[18px]" aria-hidden="true" />
                  {textos.alerta.ligar}
                </a>
              </Botao>
            ) : null}
          </div>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
}

function Seletor({
  sinais,
  bebes,
  familiaSensivel,
  telefone,
  aoRegistrar,
  aoFechar,
}: Pick<
  FolhaSinaisProps,
  | "sinais"
  | "bebes"
  | "familiaSensivel"
  | "telefone"
  | "aoRegistrar"
  | "aoFechar"
>) {
  const [codigo, definirCodigo] = React.useState<string | undefined>();
  const [bebeId, definirBebeId] = React.useState<string | undefined>(
    bebes.length === 1 ? bebes[0]?.id : undefined,
  );
  const [observacao, definirObservacao] = React.useState("");
  const [aviso, definirAviso] = React.useState<string | null>(null);
  const link = linkDeLigacao(telefone);

  const sinal = sinais.find((s) => s.regraId === codigo);
  const deBebe = sinal?.grupo === "recem_nascido";
  const grupos = Array.from(new Set(sinais.map((s) => s.grupo)));

  function registrar() {
    if (!sinal) {
      definirAviso(textos.seletor.escolha);
      return;
    }
    const resultado = aoRegistrar(
      sinal,
      deBebe ? (bebeId ?? null) : null,
      observacao || null,
    );
    if (resultado === "ja_registrado") {
      definirAviso(textos.seletor.jaRegistrado);
      return;
    }
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <EscolhaUnica
          key={grupo}
          rotulo={textos.seletor.grupos[grupo] ?? grupo}
          name={`sinal-${grupo}`}
          valor={sinal?.grupo === grupo ? codigo : undefined}
          onMudar={(v) => {
            definirCodigo(v);
            definirAviso(null);
          }}
          opcoes={sinais
            .filter((s) => s.grupo === grupo)
            .map((s) => ({
              valor: s.regraId,
              rotulo: (
                <span className="flex flex-col py-1 text-left">
                  <span>
                    <span className="mr-2 font-mono text-[0.9em]">
                      {s.regraId}
                    </span>
                    {s.descricao}
                  </span>
                </span>
              ),
            }))}
        />
      ))}

      {sinal ? (
        <FaixaAlerta
          variante={varianteDaFaixa(sinal.severidade, familiaSensivel)}
          codigo={sinal.regraId}
          titulo={tituloDoAchado(sinal.descricao, null)}
          anunciar={false}
          acoes={
            link ? (
              <Botao asChild variante="secundario" tamanho="compacto">
                <a href={link}>
                  <PhoneCall className="size-[18px]" aria-hidden="true" />
                  {textos.alerta.ligar}
                </a>
              </Botao>
            ) : null
          }
        >
          {sinal.conduta}
        </FaixaAlerta>
      ) : null}

      {sinal && deBebe && bebes.length > 1 ? (
        <EscolhaUnica
          rotulo={textos.seletor.bebe}
          name="sinal-bebe"
          valor={bebeId}
          onMudar={definirBebeId}
          opcoes={bebes.map((b) => ({ valor: b.id, rotulo: b.rotulo }))}
        />
      ) : null}

      {sinal ? (
        <CampoTexto
          id="sinal-observacao"
          rotulo={textos.seletor.observacao}
          multilinha
          linhas={2}
          value={observacao}
          onChange={(e) => definirObservacao(e.target.value)}
        />
      ) : null}

      {aviso ? (
        <p className="text-apoio text-aviso-texto font-medium" role="status">
          {aviso}
        </p>
      ) : null}

      <DialogoRodape>
        <Botao variante="secundario" onClick={aoFechar}>
          {textos.alerta.fecharJanela}
        </Botao>
        <Botao onClick={registrar}>{textos.seletor.registrar}</Botao>
      </DialogoRodape>
    </div>
  );
}
