"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import {
  IndicadorSincronizacao,
  type EstadoSincronizacao,
} from "@/components/ui/indicador-sincronizacao";
import { formatarDataHora } from "@/lib/formatacao";
import { criarBancoOffline, type BancoOffline } from "@/lib/sync/db";
import {
  salvarCampo,
  processarFila,
  iniciarMotorSincronizacao,
  type ResumoProcessamento,
} from "@/lib/sync/motor";
import { encerrarSessaoOffline, limparCacheDoDia } from "@/lib/sync/cache";
import type { Entidade, EstadoItemFila, ItemFila } from "@/lib/sync/tipos";

const USUARIO_DEMO = "dev-demo-usuario";

const ENTIDADES: Entidade[] = [
  "visita",
  "consulta_prenatal",
  "anexo_audio",
  "alerta_clinico",
  "registro_atendimento",
];

function estadoParaIndicador(estado: EstadoItemFila): EstadoSincronizacao {
  switch (estado) {
    case "rascunho_local":
      return "local";
    case "enviando":
      return "enviando";
    case "sincronizado":
      return "sincronizado";
    case "conflito":
    case "erro":
      return "erro";
  }
}

function textoDoEstado(item: ItemFila): string {
  switch (item.estado) {
    case "rascunho_local":
      return "Salvo no aparelho, aguardando envio";
    case "enviando":
      return "Enviando";
    case "sincronizado":
      return "Sincronizado";
    case "conflito":
      return "Conflito: alguém mais atualizou este campo antes";
    case "erro":
      return `Não enviou${item.tentativas > 0 ? ` (tentativa ${item.tentativas})` : ""}. Tentamos de novo em instantes.`;
  }
}

/**
 * Demonstração manual do motor offline (P12 item 5), fora do ar em
 * produção. Não é a tela real da enfermeira (isso é do P38 em diante):
 * aqui dá para salvar um campo qualquer, ver a fila em tempo real, forçar
 * a sincronização e observar conflito e adendo com dados de mentira.
 */
