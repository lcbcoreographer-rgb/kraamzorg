"use client";

import * as React from "react";
import { useFormularioSemReset } from "@/modules/relacao/usar-formulario";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { Plus } from "lucide-react";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { CanaisMarketing, CanalCaptacao } from "@/lib/dados/tipos-relacao";
import { CampoSelecao } from "@/modules/configuracoes/componentes/campo-selecao";
import { BotaoCopiar } from "@/modules/relacao/botao-copiar";
import { estadoInicialRelacao } from "@/modules/relacao/frases";
import { ORIGENS_DE_CANAL, ROTULO_ORIGEM } from "@/modules/relacao/rotulos";
import { acaoSalvarCanal } from "../acoes";
import { codigoDeOrigem, linkDaPagina, linkWhatsAppDoCanal } from "../links";

function CartaoCanal({
  canais,
  canal,
  enderecoBase,
}: {
  canais: CanaisMarketing;
  canal: CanalCaptacao;
  enderecoBase: string;
}) {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarCanal,
    estadoInicialRelacao,
  );
  const pagina = linkDaPagina(enderecoBase, canal.codigo);
  const whatsapp = linkWhatsAppDoCanal(canais, canal);
  return (
    <li
      className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5"
      data-canal={canal.codigo}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-titulo text-2 text-texto font-medium">
          {canal.nome}
        </h3>
        <span className="rounded-pilula bg-areia-clara text-apoio text-texto px-2.5 py-0.5 font-mono">
          {codigoDeOrigem(canais.prefixo, canal.codigo)}
        </span>
        <Selo variante={canal.ativo ? "sucesso" : "neutro"}>
          {canal.ativo ? "Ativo" : "Desativado"}
        </Selo>
        <Selo variante="contorno">{ROTULO_ORIGEM[canal.origem]}</Selo>
      </div>
      <p className="text-apoio text-texto-2">
        {canal.visitas}{" "}
        {canal.visitas === 1 ? "visita à página" : "visitas à página"} e{" "}
        {canal.conversas}{" "}
        {canal.conversas === 1 ? "conversa iniciada" : "conversas iniciadas"}{" "}
        por este canal.
      </p>

      <div className="flex flex-col gap-3">
        <div className="rounded-2 bg-areia-clara flex flex-col gap-1 p-3">
          <span className="text-apoio text-texto font-semibold">
            Página de captação (com verificação e UTM)
          </span>
          <code className="text-apoio text-texto break-all">{pagina}</code>
          <BotaoCopiar
            texto={pagina}
            rotulo="Copiar página"
            rotuloAcessivel={`Copiar o endereço da página do canal ${canal.nome}`}
          />
        </div>
        <div className="rounded-2 bg-areia-clara flex flex-col gap-1 p-3">
          <span className="text-apoio text-texto font-semibold">
            Link direto do WhatsApp (código no texto)
          </span>
          {whatsapp ? (
            <>
              <code className="text-apoio text-texto break-all">
                {whatsapp}
              </code>
              <BotaoCopiar
                texto={whatsapp}
                rotulo="Copiar link"
                rotuloAcessivel={`Copiar o link do WhatsApp do canal ${canal.nome}`}
              />
            </>
          ) : (
            <p className="text-apoio text-texto-2">
              O número do WhatsApp ou o texto-modelo ainda não foi configurado.
              A diretoria ajusta em Configurações.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={acao} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={canal.id} />
        <input type="hidden" name="codigo" value={canal.codigo} />
        <input type="hidden" name="nome" value={canal.nome} />
        <input type="hidden" name="origem" value={canal.origem} />
        <input type="hidden" name="ativo" value={canal.ativo ? "nao" : "sim"} />
        <Botao
          type="submit"
          variante="fantasma"
          tamanho="compacto"
          carregando={salvando}
          rotuloCarregando="Salvando"
        >
          {canal.ativo ? "Desativar canal" : "Reativar canal"}
        </Botao>
        <span role="status" className="text-apoio text-texto-2">
          {estado.erro ?? estado.sucesso ?? ""}
        </span>
      </form>
    </li>
  );
}

function FormularioNovoCanal() {
  const [estado, acao, salvando] = useFormularioSemReset(
    acaoSalvarCanal,
    estadoInicialRelacao,
  );
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (estado.sucesso) ref.current?.reset();
  }, [estado]);
  return (
    <form
      ref={ref}
      onSubmit={acao}
      className="rounded-3 bg-dourado-claro flex max-w-[560px] flex-col gap-4 p-5 lg:p-6"
    >
      <h3 className="font-titulo text-2 text-texto flex items-center gap-3 font-medium">
        <TileIcone tom="dourado" forma="quadrado" tamanho="p">
          <Plus />
        </TileIcone>
        Novo canal
      </h3>
      <CampoTexto
        rotulo="Código"
        name="codigo"
        required
        maxLength={12}
        autoCapitalize="characters"
        descricao="De 3 a 12 letras maiúsculas ou números, sem espaço nem hífen. Depois de usado em um link, não muda mais."
      />
      <CampoTexto
        rotulo="Nome do canal"
        name="nome"
        required
        maxLength={80}
        descricao="Como a equipe vai reconhecer, por exemplo: Instagram, história de outubro."
      />
      <CampoSelecao
        rotulo="Origem que o canal grava na família"
        name="origem"
        defaultValue="instagram_organico"
        opcoes={ORIGENS_DE_CANAL.map((o) => ({
          valor: o,
          rotulo: ROTULO_ORIGEM[o],
        }))}
      />
      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo="O canal não foi salvo">
          {estado.erro}
        </FaixaAlerta>
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso}>
          O link já pode ser copiado abaixo.
        </FaixaAlerta>
      ) : null}
      <Botao
        type="submit"
        carregando={salvando}
        rotuloCarregando="Salvando"
        className="self-start"
      >
        Salvar canal
      </Botao>
    </form>
  );
}

export function GeradorLinks({
  canais,
  enderecoBase,
}: {
  canais: CanaisMarketing;
  enderecoBase: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {canais.canais.length === 0 ? (
        <p className="text-corpo text-texto-2 max-w-[60ch]">
          Ainda não há canais. Crie o primeiro abaixo: cada canal ganha um
          código que vai no texto da mensagem e diz de onde a família veio.
        </p>
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {canais.canais.map((canal) => (
            <CartaoCanal
              key={canal.id}
              canais={canais}
              canal={canal}
              enderecoBase={enderecoBase}
            />
          ))}
        </ul>
      )}
      <FormularioNovoCanal />
    </div>
  );
}
