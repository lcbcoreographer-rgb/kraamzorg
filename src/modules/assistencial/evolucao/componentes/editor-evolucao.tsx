"use client";

import * as React from "react";
import { useActionState } from "react";
import { FileText, Send } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import type { EvolucaoDetalhe } from "@/lib/dados/tipos-evolucao";
import { formatarDataHora } from "@/lib/formatacao";
import type { ConteudoEvolucao } from "@/lib/pdf";
import {
  acaoAprovarEEnviar,
  acaoDevolverEvolucao,
  acaoEnviarParaRevisao,
  acaoReenviarEvolucao,
  acaoSalvarEvolucao,
} from "../acoes";
import type { CampoEditavel, Dados } from "../campos";
import { ROTULO_STATUS, VARIANTE_STATUS } from "../documento";
import {
  estadoInicialEvolucao,
  type EstadoAcaoEvolucao,
} from "../estado-acoes";
import { CampoEvolucao } from "./campo-evolucao";
import { PreviaConteudo } from "./previa-conteudo";

/**
 * Um documento da evolução (P41): o que falta, o que a enfermeira confirma, o
 * que a coordenação revisa e o que sai para o médico. Mobile primeiro: uma
 * coluna, botões de 44 px, e o salvamento devolve a lista de pontos a corrigir
 * no topo, onde a pessoa está olhando.
 */

interface Props {
  detalhe: EvolucaoDetalhe;
  rotulo: string;
  campos: CampoEditavel[];
  dados: Dados;
  ehCoordenacao: boolean;
  /** Caminho do PDF (com ?previa=1 quando ainda não foi enviado). */
  caminhoPdf: string;
  demonstracao: boolean;
}

/**
 * Envia o formulário sem o reinício automático de campos do React 19: se o
 * salvamento falhar (conflito de versão, ponto a corrigir), o que a pessoa
 * digitou continua na tela.
 */
function aoEnviar(acao: (dados: FormData) => void) {
  return (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    React.startTransition(() => acao(dados));
  };
}

function Mensagem({ estado }: { estado: EstadoAcaoEvolucao }) {
  if (estado.erro) {
    return (
      <FaixaAlerta variante="erro" titulo={estado.erro}>
        {estado.pontos && estado.pontos.length > 0 ? (
          <ul className="list-disc pl-5">
            {estado.pontos.map((ponto) => (
              <li key={ponto}>{ponto}</li>
            ))}
          </ul>
        ) : null}
      </FaixaAlerta>
    );
  }
  if (estado.sucesso) {
    return <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />;
  }
  return null;
}