export function DemonstracaoSync() {
  // Ref, não estado: o banco Dexie é um objeto estável por sessão de tela
  // (um "sistema externo", no sentido do react-hooks/set-state-in-effect),
  // não algo que a interface precisa recalcular a cada render.
  const bancoRef = React.useRef<BancoOffline | null>(null);
  const [itens, definirItens] = React.useState<ItemFila[]>([]);
  const [resumo, definirResumo] = React.useState<ResumoProcessamento | null>(
    null,
  );
  const [online, definirOnline] = React.useState(true);

  const [entidade, definirEntidade] = React.useState<Entidade>("visita");
  const [entidadeId, definirEntidadeId] = React.useState("");
  const [campo, definirCampo] = React.useState("observacoes");
  const [valor, definirValor] = React.useState("");
  const [versaoBase, definirVersaoBase] = React.useState("");

  const recarregarItens = React.useCallback(async (db: BancoOffline) => {
    const todos = await db.fila.toArray();
    todos.sort(
      (a, b) =>
        Date.parse(a.criadoNoClienteEm) - Date.parse(b.criadoNoClienteEm),
    );
    definirItens(todos);
  }, []);

  React.useEffect(() => {
    const instancia = criarBancoOffline();
    bancoRef.current = instancia;

    const atualizarOnline = () => definirOnline(navigator.onLine);
    window.addEventListener("online", atualizarOnline);
    window.addEventListener("offline", atualizarOnline);

    const pararMotor = iniciarMotorSincronizacao(instancia, {
      intervaloMs: 2_000,
    });

    // As duas linhas abaixo atualizam estado da tela a partir de um sistema
    // externo (o navegador e o IndexedDB): por isso rodam dentro de um
    // temporizador, não direto no corpo do efeito (react-hooks/set-state-in-effect
    // só aceita setState em efeito dentro de um retorno de chamada, não
    // síncrono no corpo).
    const tick = () => {
      atualizarOnline();
      void recarregarItens(instancia);
    };
    const primeiraLeitura = window.setTimeout(tick, 0);
    const intervalo = window.setInterval(tick, 1_000);

    return () => {
      window.removeEventListener("online", atualizarOnline);
      window.removeEventListener("offline", atualizarOnline);
      window.clearTimeout(primeiraLeitura);
      window.clearInterval(intervalo);
      pararMotor();
    };
  }, [recarregarItens]);

  async function aoSalvarCampo(evento: React.FormEvent) {
    evento.preventDefault();
    const banco = bancoRef.current;
    if (!banco) return;

    await salvarCampo(banco, {
      usuarioId: USUARIO_DEMO,
      entidade,
      entidadeId: entidadeId.trim() === "" ? null : entidadeId.trim(),
      campo,
      valor,
      versaoBase: versaoBase.trim() === "" ? null : Number(versaoBase),
    });

    definirValor("");
    await recarregarItens(banco);
  }

  async function aoSincronizarAgora() {
    const banco = bancoRef.current;
    if (!banco) return;
    const resultado = await processarFila(banco);
    definirResumo(resultado);
    await recarregarItens(banco);
  }

  async function aoEncerrarSessao() {
    const banco = bancoRef.current;
    if (!banco) return;
    await encerrarSessaoOffline(banco, () => processarFila(banco));
    await recarregarItens(banco);
  }

  async function aoLimparTudo() {
    const banco = bancoRef.current;
    if (!banco) return;
    await banco.fila.clear();
    await banco.rascunhos.clear();
    await limparCacheDoDia(banco);
    definirResumo(null);
    await recarregarItens(banco);
  }

  return (
    <main className="max-w-conteudo mx-auto flex flex-col gap-8 px-4 pt-8 pb-24 lg:px-8 lg:pt-12">
      <header className="flex flex-col gap-3">
        <p className="text-mini text-texto-2 font-mono">
          /dev/sync · fora do ar em produção
        </p>
        <h1 className="font-titulo text-display text-texto lg:text-display-lg">
          Motor offline
        </h1>
        <p className="text-corpo text-texto-2 max-w-[64ch]">
          Salvar grava no IndexedDB do aparelho e entra na fila no mesmo
          instante (PRD 15). Desligue a rede do navegador para ver o item ficar
          &ldquo;salvo no aparelho&rdquo; e religue para ver a sincronização.
        </p>
        <div>
          <Selo variante={online ? "sucesso" : "aviso"}>
            {online ? "navegator.onLine: online" : "navegator.onLine: offline"}
          </Selo>
        </div>
      </header>

      <Cartao>
        <h2 className="text-3 text-texto mb-4 font-semibold">
          Salvar um campo
        </h2>
        <form
          onSubmit={(evento) => void aoSalvarCampo(evento)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="campo-entidade"
              className="text-apoio text-texto font-medium"
            >
              Entidade
            </label>
            <select
              id="campo-entidade"
              value={entidade}
              onChange={(evento) =>
                definirEntidade(evento.target.value as Entidade)
              }
              className="rounded-2 border-borda-campo bg-superficie text-corpo text-texto min-h-toque-campo border px-4"
            >
              {ENTIDADES.map((valorEntidade) => (
                <option key={valorEntidade} value={valorEntidade}>
                  {valorEntidade}
                </option>
              ))}
            </select>
          </div>
          <CampoTexto
            id="campo-entidade-id"
            rotulo="Id da entidade"
            descricao="Vazio cria um registro novo. Em registro_atendimento é o visita_id."
            value={entidadeId}
            onChange={(evento) => definirEntidadeId(evento.target.value)}
          />
          <CampoTexto
            id="campo-nome-campo"
            rotulo="Campo"
            value={campo}
            onChange={(evento) => definirCampo(evento.target.value)}
          />
          <CampoTexto
            id="campo-valor"
            rotulo="Valor"
            value={valor}
            onChange={(evento) => definirValor(evento.target.value)}
          />
          <CampoTexto
            id="campo-versao-base"
            rotulo="Versão base"
            descricao="Vazio = criação. A versão que este aparelho tinha, ao editar."
            value={versaoBase}
            onChange={(evento) => definirVersaoBase(evento.target.value)}
          />
          <div className="flex items-end">
            <Botao type="submit" data-testid="botao-salvar-campo">
              Salvar campo
            </Botao>
          </div>
        </form>
      </Cartao>

      <Cartao>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3 text-texto font-semibold">
            Fila de sincronização
          </h2>
          <div className="flex gap-2">
            <Botao
              type="button"
              variante="secundario"
              data-testid="botao-sincronizar-agora"
              onClick={() => void aoSincronizarAgora()}
            >
              Sincronizar agora
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => void aoEncerrarSessao()}
            >
              Encerrar sessão
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => void aoLimparTudo()}
            >
              Limpar tudo
            </Botao>
          </div>
        </div>

        {resumo ? (
          <p className="text-apoio text-texto-2 mb-4">
            Última sincronização: {resumo.sincronizados} sincronizado(s),{" "}
            {resumo.conflitos} em conflito, {resumo.erros} com erro,{" "}
            {resumo.pendentesRestantes} ainda pendente(s).
          </p>
        ) : null}

        {itens.length === 0 ? (
          <p className="text-apoio text-texto-2">Nenhum item na fila.</p>
        ) : (
          <ul data-testid="lista-fila" className="flex flex-col gap-3">
            {itens.map((item) => (
              <li
                key={item.id}
                data-testid={`item-fila-${item.id}`}
                data-estado={item.estado}
                className="border-linha rounded-2 flex flex-col gap-2 border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-apoio text-texto font-mono">
                    {item.entidade}
                    {item.entidadeId ? ` · ${item.entidadeId}` : " · (novo)"}
                    {item.campo ? ` · ${item.campo}` : ""}
                  </span>
                  <IndicadorSincronizacao
                    estado={estadoParaIndicador(item.estado)}
                    texto={textoDoEstado(item)}
                    aoTentarNovamente={
                      item.estado === "erro"
                        ? () => void aoSincronizarAgora()
                        : undefined
                    }
                    rotuloTentarNovamente="Tentar agora"
                  />
                </div>
                <p className="text-apoio text-texto-2 font-mono">
                  {JSON.stringify(item.payload)} · criado em{" "}
                  {formatarDataHora(item.criadoNoClienteEm)}
                </p>
                {item.conflito ? (
                  <p className="text-apoio text-alerta">
                    Original preservado no servidor (versão{" "}
                    {item.conflito.versaoAtual}):{" "}
                    {JSON.stringify(item.conflito.original)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </main>
  );
}
