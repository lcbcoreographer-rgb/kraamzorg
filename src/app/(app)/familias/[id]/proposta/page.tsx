import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { z } from "zod";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/formatacao";
import {
  hojeBrasilia,
  textoIdadeGestacional,
} from "@/modules/crm/pipeline/idade-gestacional";
import { rotuloEstagio } from "@/modules/crm/pipeline/estagios";
import { FormularioProposta } from "@/modules/crm/proposta/componentes/formulario-proposta";
import { PainelAprovacao } from "@/modules/crm/proposta/componentes/painel-aprovacao";
import { PainelFormulario } from "@/modules/crm/proposta/componentes/painel-formulario";
import {
  obterTelaProposta,
  type TelaProposta,
} from "@/modules/crm/proposta/dados";

// Título sem nome de família (DESIGN.md, microcopy 11).
export const metadata: Metadata = { title: "Proposta · Kraamzorg OS" };

/**
 * Proposta e formulário seguro (P30). Pacote vigente, condição da tabela,
 * taxa da cidade, quem paga e parcelas; aprovação da diretoria quando a
 * condição pede; e o link de uso único do formulário, entregue à família
 * pela tarefa com o texto formulario_contrato.
 */
export default async function PaginaProposta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const usuario = await exigirSessao("/familias");

  let tela: TelaProposta | null = null;
  try {
    tela = await obterTelaProposta(id, usuario);
  } catch {
    tela = null;
  }

  const voltar = (
    <Link
      href={`/familias/${id}?aba=comercial`}
      className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 pt-2 font-medium no-underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Ficha da família
    </Link>
  );

  if (!tela || tela.situacao !== "ok") {
    return (
      <>
        {voltar}
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
            Proposta
          </h1>
          {!tela ? (
            <FaixaAlerta variante="erro" titulo="A proposta não abriu agora">
              Confira a conexão e recarregue a página. Nada foi alterado.
            </FaixaAlerta>
          ) : tela.situacao === "mfa" ? (
            <div className="rounded-3 bg-superficie shadow-1 flex max-w-[560px] flex-col gap-3 p-5">
              <p className="text-corpo text-texto flex items-start gap-3">
                <LockKeyhole
                  className="text-texto-2 mt-1 size-4 shrink-0"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                A proposta mostra valores e dados do contrato, por isso pede o
                código do aplicativo (MFA) antes de abrir.
              </p>
              <Botao
                asChild
                variante="secundario"
                tamanho="compacto"
                className="self-start"
              >
                <Link
                  href={`${usuario.aalPossivel === "aal2" ? "/mfa/desafio" : "/mfa/cadastro"}?proximo=${encodeURIComponent(`/familias/${id}/proposta`)}`}
                >
                  Confirmar com o código
                </Link>
              </Botao>
            </div>
          ) : tela.situacao === "sem_oportunidade" ? (
            <EstadoVazio
              nivelTitulo="h2"
              titulo="Esta família não tem oportunidade aberta"
              texto="A proposta parte da oportunidade no pipeline. Quando houver uma aberta, ela aparece aqui."
            />
          ) : (
            <FaixaAlerta
              variante="info"
              titulo="A proposta desta família não está com o seu papel"
            >
              A proposta é do comercial e da diretoria. O financeiro vê a
              proposta quando o contrato existe.
            </FaixaAlerta>
          )}
        </div>
      </>
    );
  }

  const { proposta } = tela;
  const { familia, oportunidade, contrato } = proposta;
  const sensivel =
    familia.estadoSensivel === "bloqueio_total" ||
    familia.estadoSensivel === "encerrado_sensivel";
  const hoje = hojeBrasilia();
  const tempo = sensivel
    ? null
    : textoIdadeGestacional(familia.dpp, hoje, familia.dataNascimento);
  const estagio =
    oportunidade.pipeline === 2 && oportunidade.estagioP2
      ? rotuloEstagio(2, oportunidade.estagioP2)
      : oportunidade.estagioP1
        ? rotuloEstagio(1, oportunidade.estagioP1)
        : null;
  const aguardandoAprovacao =
    oportunidade.precisaAprovacao && !oportunidade.descontoAprovado;
  // A proposta só muda até a negociação (api.salvar_proposta recusa depois
  // com proposta_fechada); o link ainda pode ser gerado de novo em "Ganho".
  const propostaAberta =
    oportunidade.estagioP2 === null ||
    oportunidade.estagioP2 === "proposta_enviada" ||
    oportunidade.estagioP2 === "em_negociacao";
  const bloqueioLink = !contrato
    ? "Salve a proposta para gerar o link do formulário."
    : familia.naoContatar
      ? "A família pediu para não ser contatada. Nenhum link sai por aqui."
      : aguardandoAprovacao
        ? "O link sai depois da aprovação da diretoria."
        : null;

  const paineis = (
    <>
      {oportunidade.precisaAprovacao ? (
        <PainelAprovacao
          familiaId={familia.id}
          oportunidadeId={oportunidade.id}
          aprovado={oportunidade.descontoAprovado}
          aprovadoPor={oportunidade.descontoAprovadoPorNome}
          podeAprovar={proposta.podeAprovar}
        />
      ) : null}
      <PainelFormulario
        familiaId={familia.id}
        oportunidadeId={oportunidade.id}
        situacao={contrato?.formulario.situacao ?? null}
        expiraEm={contrato?.formulario.expiraEm ?? null}
        recebidoEm={contrato?.formulario.recebidoEm ?? null}
        validadeHoras={proposta.formularioValidadeHoras}
        bloqueio={bloqueioLink}
      />
    </>
  );

  return (
    <>
      {voltar}
      <div className="flex flex-col gap-6 pt-2">
        <header className="bg-superficie-2 -mx-4 flex flex-col gap-3 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8">
          <h1 className="font-titulo text-1 text-texto font-normal">
            Proposta para a {familia.nome}
          </h1>
          <div className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {estagio && !sensivel ? (
              <Selo variante="marinho">{estagio}</Selo>
            ) : null}
            {tempo ? (
              <span className="text-corpo text-texto font-mono">{tempo}</span>
            ) : null}
            {familia.dpp && !sensivel ? (
              <span>
                DPP{" "}
                <span className="font-mono">{formatarData(familia.dpp)}</span>{" "}
                <em>estimativa</em>
              </span>
            ) : null}
            {familia.cidade ? (
              <span>
                {familia.cidade.nome}, {familia.cidade.uf}
              </span>
            ) : null}
          </div>
        </header>

        {sensivel ? (
          <FaixaAlerta
            variante="sensivel"
            titulo="Esta família está com o freio acionado"
          >
            Nada comercial segue enquanto o freio estiver ativo: a proposta e o
            formulário ficam parados. O contato é da coordenação, pelo nome.
          </FaixaAlerta>
        ) : !proposta.podeEditar ? (
          <FaixaAlerta variante="info" titulo="Proposta em leitura">
            Só o comercial e a diretoria mudam a proposta.
          </FaixaAlerta>
        ) : (
          <FormularioProposta
            proposta={proposta}
            temContrato={Boolean(contrato)}
            fechada={!propostaAberta && Boolean(contrato)}
            lateral={paineis}
          />
        )}
      </div>
    </>
  );
}