export function EditorEvolucao({
  detalhe,
  rotulo,
  campos,
  dados,
  ehCoordenacao,
  caminhoPdf,
  demonstracao,
}: Props) {
  const [estadoSalvar, salvar, salvando] = useActionState(
    acaoSalvarEvolucao,
    estadoInicialEvolucao,
  );
  const [estadoDevolver, devolver, devolvendo] = useActionState(
    acaoDevolverEvolucao,
    estadoInicialEvolucao,
  );
  const [estadoAcao, definirEstadoAcao] = React.useState<EstadoAcaoEvolucao>(
    estadoInicialEvolucao,
  );
  const [ocupado, iniciar] = React.useTransition();
  const [devolvendoAberto, definirDevolvendoAberto] = React.useState(false);

  function executar(acao: () => Promise<EstadoAcaoEvolucao>) {
    definirEstadoAcao(estadoInicialEvolucao);
    iniciar(async () => {
      definirEstadoAcao(await acao());
    });
  }

  const pontos = detalhe.errosValidacao;
  const completar = campos.filter((c) => c.grupo === "completar");
  const julgamento = campos.filter((c) => c.grupo === "julgamento");
  const conteudo = detalhe.conteudo.conteudo as ConteudoEvolucao | null;
  const bloqueado = !detalhe.podeEditar;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Selo variante={VARIANTE_STATUS[detalhe.status]}>
          {ROTULO_STATUS[detalhe.status]}
        </Selo>
        <span className="text-apoio text-texto-2">
          {rotulo}, versão {detalhe.versao}
          {detalhe.profissionalNome ? `, com ${detalhe.profissionalNome}` : ""}
        </span>
        {detalhe.enviadoEm ? (
          <span className="text-apoio text-texto-2">
            Enviada em{" "}
            <span className="font-mono">
              {formatarDataHora(detalhe.enviadoEm)}
            </span>
            .
          </span>
        ) : null}
      </div>

      {detalhe.notaRevisao && detalhe.status === "rascunho" ? (
        <FaixaAlerta
          variante="prioritario"
          titulo="A coordenação devolveu com um recado"
        >
          {detalhe.notaRevisao}
        </FaixaAlerta>
      ) : null}

      {detalhe.status === "erro_envio" ? (
        <FaixaAlerta
          variante="erro"
          titulo="O e-mail não saiu"
          acoes={
            detalhe.podeReenviar ? (
              <Botao
                className="max-w-full text-balance whitespace-normal"
                tamanho="compacto"
                iconeEsquerda={<Send className="size-4" aria-hidden="true" />}
                carregando={ocupado}
                rotuloCarregando="Reenviando"
                onClick={() => executar(() => acaoReenviarEvolucao(detalhe.id))}
              >
                Reenviar aos médicos
              </Botao>
            ) : null
          }
        >
          {detalhe.erroEnvio ??
            "O envio não terminou. Reenvie em alguns minutos."}
        </FaixaAlerta>
      ) : null}

      {pontos.length > 0 ? (
        <FaixaAlerta
          variante="prioritario"
          titulo="Falta corrigir antes de seguir"
          meta="Enquanto houver pontos aqui, o documento não vai para a revisão nem para a aprovação."
        >
          <ul className="list-disc pl-5">
            {pontos.map((ponto) => (
              <li key={ponto}>{ponto}</li>
            ))}
          </ul>
        </FaixaAlerta>
      ) : null}

      <Mensagem estado={estadoSalvar} />

      {!bloqueado ? (
        <form
          key={detalhe.versao}
          onSubmit={aoEnviar(salvar)}
          className="flex flex-col gap-6"
          noValidate
        >
          <input type="hidden" name="relatorioId" value={detalhe.id} />
          <input type="hidden" name="versao" value={detalhe.versao} />

          {completar.length > 0 ? (
            <section
              aria-labelledby="grupo-completar"
              className="rounded-3 bg-superficie shadow-1 flex flex-col gap-5 p-5"
            >
              <div>
                <h2
                  id="grupo-completar"
                  className="text-3 text-texto font-semibold"
                >
                  O que o checklist não registra
                </h2>
                <p className="text-apoio text-texto-2 mt-1">
                  Estes dados não vieram do checklist nem do cadastro. Preencha
                  com o que você viu no período.
                </p>
              </div>
              {completar.map((campo) => (
                <CampoEvolucao
                  key={campo.caminho}
                  campo={campo}
                  dados={dados}
                  desabilitado={false}
                />
              ))}
            </section>
          ) : null}

          <section
            aria-labelledby="grupo-julgamento"
            className="rounded-3 bg-superficie shadow-1 flex flex-col gap-5 p-5"
          >
            <div>
              <h2
                id="grupo-julgamento"
                className="text-3 text-texto font-semibold"
              >
                Conclusão e julgamento clínico
              </h2>
              <p className="text-apoio text-texto-2 mt-1">
                O que o período mostrou já vem sugerido. Confirme ou troque; a
                conclusão é conferida contra os achados antes de seguir.
              </p>
            </div>
            {julgamento.map((campo) => (
              <CampoEvolucao
                key={campo.caminho}
                campo={campo}
                dados={dados}
                desabilitado={false}
              />
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Botao
              className="max-w-full text-balance whitespace-normal"
              type="submit"
              variante="secundario"
              carregando={salvando}
              rotuloCarregando="Salvando"
            >
              Salvar o documento
            </Botao>
            <span className="text-apoio text-texto-2">
              Salvar não envia nada: o documento só sai depois da aprovação.
            </span>
          </div>
        </form>
      ) : (
        <FaixaAlerta
          variante="info"
          titulo="Este documento não pode ser editado agora"
        >
          {detalhe.status === "em_revisao"
            ? "Ele está com a coordenação para revisão. Se ela devolver, o recado aparece aqui e você volta a editar."
            : "Ele já foi aprovado e não muda mais. Se algo estiver errado, fale com a diretoria."}
        </FaixaAlerta>
      )}

      <Mensagem estado={estadoAcao} />

      <section
        aria-labelledby="grupo-acoes"
        className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
      >
        <h2 id="grupo-acoes" className="text-3 text-texto font-semibold">
          Próximo passo
        </h2>
        <div className="flex flex-wrap gap-3">
          {detalhe.status === "rascunho" ? (
            <Botao
              className="max-w-full text-balance whitespace-normal"
              disabled={!detalhe.podeEnviarRevisao}
              carregando={ocupado}
              rotuloCarregando="Enviando"
              iconeEsquerda={<Send className="size-4" aria-hidden="true" />}
              onClick={() =>
                executar(() =>
                  acaoEnviarParaRevisao(detalhe.id, detalhe.versao),
                )
              }
            >
              Enviar para a revisão da coordenação
            </Botao>
          ) : null}
          {ehCoordenacao && detalhe.status === "em_revisao" ? (
            <>
              <Botao
                className="max-w-full text-balance whitespace-normal"
                disabled={!detalhe.podeAprovar}
                carregando={ocupado}
                rotuloCarregando="Aprovando e enviando"
                iconeEsquerda={<Send className="size-4" aria-hidden="true" />}
                onClick={() =>
                  executar(() => acaoAprovarEEnviar(detalhe.id, detalhe.versao))
                }
              >
                Aprovar e enviar ao médico
              </Botao>
              <Botao
                className="max-w-full text-balance whitespace-normal"
                variante="secundario"
                onClick={() => definirDevolvendoAberto((aberto) => !aberto)}
                aria-expanded={devolvendoAberto}
              >
                Devolver com recado
              </Botao>
            </>
          ) : null}
          {conteudo ? (
            <Botao
              className="max-w-full text-balance whitespace-normal"
              asChild
              variante="secundario"
              iconeEsquerda={<FileText className="size-4" aria-hidden="true" />}
            >
              <a href={caminhoPdf} target="_blank" rel="noreferrer noopener">
                {detalhe.temPdf ? "Abrir o PDF enviado" : "Ver como PDF"}
              </a>
            </Botao>
          ) : null}
        </div>
        {detalhe.status === "rascunho" && !detalhe.podeEnviarRevisao ? (
          <p className="text-apoio text-texto-2">
            {pontos.length > 0
              ? "Corrija os pontos acima e salve; depois o botão de revisão libera."
              : "Salve o documento para liberar o envio à revisão."}
          </p>
        ) : null}
        {ehCoordenacao &&
        detalhe.status === "em_revisao" &&
        !detalhe.podeAprovar ? (
          <p className="text-apoio text-texto-2">
            A aprovação libera quando o documento não tem pontos a corrigir.
          </p>
        ) : null}
        {demonstracao ? (
          <p className="text-apoio text-texto-2">
            Na demonstração o e-mail não sai: ele cai na caixa de saída local.
          </p>
        ) : null}

        {devolvendoAberto && ehCoordenacao ? (
          <form onSubmit={aoEnviar(devolver)} className="flex flex-col gap-3">
            <input type="hidden" name="relatorioId" value={detalhe.id} />
            <CampoTexto
              rotulo="Recado para a enfermeira"
              name="motivo"
              multilinha
              linhas={3}
              maxLength={1000}
              descricao="Diga o que ajustar. O recado aparece no topo do documento dela."
            />
            <Mensagem estado={estadoDevolver} />
            <div>
              <Botao
                className="max-w-full text-balance whitespace-normal"
                type="submit"
                variante="secundario"
                carregando={devolvendo}
                rotuloCarregando="Devolvendo"
              >
                Devolver para a enfermeira
              </Botao>
            </div>
          </form>
        ) : null}
      </section>

      {conteudo ? (
        <details className="rounded-3 bg-superficie shadow-1 p-5" open>
          <summary className="text-3 text-texto min-h-toque cursor-pointer font-semibold">
            Como o médico vai ler
          </summary>
          <div className="pt-4">
            <PreviaConteudo conteudo={conteudo} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
