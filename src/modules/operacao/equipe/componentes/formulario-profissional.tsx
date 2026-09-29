"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaMultipla } from "@/components/ui/escolha-multipla";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { Regiao } from "@/lib/dados/tipos";
import type { ProfissionalEquipe } from "@/lib/dados/tipos-equipe";
import { acaoSalvarProfissional } from "../acoes";
import { estadoInicialEquipe } from "../estado-acoes";
import { ROTULO_FUNCAO, ROTULO_VINCULO } from "../textos";
import { textoDeCentavos } from "../valores";

/**
 * Cadastro da profissional (P37 item 1): conselho e UF, regiões, vínculo,
 * valor da hora e ajuda de deslocamento (em reais na tela, centavos no
 * banco). Salvar leva ao cadastro da profissional com a confirmação. O
 * acesso ao portal (usuário) é ligado pela diretoria; aqui a ligação que já
 * existe só é preservada.
 */
export function FormularioProfissional({
  profissional,
  regioes,
}: {
  profissional?: ProfissionalEquipe;
  regioes: Regiao[];
}) {
  const [estado, acao, enviando] = useActionState(
    acaoSalvarProfissional,
    estadoInicialEquipe,
  );
  const campos = estado.campos ?? {};
  const novo = !profissional;

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      {profissional ? (
        <input type="hidden" name="id" value={profissional.id} />
      ) : null}
      {profissional?.usuarioId ? (
        <input type="hidden" name="usuarioId" value={profissional.usuarioId} />
      ) : null}

      <CampoTexto
        rotulo="Nome"
        name="nome"
        defaultValue={profissional?.nome}
        autoComplete="off"
        required
        erro={campos.nome}
      />

      <EscolhaUnica
        rotulo="Função"
        name="funcao"
        valorPadrao={profissional?.funcao ?? "enfermeira_obstetrica"}
        opcoes={Object.entries(ROTULO_FUNCAO).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
        descricao={campos.funcao}
      />

      <EscolhaUnica
        rotulo="Vínculo"
        name="vinculo"
        valorPadrao={profissional?.vinculo ?? "a_definir"}
        opcoes={Object.entries(ROTULO_VINCULO).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
        descricao={campos.vinculo}
      />

      <div className="tablet:grid-cols-[120px_minmax(0,1fr)] grid grid-cols-1 gap-5">
        <CampoTexto
          rotulo="Estado do conselho"
          name="conselhoUf"
          defaultValue={profissional?.conselhoUf ?? undefined}
          maxLength={2}
          autoCapitalize="characters"
          placeholder="SP"
          opcional
          erro={campos.conselhoUf}
        />
        <CampoTexto
          rotulo="Número do COREN"
          name="conselhoNumero"
          defaultValue={profissional?.conselhoNumero ?? undefined}
          autoComplete="off"
          opcional
          erro={campos.conselhoNumero}
        />
      </div>

      <CampoTexto
        rotulo="Telefone com DDD"
        name="telefone"
        type="tel"
        inputMode="tel"
        defaultValue={profissional?.telefoneE164 ?? undefined}
        placeholder="+5511900000000"
        opcional
        erro={campos.telefone}
        descricao="Com o + e o código do país, sem espaços."
      />

      <EscolhaMultipla
        rotulo="Regiões em que atende"
        name="regioes"
        valoresPadrao={profissional?.regioes ?? []}
        opcoes={regioes.map((r) => ({ valor: r.id, rotulo: r.nome }))}
        erro={campos.regioes}
      />

      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-5">
        <CampoTexto
          rotulo="Valor da hora (R$)"
          name="valorHora"
          inputMode="decimal"
          defaultValue={textoDeCentavos(profissional?.valorHoraCentavos)}
          opcional
          erro={campos.valorHora}
        />
        <CampoTexto
          rotulo="Ajuda de deslocamento (R$)"
          name="adicionalDeslocamento"
          inputMode="decimal"
          defaultValue={textoDeCentavos(
            profissional?.adicionalDeslocamentoCentavos ?? 0,
          )}
          opcional
          erro={campos.adicionalDeslocamento}
        />
      </div>

      <EscolhaUnica
        rotulo="Situação"
        name="ativa"
        valorPadrao={profissional && !profissional.ativa ? "nao" : "sim"}
        opcoes={[
          { valor: "sim", rotulo: "Ativa" },
          { valor: "nao", rotulo: "Inativa" },
        ]}
        descricao="Inativa deixa de receber visitas e perde o acesso ao portal na hora."
      />

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}

      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Salvando"
        largaTotal
        className="tablet:w-auto self-start"
      >
        {novo ? "Cadastrar a profissional" : "Salvar o cadastro"}
      </Botao>
    </form>
  );
}
