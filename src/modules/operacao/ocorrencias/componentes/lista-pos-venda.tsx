"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { FiltrosLista } from "@/components/ui/filtros-lista";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type { ListaPosVenda, PosVendaItem } from "@/lib/dados/tipos-ocorrencia";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import {
  acaoAvancarPosVenda,
  acaoGerarLinkPesquisa,
  acaoMarcarPesquisaEnviada,
} from "../acoes";
import {
  estadoInicialOcorrencia,
  type EstadoAcaoOcorrencia,
} from "../estado-acoes";
import {
  fraseProximoPasso,
  fraseResumoPosVenda,
  ROTULO_CLASSIFICACAO,
  ROTULO_ESTAGIO,
  VARIANTE_ESTAGIO,
} from "../rotulos-pos-venda";

/**
 * Pós-venda, pipeline 4 (P42, PRD 7.4): cada acompanhamento concluído com a
 * pesquisa, a nota e o próximo passo. A pesquisa é enviada pela coordenação,
 * por mensagem pessoal, com um link de uso único; a família responde na
 * página `/pesquisa/<código>`. Família em estado sensível ou que pediu para não
 * ser contatada não recebe pesquisa: o cartão diz isso e some o botão.
 */

function ItemPosVenda({ item }: { item: PosVendaItem }) {
  const [estado, definirEstado] = React.useState<EstadoAcaoOcorrencia>(
    estadoInicialOcorrencia,
  );
  const [ocupado, iniciar] = React.useTransition();
  const [copiado, definirCopiado] = React.useState(false);

  function executar(acao: () => Promise<EstadoAcaoOcorrencia>) {
    definirEstado(estadoInicialOcorrencia);
    definirCopiado(false);
    iniciar(async () => {
      const r = await acao();
      // o texto do link só vive na tela enquanto a pessoa copia; o token nunca é gravado
      definirEstado((antes) => ({ ...r, texto: r.texto ?? antes.texto }));
    });
  }

  async function copiar() {
    if (!estado.texto) return;
    try {
      await navigator.clipboard.writeText(estado.texto);
      definirCopiado(true);
    } catch {
      definirCopiado(false);
    }
  }

  const bloqueada = item.bloqueio !== null;

  return (
    <Cartao className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-titulo text-2 text-texto font-medium">
            {item.familiaNome}
          </h2>
          <p className="text-apoio text-texto-2">
            {item.pesquisaRespondidaEm ? (
              <>
                Respondida em{" "}
                <span className="font-mono">
                  {formatarDataHora(item.pesquisaRespondidaEm)}
                </span>
                .
              </>
            ) : item.pesquisaEnviadaEm ? (
              <>
                Enviada em{" "}
                <span className="font-mono">
                  {formatarDataHora(item.pesquisaEnviadaEm)}
                </span>
                {item.pesquisaExpiraEm ? (
                  <>
                    , o link vale até{" "}
                    <span className="font-mono">
                      {formatarData(item.pesquisaExpiraEm)}
                    </span>
                  </>
                ) : null}
                .
              </>
            ) : (
              "Ainda não enviada."
            )}
          </p>
        </div>
        <Selo variante={VARIANTE_ESTAGIO[item.estagio]}>
          {ROTULO_ESTAGIO[item.estagio]}
        </Selo>
      </div>

      {item.nps !== null ? (
        <p className="text-corpo text-texto">
          Nota <span className="font-mono">{item.nps}</span> de 10.
          {item.classificacao === "detrator"
            ? " A resposta virou uma ocorrência privada da coordenação, com contato pessoal e sem mensagem automática."
            : item.classificacao
              ? ` Classificação: ${ROTULO_CLASSIFICACAO[item.classificacao].toLowerCase()}.`
              : ""}
          {item.depoimentoAutorizado === true
            ? " Autorizou o uso do depoimento."
            : ""}
          {item.autorizacaoImagem === true
            ? " Autorizou o uso de imagens."
            : ""}
        </p>
      ) : (
        <p className="text-corpo text-texto">
          {fraseProximoPasso(item.estagio)}
        </p>
      )}
      {item.nps !== null ? (
        <p className="text-apoio text-texto-2">
          {fraseProximoPasso(item.estagio)}
        </p>
      ) : null}

      {bloqueada ? (
        <FaixaAlerta
          variante="sensivel"
          titulo={
            item.bloqueio === "freio"
              ? "A pesquisa desta família fica parada"
              : "Esta família pediu para não ser contatada"
          }
        >
          Nenhuma mensagem sai por aqui. Se a coordenação decidir procurar a
          família, o contato é pessoal e pelo nome.
        </FaixaAlerta>
      ) : null}

      {estado.erro ? (
        <FaixaAlerta variante="erro" titulo={estado.erro} />
      ) : null}
      {estado.sucesso ? (
        <FaixaAlerta variante="sucesso" titulo={estado.sucesso} />
      ) : null}
      {estado.texto ? (
        <div className="flex flex-col gap-3">
          <CampoTexto
            rotulo="Texto para a família"
            multilinha
            linhas={5}
            readOnly
            value={estado.texto}
            descricao="O link vale para uma resposta só e não aparece de novo depois que você sair desta tela."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Botao
              variante="secundario"
              tamanho="compacto"
              iconeEsquerda={
                <Copy
                  className="size-4 max-w-full text-balance whitespace-normal"
                  aria-hidden="true"
                />
              }
              onClick={copiar}
            >
              Copiar o texto
            </Botao>
            {copiado ? (
              <span className="text-apoio text-sucesso">
                Texto copiado. Cole na conversa com a família.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {item.podeGerarLink && !bloqueada ? (
          <Botao
            className="max-w-full text-balance whitespace-normal"
            variante={
              item.estagio === "pesquisa_enviada" ? "secundario" : "primario"
            }
            tamanho="compacto"
            carregando={ocupado}
            rotuloCarregando="Gerando"
            onClick={() => executar(() => acaoGerarLinkPesquisa(item.id))}
          >
            {item.linkAtivo ? "Gerar um novo link" : "Gerar o link da pesquisa"}
          </Botao>
        ) : null}
        {item.estagio === "protocolo_ultimo_dia_concluido" && item.linkAtivo ? (
          <Botao
            className="max-w-full text-balance whitespace-normal"
            tamanho="compacto"
            carregando={ocupado}
            rotuloCarregando="Marcando"
            onClick={() => executar(() => acaoMarcarPesquisaEnviada(item.id))}
          >
            Marcar como enviada
          </Botao>
        ) : null}
        {item.estagio === "classificado" ||
        item.estagio === "acao_executada" ? (
          <Botao
            className="max-w-full text-balance whitespace-normal"
            tamanho="compacto"
            variante={
              item.estagio === "classificado" ? "primario" : "secundario"
            }
            carregando={ocupado}
            rotuloCarregando="Salvando"
            onClick={() => executar(() => acaoAvancarPosVenda(item.id))}
          >
            {item.estagio === "classificado"
              ? "Marcar a ação como feita"
              : "Arquivar"}
          </Botao>
        ) : null}
      </div>
    </Cartao>
  );
}

export function ListaPosVendaTela({
  lista,
  situacao,
}: {
  lista: ListaPosVenda;
  situacao: "abertos" | "todos";
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-corpo text-texto max-w-[60ch]">
        {fraseResumoPosVenda(lista.resumo)}
      </p>
      <FiltrosLista
        rotulo="Filtrar pós-venda"
        itens={[
          {
            rotulo: "Em aberto",
            href: "/pos-venda",
            ativo: situacao === "abertos",
          },
          {
            rotulo: "Todos",
            href: "/pos-venda?situacao=todos",
            ativo: situacao === "todos",
          },
        ]}
      />
      {lista.itens.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          titulo="Nenhum pós-venda em andamento"
          texto="Quando uma família terminar o último dia contratado, o pós-venda dela abre aqui com a pesquisa a enviar."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {lista.itens.map((item) => (
            <li key={item.id}>
              <ItemPosVenda item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
