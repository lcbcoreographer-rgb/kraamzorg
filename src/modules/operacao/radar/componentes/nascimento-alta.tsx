"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { CampoNumero } from "@/components/ui/campo-numero";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EscolhaUnica } from "@/components/ui/escolha-unica";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { EstadoAcaoOperacao } from "../../comum/estado-acoes";
import { estadoInicialOperacao } from "../../comum/estado-acoes";
import { useAcao } from "../../comum/use-acao";
import {
  acaoRegistrarAlta,
  acaoRegistrarNascimento,
  acaoRegistrarPrevisaoAlta,
} from "../acoes";

/** Sexo e tipo de parto: lista fechada do cadastro do nascimento (P36 item 4). */
const OPCOES_SEXO = [
  { valor: "feminino", rotulo: "Feminino" },
  { valor: "masculino", rotulo: "Masculino" },
  { valor: "nao_informado", rotulo: "Não informado" },
];
const OPCOES_PARTO = [
  { valor: "vaginal", rotulo: "Vaginal" },
  { valor: "cesarea", rotulo: "Cesárea" },
  { valor: "nao_informado", rotulo: "Não informado" },
];

function Retorno({ estado }: { estado: EstadoAcaoOperacao }) {
  return (
    <>
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
      ) : null}
    </>
  );
}

function CamposBebe({
  n,
  titulo,
  campos,
}: {
  n: number;
  titulo?: string;
  campos: Record<string, string>;
}) {
  return (
    <fieldset className="border-linha rounded-3 flex flex-col gap-4 border p-4">
      {titulo ? (
        <legend className="text-apoio text-texto px-1 font-semibold">
          {titulo}
        </legend>
      ) : null}
      <CampoNumero
        rotulo="Peso ao nascer"
        unidade="g"
        name={`peso${n}`}
        opcional
        placeholder="3200"
        erro={campos[`peso${n}`]}
      />
      <EscolhaUnica
        rotulo="Sexo"
        name={`sexo${n}`}
        opcoes={OPCOES_SEXO}
        valorPadrao="nao_informado"
      />
      <EscolhaUnica
        rotulo="Tipo de parto"
        name={`parto${n}`}
        opcoes={OPCOES_PARTO}
        valorPadrao="nao_informado"
      />
    </fieldset>
  );
}

/**
 * Registro do nascimento (P36 item 4). A data é um fato e nunca fica depois
 * de hoje; a data provável do parto não muda. Depois de registrar, a agenda
 * é recalculada e a operação é avisada.
 */
export function FormularioNascimento({
  familiaId,
  gemelarNoCadastro,
  hoje,
}: {
  familiaId: string;
  gemelarNoCadastro: boolean;
  /** "aaaa-mm-dd" em Brasília. */
  hoje: string;
}) {
  const {
    estado,
    enviar: acao,
    pendente: enviando,
  } = useAcao(acaoRegistrarNascimento, estadoInicialOperacao);
  const [gemelar, definirGemelar] = React.useState(gemelarNoCadastro);
  const campos = estado.campos ?? {};

  return (
    <form
      onSubmit={acao}
      noValidate
      className="flex flex-col gap-4"
      data-form="nascimento"
    >
      <input type="hidden" name="familiaId" value={familiaId} />
      <input type="hidden" name="gemelar" value={gemelar ? "sim" : "nao"} />
      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-4">
        <CampoTexto
          rotulo="Data do nascimento"
          name="dataNascimento"
          type="date"
          max={hoje}
          required
          erro={campos.dataNascimento}
        />
        <CampoTexto
          rotulo="Previsão de alta"
          name="previsaoAlta"
          type="date"
          min={hoje}
          opcional
          descricao="Estimativa. A alta de fato é registrada depois."
          erro={campos.previsaoAlta}
        />
      </div>
      <EscolhaUnica
        rotulo="Quantos bebês"
        name="quantosBebes"
        opcoes={[
          { valor: "1", rotulo: "Um bebê" },
          { valor: "2", rotulo: "Gêmeos" },
        ]}
        valor={gemelar ? "2" : "1"}
        onMudar={(v) => definirGemelar(v === "2")}
      />
      <CamposBebe
        n={1}
        titulo={gemelar ? "Primeiro bebê" : undefined}
        campos={campos}
      />
      {gemelar ? (
        <CamposBebe n={2} titulo="Segundo bebê" campos={campos} />
      ) : null}
      <Retorno estado={estado} />
      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Registrando"
        className="self-start"
      >
        Registrar o nascimento
      </Botao>
    </form>
  );
}

/** Previsão de alta depois do nascimento: só uma estimativa para a operação se planejar. */
export function FormularioPrevisaoAlta({
  familiaId,
  atual,
  minimo,
}: {
  familiaId: string;
  atual: string | null;
  minimo: string;
}) {
  const {
    estado,
    enviar: acao,
    pendente: enviando,
  } = useAcao(acaoRegistrarPrevisaoAlta, estadoInicialOperacao);
  return (
    <form
      onSubmit={acao}
      noValidate
      className="flex flex-col gap-4"
      data-form="previsao-alta"
    >
      <input type="hidden" name="familiaId" value={familiaId} />
      <CampoTexto
        rotulo="Previsão de alta"
        name="previsaoAlta"
        type="date"
        min={minimo}
        defaultValue={atual ?? undefined}
        required
        descricao="Estimativa. Ela não gera visitas: quem gera é a alta registrada."
        erro={estado.campos?.previsaoAlta}
      />
      <Retorno estado={estado} />
      <Botao
        type="submit"
        variante="secundario"
        carregando={enviando}
        rotuloCarregando="Guardando"
        className="self-start"
      >
        Guardar a previsão
      </Botao>
    </form>
  );
}

/**
 * Registro da alta (P36 item 4): ativa o acompanhamento e gera as visitas de
 * D1 a D6 ou D12 no mesmo período. Por padrão o D1 é o dia seguinte à alta;
 * a coordenação pode combinar outro primeiro dia com a família.
 */
export function FormularioAlta({
  familiaId,
  dataNascimento,
  hoje,
  dias,
  periodoPadrao,
}: {
  familiaId: string;
  dataNascimento: string;
  hoje: string;
  /** 6 ou 12, do pacote contratado. */
  dias: number;
  periodoPadrao: "manha" | "tarde" | null;
}) {
  const {
    estado,
    enviar: acao,
    pendente: enviando,
  } = useAcao(acaoRegistrarAlta, estadoInicialOperacao);
  const campos = estado.campos ?? {};
  return (
    <form
      onSubmit={acao}
      noValidate
      className="flex flex-col gap-4"
      data-form="alta"
    >
      <input type="hidden" name="familiaId" value={familiaId} />
      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-4">
        <CampoTexto
          rotulo="Data da alta"
          name="dataAlta"
          type="date"
          min={dataNascimento}
          max={hoje}
          required
          erro={campos.dataAlta}
        />
        <CampoTexto
          rotulo="Primeiro dia das visitas"
          name="primeiraVisita"
          type="date"
          opcional
          descricao="Se ficar em branco, o D1 é o dia seguinte à alta."
          erro={campos.primeiraVisita}
        />
      </div>
      <EscolhaUnica
        rotulo="Período das visitas"
        name="periodo"
        opcoes={[
          { valor: "manha", rotulo: "Manhã" },
          { valor: "tarde", rotulo: "Tarde" },
        ]}
        valorPadrao={periodoPadrao ?? undefined}
        descricao={`Todas as ${dias} visitas ficam no mesmo período. Sem escolha, vale a preferência da entrevista.`}
      />
      <Retorno estado={estado} />
      <Botao
        type="submit"
        carregando={enviando}
        rotuloCarregando="Registrando"
        className="self-start"
      >
        Registrar a alta
      </Botao>
    </form>
  );
}
